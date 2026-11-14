// What the stdio front door says about itself. Always stderr: on the stdio door
// stdout IS the MCP protocol channel, and one stray line there breaks the
// client's parser.

export function logToStderr(...items) {
  console.error('[owa-devtools-mcp]', ...items);
}
