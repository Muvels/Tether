import { useEffect } from "react";
import Layout from "./components/Layout";
import PdfViewer from "./components/PdfPanel/PdfViewer";
import ExcalidrawCanvas from "./components/CanvasPanel/ExcalidrawCanvas";
import ProjectPage from "./components/ProjectPage";
import { useLinkStore } from "./store/useLinkStore";
import { useProjectStore } from "./store/useProjectStore";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function MainContent() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const projects = useProjectStore((s) => s.projects);

  if (!activeProjectId || !activeFileId) {
    return <ProjectPage />;
  }

  const project = projects.find((p) => p.id === activeProjectId);
  const file = project?.files.find((f) => f.id === activeFileId);

  if (!file) {
    return <ProjectPage />;
  }

  return (
    <Layout
      left={<PdfViewer pdfUrl={file.pdfUrl} />}
      right={<ExcalidrawCanvas />}
    />
  );
}

export default function App() {
  useEffect(() => {
    useProjectStore.getState().hydrate();
    const { activeFileId } = useProjectStore.getState();
    if (activeFileId) {
      useLinkStore.getState().loadFile(activeFileId);
    }
  }, []);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh !min-h-0 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <MainContent />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
