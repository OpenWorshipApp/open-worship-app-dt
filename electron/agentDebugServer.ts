import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import { app } from 'electron';

import type ElectronAppController from './ElectronAppController';

const AGENT_DEBUG_HOST = '127.0.0.1';
const DEFAULT_AGENT_DEBUG_PORT = 47831;
const AGENT_DEBUG_ENABLED_VALUE = '1';
const RENDERER_SNAPSHOT_SCRIPT = `
(() => {
    const limitText = (value, maxLength = 20000) => {
        if (typeof value !== 'string') {
            return '';
        }
        if (value.length <= maxLength) {
            return value;
        }
        return value.slice(0, maxLength);
    };
    const sanitizeValue = (value, depth = 0) => {
        if (depth > 4) {
            return '[max-depth]';
        }
        if (value === null || value === undefined) {
            return value ?? null;
        }
        if (typeof value === 'string') {
            return limitText(value, 5000);
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
        }
        if (typeof value === 'object') {
            const result = {};
            for (const [key, item] of Object.entries(value).slice(0, 50)) {
                result[key] = sanitizeValue(item, depth + 1);
            }
            return result;
        }
        return String(value);
    };
    const readStorage = (storage) => {
        const result = {};
        const maxStorageItems = Math.min(storage.length, 50);
        for (let i = 0; i < maxStorageItems; i += 1) {
            const key = storage.key(i);
            if (key === null) {
                continue;
            }
            result[key] = limitText(storage.getItem(key) ?? '', 5000);
        }
        return result;
    };
    const activeElement = document.activeElement;
    const debugBridge = globalThis.__OPEN_WORSHIP_AGENT_DEBUG__;
    const customSnapshot =
        typeof debugBridge?.getSnapshot === 'function'
            ? debugBridge.getSnapshot()
            : null;
    return Promise.resolve(customSnapshot)
        .then((customData) => {
            return {
                title: document.title,
                locationHref: globalThis.location?.href ?? '',
                readyState: document.readyState,
                viewport: {
                    width: globalThis.innerWidth ?? 0,
                    height: globalThis.innerHeight ?? 0,
                    scrollX: globalThis.scrollX ?? 0,
                    scrollY: globalThis.scrollY ?? 0,
                },
                activeElement: activeElement
                    ? {
                          tagName: activeElement.tagName,
                          id: activeElement.id || null,
                          className: activeElement.className || null,
                          ariaLabel:
                              activeElement.getAttribute?.('aria-label') ?? null,
                          text: limitText(activeElement.textContent ?? '', 1000),
                      }
                    : null,
                bodyText: limitText(document.body?.innerText ?? '', 20000),
                bodyHtml: limitText(document.body?.innerHTML ?? '', 200000),
                localStorage: readStorage(globalThis.localStorage),
                sessionStorage: readStorage(globalThis.sessionStorage),
                customData,
                timestamp: new Date().toISOString(),
            };
        })
        .catch((error) => {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        });
})()
`;

export type AgentRendererSnapshotType = {
    title?: string;
    locationHref?: string;
    readyState?: string;
    viewport?: {
        width: number;
        height: number;
        scrollX: number;
        scrollY: number;
    };
    activeElement?: {
        tagName: string;
        id: string | null;
        className: string | null;
        ariaLabel: string | null;
        text: string;
    } | null;
    bodyText?: string;
    bodyHtml?: string;
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
    customData?: unknown;
    timestamp?: string;
    error?: string;
};

export type AgentWindowSnapshotType = {
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    url: string;
    zoomFactor: number;
};

export type AgentDebugSnapshotType = {
    app: {
        name: string;
        version: string;
        pid: number;
        debugHost: string;
        debugPort: number;
        timestamp: string;
    };
    window: AgentWindowSnapshotType;
    renderer: AgentRendererSnapshotType;
    endpoints: {
        health: string;
        snapshot: string;
        dom: string;
        screenshot: string;
    };
};

export type AgentDebugServerHandleType = {
    baseUrl: string;
    port: number;
    close: () => Promise<void>;
};

function isAgentDebugEnabled() {
    return process.env.OPEN_WORSHIP_AGENT_DEBUG === AGENT_DEBUG_ENABLED_VALUE;
}

function getAgentDebugPort() {
    const rawPort = Number.parseInt(
        process.env.OPEN_WORSHIP_AGENT_DEBUG_PORT ?? '',
        10,
    );
    if (Number.isNaN(rawPort)) {
        return DEFAULT_AGENT_DEBUG_PORT;
    }
    return rawPort;
}

function getAgentDebugToken() {
    return process.env.OPEN_WORSHIP_AGENT_DEBUG_TOKEN ?? null;
}

