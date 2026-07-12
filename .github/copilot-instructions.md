# Copilot Instructions

## Use Chrome DevTools MCP for UI verification

For any change that affects UI, behavior, or user-visible state:

1. Use the Chrome DevTools MCP tools (`mcp_chrome_devtoo_*`) against the running app to validate the actual rendered result.
2. Do not consider the task done with lint/build/tests alone.
3. Capture at least one screenshot of the relevant screen state.
4. Check console messages for new errors and verify there are no regressions in the touched flow.

This project already exposes the MCP server in `.mcp.json` as `chrome-devtools`.
