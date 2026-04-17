# PDF Canvas Linker

`pdf-canvas-linker` is now an Electron-first desktop app for working with PDFs as source material and an Excalidraw canvas as the thinking surface.

The app combines a PDF viewer with a linked canvas so you can pull text, image regions, and arbitrary areas out of a document, turn them into visual notes, and jump back to the exact source location later.

## Current Architecture

- Electron `main` process acts as the local backend
- Electron `preload` exposes a typed IPC bridge at `window.desktopApi`
- React + Vite power the renderer UI
- PGlite stores projects, file metadata, links, and Excalidraw scenes
- Uploaded PDFs are stored as real files in the Electron app data directory

### Local Data Layout

The app stores data under:

```text
<userData>/app-data/
├── db/          # PGlite data directory
└── pdfs/        # Stored PDFs as <fileId>.pdf
```

On macOS, `<userData>` is the standard Electron app data directory for the current user.

## Features

### Projects and Files

- Create multiple projects from the sidebar
- Rename projects inline
- Add multiple PDFs to a project
- Switch between files inside a project
- Return from an open file back to the project page

### PDF Interaction

- Open stored PDFs inside a project
- Select text in the PDF
- `Alt` + drag to capture an arbitrary area
- Detect and drag images from the PDF page
- Zoom pages in and out
- Navigate by page
- Show or hide link highlights

### Canvas Interaction

- Drop text selections to create linked quote cards
- Drop area selections to create linked reference cards
- Drop images to create linked image elements
- Select an existing canvas element and manually link it to a PDF position
- Click linked canvas elements to jump back to the referenced PDF area

### Persistence

- Projects persist in PGlite
- PDF metadata persists in PGlite
- PDF binaries persist on disk
- File-specific links persist in PGlite
- Excalidraw scenes persist in PGlite
- Dropped image elements persist with their Excalidraw file payloads

## Database Shape

The desktop app initializes these tables on startup:

- `projects(id, name, emoji, created_at)`
- `project_files(id, project_id, name, stored_rel_path, added_at, scene_elements_json, scene_app_state_json, scene_files_json)`
- `file_links(file_id, element_id, pdf_link_json)`

`project_files.project_id` and `file_links.file_id` use `ON DELETE CASCADE`.

## Development

### Requirements

- Node.js 20+
- `pnpm`

### Install

```bash
pnpm install
```

If `pnpm` blocks Electron's install script in your environment, run:

```bash
node node_modules/electron/install.js
```

### Start Desktop Dev Mode

```bash
pnpm dev
```

This starts:

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

This produces:

- `dist/` for the renderer
- `dist-electron/` for Electron main and preload

### Package Desktop App

```bash
pnpm dist
```

Packaged artifacts are written to `release/`.

## Renderer API

The renderer only talks to Electron through `window.desktopApi`.

Available methods:

- `bootstrap()`
- `createProject()`
- `renameProject({ projectId, name })`
- `deleteProject(projectId)`
- `importPdf({ projectId, name, bytes })`
- `deletePdf({ projectId, fileId })`
- `openWorkspace(fileId)`
- `saveLinks(fileId, links)`
- `saveScene(fileId, scene)`

## Repository Structure

```text
.
├── electron/
│   ├── main/                 # BrowserWindow setup, PGlite, filesystem, IPC handlers
│   └── preload/              # contextBridge API exposed to the renderer
├── public/                   # sample PDF and pdf.js worker
├── src/
│   ├── components/
│   │   ├── CanvasPanel/      # Excalidraw integration
│   │   ├── PdfPanel/         # PDF viewer, selection, highlights, image overlays
│   │   └── ui/               # UI primitives
│   ├── store/                # Zustand stores for projects and workspaces
│   ├── types/                # shared app and IPC types
│   └── utils/                # drag payloads, coordinates, PDF image helpers
├── tsconfig.electron.json
├── tsup.electron.config.ts
└── vite.config.ts
```

## Notes

- This repo no longer targets browser-only persistence.
- There is no migration path from the old `localStorage` MVP data.
- The current production build passes with `pnpm build`.
- The current lint pass succeeds with `pnpm lint`.

## License

No license has been added yet.
