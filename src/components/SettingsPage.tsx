import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CheckIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  InfoIcon,
  MaximizeIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
} from "lucide-react";
import {
  useUiStore,
  type ThemePreference,
} from "@/store/useUiStore";

const APP_VERSION = "0.0.0";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Match your operating system",
    icon: <MonitorIcon className="h-3.5 w-3.5" />,
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme",
    icon: <SunIcon className="h-3.5 w-3.5" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme",
    icon: <MoonIcon className="h-3.5 w-3.5" />,
  },
];

function SettingsRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/40 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span className="flex-1">{title}</span>
    </div>
  );
}

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const autoFitPdfOnSidebarToggle = useUiStore(
    (s) => s.autoFitPdfOnSidebarToggle,
  );
  const setAutoFitPdfOnSidebarToggle = useUiStore(
    (s) => s.setAutoFitPdfOnSidebarToggle,
  );

  const activeTheme =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];

  const handleOpenSavedFiles = useCallback(async () => {
    try {
      await window.desktopApi.openSavedFilesDirectory();
    } catch (error) {
      console.error("Failed to open saved files directory", error);
    }
  }, []);

  return (
    <div className="flex h-full flex-col bg-background overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 pt-20 pb-40">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Configure how Tether looks and behaves.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Appearance" />
          <SettingsRow
            icon={<PaletteIcon className="h-4 w-4" />}
            title="Theme"
            description="Choose between light, dark, or match your system"
            action={
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-32 justify-between gap-2"
                    />
                  }
                >
                  <span className="flex items-center gap-2">
                    {activeTheme.icon}
                    <span>{activeTheme.label}</span>
                  </span>
                  <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  className="w-48 rounded-lg"
                >
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.icon}
                      <span className="flex-1">{option.label}</span>
                      {theme === option.value && (
                        <CheckIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Behavior" />
          <SettingsRow
            icon={<MaximizeIcon className="h-4 w-4" />}
            title="Auto-fit PDF after sidebar toggle"
            description="Refit the PDF to the largest visible scale when the sidebar opens or closes"
            action={
              <Switch
                checked={autoFitPdfOnSidebarToggle}
                aria-label="Toggle auto-fit PDF after sidebar toggle"
                onCheckedChange={setAutoFitPdfOnSidebarToggle}
              />
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="Storage" />
          <SettingsRow
            icon={<FolderOpenIcon className="h-4 w-4" />}
            title="Saved files directory"
            description="Reveal the folder where PDFs and canvases are stored"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenSavedFiles()}
              >
                <FolderOpenIcon className="h-3.5 w-3.5" />
                <span>Reveal</span>
              </Button>
            }
          />
        </div>

        <div className="mb-6 rounded-lg border border-border/60 overflow-hidden">
          <SectionHeader title="About" />
          <SettingsRow
            icon={<InfoIcon className="h-4 w-4" />}
            title="Tether"
            description={`Version ${APP_VERSION}`}
            action={
              <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                v{APP_VERSION}
              </span>
            }
          />
        </div>

      </div>
    </div>
  );
}
