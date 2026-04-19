import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import Layout from "./components/Layout";
import PdfViewer from "./components/PdfPanel/PdfViewer";
import ExcalidrawCanvas from "./components/CanvasPanel/ExcalidrawCanvas";
import ProjectPage from "./components/ProjectPage";
import { selectProjects, useProjectStore } from "./store/useProjectStore";
import { useLinkStore } from "./store/useLinkStore";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceNavigationGuardProvider } from "@/components/WorkspaceNavigationGuard";
import { useWorkspaceNavigationGuard } from "@/hooks/useWorkspaceNavigationGuard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { DocumentTabs } from "@/components/DocumentTabs";
import { CommandPalette } from "@/components/CommandPalette";

function MainContent() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const projects = useProjectStore(selectProjects);
  const isHydrated = useProjectStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!activeProjectId || !activeFileId) {
    return <ProjectPage />;
  }

  const project = projects.find((p) => p.id === activeProjectId);
  const file = project?.files.find((f) => f.id === activeFileId);

  if (!file) {
    return <ProjectPage />;
  }

  return (
    <Layout
      left={<PdfViewer />}
      right={<ExcalidrawCanvas />}
    />
  );
}

function useTopBarTitle() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const projects = useProjectStore(selectProjects);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) {
    return null;
  }

  if (!activeFileId) {
    return {
      projectId: project.id,
      projectName: project.name,
      fileId: null,
      fileName: null,
    };
  }

  const file = project.files.find((f) => f.id === activeFileId);
  if (!file) {
    return {
      projectId: project.id,
      projectName: project.name,
      fileId: null,
      fileName: null,
    };
  }

  return {
    projectId: project.id,
    projectName: project.name,
    fileId: file.id,
    fileName: file.name,
  };
}

