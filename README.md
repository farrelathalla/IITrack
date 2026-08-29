## Inkubator IT — Next.js Template

Standardized Next.js frontend template for projects in the Inkubator IT GitHub organization. Built and maintained by the DevOps team to unify stack choices, local development, containerization, and deployment conventions across client projects.

### Tech stack
- **Runtime**: Bun (scripts, tooling)
- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript
- **UI**: Tailwind CSS v4
- **Icons**: lucide-react
- **Quality**: Biome (lint & format)
- **Containerization**: Docker (Next.js standalone, Bun runtime)

### Project structure
```
.
├─ src/
│  ├─ app/                # App Router (layouts, pages, styles)
│  │  ├─ globals.css      # Tailwind v4 + theme tokens
│  │  ├─ layout.tsx       # Root layout
│  │  └─ page.tsx         # Example landing page
│  └─ lib/
│     └─ utils.ts         # Shared utilities (e.g., cn)
├─ public/                # Static assets served as-is
│  ├─ logo-iit.png
│  ├─ next-white.svg
│  └─ ...
├─ next.config.ts         # Next.js config (output: standalone)
├─ .env.example           # Environment variables example
├─ postcss.config.mjs     # Tailwind v4 via PostCSS
├─ components.json        # UI components registry (shadcn config)
├─ biome.json             # Biome config (lint/format)
├─ tsconfig.json          # TypeScript config (alias `@` → `src`)
├─ package.json           # Scripts and deps
└─ Dockerfile             # Multi-stage build (Bun build → Bun runtime)
```

### Prerequisites
- **Bun** installed (`bun --version`)
- **Docker** (optional, for container builds)

### Getting started (local development)
1) Create a new repository from this template in the Inkubator IT organization.
2) Clone your new repository.
3) Copy `.env.example` to `.env.local` (or `.env`) and fill in values.
    - `NEXT_PUBLIC_API_URL` is the URL of the API.
4) Install dependencies:
```sh
bun install
```
5) Start the dev server (Turbopack):
```sh
bun run dev
```
6) Open `http://localhost:3000`.
7) Edit `src/app/page.tsx` to try HMR.

### Environment variables
Next.js loads env files automatically. Server-side variables are always available via `process.env`. To expose a variable to the browser, prefix it with `NEXT_PUBLIC_`.

- Place env files at the project root: `.env.local`, `.env.development`, `.env.production`, etc.
- Use `NEXT_PUBLIC_*` for variables needed on the client.

Example `.env.local`:
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Use in server code (RSC/route handlers):
```ts
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

Use in client code (or shared code executed on the client):
```ts
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

### Scripts
- **dev**: `next dev --turbopack`
- **build**: `next build --turbopack`
- **start**: `next start`
- **lint**: `biome check`
- **lint:fix**: `biome check --write`
- **format**: `biome format --write`

Run examples:
```sh
bun run dev
bun run build && bun run start
bun run lint
```

### Aliases
TypeScript paths are configured for cleaner imports:

- **Alias**: `@` → `./src`

Example:
```ts
import { cn } from "@/lib/utils";
```

### Styling
- Tailwind CSS v4 is preconfigured via `@import "tailwindcss"` in `src/app/globals.css`.
- Light/dark design tokens are provided; apply `.dark` on `<html>` or any parent node to switch.
- Includes `tw-animate-css` for simple animations.

### Run with Docker
This repo provides a multi-stage Dockerfile using Bun for both build and runtime, leveraging Next.js `output: "standalone"`.

Build the production image:
```sh
docker build -t inkubatorit/nextjs-template .
```
Run the container:
```sh
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  inkubatorit/nextjs-template
```
Open `http://localhost:3000`.

Pass environment variables as needed (server-side only) using `-e` or an env file.

### Code quality
Run Biome locally before commits:
```sh
bun run lint
bun run format
```

### Deployment notes
- Production build emits a standalone server in `.next/standalone` and static assets in `.next/static`.
- Dockerfile copies `public/`, `.next/standalone`, and `.next/static`, then runs `server.js` with Bun in a minimal image.
- Telemetry is disabled in the image via `NEXT_TELEMETRY_DISABLED=1`. Remove or change if you prefer.
- If hosting behind a sub-path or CDN, configure `basePath`/`assetPrefix` in `next.config.ts` and ensure links and asset URLs respect them.

### Troubleshooting
- If native deps fail on Alpine (musl), add `libc6-compat` in the `deps` stage (see Dockerfile comment).
- Tailwind not applying? Ensure classes are in files under `src/` and the dev server was restarted after dependency changes.
- Type errors from path aliases? Verify `tsconfig.json` has `"@/*": ["./src/*"]` and the dev server was restarted.

### Contributing
Maintained by the **Inkubator IT DevOps** team. Contributions are welcome via Pull Requests. For significant changes, please open an Issue first for discussion.

### Support
For questions or support, contact the Inkubator IT DevOps team.

### License
Copyright (c) Inkubator IT. All rights reserved.
