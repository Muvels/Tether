"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavProjects } from "@/components/nav-projects"
import { TeamSwitcher, type Team } from "@/components/team-switcher"
import type { NewTeam } from "@/components/add-team-dialog"
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

const initialTeams: Team[] = [
  {
    name: "Acme Inc",
    logo: <TerminalIcon />,
    plan: "Enterprise",
    color: "#3b82f6",
  },
  {
    name: "Acme Corp.",
    logo: <AudioLinesIcon />,
    plan: "Startup",
    color: "#8b5cf6",
  },
  {
    name: "Evil Corp.",
    logo: <TerminalIcon />,
    plan: "Free",
    color: "#ef4444",
  },
]

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
  const [teams, setTeams] = React.useState<Team[]>(initialTeams)

  const handleAddTeam = React.useCallback((team: NewTeam) => {
    setTeams((prev) => {
      let candidate = team.name
      let suffix = 2
      const existing = new Set(prev.map((t) => t.name))
      while (existing.has(candidate)) {
        candidate = `${team.name} (${suffix++})`
      }
      return [
        ...prev,
        {
          name: candidate,
          logo: team.logo,
          plan: "Free",
          color: team.color,
        },
      ]
    })
  }, [])

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
            <TeamSwitcher teams={teams} onAddTeam={handleAddTeam} />
          </div>
        </SidebarFooter>
      </div>
      <SidebarRail />
    </Sidebar>
  )
}
