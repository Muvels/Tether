import { useCallback, useRef } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PlusIcon, FileTextIcon, ChevronDownIcon } from "lucide-react"
import { useProjectStore } from "@/store/useProjectStore"
import { useLinkStore } from "@/store/useLinkStore"
import { useWorkspaceNavigationGuard } from "@/hooks/useWorkspaceNavigationGuard"

export function NavProjects() {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeFileId = useProjectStore((s) => s.activeFileId)
  const dirtyFileIds = useLinkStore((s) => s.dirtyFileIds)
  const createProject = useProjectStore((s) => s.createProject)
  const switchProject = useProjectStore((s) => s.switchProject)
  const addFile = useProjectStore((s) => s.addFile)
  const openFile = useProjectStore((s) => s.openFile)
  const closeFile = useProjectStore((s) => s.closeFile)
  const loadFile = useLinkStore((s) => s.loadFile)
  const { isNavigationBlocked } = useWorkspaceNavigationGuard()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetProjectId = useRef<string | null>(null)

  const handleCreate = () => {
    closeFile()
    void loadFile(null)
    void createProject()
  }

  const handleSwitchProject = (id: string) => {
    if (id === activeProjectId && !activeFileId) return
    switchProject(id)
    void loadFile(null)
  }

  const handleOpenFile = (projectId: string, fileId: string) => {
    if (fileId === activeFileId) return
    if (isNavigationBlocked) return
    if (projectId !== activeProjectId) {
      switchProject(projectId)
    }
    openFile(fileId)
    void loadFile(fileId)
  }

  const handleAddFiles = useCallback(
    (projectId: string) => {
      uploadTargetProjectId.current = projectId
      fileInputRef.current?.click()
    },
    [],
  )

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const projectId = uploadTargetProjectId.current
      if (!projectId || !event.target.files) {
        event.target.value = ""
        return
      }
      try {
        for (const file of Array.from(event.target.files)) {
          await addFile(projectId, file)
        }
      } catch (error) {
        console.error("Failed to upload document", error)
      } finally {
        event.target.value = ""
        uploadTargetProjectId.current = null
      }
    },
    [addFile],
  )

  if (projects.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-sidebar-foreground/50"
                onClick={handleCreate}
                disabled={isNavigationBlocked}
              >
                <FileTextIcon />
                <span>Create your first project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      {projects.map((project) => (
        <SidebarGroup key={project.id} className="py-0.5">
          <SidebarGroupContent>
            <Collapsible defaultOpen={project.id === activeProjectId}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={project.id === activeProjectId && !activeFileId}
                    onClick={() => handleSwitchProject(project.id)}
                    disabled={isNavigationBlocked}
                    className="font-semibold text-sidebar-foreground/60"
                  >
                    <span className="truncate">{project.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    title="Add file"
                    onClick={() => handleAddFiles(project.id)}
                    disabled={isNavigationBlocked}
                    className="right-7"
                    showOnHover
                  >
                    <PlusIcon />
                  </SidebarMenuAction>
                  <SidebarMenuAction
                    render={<CollapsibleTrigger />}
                    title="Toggle"
                    disabled={isNavigationBlocked}
                    className="[&_.chevron]:-rotate-90 [&[data-panel-open]_.chevron]:rotate-0"
                  >
                    <ChevronDownIcon className="chevron text-sidebar-foreground/60 transition-transform" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
                <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
                  {project.files.map((file) => (
                    <SidebarMenuItem key={file.id}>
                      <SidebarMenuButton
                        isActive={file.id === activeFileId}
                        onClick={() => handleOpenFile(project.id, file.id)}
                        disabled={isNavigationBlocked}
                        className={
                          file.id === activeFileId
                            ? "gap-2.5"
                            : "gap-2.5 text-sidebar-foreground/60"
                        }
                      >
                        {dirtyFileIds.includes(file.id) && (
                          <span
                            aria-hidden
                            className="ml-1 size-1.5 shrink-0 rounded-full bg-yellow-400"
                          />
                        )}
                        <span className="truncate">{file.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {project.files.length === 0 && (
                    <SidebarMenuItem>
                      <div className="flex h-7 items-center gap-2.5 px-2 text-xs text-sidebar-foreground/50">
                        <span
                          aria-hidden
                          className="ml-1 size-1.5 shrink-0 rounded-full bg-yellow-400/50"
                        />
                        <span>No files yet</span>
                      </div>
                    </SidebarMenuItem>
                  )}
                </CollapsibleContent>
              </SidebarMenu>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
      <SidebarGroup className="py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleCreate}
                disabled={isNavigationBlocked}
                className="text-sidebar-foreground/60"
              >
                <PlusIcon />
                <span>New project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
