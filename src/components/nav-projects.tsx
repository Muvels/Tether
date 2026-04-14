import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { PlusIcon, FileTextIcon, ChevronRightIcon } from "lucide-react"
import { useProjectStore } from "@/store/useProjectStore"
import { useLinkStore } from "@/store/useLinkStore"

export function NavProjects() {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeFileId = useProjectStore((s) => s.activeFileId)
  const createProject = useProjectStore((s) => s.createProject)
  const switchProject = useProjectStore((s) => s.switchProject)
  const openFile = useProjectStore((s) => s.openFile)
  const closeFile = useProjectStore((s) => s.closeFile)
  const saveCurrentFile = useLinkStore((s) => s.saveCurrentFile)
  const loadFile = useLinkStore((s) => s.loadFile)

  const handleCreate = () => {
    saveCurrentFile()
    closeFile()
    createProject()
  }

  const handleSwitchProject = (id: string) => {
    if (id === activeProjectId && !activeFileId) return
    saveCurrentFile()
    switchProject(id)
  }

  const handleOpenFile = (projectId: string, fileId: string) => {
    if (fileId === activeFileId) return
    saveCurrentFile()
    if (projectId !== activeProjectId) {
      switchProject(projectId)
    }
    openFile(fileId)
    loadFile(fileId)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupAction title="Create project" onClick={handleCreate}>
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.map((project) => (
            <Collapsible
              key={project.id}
              defaultOpen={project.id === activeProjectId}
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={project.id === activeProjectId && !activeFileId}
                  onClick={() => handleSwitchProject(project.id)}
                >
                  <span>{project.emoji}</span>
                  <span>{project.name}</span>
                </SidebarMenuButton>
                {project.files.length > 0 && (
                  <SidebarMenuAction
                    render={<CollapsibleTrigger />}
                    className="left-2 bg-sidebar-accent text-sidebar-accent-foreground data-[panel-open]:rotate-90"
                    showOnHover
                  >
                    <ChevronRightIcon />
                  </SidebarMenuAction>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {project.files.map((file) => (
                      <SidebarMenuSubItem key={file.id}>
                        <SidebarMenuSubButton
                          isActive={file.id === activeFileId}
                          onClick={() => handleOpenFile(project.id, file.id)}
                        >
                          <FileTextIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>{file.name}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
          {projects.length === 0 && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-sidebar-foreground/50"
                onClick={handleCreate}
              >
                <FileTextIcon />
                <span>Create your first project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
