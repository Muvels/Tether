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
import { AddTeamDialog, type NewWorkspace } from "@/components/add-team-dialog"
import { getWorkspaceIcon } from "@/lib/workspace-icons"
import type { Workspace } from "@/types"

export function TeamSwitcher({
  workspaces,
  activeWorkspaceId,
  disabled,
  onSwitchWorkspace,
  onCreateWorkspace,
}: {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  disabled?: boolean
  onSwitchWorkspace?: (workspaceId: string) => void
  onCreateWorkspace?: (workspace: NewWorkspace) => void
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0]

  const handleCreate = React.useCallback(
    (workspace: NewWorkspace) => {
      onCreateWorkspace?.(workspace)
    },
    [onCreateWorkspace]
  )

  if (!activeWorkspace) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              render={<SidebarMenuButton className="w-fit px-1.5" disabled={disabled} />}
            >
              <div
                className="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
                style={{
                  backgroundColor: activeWorkspace.color,
                  color: "#ffffff",
                }}
              >
                {React.createElement(getWorkspaceIcon(activeWorkspace.icon), {
                  className: "size-4",
                })}
              </div>
              <span className="truncate font-medium">{activeWorkspace.name}</span>
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
                  Workspaces
                </DropdownMenuLabel>
                {workspaces.map((workspace, index) => {
                  return (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => onSwitchWorkspace?.(workspace.id)}
                      className="gap-2 p-2"
                    >
                      <div
                        className="flex size-6 items-center justify-center rounded-xs border"
                        style={{
                          backgroundColor: workspace.color,
                          color: "#ffffff",
                          borderColor: "transparent",
                        }}
                      >
                        {React.createElement(getWorkspaceIcon(workspace.icon), {
                          className: "size-4",
                        })}
                      </div>
                      {workspace.name}
                      <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="gap-2 p-2"
                  disabled={disabled}
                  onClick={() => setDialogOpen(true)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <PlusIcon className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    Add workspace
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
