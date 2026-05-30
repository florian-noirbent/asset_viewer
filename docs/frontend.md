# Frontend

The frontend is a React, TypeScript, Vite, and Tailwind application for browsing assets and opening field-level source evidence. It consumes the backend asset API and renders source documents through short-lived resource URLs.

## Stack

| Area          | Tooling                                    |
| ------------- | ------------------------------------------ |
| App runtime   | React 18, React Router, Vite               |
| Styling       | Tailwind CSS                               |
| Icons         | `lucide-react`                             |
| PDF rendering | `@react-pdf-viewer/*`, `pdfjs-dist`        |
| XLSX parsing  | `fflate` plus local XML parsing helpers    |
| Tests         | Vitest, Testing Library, Playwright        |
| Quality       | ESLint, Prettier, TypeScript project build |

## Entry Points

| File                                                     | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `frontend/src/main.tsx`                                  | React app bootstrap.                                                    |
| `frontend/src/App.tsx`                                   | Router wiring.                                                          |
| `frontend/src/api.ts`                                    | Backend API client helpers.                                             |
| `frontend/src/types.ts`                                  | API and provenance TypeScript contract.                                 |
| `frontend/src/pages/AssetsPage.tsx`                      | Asset list route.                                                       |
| `frontend/src/pages/AssetDetailPage.tsx`                 | Asset detail, leases, docked source viewer layout, and resize behavior. |
| `frontend/src/components/FieldValue.tsx`                 | Field display and source evidence trigger.                              |
| `frontend/src/components/evidence/SourceViewerPanel.tsx` | Generic source viewer shell.                                            |

## Provenance Contract

The API returns discriminated provenance sources using `sourceType`. The frontend models them as a union in `frontend/src/types.ts`:

| Source        | Required location fields                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| `pdf`         | `document`, `quote`, `page`, `url`, `refreshUrl`, `expiresInSeconds`           |
| `csv`         | `document`, `quote`, `row`, `column`, `url`, `refreshUrl`, `expiresInSeconds`  |
| `excel` cell  | `document`, `quote`, `sheet`, `cell`, `url`, `refreshUrl`, `expiresInSeconds`  |
| `excel` range | `document`, `quote`, `sheet`, `range`, `url`, `refreshUrl`, `expiresInSeconds` |
| `composite`   | `quote`, `sources`                                                             |

Document sources have URLs and can be loaded directly. Composite sources do not have URLs; they describe a calculation or reconciliation and expose nested sources.

## Source Viewer Architecture

The source viewer follows a shell plus registry plus renderer pattern.

```text
FieldValue
  -> SourceViewerTarget
  -> AssetDetailPage docked layout
  -> SourceViewerPanel generic shell
  -> getSourceRenderer(source)
  -> source-specific renderer definition
  -> source-specific view component
```

### Generic Shell

`SourceViewerPanel` is deliberately source-agnostic. It owns:

- open/closed rendering
- field label, value, and entity context
- recursive navigation history
- back and forward controls
- breadcrumbs
- close behavior
- delegating current source rendering to the registry

The shell must not import PDF, CSV, Excel, or composite view modules directly. It should not branch on concrete source types.

### Registry

`frontend/src/components/evidence/sourceViewer/registry.ts` is the single dispatch point that knows source discriminators.

`getSourceRenderer(source)` returns a `SourceRendererDefinition`:

```ts
type SourceRendererDefinition<TSource extends ProvenanceSource> = {
  Icon: ComponentType<{ className?: string }>;
  render: (props: SourceRendererProps<TSource>) => ReactNode;
  getTitle: (source: TSource) => string;
  getShortTitle: (source: TSource) => string;
  getGroupLabel: (source: TSource) => string;
};
```

Unsupported source shapes receive the fallback renderer instead of adding defensive branching to the panel.

### Renderer Definition vs View Component

A view component is the source-specific React UI and behavior. For example, `PdfSourceView` loads the PDF, renders the PDF viewer, jumps to the page, and highlights the quote.

A renderer definition is the adapter used by the registry. It provides metadata and a `render` function that instantiates the view.

Keep them split:

- `PdfSourceView.tsx`: source-specific component behavior.
- `pdfSourceRenderer.tsx`: registry-facing adapter and metadata.