function addCommonHeaders(response: ServerResponse) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store');
}

function writeJson(
    response: ServerResponse,
    statusCode: number,
    data: unknown,
) {
    addCommonHeaders(response);
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(data, null, 2));
}

function checkIsAuthorized(
    request: IncomingMessage,
    url: URL,
    token: string | null,
) {
    if (token === null || token.length === 0) {
        return true;
    }
    const authHeader = request.headers.authorization;
    if (authHeader === `Bearer ${token}`) {
        return true;
    }
    return url.searchParams.get('token') === token;
}

async function getRendererSnapshot(
    appController: ElectronAppController,
): Promise<AgentRendererSnapshotType> {
    try {
        return await appController.mainWin.webContents.executeJavaScript(
            RENDERER_SNAPSHOT_SCRIPT,
        );
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function getWindowScreenshot(appController: ElectronAppController) {
    const image = await appController.mainWin.webContents.capturePage();
    return image.toPNG();
}

async function getAgentDebugSnapshot(
    appController: ElectronAppController,
    baseUrl: string,
    port: number,
): Promise<AgentDebugSnapshotType> {
    const win = appController.mainWin;
    const bounds = win.getBounds();
    const renderer = await getRendererSnapshot(appController);
    return {
        app: {
            name: app.name,
            version: app.getVersion(),
            pid: process.pid,
            debugHost: AGENT_DEBUG_HOST,
            debugPort: port,
            timestamp: new Date().toISOString(),
        },
        window: {
            bounds,
            url: win.webContents.getURL(),
            zoomFactor: win.webContents.getZoomFactor(),
        },
        renderer,
        endpoints: {
            health: `${baseUrl}/health`,
            snapshot: `${baseUrl}/snapshot`,
            dom: `${baseUrl}/dom`,
            screenshot: `${baseUrl}/screenshot.png`,
        },
    };
}

export async function startAgentDebugServer(
    appController: ElectronAppController,
    {
        host = AGENT_DEBUG_HOST,
        port = getAgentDebugPort(),
        token = getAgentDebugToken(),
        log = console.log,
    }: {
        host?: string;
        port?: number;
        token?: string | null;
        log?: (...messages: any[]) => void;
    } = {},
): Promise<AgentDebugServerHandleType> {
    const server = createServer(async (request, response) => {
        const requestUrl = new URL(
            request.url ?? '/',
            `http://${host}:${port}`,
        );
        if (!checkIsAuthorized(request, requestUrl, token)) {
            writeJson(response, 401, {
                error: 'Unauthorized',
            });
            return;
        }
        if (request.method === 'OPTIONS') {
            addCommonHeaders(response);
            response.statusCode = 204;
            response.end();
            return;
        }
        if (requestUrl.pathname === '/' || requestUrl.pathname === '/health') {
            writeJson(response, 200, {
                ok: true,
                message: 'Open Worship agent debug server is running',
            });
            return;
        }
        if (requestUrl.pathname === '/dom') {
            const rendererSnapshot = await getRendererSnapshot(appController);
            writeJson(response, 200, rendererSnapshot);
            return;
        }
        if (requestUrl.pathname === '/snapshot') {
            const address = server.address() as AddressInfo;
            const baseUrl = `http://${host}:${address.port}`;
            const snapshot = await getAgentDebugSnapshot(
                appController,
                baseUrl,
                address.port,
            );
            writeJson(response, 200, snapshot);
            return;
        }
        if (requestUrl.pathname === '/screenshot.png') {
            try {
                const screenshot = await getWindowScreenshot(appController);
                addCommonHeaders(response);
                response.statusCode = 200;
                response.setHeader('Content-Type', 'image/png');
                response.end(screenshot);
            } catch (error) {
                writeJson(response, 500, {
                    error:
                        error instanceof Error ? error.message : String(error),
                });
            }
            return;
        }
        writeJson(response, 404, {
            error: 'Not found',
            endpoints: ['/', '/health', '/snapshot', '/dom', '/screenshot.png'],
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://${host}:${address.port}`;
    log(`[agent-debug] listening on ${baseUrl}`);
    log('[agent-debug] endpoints: /health /snapshot /dom /screenshot.png');
    if (token) {
        log('[agent-debug] authorization token is required');
    }
    const close = async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    };
    app.on('before-quit', () => {
        void close().catch(() => {});
    });
    return {
        baseUrl,
        port: address.port,
        close,
    };
}

export async function maybeStartAgentDebugServer(
    appController: ElectronAppController,
) {
    if (!isAgentDebugEnabled()) {
        return null;
    }
    return await startAgentDebugServer(appController);
}
