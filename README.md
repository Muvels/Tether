# PDF Canvas Linker

PDF Canvas Linker is a local-first Electron desktop app for turning PDFs into source-linked visual workspaces.

It pairs a PDF reader with an Excalidraw canvas so you can pull text, image regions, and arbitrary page areas out of a document, arrange them visually, and jump back to the exact source location later.

## What The App Is Now

This project is no longer the earlier browser-only experiment. The current version is an Electron app with:

- a real local persistence layer
- filesystem-backed PDF storage
- a project-based workspace model
- multi-document tabs
- per-document Excalidraw scenes
- source links between canvas elements and PDF locations

Everything is stored locally on the machine. There is no cloud sync or shared backend in the current implementation.

## Core Workflow

1. Create a project.
2. Import one or more PDFs into that project.
3. Open a document workspace.
4. Read the PDF on the left and build notes on the canvas on the right.
5. Drag content from the PDF onto the canvas to create linked elements.
6. Reopen the document later with its links and Excalidraw scene intact.

## Current Capabilities

### Projects and documents

- Create, rename, and delete projects
- Import multiple PDFs per project
- Rename and delete PDFs
- Open documents from the sidebar or the project page
- Work with multiple open document tabs
- Reorder tabs with drag and drop
- Open the saved PDF directory from the sidebar

### PDF interaction

- Render PDFs inside the app with `react-pdf` / pdf.js
- Fit the document to the visible area on load
- Zoom in and out
- Navigate by page
- Toggle PDF highlights on and off
- Select text and drag it to the canvas
- Hold `Alt` and drag to capture an arbitrary area
- Detect page images and drag them to the canvas

### Canvas interaction

- Use Excalidraw as the per-document canvas
- Drop text selections to create linked quote cards
- Drop area selections to create linked reference cards
- Drop detected PDF images to create linked image elements
- Select a linked canvas element to reveal its source area in the PDF
- Link an existing canvas element to the PDF manually
- Remove links automatically when their source canvas element is deleted

### Saving and navigation

- Each PDF has its own stored canvas scene and link set
- `Cmd+S` / `Ctrl+S` saves the current workspace
- If you switch documents with unsaved changes, the app prompts you to save, discard, or cancel
- The app warns before window unload when there are unsaved workspace changes

## How Linking Works

The linking model is intentionally simple:

- every link belongs to a single PDF file
- every link connects one canvas element to one normalized PDF location
- links can represent text, arbitrary areas, or images
- clicking or selecting a linked canvas element focuses the related PDF region

Normalized coordinates are stored per page, which makes links resilient to zoom level changes.

## Architecture

- Electron `main` process handles window lifecycle, IPC, local files, and database access
- Electron `preload` exposes a typed bridge at `window.desktopApi`
- React + Vite power the renderer
- Zustand stores manage project state and active workspace state
- PGlite stores projects, file metadata, links, and Excalidraw scene data
- PDF binaries are stored as real files on disk

## Local Data Layout

App data lives under the Electron `userData` directory:

```text
<userData>/app-data/
├── db/          # PGlite data directory
└── pdfs/        # Stored PDFs as <fileId>.pdf
```

Current tables:

- `projects(id, name, emoji, created_at)`
- `project_files(id, project_id, name, stored_rel_path, added_at, scene_elements_json, scene_app_state_json, scene_files_json)`
- `file_links(file_id, element_id, pdf_link_json)`

`project_files.project_id` and `file_links.file_id` use `ON DELETE CASCADE`.

## Repository Structure

```text
.
├── electron/
│   ├── main/        # Electron app lifecycle, IPC handlers, database, filesystem
│   └── preload/     # Typed renderer bridge
├── public/          # Static assets, including the pdf.js worker
├── src/
│   ├── components/
│   │   ├── CanvasPanel/
│   │   ├── PdfPanel/
│   │   └── ui/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   └── utils/
├── vite.config.ts
├── tsup.electron.config.ts
└── package.json
```

## Development

### Requirements

- Node.js 20+
- `pnpm`

### Install

```bash
pnpm install
```

The `postinstall` step copies the pdf.js worker into `public/`.

If Electron's install script is blocked in your environment, run:

```bash
node node_modules/electron/install.js
```

### Start dev mode

```bash
pnpm dev
```

This runs:

- the Vite renderer dev server
- the Electron main/preload watcher
- Electron pointed at the local dev server

### Typecheck

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

Build output:

- `dist/` for the renderer
- `dist-electron/` for Electron main and preload

### Package the desktop app

```bash
pnpm dist
```

Packaged artifacts are written to `release/`.

## Current Notes

- This is a desktop-only app in its current form.
- There is no migration path from the older browser/localStorage versions.
- Data is local-only; there is no sync or collaboration layer yet.

## License

No license has been added yet.
