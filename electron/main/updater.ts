import { app, BrowserWindow } from "electron";
import electronUpdater, {
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from "electron-updater";
import type { AppInfo, UpdateState } from "../../src/types";

const { autoUpdater } = electronUpdater;

const UPDATE_EVENT_CHANNEL = "app:update-state";

function normalizeReleaseNotes(releaseNotes: UpdateInfo["releaseNotes"]): string | null {
  if (!releaseNotes) {
    return null;
  }

  if (typeof releaseNotes === "string") {
    return releaseNotes.trim() || null;
  }

  return releaseNotes
    .map((entry) => entry.note?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

function buildUnsupportedState(): UpdateState {
  return {
    status: "unsupported",
    message: "In-app updates are currently available only in packaged macOS builds.",
    availableVersion: null,
    downloadedVersion: null,
    releaseDate: null,
    releaseNotes: null,
    progressPercent: null,
    bytesPerSecond: null,
    transferredBytes: null,
    totalBytes: null,
  };
}

export function isAutoUpdateSupported() {
  return process.platform === "darwin" && app.isPackaged;
}

export class AppUpdaterService {
  private state: UpdateState = isAutoUpdateSupported()
    ? {
        status: "idle",
        message: "Automatic updates are ready.",
        availableVersion: null,
        downloadedVersion: null,
        releaseDate: null,
        releaseNotes: null,
        progressPercent: null,
        bytesPerSecond: null,
        transferredBytes: null,
        totalBytes: null,
      }
    : buildUnsupportedState();

  private hasConfigured = false;

  private hasScheduledLaunchCheck = false;

  constructor() {
    if (isAutoUpdateSupported()) {
      this.configure();
    }
  }

  getAppInfo(): AppInfo {
    return {
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    };
  }

  getState() {
    return this.state;
  }

  async checkForUpdates() {
    if (!isAutoUpdateSupported()) {
      this.updateState(buildUnsupportedState());
      return;
    }

    await autoUpdater.checkForUpdates();
  }

  async downloadUpdate() {
    if (!isAutoUpdateSupported()) {
      this.updateState(buildUnsupportedState());
      return;
    }

    if (this.state.status !== "available") {
      return;
    }

    await autoUpdater.downloadUpdate();
  }

  quitAndInstall() {
    if (!isAutoUpdateSupported()) {
      return;
    }

    if (this.state.status !== "downloaded") {
      return;
    }

    autoUpdater.quitAndInstall();
  }

  scheduleStartupCheck() {
    if (!isAutoUpdateSupported() || this.hasScheduledLaunchCheck) {
      return;
    }

    this.hasScheduledLaunchCheck = true;
    void this.checkForUpdates().catch((error) => {
      this.handleError(error);
    });
  }

  private configure() {
    if (this.hasConfigured) {
      return;
    }

    this.hasConfigured = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.fullChangelog = false;

    autoUpdater.on("checking-for-update", () => {
      this.updateState({
        status: "checking",
        message: "Checking GitHub Releases for a newer macOS build.",
        availableVersion: null,
        downloadedVersion: null,
        releaseDate: null,
        releaseNotes: null,
        progressPercent: null,
        bytesPerSecond: null,
        transferredBytes: null,
        totalBytes: null,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      this.updateState({
        status: "up-to-date",
        message: "You already have the latest stable release installed.",
        availableVersion: info.version,
        downloadedVersion: null,
        releaseDate: info.releaseDate ?? null,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        progressPercent: null,
        bytesPerSecond: null,
        transferredBytes: null,
        totalBytes: null,
      });
    });

    autoUpdater.on("update-available", (info) => {
      this.updateState(this.buildAvailableState(info));
    });

    autoUpdater.on("download-progress", (progress) => {
      this.updateState(this.buildDownloadingState(progress));
    });

    autoUpdater.on("update-downloaded", (event) => {
      this.updateState(this.buildDownloadedState(event));
    });

    autoUpdater.on("error", (error, message) => {
      const fullMessage = [message, error.message].filter(Boolean).join(": ");
      this.updateState({
        ...this.state,
        status: "error",
        message: fullMessage || "The update check failed.",
        progressPercent: null,
        bytesPerSecond: null,
      });
    });
  }

  private buildAvailableState(info: UpdateInfo): UpdateState {
    return {
      status: "available",
      message: `Version ${info.version} is available to download.`,
      availableVersion: info.version,
      downloadedVersion: null,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      progressPercent: null,
      bytesPerSecond: null,
      transferredBytes: null,
      totalBytes: null,
    };
  }

  private buildDownloadingState(progress: ProgressInfo): UpdateState {
    return {
      ...this.state,
      status: "downloading",
      message: `Downloading version ${this.state.availableVersion ?? "update"}...`,
      progressPercent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferredBytes: progress.transferred,
      totalBytes: progress.total,
    };
  }

  private buildDownloadedState(event: UpdateDownloadedEvent): UpdateState {
    return {
      status: "downloaded",
      message: `Version ${event.version} has been downloaded and is ready to install.`,
      availableVersion: event.version,
      downloadedVersion: event.version,
      releaseDate: event.releaseDate ?? null,
      releaseNotes: normalizeReleaseNotes(event.releaseNotes),
      progressPercent: 100,
      bytesPerSecond: null,
      transferredBytes: null,
      totalBytes: null,
    };
  }

  private handleError(error: unknown) {
    const message = error instanceof Error ? error.message : "The update check failed.";

    this.updateState({
      ...this.state,
      status: "error",
      message,
    });
  }

  private updateState(nextState: UpdateState) {
    this.state = nextState;
    this.broadcastState();
  }

  private broadcastState() {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(UPDATE_EVENT_CHANNEL, this.state);
    }
  }
}

export { UPDATE_EVENT_CHANNEL };
