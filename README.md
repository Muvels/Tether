# PDF Canvas Linker

`pdf-canvas-linker` is a small MVP for source-linked thinking with PDFs.

It combines a PDF viewer with an [Excalidraw](https://excalidraw.com/) canvas so you can pull content out of a document, turn it into visual notes, and jump back to the original source location later.

## What It Does

- Open a local PDF or use the bundled sample PDF
- Select text in the PDF and drag it onto the canvas
- Alt-drag an arbitrary area on the PDF and drag that selection onto the canvas
- Drag detected PDF images directly onto the canvas
- Create deep links from canvas elements back to the source position in the PDF
- Click linked canvas elements to scroll back to the referenced page area

## Why This Exists

Most PDF tools are good at reading and highlighting.
Most canvases are good at thinking, clustering, and mapping ideas.

This project sits between those two modes:

- the PDF stays the source of truth
- the canvas becomes the thinking surface
- links keep both sides connected

The goal of the MVP is simple: validate whether linked PDF-to-canvas workflows feel useful for research, document review, note-making, and concept mapping.

## MVP Scope

This is intentionally narrow.

Current scope:

- single-user
- local browser storage
- no backend
- no auth
- no collaboration
- no export flow
- no document library

That is deliberate. The current version is meant to test the core interaction, not the full product surface.

## How It Works

### PDF Side

- Text selection creates a draggable handle
- `Alt` + drag creates an area selection
- Images detected on the page can be dragged directly
- Linked regions can be highlighted in the viewer

### Canvas Side

- Dropping text creates a linked quote card
- Dropping an image creates a linked image element
- Dropping an area creates a linked reference card
- Existing canvas elements can also be linked manually to a PDF location

## Tech Stack

- React
- TypeScript
- Vite
- [react-pdf](https://github.com/wojtekmaj/react-pdf)
- [pdf.js](https://mozilla.github.io/pdf.js/)
- [Excalidraw](https://github.com/excalidraw/excalidraw)
- Zustand

## Getting Started

### Requirements

- Node.js 20+ recommended
- npm

### Install

```bash
npm install
```

### Run In Development

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. Open a PDF.
2. Select text, an area, or drag an image from the PDF.
3. Drop it onto the canvas to create a linked element.
4. Select a linked canvas element to jump back to the source in the PDF.
5. Optionally create a manual link by selecting a canvas element and using `Link to PDF`.

## Persistence

The app currently stores state in `localStorage`.

That includes:

- the current PDF reference
- created PDF links
- the Excalidraw scene

Changing to a different PDF resets the existing link context for that document session.

## Known Limitations

- Local-first only
- No sync across devices
- No multi-document workspace
- No robust import/export for link data
- No collaboration or comments
- PDF handling is geared toward MVP-level interaction, not full document management

## Repository

```bash
.
├── public/                  # sample PDF + pdf worker
├── src/components/
│   ├── CanvasPanel/         # Excalidraw integration
│   └── PdfPanel/            # PDF viewer, selection, highlights, image overlays
├── src/store/               # Zustand link state
├── src/utils/               # drag data, coordinates, PDF image helpers
└── src/types/               # shared types
```

## Next Likely Steps

If the MVP proves useful, the next logical additions would be:

- better persistence per document
- export/share flows
- stronger linking UX
- project-level organization
- collaboration

## License

No license has been added yet.
