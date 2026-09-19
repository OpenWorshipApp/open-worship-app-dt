#!/usr/bin/env node
// The stdio front door of `owa-devtools-mcp` -- what an MCP client outside the
// app spawns:
//
//   claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs
//
// The app itself serves the SAME server over HTTP (`host.mjs`), for the in-app
// chatbot and for any client that would rather connect than spawn.
//
// `--bridge --listen=<port>` runs neither: it forwards a fixed local port to
// whatever debugging port the app is on right now, for a client that can only
// be pointed at one hardcoded URL.
//
// Everything printed here goes to stderr; stdout is the MCP protocol channel.

import net from 'node:net';

import { StdioServerTransport } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { connectToCdp } from './discovery.mjs';
import { createOwaMcpServer } from './server.mjs';

process.title = 'owa-devtools-mcp';

const argv = process.argv.slice(2);

function log(...items) {
    console.error('[owa-devtools-mcp]', ...items);
}

function readFlagValue(name) {
    const prefix = `--${name}=`;
    return argv
        .find((arg) => {
            return arg.startsWith(prefix);
        })
        ?.slice(prefix.length);
}

async function startBridge(listenPort) {
    const server = net.createServer(async (clientSocket) => {
        clientSocket.on('error', () => {});
        try {
            const { socket, port } = await connectToCdp({
                // Without this the bridge finds its own listener through the
                // legacy fallback port and forwards to itself, forever.
                excludePorts: [listenPort],
            });
            clientSocket.pipe(socket);
            socket.pipe(clientSocket);
            socket.on('error', () => {
                clientSocket.destroy();
            });
            clientSocket.on('close', () => {
                socket.destroy();
            });
            log(`forwarding a connection to 127.0.0.1:${port}`);
        } catch (error) {
            // The app is not up. A refused connection is what every client
            // already knows how to report, and they retry per call -- so
            // starting the app is enough to recover.
            log(error.message);
            clientSocket.destroy();
        }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(listenPort, '127.0.0.1', resolve);
    });
    log(`bridge listening on http://127.0.0.1:${server.address().port}`);
}

if (argv.includes('--bridge')) {
    await startBridge(Number(readFlagValue('listen') ?? 0));
} else {
    const { server } = await createOwaMcpServer({
        argv: argv.filter((arg) => {
            return arg !== '--bridge' && !arg.startsWith('--listen=');
        }),
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('connected over stdio');
    const shutdown = () => {
        process.exit(0);
    };
    process.stdin.on('end', shutdown);
    process.stdin.on('close', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
