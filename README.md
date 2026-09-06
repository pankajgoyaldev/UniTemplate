# UniTemplate

**UniTemplate** is a professional template design and bulk document generation studio built for precision, local-first privacy, and high-performance document workflows.

The primary objective of UniTemplate is to allow users to import existing designs (such as PDF, PNG, JPG, or SVG backgrounds), overlay and position dynamic fields with physical millimeter precision, and generate batches of populated documents from structured Excel/CSV data sources.

> [!NOTE]
> **Product Direction:** UniTemplate is **not** a general-purpose graphics or marketing design tool (like Canva). It is specialized for structured, repeatable document templates (invoices, certificates, ID cards, shipping labels, tags) and high-volume document compilation from data.

---

## Architecture & Technology Stack

UniTemplate is engineered as a modern, local-first TypeScript monorepo using **pnpm workspaces**:

```
├── apps/
│   └── web/                   # Web studio application (React 18, Vite, Tailwind CSS)
└── packages/
    ├── core/                  # Core domain logic, Zod AST schemas, units, .uts container packager
    └── canvas-engine/         # SVG renderers, coordinate math, hit-testing, resize/drag manipulation
```

### Technology Highlights

- **Frontend Core:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Lucide React
- **State Management:** Zustand (decoupled stores for template AST, UI, document session, history, and recovery)
- **Schema Validation:** Zod (runtime and serialization AST validation)
- **Vector Rendering:** SVG-based vector canvas with subpixel font fidelity
- **Barcodes:** `bwip-js` vector barcode and QR code generation
- **Packaging:** `jszip` for `.uts` archive serialization and parsing
- **Persistence:** IndexedDB (local session recovery with in-memory test fallback)
- **Testing:** Vitest (245 automated unit and regression tests)

---

## Current Capabilities

The following features are currently implemented and verified in the codebase:

### 1. Physical Geometry & Metric Canvas
- **Millimeter Coordinate Space:** All elements and page boundaries are modeled in physical millimeters (`mm`), ensuring physical print fidelity regardless of display DPI or scaling.
- **Dual Metric Rulers:** Interactive horizontal and vertical rulers displaying millimeter graduations that dynamically adapt tick intervals across all zoom scales.
- **Cursor Position Tracking:** Live crosshair and numeric display of the pointer's physical coordinates on the page.

### 2. Viewport & Canvas Navigation
- **Cursor-Centered Zoom:** Smooth mouse-wheel zooming that preserves the exact canvas point under the cursor. Features delta-mode normalization across standard mice, smooth wheels, and touchpads, with `requestAnimationFrame` (RAF) batching and velocity clamping.
- **Hand-Tool Panning:** Smooth 1:1 viewport panning via middle-mouse drag, Space + Left Click, or the Hand tool, backed by window-level pointer tracking and RAF delta accumulation.
- **Fit to Screen:** Automatic viewport auto-centering with comfortable padding.

### 3. Template AST & Elements
- **Strict AST Validation:** Every document complies with `@uts/core` Zod schemas, enforcing positive page dimensions and valid non-negative element boundaries.
- **Text Elements:** Rich typography controls including font family, size (pt), weight, line height, letter spacing, horizontal alignment, and color.
- **Vector Shapes:** Rectangles, ellipses, and horizontal/vertical line shapes with configurable fill, stroke width, stroke color, and corner radius.
- **Image Elements:** Local bitmap rendering with aspect ratio preservation and asset resolution.
- **Vector Barcodes:** Native 1D and 2D barcode generation supporting Code 128, QR Code, EAN-13, UPC-A, Data Matrix, and PDF417.

### 4. Canvas Manipulation & Editing
- **Selection:** Single-click selection, multi-selection (Shift/Ctrl/Meta), and empty-canvas selection clearing.
- **Move & Drag:** Non-jittery pointer-based translation with container screen origin caching to eliminate synchronous layout thrashing (`getBoundingClientRect`).
- **Resize:** 8 interactive resize handles supporting proportional scaling (Shift-key) and page boundary clamping.
- **Rotation:** Arbitrary rotation degrees with rotated visual bounding box hit-testing.
- **Grid Snapping:** 5mm and 10mm grid snapping with live UI toggle and temporary modifier bypass (`Alt` or `Ctrl`) for fine decimal adjustments.
- **Inspector Panel:** Real-time property editing for position, dimensions, rotation, typography, shape fills, and element hierarchy.

### 5. Document Lifecycle & `.uts` Project Format
- **Custom Project Container (`.uts`):** Compressed archive containing the structured AST (`template.json`) and embedded binary assets (`assets/`).
- **File I/O:** Native Chromium File System Access API with automatic fallback to standard HTML5 file upload and download anchors.
- **Document Actions:** **New**, **Open**, **Save**, and **Save As** with unsaved-changes confirmation dialogs (`UnsavedChangesModal`).
- **Deep Dirty Checking:** Structural AST equality comparison (`isTemplateAstEqual`) against the saved baseline.

