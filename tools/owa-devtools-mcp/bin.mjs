#!/usr/bin/env node
// The stdio front door of `owa-devtools-mcp` -- what an MCP client outside the
// app spawns:
//
//   claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs
//
// The same command is the `open-worship-app-mcp` bin of the npm package and,
// wrapped in a Node single executable, `mcp/open-worship-app-mcp` in the
// extra-bin pack -- one body (`stdio.mjs`, `bridge.mjs`) behind all three.
// The app itself serves the SAME server over HTTP (`host.mjs`), for the in-app
// chatbot and for any client that would rather connect than spawn.
//
// `--bridge --listen=<port>` runs neither: it forwards a fixed local port to
// whatever debugging port the app is on right now, for a client that can only
// be pointed at one hardcoded URL. It never loads the MCP server, so its
// modules are imported only on the path that needs them.
//
// Everything printed here goes to stderr; stdout is the MCP protocol channel.

process.title = 'owa-devtools-mcp';

const argv = process.argv.slice(2);

function readFlagValue(name) {
  const prefix = `--${name}=`;
  return argv
    .find((arg) => {
      return arg.startsWith(prefix);
    })
    ?.slice(prefix.length);
}

if (argv.includes('--bridge')) {
  const { runOwaMcpBridge } = await import('./bridge.mjs');
  await runOwaMcpBridge({ listenPort: Number(readFlagValue('listen') ?? 0) });
} else {
  const { runOwaMcpStdioServer } = await import('./stdio.mjs');
  await runOwaMcpStdioServer({
    argv: argv.filter((arg) => {
      return arg !== '--bridge' && !arg.startsWith('--listen=');
    }),
  });
  const shutdown = () => {
    process.exit(0);
  };
  process.stdin.on('end', shutdown);
  process.stdin.on('close', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
