import {
  AudioLinesIcon,
  BoxIcon,
  BriefcaseIcon,
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

export const WORKSPACE_ICON_OPTIONS: { id: string; label: string; Icon: LucideIcon }[] = [
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

export function getWorkspaceIcon(iconId: string) {
  return (
    WORKSPACE_ICON_OPTIONS.find((option) => option.id === iconId)?.Icon ??
    WORKSPACE_ICON_OPTIONS[0].Icon
  )
}
