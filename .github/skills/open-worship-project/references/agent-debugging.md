# Agent Debugging Guide

## Purpose

Use the agent debug surface when a local tool or coding agent needs a live view of the running Electron app instead of static code inspection alone. The current surface is intentionally read-only: it exposes screenshots, DOM snapshots, and structured renderer data over a loopback HTTP server.

## Startup Flow

The standard entrypoint is `npm run dev:agent`.

That command runs `extra-work/dev-agent.mjs`, which:

1. Checks whether the agent debug server is already running on `http://127.0.0.1:47831/health`.
2. Reuses an existing Vite dev server on `https://127.0.0.1:3000` when available, or starts one on that exact host and port.
3. Runs `npm run electron:build`.
4. Launches Electron with `OPEN_WORSHIP_AGENT_DEBUG=1`.

If a healthy agent debug session is already active, the launcher exits cleanly instead of starting a duplicate app instance.

## Environment Variables

- `OPEN_WORSHIP_AGENT_DEBUG=1`: enables the loopback debug server.
- `OPEN_WORSHIP_AGENT_DEBUG_PORT=<port>`: overrides the default port `47831`.
- `OPEN_WORSHIP_AGENT_DEBUG_TOKEN=<token>`: requires either `Authorization: Bearer <token>` or `?token=<token>` on requests.

## Runtime Architecture

The debug workflow spans Electron and renderer code.

### Electron side

- `electron/index.ts` calls `maybeStartAgentDebugServer()` during app startup.
- `electron/agentDebugServer.ts` binds a local HTTP server to `127.0.0.1`.
- The server reads the current `BrowserWindow` state, captures screenshots with `capturePage()`, and executes a renderer snapshot script with `webContents.executeJavaScript()`.

### Renderer side

- `src/boot.ts` calls `initAgentDebugBridge()` on every renderer page.
- `src/server/agentDebugHelpers.ts` installs `globalThis.__OPEN_WORSHIP_AGENT_DEBUG__`.
- Pages and feature shells can publish structured data through:
  - `setAgentDebugData(key, value)` for direct values.
  - `registerAgentDebugProvider(key, provider)` for live computed snapshots.

Provider data is sanitized in the renderer before it is returned to Electron. Keep values JSON-like, bounded, and focused on user-visible state.

## Endpoints

All endpoints are GET-only and loopback-only.

- `/health`: readiness probe.
- `/snapshot`: full app, window, renderer, and registered provider snapshot.
- `/dom`: renderer-only snapshot, including page title, active element, viewport, text, HTML, and storage.
- `/screenshot.png`: PNG capture of the current main window.

`/snapshot` is the most useful default endpoint because it includes:

- app metadata such as version, pid, host, and port
- BrowserWindow bounds, current URL, and zoom factor
- renderer DOM and storage summary
- `customData.registeredData`
- `customData.providerData`

## Extending The Debug Surface

When adding agent-visible state:

1. Prefer `registerAgentDebugProvider()` close to the component or controller that already owns the relevant UI state.
2. Return summaries instead of entire controller objects.
3. Keep arrays, objects, and strings small enough that snapshots stay readable.
4. Clean up provider registrations when the owning component unmounts.

When changing the Electron server:

1. Keep the server bound to `127.0.0.1`.
2. Preserve opt-in startup through environment variables.
3. Treat the current surface as read-only.
4. If write actions are ever added later, use explicit authenticated routes and avoid exposing arbitrary renderer code execution.

## Recommended Validation

- For docs-only changes, no runtime validation is required.
- For debug-surface code changes, start `npm run dev:agent` and verify:
  - `/health` responds with `200`
  - `/snapshot` returns the expected provider data
  - `/screenshot.png` returns a valid PNG
- Finish code changes with `npm run lint` unless the user asked for a narrower validation scope.
