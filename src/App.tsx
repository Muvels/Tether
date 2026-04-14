import { useEffect } from "react";
import Layout from "./components/Layout";
import PdfViewer from "./components/PdfPanel/PdfViewer";
import ExcalidrawCanvas from "./components/CanvasPanel/ExcalidrawCanvas";
import { useLinkStore } from "./store/useLinkStore";

export default function App() {
  const hydrate = useLinkStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Layout
      left={<PdfViewer />}
      right={<ExcalidrawCanvas />}
    />
  );
}
