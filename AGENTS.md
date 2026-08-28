# Repository Instructions

## Project Purpose

Raddus Canvas is a local web app for building, configuring, and running Claude managed-agent projects from a visual canvas. It ships as the `@raddus/canvas` npm package and runs a loopback Node.js server with a React/Vite frontend.

## Architecture

- `bin/raddus-canvas.mjs` is the published CLI entrypoint.
- `server.mjs` is a compatibility launcher from the repository root.
- `server/` contains the local Node.js server, Anthropic proxy, session handling, security checks, static asset serving, and JSON-backed local storage.
- `src/main.tsx` mounts the React app.
- `src/App.tsx` owns the main frontend controller and feature views.
- `src/api/`, `src/auth/`, `src/domain/`, `src/features/`, `src/storage/`, and `src/theme/` hold frontend API adapters, auth UI, domain helpers, feature areas, persistence helpers, and styling tokens.
- `src/generated/` contains generated frontend support files. Avoid hand-editing it unless the generator source is unavailable and the change is documented in the PR.
- `public/` contains static assets copied by Vite.
- `dist/`, `node_modules/`, and local `.env*` files are ignored build/runtime artifacts.

## Tooling And Setup

- Use npm for this repository. `package-lock.json` is the package-manager lockfile; do not add `pnpm`, Yarn, or Bun lockfiles.
- Use Node.js 22 for CI parity. The Vite dependency chain requires Node `^20.19.0 || >=22.12.0`.
- Install dependencies with:

```shell
npm ci
```

- For local iterative development:

```shell
npm run dev
```

- For a production-like local server after building:

```shell
npm run preview
```

## Validation Commands

- Type-check the frontend:

```shell
npm run typecheck
```

- Run the current test entrypoint. This is typecheck-only until a dedicated test framework is added:

```shell
npm run test
```

- Build and verify the production bundle:

```shell
npm run verify
```

`npm run build` and `npm run verify` type-check `src` through `tsconfig.json`, then run `vite build`. The server `.mjs` files are not type-checked by the current TypeScript configuration, so server changes need focused manual or CLI smoke testing in addition to the build.

## Coding Standards

- Keep changes scoped to the relevant frontend feature, server module, or domain helper.
- Prefer existing plain React, TypeScript, and CSS patterns over new frameworks or state libraries.
- Keep Node server modules as ESM `.mjs` files unless a broader migration is explicitly approved.
- Keep browser API access behind the local server proxy when Anthropic credentials are involved.
- Do not introduce a formatter, linter, test framework, or package-manager change as part of unrelated feature work.
- Use concise comments only for non-obvious control flow, security checks, or cross-process behavior.

## Environment Policy

- `.env.example` is the public template for local environment variables.
- Supported local variables include `PORT` and `RADDUS_CANVAS_DATA_FILE`.
- Do not commit Anthropic API keys, generated credentials, local data files, keychain exports, or captured session cookies.
- The app is designed to bind to `127.0.0.1`; preserve loopback-only behavior unless a security review explicitly approves a change.

## Pull Request Workflow

- Work on a branch and open a pull request; do not commit directly to `main`.
- Link the relevant issue when one exists.
- Include a short summary, validation commands with outcomes, and user-visible risk notes in the PR.
- Run `npm run typecheck` and `npm run verify` before requesting review when the change touches code, build config, or dependencies.
- Treat `publish:*` scripts as release commands. Do not run them unless the user explicitly asks for a package publish.

## Safety Rules

- Do not run destructive git commands such as `git reset --hard` or broad cleanups unless explicitly requested.
- Do not delete user data, local app data, or generated project state as part of routine fixes.
- Do not change GitHub branch protection, repository settings, npm package metadata, or production publishing settings without explicit approval for that exact remote change.
- Keep dependency updates separate from feature or documentation changes unless the dependency change is required to complete the task.
