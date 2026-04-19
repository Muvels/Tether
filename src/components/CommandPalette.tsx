import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BugOffIcon,
  ColumnsIcon,
  HelpCircleIcon,
  ListChecksIcon,
  MicIcon,
  MicOffIcon,
  PinIcon,
  RowsIcon,
  TriangleIcon,
  XIcon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[1rem] items-center justify-center text-[13px] leading-none text-muted-foreground/80">
      {children}
    </span>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runCommand = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search files, actions, agents..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Agent">
          <CommandItem onSelect={() => runCommand(() => {})}>
            <TriangleIcon className="-rotate-90 fill-current" />
            <span>New Agent</span>
            <CommandShortcut>
              <Kbd>⌘</Kbd>
              <Kbd>N</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <MicIcon />
            <span>Use Voice</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <MicOffIcon />
            <span>Hold to Talk</span>
            <CommandShortcut>
              <Kbd>⌃</Kbd>
              <Kbd>M</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <PinIcon />
            <span>Pin / Unpin Agent</span>
            <CommandShortcut>
              <Kbd>⌘</Kbd>
              <Kbd>D</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <ColumnsIcon />
            <span>Split Tile Horizontally</span>
            <CommandShortcut>
              <Kbd>⌘</Kbd>
              <Kbd>D</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <RowsIcon />
            <span>Split Tile Vertically</span>
            <CommandShortcut>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>D</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <XIcon />
            <span>Remove from Tileset</span>
            <CommandShortcut>
              <Kbd>⌘</Kbd>
              <Kbd>W</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <ArrowLeftIcon />
            <span>Go Back</span>
            <CommandShortcut>
              <Kbd>⌃</Kbd>
              <Kbd>⌥</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>5</Kbd>
            </CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => {})}>
            <ArrowRightIcon />
            <span>Go Forward</span>
            <CommandShortcut>
              <Kbd>⌃</Kbd>
              <Kbd>⌥</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>6</Kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Mode">
          <CommandItem onSelect={() => runCommand(() => {})}>
            <ListChecksIcon />
            <span>Plan Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <HelpCircleIcon />
            <span>Ask Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <BugOffIcon />
            <span>Debug Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
