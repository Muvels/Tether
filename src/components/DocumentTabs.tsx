import { useCallback, useMemo, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectProjects, useProjectStore } from "@/store/useProjectStore";
import { useLinkStore } from "@/store/useLinkStore";
import { useWorkspaceNavigationGuard } from "@/hooks/useWorkspaceNavigationGuard";

interface TabDescriptor {
  projectId: string;
  fileId: string;
  projectName: string;
  fileName: string;
}

export function DocumentTabs() {
  const projects = useProjectStore(selectProjects);
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const dirtyFileIds = useLinkStore((s) => s.dirtyFileIds);
  const openFile = useProjectStore((s) => s.openFile);
  const closeTab = useProjectStore((s) => s.closeTab);
  const reorderTabs = useProjectStore((s) => s.reorderTabs);
  const switchProject = useProjectStore((s) => s.switchProject);
  const loadFile = useLinkStore((s) => s.loadFile);
  const { isNavigationBlocked } = useWorkspaceNavigationGuard();

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);

  const tabs = useMemo<TabDescriptor[]>(() => {
    return openTabs
      .map((tab) => {
        const project = projects.find((p) => p.id === tab.projectId);
        const file = project?.files.find((f) => f.id === tab.fileId);
        if (!project || !file) return null;
        return {
          projectId: project.id,
          fileId: file.id,
          projectName: project.name,
          fileName: file.name,
        };
      })
      .filter((value): value is TabDescriptor => value !== null);
  }, [openTabs, projects]);

  const handleActivate = useCallback(
    (tab: TabDescriptor) => {
      if (isNavigationBlocked) return;
      if (tab.fileId === activeFileId) return;

      if (tab.projectId !== activeProjectId) {
        switchProject(tab.projectId);
      }
      openFile(tab.fileId);
      void loadFile(tab.fileId);
    },
    [
      activeFileId,
      activeProjectId,
      isNavigationBlocked,
      loadFile,
      openFile,
      switchProject,
    ],
  );

  const handleClose = useCallback(
    (tab: TabDescriptor, event: React.MouseEvent) => {
      event.stopPropagation();
      if (isNavigationBlocked) return;

      const isActive = tab.fileId === activeFileId;

      if (!isActive) {
        closeTab(tab.fileId);
        return;
      }

      const { nextFileId } = closeTab(tab.fileId);
      void loadFile(nextFileId);
    },
    [activeFileId, closeTab, isNavigationBlocked, loadFile],
  );

  const handleDragStart = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      dragFromIndexRef.current = index;
      setDraggingIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      if (dragFromIndexRef.current === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const from = dragFromIndexRef.current;
      dragFromIndexRef.current = null;
      setDraggingIndex(null);
      setDragOverIndex(null);
      if (from === null || from === index) return;
      reorderTabs(from, index);
    },
    [reorderTabs],
  );

  const handleDragEnd = useCallback(() => {
    dragFromIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  if (tabs.length === 0) return null;

  const activeIndex = tabs.findIndex((tab) => tab.fileId === activeFileId);

  return (
    <div className="app-no-drag flex min-w-0 flex-1 items-center overflow-x-auto no-scrollbar">
      {tabs.map((tab, index) => {
        const isActive = tab.fileId === activeFileId;
        const isDragging = draggingIndex === index;
        const isDropTarget =
          dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;
        const showDivider =
          index > 0 && activeIndex !== index && activeIndex !== index - 1;
        const isDirty = dirtyFileIds.includes(tab.fileId);

        return (
          <div key={tab.fileId} className="flex shrink-0 items-center">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 h-3.5 w-px bg-muted-foreground/40 transition-opacity",
                  showDivider ? "opacity-100" : "opacity-0",
                )}
              />
            )}
            <div
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleActivate(tab)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  handleClose(tab, event);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleActivate(tab);
                }
              }}
              title={`${tab.projectName} / ${tab.fileName}`}
              className={cn(
                "group relative flex h-7 min-w-0 max-w-[260px] shrink-0 cursor-pointer select-none items-center rounded-sm pl-2.5 pr-6 text-xs transition-colors",
                isActive
                  ? "bg-sidebar text-foreground border border-[#dcdcdc] border-dashed"
                  : "text-muted-foreground hover:text-foreground",
                isDragging && "opacity-50",
                isDropTarget && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                isNavigationBlocked && !isActive && "pointer-events-none opacity-60",
              )}
            >
            <span className="min-w-0 flex flex-1 items-center truncate">
              {isDirty && (
                <span
                  aria-hidden
                  className="mr-1.5 size-1.5 shrink-0 rounded-full bg-yellow-400"
                />
              )}
              <span
                className={cn(
                  "transition-colors",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/80",
                )}
              >
                {tab.projectName}
              </span>
              <span className="mx-1 text-muted-foreground/50">/</span>
              <span
                className={cn(
                  "transition-colors",
                  isActive ? "font-medium text-foreground" : "text-foreground/80",
                )}
              >
                {tab.fileName}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Close ${tab.fileName}`}
              onClick={(event) => handleClose(tab, event)}
              onMouseDown={(event) => event.stopPropagation()}
              className={cn(
                "absolute right-1 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-[opacity,background-color,color] hover:bg-muted hover:text-foreground",
                isActive ? "opacity-70" : "opacity-0 group-hover:opacity-70",
              )}
            >
              <XIcon className="h-3 w-3" />
            </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