This avoids fast-refresh warnings and keeps the extension seam obvious.

### Concrete Source Modules

| Module                      | Responsibility                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `CompositeSourceView.tsx`   | Shows calculation/reconciliation quote and nested source cards.                     |
| `PdfSourceView.tsx`         | Loads cached object URLs, renders PDF viewer, navigates pages, highlights quotes.   |
| `CsvSourceView.tsx`         | Loads cached text, parses CSV, renders a highlighted table.                         |
| `ExcelSourceView.tsx`       | Loads cached array buffers, parses workbook XML, renders worksheets as HTML tables. |
| `UnsupportedSourceView.tsx` | Generic unsupported-source empty state.                                             |

Shared source-agnostic UI lives in `sourceViewer/primitives.tsx`:

- `SourceLoadingState`
- `SourceErrorState`
- `SourceStatusMessage`
- `SourceTableView`

## Document Loading And Caching

`frontend/src/lib/documentCache.ts` is the single document cache for all source types.

It supports:

- blob/object URL loading for PDFs
- text loading for CSV
- array-buffer loading for XLSX
- cache keys based on `refreshUrl ?? url`
- refresh-on-401/403 through the backend resource URL route
- LRU eviction
- object URL revocation
- failed load exclusion from cache

Renderers should use this cache rather than calling `fetch` directly.

## CSV And Excel Rendering

CSV and Excel files are rendered as HTML tables, not embedded spreadsheet viewers.

Reasons:

- consistent UI with PDF/composite source views
- precise row, column, cell, and range highlighting
- lower runtime weight
- easier testing
- source viewer remains a document evidence panel, not a spreadsheet editor

CSV parsing lives in `frontend/src/lib/csv.ts`.

XLSX parsing lives in `frontend/src/lib/xlsx.ts`. It reads the zipped workbook package, shared strings, worksheets, rows, cells, and merged ranges needed by the viewer.

## Adding A New Source Type

To add a new source type:

1. Add a discriminated source type in `frontend/src/types.ts`.
2. Add a source-specific view component under `sourceViewer/renderers`.
3. Add a renderer definition with icon, titles, group label, and render function.
4. Register the renderer in `sourceViewer/registry.ts`.
5. Add registry tests for metadata and fallback behavior.
6. Add renderer tests for loading, error, and highlight/navigation behavior.
7. Add integration or e2e coverage if the source type appears in seeded data.

Do not add source-specific branching to `SourceViewerPanel`.

## Testing Map

| Test file                                         | Coverage                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SourceViewerPanel.test.tsx`                      | Generic shell behavior: closed state, field metadata, back/forward, reset, sibling source merge, renderer delegation. |
| `sourceViewer/registry.test.tsx`                  | Factory dispatch, renderer metadata, unsupported fallback.                                                            |
| `sourceViewer/renderers/SourceRenderers.test.tsx` | Composite navigation and PDF/CSV/Excel renderer behavior.                                                             |
| `lib/documentCache.test.ts`                       | cache reuse, refresh, eviction, object URL cleanup, failed load behavior.                                             |
| `lib/csv.test.ts`                                 | CSV parser behavior.                                                                                                  |
| `lib/xlsx.test.ts`                                | Workbook parser and range matching.                                                                                   |
| `pages/AssetDetailPage.test.tsx`                  | Docked panel integration with asset detail layout.                                                                    |
| `e2e/asset-evidence.spec.ts`                      | Browser-level source viewer flows against the running app.                                                            |

## Local Development

From `frontend/`:

```bash
npm install
npm run dev
```

Common checks:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run e2e
```

The e2e tests expect the app and backend stack to be running with seeded data. The Docker compose frontend is exposed on `http://localhost:5173`.

## Design Rules

- Keep operational pages dense, clear, and scan-friendly.
- Source viewer opens docked inside the asset detail page, not as an overlay that hides the main content.
- The docked viewer is resizable; the main asset container must remain responsive.
- Asset field grids must reflow as width changes and should not stay fixed at three columns when squeezed.
- Use source-count buttons for fields with provenance.
- Prefer composite roots when opening source evidence so users can inspect calculation stacks before drilling into documents.
- Use generic source wording in shared UI. Concrete source labels belong in renderers.
