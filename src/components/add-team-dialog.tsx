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
import {
  AudioLinesIcon,
  BoxIcon,
  BriefcaseIcon,
  CheckIcon,
  CodeIcon,
  CompassIcon,
  FeatherIcon,
  FlameIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  LayersIcon,
  LeafIcon,
  RocketIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  TerminalIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

const ICON_OPTIONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "audio-lines", label: "Audio Lines", Icon: AudioLinesIcon },
  { id: "rocket", label: "Rocket", Icon: RocketIcon },
  { id: "sparkles", label: "Sparkles", Icon: SparklesIcon },
  { id: "star", label: "Star", Icon: StarIcon },
  { id: "heart", label: "Heart", Icon: HeartIcon },
  { id: "flame", label: "Flame", Icon: FlameIcon },
  { id: "zap", label: "Zap", Icon: ZapIcon },
  { id: "globe", label: "Globe", Icon: GlobeIcon },
  { id: "compass", label: "Compass", Icon: CompassIcon },
  { id: "shield", label: "Shield", Icon: ShieldIcon },
  { id: "leaf", label: "Leaf", Icon: LeafIcon },
  { id: "feather", label: "Feather", Icon: FeatherIcon },
  { id: "layers", label: "Layers", Icon: LayersIcon },
  { id: "box", label: "Box", Icon: BoxIcon },
  { id: "briefcase", label: "Briefcase", Icon: BriefcaseIcon },
  { id: "code", label: "Code", Icon: CodeIcon },
  { id: "graduation-cap", label: "Graduation Cap", Icon: GraduationCapIcon },
]

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

export type NewTeam = {
  name: string
  logo: React.ReactNode
  color: string
}

export function AddTeamDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (team: NewTeam) => void
}) {
  const [name, setName] = React.useState("")
  const [selectedIconId, setSelectedIconId] = React.useState<string>(
    ICON_OPTIONS[0].id
  )
  const [selectedColorId, setSelectedColorId] = React.useState<string>(
    COLOR_OPTIONS[8].id
  )

  React.useEffect(() => {
    if (!open) {
      setName("")
      setSelectedIconId(ICON_OPTIONS[0].id)
      setSelectedColorId(COLOR_OPTIONS[8].id)
    }
  }, [open])

  const selectedIcon =
    ICON_OPTIONS.find((option) => option.id === selectedIconId) ??
    ICON_OPTIONS[0]
  const selectedColor =
    COLOR_OPTIONS.find((option) => option.id === selectedColorId) ??
    COLOR_OPTIONS[0]

  const canSubmit = name.trim().length > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const Icon = selectedIcon.Icon
    onCreate({
      name: name.trim(),
      logo: <Icon />,
      color: selectedColor.value,
    })
    onOpenChange(false)
  }

  const PreviewIcon = selectedIcon.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Give your team a name and pick an icon.
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
                {name.trim() || "Team preview"}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedIcon.label} · {selectedColor.label}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="team-name"
              className="text-xs font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="team-name"
              autoFocus
              placeholder="Acme Inc."
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={48}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Icon</span>
            <div
              role="radiogroup"
              aria-label="Team icon"
              className="grid grid-cols-6 gap-1.5"
            >
              {ICON_OPTIONS.map(({ id, label, Icon }) => {
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
              aria-label="Team icon background color"
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
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
