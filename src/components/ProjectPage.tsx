import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLinkStore } from "@/store/useLinkStore";
import { selectProjects, useProjectStore } from "@/store/useProjectStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceNavigationGuard } from "@/hooks/useWorkspaceNavigationGuard";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { Project } from "@/types";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProjectContent({ project }: { project: Project }) {
  const dirtyFileIds = useLinkStore((s) => s.dirtyFileIds);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const addFile = useProjectStore((s) => s.addFile);
  const renameFile = useProjectStore((s) => s.renameFile);
  const removeFile = useProjectStore((s) => s.removeFile);
  const openFile = useProjectStore((s) => s.openFile);
  const closeFile = useProjectStore((s) => s.closeFile);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const loadFile = useLinkStore((s) => s.loadFile);
  const forgetFileSession = useLinkStore((s) => s.forgetFileSession);
  const forgetSessionsForFiles = useLinkStore((s) => s.forgetSessionsForFiles);
  const { guardNavigation, isNavigationBlocked } = useWorkspaceNavigationGuard();

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleDraftRef = useRef(project.name);
  const isEditingTitleRef = useRef(false);

  useEffect(() => {
    titleDraftRef.current = project.name;

    const titleElement = titleRef.current;
    if (!isEditingTitleRef.current && titleElement && titleElement.textContent !== project.name) {
      titleElement.textContent = project.name;
    }
  }, [project.name]);

  const handleTitleBlur = useCallback(() => {
    isEditingTitleRef.current = false;

    const currentTitle = titleRef.current?.textContent ?? titleDraftRef.current;
    const newName = currentTitle.trim() || "Untitled";
    titleDraftRef.current = newName;

    if (titleRef.current && titleRef.current.textContent !== newName) {
      titleRef.current.textContent = newName;
    }

    if (newName !== project.name) {
      void renameProject(project.id, newName);
    }
  }, [project.id, project.name, renameProject]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleRef.current?.blur();
      }
    },
    [],
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      for (const file of Array.from(e.target.files)) {
        await addFile(project.id, file);
      }
      e.target.value = "";
    },
    [addFile, project.id],
  );

  const handleOpenFile = useCallback(
    (fileId: string) => {
      if (fileId === activeFileId || openingFileId) return;
      setOpeningFileId(fileId);
      void loadFile(fileId)
        .then(() => {
          openFile(fileId);
        })
        .finally(() => {
          setOpeningFileId(null);
        });
    },
    [activeFileId, loadFile, openFile, openingFileId],
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      if (fileId === activeFileId) {
        guardNavigation(async () => {
          closeFile();
          await loadFile(null);
          await removeFile(project.id, fileId);
          forgetFileSession(fileId);
        });
        return;
      }
      await removeFile(project.id, fileId);
      forgetFileSession(fileId);
    },
    [
      activeFileId,
      closeFile,
      forgetFileSession,
      guardNavigation,
      loadFile,
      project.id,
      removeFile,
    ],
  );

  const startRenameFile = useCallback((fileId: string, currentName: string) => {
    setEditingFileId(fileId);
    setEditingFileName(currentName);
  }, []);

  const commitRenameFile = useCallback(async () => {
    if (!editingFileId) return;
    const currentFile = project.files.find((file) => file.id === editingFileId);
    const nextName = editingFileName.trim();

    if (currentFile && nextName && nextName !== currentFile.name) {
      await renameFile(project.id, editingFileId, nextName);
    }

    setEditingFileId(null);
    setEditingFileName("");
  }, [editingFileId, editingFileName, project.files, project.id, renameFile]);

  const cancelRenameFile = useCallback(() => {
    setEditingFileId(null);
    setEditingFileName("");
  }, []);

  const handleDeleteProject = useCallback(() => {
    if (isDeletingProject) return;

    const confirmed = window.confirm(
      `Delete "${project.name}" and all of its PDFs and canvases? This cannot be undone.`,
    );

    if (!confirmed) return;

    guardNavigation(async () => {
      setIsDeletingProject(true);

      try {
        closeFile();
        await loadFile(null);
        await deleteProject(project.id);
        forgetSessionsForFiles(project.files.map((file) => file.id));
      } finally {
        setIsDeletingProject(false);
      }
    });
  }, [
    closeFile,
    deleteProject,
    forgetSessionsForFiles,
    guardNavigation,
    isDeletingProject,
    loadFile,
    project.files,
    project.id,
    project.name,
  ]);

  const files = project.files;
  const isProjectActionDisabled =
    isNavigationBlocked || isDeletingProject || openingFileId !== null;

  return (
    <div className="flex h-full flex-col bg-background overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 pt-20 pb-40">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              className="text-4xl font-bold text-foreground outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
              data-placeholder="Untitled"
              onFocus={() => {
                isEditingTitleRef.current = true;
              }}
              onInput={(e) => {
                titleDraftRef.current = e.currentTarget.textContent ?? "";
              }}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Created {formatDate(project.createdAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDeleteProject}
            disabled={isProjectActionDisabled}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            <span>{isDeletingProject ? "Deleting..." : "Delete project"}</span>
          </Button>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 border-b border-border/40 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span className="flex-1">Name</span>
              <span className="w-28 text-right">Added</span>
              <span className="w-8" />
            </div>

            {/* File rows */}
            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-3 border-b border-border/30 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/50"
              >
                {editingFileId === file.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      autoFocus
                      aria-label={`Rename ${file.name}`}
                      value={editingFileName}
                      onChange={(e) => setEditingFileName(e.target.value)}
                      onBlur={() => void commitRenameFile()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void commitRenameFile();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRenameFile();
                        }
                      }}
                      className="h-7 flex-1"
                    />
                    <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                      {formatDate(file.addedAt)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenFile(file.id)}
                    disabled={isProjectActionDisabled}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {dirtyFileIds.includes(file.id) ? (
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full bg-yellow-400"
                        />
                      ) : null}
                    </div>
                    <span className="flex-1 truncate text-sm text-foreground">
                      {file.name}
                    </span>
                    <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                      {formatDate(file.addedAt)}
                    </span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={isProjectActionDisabled}
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 text-muted-foreground/70 aria-expanded:bg-accent aria-expanded:text-foreground"
                      />
                    }
                  >
                    <MoreHorizontalIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">Open document actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    className="w-40 rounded-lg"
                  >
                    <DropdownMenuItem
                      onClick={() => startRenameFile(file.id, file.name)}
                    >
                      <PencilIcon className="text-muted-foreground" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void handleRemoveFile(file.id)}
                    >
                      <Trash2Icon />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        <label
          className={`group flex items-center gap-3 rounded-lg border border-dashed border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-accent/30 ${
            isProjectActionDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {files.length === 0 ? (
              <UploadIcon className="h-4 w-4" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {files.length === 0 ? "Upload a PDF" : "Add another PDF"}
            </p>
            <p className="text-xs text-muted-foreground">
              {files.length === 0
                ? "Choose a PDF file to view and annotate on the canvas"
                : "Add more files to this project"}
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileUpload}
            disabled={isProjectActionDisabled}
            className="hidden"
          />
        </label>

        {files.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground/50">
            Upload a PDF to get started
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore(selectProjects);
  const project = projects.find((candidate) => candidate.id === activeProjectId);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <FileTextIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">Create a project to get started</p>
        </div>
      </div>
    );
  }

  return <ProjectContent key={project.id} project={project} />;
}
