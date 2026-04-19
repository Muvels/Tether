"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavProjects } from "@/components/nav-projects"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  SearchIcon,
  Settings2Icon,
  MessageCircleQuestionIcon,
  FolderOpenIcon,
} from "lucide-react"
import { useProjectStore } from "@/store/useProjectStore"
import { useLinkStore } from "@/store/useLinkStore"
import { useWorkspaceNavigationGuard } from "@/hooks/useWorkspaceNavigationGuard"

const data = {
  navMain: [
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Open Workspace",
      url: "#",
      icon: <FolderOpenIcon />,
    },
    {
      title: "Settings",
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: "Help",
      url: "#",
      icon: <MessageCircleQuestionIcon />,
    },
  ],
}

function SidebarTitlebar() {
  const { open } = useSidebar()

  return (
    <div
      className="app-drag-region flex h-12 shrink-0 items-center justify-end gap-1 pr-2"
      style={{ paddingLeft: open ? 78 : 8 }}
    >
      <SidebarTrigger className="h-6 w-9 shrink-0 text-sidebar-foreground/60" />
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const workspaces = useProjectStore((s) => s.workspaces)
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId)
  const createWorkspace = useProjectStore((s) => s.createWorkspace)
  const switchWorkspace = useProjectStore((s) => s.switchWorkspace)
  const closeFile = useProjectStore((s) => s.closeFile)
  const loadFile = useLinkStore((s) => s.loadFile)
  const { guardNavigation, isNavigationBlocked } = useWorkspaceNavigationGuard()

  const handleSwitchWorkspace = React.useCallback(
    (workspaceId: string) => {
      if (workspaceId === activeWorkspaceId || isNavigationBlocked) return

      guardNavigation(async () => {
        closeFile()
        await loadFile(null)
        switchWorkspace(workspaceId)
      })
    },
    [
      activeWorkspaceId,
      closeFile,
      guardNavigation,
      isNavigationBlocked,
      loadFile,
      switchWorkspace,
    ]
  )

  const handleCreateWorkspace = React.useCallback(
    (workspace: { name: string; icon: string; color: string }) => {
      if (isNavigationBlocked) return

      let candidate = workspace.name
      let suffix = 2
      const existing = new Set(workspaces.map((entry) => entry.name))
      while (existing.has(candidate)) {
        candidate = `${workspace.name} (${suffix++})`
      }

      guardNavigation(async () => {
        closeFile()
        await loadFile(null)
        await createWorkspace({ ...workspace, name: candidate })
      })
    },
    [
      closeFile,
      createWorkspace,
      guardNavigation,
      isNavigationBlocked,
      loadFile,
      workspaces,
    ]
  )

  const openSavedFilesDirectory = React.useCallback(async () => {
    try {
      await window.desktopApi.openSavedFilesDirectory()
    } catch (error) {
      console.error("Failed to open saved files directory", error)
    }
  }, [])

  const navSecondary = React.useMemo(
    () =>
      data.navSecondary.map((item) =>
        item.title === "Open Workspace"
          ? { ...item, onClick: openSavedFilesDirectory }
          : item
      ),
    [openSavedFilesDirectory]
  )

  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-0 p-0">
        <SidebarTitlebar />
      </SidebarHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader className="gap-1 p-0">
          <div className="flex flex-col gap-0.5 px-2 pb-1">
            <NavMain items={data.navMain} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavProjects />
        </SidebarContent>
        <SidebarFooter className="gap-0 p-0">
          <NavSecondary items={navSecondary} className="px-2 py-1" />
          <div className="px-2 pb-2">
            <TeamSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              disabled={isNavigationBlocked}
              onSwitchWorkspace={handleSwitchWorkspace}
              onCreateWorkspace={handleCreateWorkspace}
            />
          </div>
        </SidebarFooter>
      </div>
      <SidebarRail />
    </Sidebar>
  )
}
