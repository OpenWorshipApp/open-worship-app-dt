# Project Guidelines

## Architecture

- This repository is a desktop application split across a React renderer in `src/` and an Electron main process in `electron/`. The renderer is bundled from `html/*.html` by Vite into `dist/`, while the main process is compiled by TypeScript into `electron-build/`.
- Renderer code should use `src/server/appProvider.ts` and the helpers in `src/server/` for filesystem, clipboard, SQLite, OS, and IPC access. Do not import Electron or Node-only APIs into renderer code unless the capability is already exposed through the provider layer.
- Custom async renderer-to-main communication uses `electronSendAsync()` in `src/server/appHelpers.ts` plus a generated `replyEventName`; corresponding handlers live in `electron/electronEventListener.ts`. Keep channel names and payload shapes synchronized on both sides.
- File conversion and heavy document processing run outside the renderer: worker scripts live in `public/js/`, Electron wrappers live in `electron/`, and the bundled .NET helper lives under `extra-work/bin-helper/`.
- Agent debugging is opt-in and split across `electron/agentDebugServer.ts` in the main process and `src/server/agentDebugHelpers.ts` in the renderer. `src/boot.ts` initializes the renderer bridge on every page.

## Build and Test

- `npm run dev` starts Vite plus the Electron app in development mode.
- `npm run dev:agent` starts or reuses a local dev session with the loopback agent debug server enabled on `127.0.0.1:47831` by default.
- `npm run lint` is the default final validation command after code changes in this repo. It runs the repository validation chain, including tests, typecheck, formatting, eslint, and build.
- `npm run test` runs renderer tests, and `npm run test:electron` runs Electron main-process tests.
- `npm run build` produces the production renderer and Electron outputs. Use this after cross-cutting changes that touch both targets.
- If you change `extra-work/bin-helper/Helper.cs` or the Office helper pipeline, rebuild with `bash extra-work/bin-helper/build.sh` and then rerun `npm run electron:build`.

## Conventions

- Most page entrypoints follow the same pattern: `html/<page>.html` loads `src/<page>.tsx`. Shared boot logic lives in `src/boot.ts`.
- Naming is meaningful: `*Controller` usually owns stateful workflows, `*Manager` coordinates persistence or cross-module behavior, and `*Helpers` provides reusable utilities.
- Settings persistence is handled in `electron/ElectronSettingManager.ts`, and renderer navigation is handled in `src/router/routeHelpers.tsx`.
- Register agent-visible renderer state close to the owning page or feature shell with `registerAgentDebugProvider()` or `setAgentDebugData()`. Keep payloads small and JSON-like.
- For renderer styling, check Bootstrap utility classes and existing Bootstrap-compatible patterns first before creating new SCSS rules. Add custom styles only when Bootstrap cannot express the requirement cleanly.
- Avoid manual edits in generated or packaged outputs such as `electron-build/`, `dist/`, and release artifacts under `release/`.
- `REACT.md` is legacy Create React App boilerplate and is not authoritative for this repo.
- Use the detailed repository reference at `.github/skills/open-worship-project/references/repo-guide.md` before making structural changes.
- Use `.github/skills/open-worship-project/references/agent-debugging.md` when working on the live inspection surface or teaching another agent how it works.
- Use the functionality inventory at `.github/skills/open-worship-project/references/functionality-inventory.md` when planning feature-specific skills or breaking the repo into smaller AI work areas.