### 6. Reliability & Session Recovery
- **Undo / Redo History:** Multi-step transactional history with automatic snapshot compaction and no-op protection.
- **Session Recovery:** Debounced (750ms) IndexedDB persistence that restores unsaved working documents, filenames, and embedded assets after an accidental tab close or page refresh.
- **Asset Fallback:** Missing or corrupt asset references render a subtle vector placeholder without crashing or corrupting the template.

---

## The `.uts` File Format

UniTemplate projects are stored in `.uts` (Universe Template Studio) files, which are standard ZIP containers structured as follows:

```
document.uts (ZIP archive)
├── template.json           # TemplateAst JSON definition (page settings, elements, styles)
└── assets/                 # Embedded binary assets
    ├── image_01.png
    ├── logo.svg
    └── background.jpg
```

### AST Structure (`template.json`)
```json
{
  "version": "1.0.0",
  "metadata": {
    "title": "A4 Invoice Template",
    "createdAt": "2026-09-06T12:00:00.000Z",
    "updatedAt": "2026-09-06T12:00:00.000Z"
  },
  "pageSettings": {
    "width": 210,
    "height": 297,
    "unit": "mm",
    "orientation": "portrait",
    "margins": { "top": 15, "right": 15, "bottom": 15, "left": 15 }
  },
  "elements": [
    {
      "id": "el_title",
      "type": "text",
      "name": "Invoice Title",
      "bounds": { "x": 20, "y": 25, "width": 80, "height": 12, "rotation": 0 },
      "content": "TAX INVOICE",
      "style": { "fontSize": 20, "fontFamily": "Inter", "color": "#0f172a", "fontWeight": "bold" },
      "isVisible": true,
      "isLocked": false
    }
  ]
}
```

---

## Project Structure

```
├── apps/
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   │   ├── canvas/          # Viewport, PageCanvas, ElementRenderer, MetricRuler, SelectionOverlay
│       │   │   ├── inspector/       # InspectorPanel & element property editors
│       │   │   ├── modals/          # UnsavedChangesModal
│       │   │   └── shell/           # TopBar & studio layout
│       │   ├── hooks/               # useDocumentShortcuts, useSessionRecovery
│       │   ├── io/                  # browserFileIO (File System Access API & fallback)
│       │   ├── operations/          # documentOperations (New, Open, Save, Save As)
│       │   └── store/               # Zustand stores (Template, UI, Document, History, Recovery)
│       └── vite.config.ts
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── ast/                 # Zod schemas, types, AST validation
│   │       ├── package/             # serializeUts, parseUts (.uts packager)
│   │       └── units/               # mmToPx, pxToMm, precision math
│   └── canvas-engine/
│       └── src/
│           ├── manipulation/        # hit-testing, resize algorithms, multi-element move, grid snap
│           ├── renderers/           # SVG element renderers (Text, Shapes, Images, Barcodes)
│           └── viewport/            # coordinate math, zoom calculations, ruler intervals
└── package.json
```

---

## Development Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)

### Installation
```bash
# Clone the repository
git clone https://github.com/pankajgoyaldev/UniTemplate.git
cd UniTemplate

# Install dependencies across all monorepo packages
pnpm install
```

### Running the Development Server
```bash
# Start the web studio in development mode
pnpm --filter @uts/web dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Tests
The test suite includes 245 automated tests covering AST validation, `.uts` container serialization/round-trip, SVG rendering, barcode generation, coordinate math, grid snapping, history, and session recovery.

```bash
# Run all Vitest suites
pnpm test
```

### Production Build
```bash
# Build all packages in topological order
pnpm --filter @uts/core build
pnpm --filter @uts/canvas-engine build
pnpm --filter @uts/web build

# Or run the workspace-wide build
pnpm build
```

---

## Roadmap & Planned Features

The following features represent the ongoing product development roadmap:

- [ ] **Background Template Import:** Direct import of existing multi-page PDF, PNG, JPG, and SVG files as locked or semi-transparent template backgrounds.
- [ ] **Dynamic Field Bindings:** Visual placeholder syntax (`{{customer_name}}`, `{{invoice_total}}`) with data-type formatting (dates, currency, decimal places).
- [ ] **Data Source Integration:** Import Excel (`.xlsx`, `.xls`) and CSV files with auto-detected column headers and preview rows.
- [ ] **Field Mapping Interface:** Drag-and-drop or dropdown column-to-element mapping.
- [ ] **Bulk Generation Engine:** Client-side iteration over imported data rows to compile batches of populated documents.
- [ ] **Batch Export:** Multi-page print-ready PDF export and compressed ZIP image archive generation.
- [ ] **Desktop Distribution:** Electron wrapper providing native filesystem access, OS printer spooling, and offline desktop installation for Windows, macOS, and Linux.

---

## License

This project is currently distributed under a proprietary commercial license placeholder. For inquiries, licensing, or commercial partnerships, please contact the repository owner.

