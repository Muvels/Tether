import { useCallback, useEffect, useRef, useState } from "react";
import { useLinkStore } from "@/store/useLinkStore";
import { useProjectStore } from "@/store/useProjectStore";
import { setPendingFile } from "@/utils/pendingFile";
import {
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { ProjectFile } from "@/types";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const renameProject = useProjectStore((s) => s.renameProject);
  const addFile = useProjectStore((s) => s.addFile);
  const removeFile = useProjectStore((s) => s.removeFile);
  const openFile = useProjectStore((s) => s.openFile);
  const loadFile = useLinkStore((s) => s.loadFile);

  const project = projects.find((p) => p.id === activeProjectId);
  const [title, setTitle] = useState(project?.name ?? "New Page");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setTitle(project?.name ?? "New Page");
  }, [project?.name, activeProjectId]);

  const handleTitleBlur = useCallback(() => {
    if (!activeProjectId) return;
    const newName = title.trim() || "Untitled";
    renameProject(activeProjectId, newName);
    if (!title.trim()) setTitle("Untitled");
  }, [activeProjectId, title, renameProject]);

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeProjectId || !e.target.files) return;
      for (const file of Array.from(e.target.files)) {
        const pf: ProjectFile = {
          id: crypto.randomUUID(),
          name: file.name,
          pdfUrl: file.name,
          addedAt: Date.now(),
        };
        addFile(activeProjectId, pf);
        setPendingFile(file);
      }
      e.target.value = "";
    },
    [activeProjectId, addFile],
  );

  const handleOpenFile = useCallback(
    (fileId: string) => {
      openFile(fileId);
      loadFile(fileId);
    },
    [openFile, loadFile],
  );

  const handleRemoveFile = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      if (!activeProjectId) return;
      removeFile(activeProjectId, fileId);
    },
    [activeProjectId, removeFile],
  );

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

  const files = project.files;

  return (
    <div className="flex h-full flex-col bg-background overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 pt-20 pb-40">
        {/* Editable title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-4xl font-bold text-foreground outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 mb-10"
          data-placeholder="Untitled"
          onInput={(e) => setTitle(e.currentTarget.textContent ?? "")}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
        >
          {title}
        </h1>

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
              <button
                key={file.id}
                onClick={() => handleOpenFile(file.id)}
                className="group flex w-full items-center gap-3 border-b border-border/30 last:border-b-0 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
              >
                <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-foreground">
                  {file.name}
                </span>
                <span className="w-28 text-right text-xs text-muted-foreground">
                  {formatDate(file.addedAt)}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleRemoveFile(e, file.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRemoveFile(e as unknown as React.MouseEvent, file.id);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Upload area */}
        <label className="group flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-accent/30">
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
