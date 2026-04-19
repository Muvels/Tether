"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChevronDownIcon, PlusIcon } from "lucide-react"
import { AddTeamDialog, type NewTeam } from "@/components/add-team-dialog"

export type Team = {
  name: string
  logo: React.ReactNode
  plan: string
  color?: string
}

export function TeamSwitcher({
  teams,
  onAddTeam,
}: {
  teams: Team[]
  onAddTeam?: (team: NewTeam) => void
}) {
  const [activeTeamName, setActiveTeamName] = React.useState<string | null>(
    teams[0]?.name ?? null
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const activeTeam =
    teams.find((team) => team.name === activeTeamName) ?? teams[0]

  const handleCreate = React.useCallback(
    (team: NewTeam) => {
      onAddTeam?.(team)
      setActiveTeamName(team.name)
    },
    [onAddTeam]
  )

  if (!activeTeam) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton className="w-fit px-1.5" />}
            >
              <div
                className="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
                style={
                  activeTeam.color
                    ? {
                        backgroundColor: activeTeam.color,
                        color: "#ffffff",
                      }
                    : undefined
                }
              >
                {activeTeam.logo}
              </div>
              <span className="truncate font-medium">{activeTeam.name}</span>
              <ChevronDownIcon className="opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64 rounded-lg"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Teams
                </DropdownMenuLabel>
                {teams.map((team, index) => (
                  <DropdownMenuItem
                    key={team.name}
                    onClick={() => setActiveTeamName(team.name)}
                    className="gap-2 p-2"
                  >
                    <div
                      className="flex size-6 items-center justify-center rounded-xs border"
                      style={
                        team.color
                          ? {
                              backgroundColor: team.color,
                              color: "#ffffff",
                              borderColor: "transparent",
                            }
                          : undefined
                      }
                    >
                      {team.logo}
                    </div>
                    {team.name}
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => setDialogOpen(true)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <PlusIcon className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    Add team
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <AddTeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </>
  )
}
