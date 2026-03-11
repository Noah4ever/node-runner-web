# Node Runner Web Platform

Web platform for the [Node Runner](https://github.com/Noah4ever/node_runner) Blender addon. Paste, inspect, convert, share, and visualize Blender shader node trees in the browser.

## Architecture

```
node-runner-web/
├── apps/
│   ├── api/          Fastify API server (port 4000)
│   └── web/          React + Vite frontend (port 3000)
├── packages/
│   ├── config/       Shared tsconfig presets
│   ├── shared/       TypeScript types (NodeTree, NodeFormat, etc.)
│   ├── schemas/      Zod request/response schemas
│   ├── node-runner-core/  Format detection, parsing, conversion logic
│   └── ui/           Shared UI utilities (cn helper)
```

### Apps

**`apps/api`** — Fastify + TypeScript backend with modular route structure:
- `modules/health` — Health check
- `modules/parse` — Format detection
- `modules/validate` — Input validation
- `modules/convert` — Format conversion
- `modules/inspect` — Node tree inspection
- `modules/share` — Shareable pages (in-memory store, Prisma schema ready)
- `modules/diff` — Node tree comparison
- `modules/ai` — AI explanations (placeholder)

**`apps/web`** — React 19 + Vite + Tailwind v4 frontend:
- Home page with hero, format cards, feature grid
- Paste & Inspect page with format detection
- Convert page with format selector
- Diff page with side-by-side comparison
- Shared node page with metadata sidebar
- Docs page with API reference table
- 404 page

### Packages

**`@node-runner/shared`** — Domain types used everywhere: `NodeTree`, `NodeData`, `NodeLink`, `NodeFormat`, `DiffResult`, `ApiResponse`, etc.

**`@node-runner/schemas`** — Zod schemas for all API endpoints. Single source of truth for request/response validation.

**`@node-runner/core`** — Domain logic with pluggable interfaces:
- `FormatDetector` — Detect Hash/JSON/XML/AI JSON from raw input
- `Parser` — Parse raw input into a normalized `NodeTree`
- `Converter` — Convert between formats
- `Validator` — Validate input for a given format
- Placeholder implementations included, designed for real addon logic to be dropped in

**`@node-runner/ui`** — `cn()` utility (clsx + tailwind-merge), ready for shared components.

**`@node-runner/config`** — Shared TypeScript configs: `tsconfig.base.json`, `tsconfig.react.json`, `tsconfig.node.json`.

## Setup

```bash
pnpm install
```

## Development

```bash
# Start both apps
pnpm dev

# Start individually
pnpm --filter @node-runner/api dev    # API on :4000
pnpm --filter @node-runner/web dev    # Web on :3000
```

The web dev server proxies `/api` requests to the API server.

## Database

Prisma with PostgreSQL. Schema at `apps/api/prisma/schema.prisma`.

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Push schema to database
pnpm db:studio     # Open Prisma Studio
```

## Type Checking

```bash
pnpm lint          # TypeScript check all packages
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/parse/detect-format` | Detect input format |
| POST | `/api/v1/validate` | Validate node data |
| POST | `/api/v1/inspect` | Parse and inspect node tree |
| POST | `/api/v1/convert` | Convert between formats |
| POST | `/api/v1/diff` | Compare two node trees |
| POST | `/api/v1/ai/explain` | AI explanation (placeholder) |
| POST | `/api/v1/share` | Create shared page |
| GET | `/api/v1/share/:id` | Get shared page |

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind v4, React Router, Zustand, TanStack Query
- **Backend:** Fastify, TypeScript, Zod, Prisma, PostgreSQL
- **Monorepo:** pnpm workspaces, Turborepo
- **Future:** React Flow for graph rendering, Redis for caching, Framer Motion for animations
