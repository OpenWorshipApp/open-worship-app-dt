/**
 * The main process's own stdout and stderr lead to whatever started it --
 * `electron/cli.js` under nodemon in development. When that launcher goes
 * away and the app stays up, the next `console.log` writes into a closed
 * pipe: Node raises EPIPE on the stream, and a stream error nobody listens
 * for is an uncaught exception. Electron then puts up _A JavaScript error
 * occurred in the main process_ and the main process stops on it -- every
 * window, the MCP door and the CDP door with it (seen 2026-11-07: a
 * settings save's `Setting saved` line, with the dev watcher gone).
 *
 * A log line that cannot be written is not worth the app, so a broken or
 * closed pipe is ignored here; any other stream error is left to throw as
 * before. A leaf module: nothing but Node's own types.
 */

const IGNORED_CODE_SET = new Set(['EPIPE', 'ERR_STREAM_DESTROYED', 'EOF']);

type ErrorStreamType = {
    on: (event: 'error', listener: (error: unknown) => void) => unknown;
};

export function checkIsBrokenPipeError(error: unknown) {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && IGNORED_CODE_SET.has(code);
}

/** Makes a write into a closed pipe harmless on each stream given. */
export function guardBrokenPipes(streams: (ErrorStreamType | undefined)[]) {
    for (const stream of streams) {
        stream?.on('error', (error: unknown) => {
            if (checkIsBrokenPipeError(error)) {
                return;
            }
            throw error;
        });
    }
}