function MainInsetTopBar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const title = useTopBarTitle();
  const openTabs = useProjectStore((s) => s.openTabs);
  const addFile = useProjectStore((s) => s.addFile);
  const renameFile = useProjectStore((s) => s.renameFile);
  const removeFile = useProjectStore((s) => s.removeFile);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const closeFile = useProjectStore((s) => s.closeFile);
  const loadFile = useLinkStore((s) => s.loadFile);
  const forgetFileSession = useLinkStore((s) => s.forgetFileSession);
  const forgetSessionsForFiles = useLinkStore((s) => s.forgetSessionsForFiles);
  const { guardNavigation, isNavigationBlocked } = useWorkspaceNavigationGuard();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const hasTabs = openTabs.length > 0;
  const onProjectPage = Boolean(title) && !title?.fileId;

  const handleRenameDocument = useCallback(async () => {
    if (!title?.fileId || !title.fileName) return;

    const nextName = window.prompt("Rename document", title.fileName);
    const trimmedName = nextName?.trim();

    if (!trimmedName || trimmedName === title.fileName) {
      return;
    }

    try {
      await renameFile(title.projectId, title.fileId, trimmedName);
    } catch (error) {
      console.error("Failed to rename document", error);
    }
  }, [renameFile, title]);

  const handleDeleteDocument = useCallback(() => {
    if (!title?.fileId || !title.fileName || isNavigationBlocked) return;

    const confirmed = window.confirm(`Delete "${title.fileName}"? This cannot be undone.`);
    if (!confirmed) return;

    guardNavigation(async () => {
      closeFile();
      await loadFile(null);
      await removeFile(title.projectId, title.fileId!);
      forgetFileSession(title.fileId!);
    });
  }, [
    closeFile,
    forgetFileSession,
    guardNavigation,
    isNavigationBlocked,
    loadFile,
    removeFile,
    title,
  ]);

  const handleDeleteProject = useCallback(() => {
    if (!title || isNavigationBlocked) return;

    const confirmed = window.confirm(
      `Delete "${title.projectName}" and all of its PDFs and canvases? This cannot be undone.`,
    );
    if (!confirmed) return;

    guardNavigation(async () => {
      const project = useProjectStore
        .getState()
        .workspaces.flatMap((workspace) => workspace.projects)
        .find((candidate) => candidate.id === title.projectId);

      closeFile();
      await loadFile(null);
      await deleteProject(title.projectId);
      forgetSessionsForFiles(project?.files.map((file) => file.id) ?? []);
    });
  }, [
    closeFile,
    deleteProject,
    forgetSessionsForFiles,
    guardNavigation,
    isNavigationBlocked,
    loadFile,
    title,
  ]);

  const handleUploadClick = useCallback(() => {
    if (!onProjectPage || isNavigationBlocked || !title) return;
    uploadInputRef.current?.click();
  }, [isNavigationBlocked, onProjectPage, title]);

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!title || title.fileId || !event.target.files?.length) return;

      try {
        for (const file of Array.from(event.target.files)) {
          await addFile(title.projectId, file);
        }
      } catch (error) {
        console.error("Failed to upload document", error);
      } finally {
        event.target.value = "";
      }
    },
    [addFile, title],
  );

  return (
    <div
      className="app-drag-region pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-[var(--app-topbar-height)] shrink-0 items-center gap-2 bg-muted/60 pr-2 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-muted/50"
      style={{ paddingLeft: collapsed ? 78 : 12 }}
    >
      {collapsed && <SidebarTrigger className="h-6 w-9 shrink-0 text-sidebar-foreground/60" />}

      {hasTabs ? (
        <DocumentTabs />
      ) : (
        <div className="flex min-w-0 flex-1 items-center">
          {title ? (
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {title.projectName}
            </span>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              No project selected
            </span>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {onProjectPage && (
          <>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleUploadChange}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-7 text-muted-foreground"
              onClick={handleUploadClick}
              disabled={isNavigationBlocked}
            >
              <PlusIcon />
              <span className="sr-only">Upload document</span>
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!title || isNavigationBlocked}
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-7 text-muted-foreground"
              />
            }
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-44 rounded-lg">
            {title?.fileId ? (
              <>
                <DropdownMenuItem onClick={() => void handleRenameDocument()}>
                  <PencilIcon className="text-muted-foreground" />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void handleDeleteDocument()}
                >
                  <Trash2Icon />
                  <span>Delete</span>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handleDeleteProject()}
              >
                <Trash2Icon />
                <span>Delete project</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function MainInset() {
  return (
    <SidebarInset className="relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <MainContent />
      </div>
      <MainInsetTopBar />
    </SidebarInset>
  );
}

function WorkspaceSaveGuards() {
  const currentFileId = useLinkStore((s) => s.currentFileId);
  const hasUnsavedChanges = useLinkStore((s) => s.hasUnsavedChanges);
  const isSaving = useLinkStore((s) => s.isSaving);
  const saveCurrentFile = useLinkStore((s) => s.saveCurrentFile);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();

      if (!currentFileId || !hasUnsavedChanges || isSaving) return;

      void saveCurrentFile().catch((error) => {
        console.error("Failed to save workspace", error);
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFileId, hasUnsavedChanges, isSaving, saveCurrentFile]);

  return null;
}

function WorkspaceCloseGuard() {
  const hasAnyUnsavedChanges = useLinkStore((s) => s.hasAnyUnsavedChanges);
  const dirtyFileIds = useLinkStore((s) => s.dirtyFileIds);
  const saveAllDirtyFiles = useLinkStore((s) => s.saveAllDirtyFiles);
  const [open, setOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return window.desktopApi.onRequestAppClose(() => {
      if (isResolving) return;

      if (!useLinkStore.getState().hasAnyUnsavedChanges) {
        void window.desktopApi.confirmAppClose();
        return;
      }

      setErrorMessage(null);
      setOpen(true);
    });
  }, [isResolving]);

  const handleSaveAndClose = useCallback(async () => {
    setIsResolving(true);
    setErrorMessage(null);

    try {
      await saveAllDirtyFiles();
      await window.desktopApi.confirmAppClose();
    } catch (error) {
      console.error("Failed to save workspaces before closing", error);
      setErrorMessage("Could not save all changes. Try again or discard them.");
      setIsResolving(false);
    }
  }, [saveAllDirtyFiles]);

  const handleDiscardAndClose = useCallback(async () => {
    setIsResolving(true);
    setErrorMessage(null);

    try {
      await window.desktopApi.confirmAppClose();
    } catch (error) {
      console.error("Failed to close application", error);
      setErrorMessage("Could not close the app. Try again.");
      setIsResolving(false);
    }
  }, []);

  const dirtyCount = dirtyFileIds.length;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (isResolving) return;
        setErrorMessage(null);
        setOpen(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-lg">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-base font-medium text-foreground">
              Unsaved changes
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {dirtyCount === 1
                ? "One document still has unsaved changes. Save it before closing, or discard it."
                : `${dirtyCount} documents still have unsaved changes. Save them before closing, or discard them.`}
            </DialogPrimitive.Description>
          </div>
          {errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (isResolving) return;
                setErrorMessage(null);
                setOpen(false);
              }}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDiscardAndClose()}
              disabled={isResolving}
            >
              Discard and Close
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveAndClose()}
              disabled={isResolving || !hasAnyUnsavedChanges}
            >
              {isResolving ? "Saving..." : "Save and Close"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default function App() {
  const bootstrap = useProjectStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh !min-h-0 overflow-hidden">
        <WorkspaceNavigationGuardProvider>
          <WorkspaceSaveGuards />
          <WorkspaceCloseGuard />
          <CommandPalette />
          <AppSidebar className="border-r-[#dcdcdc]" />
          <MainInset />
        </WorkspaceNavigationGuardProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
