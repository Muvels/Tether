"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"
import { WORKSPACE_ICON_OPTIONS } from "@/lib/workspace-icons"

const COLOR_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: "slate", label: "Slate", value: "#64748b" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "lime", label: "Lime", value: "#84cc16" },
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "teal", label: "Teal", value: "#14b8a6" },
  { id: "sky", label: "Sky", value: "#0ea5e9" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "indigo", label: "Indigo", value: "#6366f1" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "pink", label: "Pink", value: "#ec4899" },
]

export type NewWorkspace = {
  name: string
  icon: string
  color: string
}

export function AddTeamDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (workspace: NewWorkspace) => void
}) {
  const [name, setName] = React.useState("")
  const [selectedIconId, setSelectedIconId] = React.useState<string>(
    WORKSPACE_ICON_OPTIONS[0].id
  )
  const [selectedColorId, setSelectedColorId] = React.useState<string>(
    COLOR_OPTIONS[8].id
  )

  React.useEffect(() => {
    if (!open) {
      setName("")
      setSelectedIconId(WORKSPACE_ICON_OPTIONS[0].id)
      setSelectedColorId(COLOR_OPTIONS[8].id)
    }
  }, [open])

  const selectedIcon =
    WORKSPACE_ICON_OPTIONS.find((option) => option.id === selectedIconId) ??
    WORKSPACE_ICON_OPTIONS[0]
  const selectedColor =
    COLOR_OPTIONS.find((option) => option.id === selectedColorId) ??
    COLOR_OPTIONS[0]

  const canSubmit = name.trim().length > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    onCreate({
      name: name.trim(),
      icon: selectedIcon.id,
      color: selectedColor.value,
    })
    onOpenChange(false)
  }

  const PreviewIcon = selectedIcon.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Give your workspace a name and pick an icon.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex size-10 items-center justify-center rounded-md text-white shadow-sm"
              style={{ backgroundColor: selectedColor.value }}
            >
              <PreviewIcon className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {name.trim() || "Workspace preview"}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedIcon.label} · {selectedColor.label}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="workspace-name"
              className="text-xs font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="workspace-name"
              autoFocus
              placeholder="Client PDFs"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={48}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Icon</span>
            <div
              role="radiogroup"
              aria-label="Workspace icon"
              className="grid grid-cols-6 gap-1.5"
            >
              {WORKSPACE_ICON_OPTIONS.map(({ id, label, Icon }) => {
                const isSelected = selectedIconId === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={label}
                    onClick={() => setSelectedIconId(id)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected && "border-transparent text-white hover:brightness-95"
                    )}
                    style={
                      isSelected
                        ? { backgroundColor: selectedColor.value }
                        : undefined
                    }
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Color</span>
            <div
              role="radiogroup"
              aria-label="Workspace icon background color"
              className="grid grid-cols-6 gap-1.5"
            >
              {COLOR_OPTIONS.map(({ id, label, value }) => {
                const isSelected = selectedColorId === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={label}
                    onClick={() => setSelectedColorId(id)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-md text-white outline-none transition-transform hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                    )}
                    style={{ backgroundColor: value }}
                  >
                    {isSelected && <CheckIcon className="size-3.5" />}
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
