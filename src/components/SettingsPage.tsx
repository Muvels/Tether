import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CheckIcon,
  DownloadIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  InfoIcon,
  LoaderCircleIcon,
  MaximizeIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SunIcon,
} from "lucide-react";
import {
  useUiStore,
  type ThemePreference,
} from "@/store/useUiStore";
import type { AppInfo, UpdateState } from "@/types";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Match your operating system",
    icon: <MonitorIcon className="h-3.5 w-3.5" />,
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme",
    icon: <SunIcon className="h-3.5 w-3.5" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme",
    icon: <MoonIcon className="h-3.5 w-3.5" />,
  },
];

function SettingsRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/40 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span className="flex-1">{title}</span>
    </div>
  );
}

const INITIAL_UPDATE_STATE: UpdateState = {
  status: "idle",
  message: "Loading updater status...",
  availableVersion: null,
  downloadedVersion: null,
  releaseDate: null,
  releaseNotes: null,
  progressPercent: null,
  bytesPerSecond: null,
  transferredBytes: null,
  totalBytes: null,
};

function formatBytes(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes)) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(bytes / 1024 / 1024);
}

function formatReleaseDate(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const parsedDate = new Date(releaseDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const autoFitPdfOnSidebarToggle = useUiStore(
    (s) => s.autoFitPdfOnSidebarToggle,
  );
  const setAutoFitPdfOnSidebarToggle = useUiStore(
    (s) => s.setAutoFitPdfOnSidebarToggle,
  );
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>(INITIAL_UPDATE_STATE);
  const [isUpdateActionPending, setIsUpdateActionPending] = useState(false);

  const activeTheme =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];

  const handleOpenSavedFiles = useCallback(async () => {
    try {
      await window.desktopApi.openSavedFilesDirectory();
    } catch (error) {
      console.error("Failed to open saved files directory", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void window.desktopApi.getAppInfo().then((info) => {
      if (isMounted) {
        setAppInfo(info);
      }
    });

    const unsubscribe = window.desktopApi.onUpdateStateChanged((state) => {
      if (isMounted) {
        setUpdateState(state);
        if (state.status !== "checking" && state.status !== "downloading") {
          setIsUpdateActionPending(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const releaseDateLabel = useMemo(
    () => formatReleaseDate(updateState.releaseDate),
    [updateState.releaseDate],
  );
  const downloadProgressLabel = useMemo(() => {
    if (updateState.status !== "downloading" || updateState.progressPercent == null) {
      return null;
    }

    const transferred = formatBytes(updateState.transferredBytes);
    const total = formatBytes(updateState.totalBytes);
    const progress = `${Math.round(updateState.progressPercent)}%`;

    if (transferred && total) {
      return `${progress} downloaded (${transferred} of ${total})`;
    }

    return progress;
  }, [updateState]);
  const canCheckForUpdates = !isUpdateActionPending
    && updateState.status !== "checking"
    && updateState.status !== "downloading"
    && updateState.status !== "unsupported";

  const handleCheckForUpdates = useCallback(async () => {
    if (!canCheckForUpdates) return;

    setIsUpdateActionPending(true);

    try {
      await window.desktopApi.checkForUpdates();
    } catch (error) {
      console.error("Failed to check for updates", error);
      setIsUpdateActionPending(false);
    }
  }, [canCheckForUpdates]);

  const handleDownloadUpdate = useCallback(async () => {
    if (isUpdateActionPending || updateState.status !== "available") return;

    setIsUpdateActionPending(true);

    try {
      await window.desktopApi.downloadUpdate();
    } catch (error) {
      console.error("Failed to download update", error);
      setIsUpdateActionPending(false);
    }
  }, [isUpdateActionPending, updateState.status]);

  const handleQuitAndInstall = useCallback(async () => {
    if (updateState.status !== "downloaded") return;

    try {
      await window.desktopApi.quitAndInstallUpdate();
    } catch (error) {
      console.error("Failed to install update", error);
    }
  }, [updateState.status]);

  const updateAction = useMemo(() => {
    switch (updateState.status) {
      case "checking":
        return (
          <Button variant="outline" size="sm" disabled>
            <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" />
            <span>Checking…</span>
          </Button>
        );
      case "available":
        return (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleDownloadUpdate()}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            <span>Download</span>
          </Button>
        );
      case "downloading":
        return (
          <Button variant="outline" size="sm" disabled>
            <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" />
            <span>{downloadProgressLabel ?? "Downloading…"}</span>
          </Button>
        );
      case "downloaded":
        return (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleQuitAndInstall()}
          >
            <RotateCwIcon className="h-3.5 w-3.5" />
            <span>Restart to update</span>
          </Button>
        );
      case "unsupported":
        return (
          <Button variant="outline" size="sm" disabled>
            <span>Unavailable</span>
          </Button>
        );
      default:
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCheckForUpdates}
            onClick={() => void handleCheckForUpdates()}
          >
            <RefreshCwIcon className="h-3.5 w-3.5" />
            <span>Check for updates</span>
          </Button>
        );
    }
  }, [
    canCheckForUpdates,
    downloadProgressLabel,
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleQuitAndInstall,
    updateState.status,
  ]);

  const appVersion = appInfo?.version ?? "…";
  const platformLabel = appInfo?.platform
    ? `${appInfo.platform}${appInfo.isPackaged ? "" : " dev build"}`
    : "Loading build info…";

  return (
    <div className="flex h-full flex-col bg-background overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 pt-20 pb-40">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Configure how Tether looks and behaves.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Appearance" />
          <SettingsRow
            icon={<PaletteIcon className="h-4 w-4" />}
            title="Theme"
            description="Choose between light, dark, or match your system"
            action={
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-32 justify-between gap-2"
                    />
                  }
                >
                  <span className="flex items-center gap-2">
                    {activeTheme.icon}
                    <span>{activeTheme.label}</span>
                  </span>
                  <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  className="w-48 rounded-lg"
                >
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.icon}
                      <span className="flex-1">{option.label}</span>
                      {theme === option.value && (
                        <CheckIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Behavior" />
          <SettingsRow
            icon={<MaximizeIcon className="h-4 w-4" />}
            title="Auto-fit PDF after sidebar toggle"
            description="Refit the PDF to the largest visible scale when the sidebar opens or closes"
            action={
              <Switch
                checked={autoFitPdfOnSidebarToggle}
                aria-label="Toggle auto-fit PDF after sidebar toggle"
                onCheckedChange={setAutoFitPdfOnSidebarToggle}
              />
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Storage" />
          <SettingsRow
            icon={<FolderOpenIcon className="h-4 w-4" />}
            title="Saved files directory"
            description="Reveal the folder where PDFs and canvases are stored"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenSavedFiles()}
              >
                <FolderOpenIcon className="h-3.5 w-3.5" />
                <span>Reveal</span>
              </Button>
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="About" />
          <SettingsRow
            icon={<InfoIcon className="h-4 w-4" />}
            title="Tether"
            description={`Version ${appVersion} • ${platformLabel}`}
            action={
              <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                v{appVersion}
              </span>
            }
          />
          <SettingsRow
            icon={<RefreshCwIcon className="h-4 w-4" />}
            title="Automatic updates"
            description={updateState.message ?? "Check GitHub Releases for new macOS builds."}
            action={updateAction}
          />
          {(updateState.availableVersion || releaseDateLabel) && (
            <SettingsRow
              icon={<DownloadIcon className="h-4 w-4" />}
              title="Release details"
              description={[
                updateState.availableVersion
                  ? `Latest version: ${updateState.availableVersion}`
                  : null,
                releaseDateLabel ? `Published: ${releaseDateLabel}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
              action={
                <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {updateState.status}
                </span>
              }
            />
          )}
          {updateState.releaseNotes && (
            <div className="border-t border-border/30 px-4 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Release notes
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {updateState.releaseNotes}
              </p>
            </div>
          )}
          {downloadProgressLabel && updateState.status === "downloading" && (
            <SettingsRow
              icon={<LoaderCircleIcon className="h-4 w-4 animate-spin" />}
              title="Download progress"
              description={downloadProgressLabel}
              action={
                <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {Math.round(updateState.progressPercent ?? 0)}%
                </span>
              }
            />
          )}
          {updateState.status === "downloaded" && (
            <SettingsRow
              icon={<RotateCwIcon className="h-4 w-4" />}
              title="Ready to install"
              description="Restart Tether from here to apply the downloaded macOS update."
              action={
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                  Ready
                </span>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
