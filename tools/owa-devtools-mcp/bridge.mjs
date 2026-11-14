// `--bridge --listen=<port>`: forwards a fixed local port to whatever debugging
// port the app is on right now, for a client that can only be pointed at one
// hardcoded URL. Run by the CLI (`bin.mjs`) and by the package API
// (`index.mjs`). Light on purpose: no MCP server, no chrome-devtools-mcp.

import net from 'node:net';

import { connectToCdp } from './discovery.mjs';
import { logToStderr } from './stderrLog.mjs';

/**
 * Listens on `listenPort` (0: any free port) on loopback and pipes every
 * client to the app's CDP endpoint of the moment. Resolves once listening;
 * rejects when the port cannot be had (`EADDRINUSE`).
 */
export async function runOwaMcpBridge({
  listenPort = 0,
  log = logToStderr,
} = {}) {
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
  const { port } = server.address();
  log(`bridge listening on http://127.0.0.1:${port}`);
  return {
    port,
    close: () => {
      return new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
