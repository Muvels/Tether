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
  TerminalIcon,
  AudioLinesIcon,
  SearchIcon,
  Settings2Icon,
  MessageCircleQuestionIcon,
  FolderOpenIcon,
} from "lucide-react"

const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: <TerminalIcon />,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: <AudioLinesIcon />,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: <TerminalIcon />,
      plan: "Free",
    },
  ],
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
      className="app-drag-region flex h-12 shrink-0 items-center gap-1 pr-2"
      style={{ paddingLeft: open ? 78 : 8 }}
    >
      <SidebarTrigger className="h-6 w-9 shrink-0" />
      
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
            <TeamSwitcher teams={data.teams} />
          </div>
        </SidebarFooter>
      </div>
      <SidebarRail />
    </Sidebar>
  )
}
