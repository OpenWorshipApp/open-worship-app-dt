// Types for `index.mjs`, the JavaScript API of the `open-worship-app-mcp` npm
// package. Self-contained on purpose: a consumer needs no MCP SDK types, and
// any SDK transport fits `OwaMcpTransport`.

/**
 * A running Open Worship App, as its discovery file publishes it -- minus the
 * token of its MCP door, which this API never hands out.
 */
export type OwaAppInstance = {
  pid?: number;
  /** Its Chrome DevTools Protocol port on 127.0.0.1. */
  port: number;
  url?: string;
  /** Its in-app MCP door (streamable HTTP), when AI features are on. */
  mcpUrl?: string | null;
  isDev?: boolean;
  version?: string;
  userDataPath?: string;
  /** ISO time; the newest instance is the one driven by default. */
  startedAt?: string;
  /** The language plugins it has installed. */
  langDirs?: string[];
};

/** One JSON-RPC 2.0 message, as an MCP transport carries it. */
export type OwaJsonRpcMessage = {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

/** The MCP SDK's `Transport` shape. */
export interface OwaMcpTransport {
  start(): Promise<void>;
  send(message: OwaJsonRpcMessage, options?: unknown): Promise<void>;
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: OwaJsonRpcMessage, extra?: unknown) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
}

/** The MCP server: chrome-devtools' browser tools plus the `owa_*` ones. */
export interface OwaMcpServer {
  connect(transport: OwaMcpTransport): Promise<void>;
  close(): Promise<void>;
}

export type OwaMcpServerOptions = {
  /** chrome-devtools-mcp's own flags, e.g. `--headless`, `--viewport=1280x720`. */
  argv?: string[];
  /** A file chrome-devtools-mcp writes its log to. */
  logFile?: string;
};

export type OwaMcpLogger = (...items: unknown[]) => void;

export type OwaMcpStdioOptions = OwaMcpServerOptions & {
  /** Where its own lines go; stderr by default (stdout is the protocol). */
  log?: OwaMcpLogger;
};

export type OwaMcpBridgeOptions = {
  /** 0 or absent: any free port. */
  listenPort?: number;
  log?: OwaMcpLogger;
};

export const OWA_CDP_INFO_DIR_PATH: string;
export function listOwaAppInstances(): OwaAppInstance[];
export function findDrivenInstance(): OwaAppInstance | null;
export function resolveAppBrowserUrl(): string;
export function createOwaMcpServer(
  options?: OwaMcpServerOptions,
): Promise<{ server: OwaMcpServer }>;
export function runOwaMcpStdioServer(
  options?: OwaMcpStdioOptions,
): Promise<{ server: OwaMcpServer; close(): Promise<void> }>;
export function runOwaMcpBridge(
  options?: OwaMcpBridgeOptions,
): Promise<{ port: number; close(): Promise<void> }>;
export function redactSecrets(text: string): string;
