import type { Display } from 'electron';
import type { AppProviderType, MessageEventType } from './appProvider';

import packageInfo from '../../package.json';

type Listener = (event: MessageEventType, ...args: any[]) => void;
type StatResult = {
    isFile: () => boolean;
    isDirectory: () => boolean;
};
type FileDataInput = string | Uint8Array | ArrayBuffer;

const BROWSER_FS_STORAGE_KEY = 'owa-browser-mock-fs';
const BROWSER_THEME_STORAGE_KEY = 'owa-browser-theme';
const BROWSER_CLIPBOARD_STORAGE_KEY = 'owa-browser-clipboard';
const BROWSER_DATA_ROOT = '/browser-data';
const SPECIAL_PATHS = {
    desktop: `${BROWSER_DATA_ROOT}/desktop`,
    downloads: `${BROWSER_DATA_ROOT}/downloads`,
    temp: `${BROWSER_DATA_ROOT}/temp`,
} as const;
const DEFAULT_THEME = 'system';
const POPUP_FRAME_NAME_PREFIX = 'owa-popup-frame-';
const htmlFiles = {
    appDocumentEditor: 'appDocumentEditor.html',
    presenter: 'presenter.html',
    screen: 'screen.html',
    reader: 'reader.html',
    setting: 'setting.html',
    finder: 'finder.html',
    lwShare: 'lwShare.html',
    about: 'about.html',
    experiment: 'experiment.html',
    lyricEditor: 'lyricEditor.html',
    bibleNote: 'bibleNote.html',
    webEditor: 'webEditor.html',
} as const;

function toVersionNumber(version: string) {
    const [major, minor, patch] = version
        .split('.')
        .map((str) => Number.parseInt(str, 10));
    return major * 10000 + minor * 100 + patch;
}

function encodeBase64(text: string) {
    const bytes = new TextEncoder().encode(text);
    return btoa(bytesToBinary(bytes));
}

function decodeBase64(text: string) {
    const bytes = base64ToBytes(text);
    return new TextDecoder().decode(bytes);
}

function bytesToBinary(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }
    return binary;
}

function base64ToBytes(base64: string) {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
}

const mockOpenFiles = new Map<number, Uint8Array>();
let mockNextFd = 3;

function createHexDigest(input: Uint8Array) {
    let hash = 2166136261;
    for (const byte of input) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function createHashAdapter() {
    const chunks: Uint8Array[] = [];
    return {
        update(chunk: string | ArrayBuffer | ArrayBufferView) {
            if (typeof chunk === 'string') {
                chunks.push(new TextEncoder().encode(chunk));
                return this;
            }
            if (chunk instanceof ArrayBuffer) {
                chunks.push(new Uint8Array(chunk));
                return this;
            }
            chunks.push(
                new Uint8Array(
                    chunk.buffer,
                    chunk.byteOffset,
                    chunk.byteLength,
                ),
            );
            return this;
        },
        digest(encoding?: string) {
            const size = chunks.reduce(
                (total, chunk) => total + chunk.length,
                0,
            );
            const merged = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
            }
            const digest = createHexDigest(merged);
            if (!encoding || encoding === 'hex') {
                return digest;
            }
            return digest;
        },
    } as any;
}

function normalizePath(filePath: string) {
    if (!filePath) {
        return '/';
    }
    const slashPath = filePath.replaceAll('\\', '/');
    const hasDrive = /^[A-Za-z]:/.test(slashPath);
    let prefix = '';
    if (hasDrive) {
        prefix = slashPath.slice(0, 2);
    } else if (slashPath.startsWith('/')) {
        prefix = '/';
    }
    const body = hasDrive ? slashPath.slice(2) : slashPath;
    const segments = body
        .split('/')
        .filter((segment) => segment.length > 0 && segment !== '.');
    const resolved: string[] = [];
    for (const segment of segments) {
        if (segment === '..') {
            resolved.pop();
            continue;
        }
        resolved.push(segment);
    }
    const joined = resolved.join('/');
    if (hasDrive) {
        return joined.length > 0 ? `${prefix}/${joined}` : `${prefix}/`;
    }
    if (prefix === '/') {
        return joined.length > 0 ? `/${joined}` : '/';
    }
    return joined.length > 0 ? joined : '.';
}

function joinPath(...parts: string[]) {
    const filtered = parts.filter((part) => part.length > 0);
    if (filtered.length === 0) {
        return '.';
    }
    return normalizePath(filtered.join('/'));
}

function dirname(filePath: string) {
    const normalized = normalizePath(filePath);
    if (normalized === '/' || normalized === '.') {
        return normalized;
    }
    if (/^[A-Za-z]:\/$/.test(normalized)) {
        return normalized;
    }
    const index = normalized.lastIndexOf('/');
    if (index === -1) {
        return '.';
    }
    if (index === 2 && /^[A-Za-z]:\//.test(normalized)) {
        return `${normalized.slice(0, 2)}/`;
    }
    if (index === 0) {
        return '/';
    }
    return normalized.slice(0, index);
}

function basename(filePath: string) {
    const normalized = normalizePath(filePath);
    if (normalized === '/' || normalized === '.') {
        return normalized;
    }
    const index = normalized.lastIndexOf('/');
    if (index === -1) {
        return normalized;
    }
    return normalized.slice(index + 1);
}

function resolvePath(...parts: string[]) {
    return normalizePath(joinPath(...parts));
}

function toUint8Array(data: FileDataInput) {
    if (typeof data === 'string') {
        return new TextEncoder().encode(data);
    }
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    return data;
}

function toStringContent(data: Uint8Array) {
    return new TextDecoder().decode(data);
}

function toDataUrl(
    bytes: Uint8Array,
    mimeType: string = 'application/octet-stream',
) {
    return `data:${mimeType};base64,${btoa(bytesToBinary(bytes))}`;
}

function getMimeType(filePath: string) {
    const lowerFilePath = filePath.toLowerCase();
    if (lowerFilePath.endsWith('.html')) {
        return 'text/html';
    }
    if (lowerFilePath.endsWith('.json')) {
        return 'application/json';
    }
    if (lowerFilePath.endsWith('.txt')) {
        return 'text/plain';
    }
    if (lowerFilePath.endsWith('.svg')) {
        return 'image/svg+xml';
    }
    if (lowerFilePath.endsWith('.png')) {
        return 'image/png';
    }
    if (lowerFilePath.endsWith('.jpg') || lowerFilePath.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    return 'application/octet-stream';
}

function readVirtualFsStore() {
    try {
        const raw = globalThis.localStorage.getItem(BROWSER_FS_STORAGE_KEY);
        if (!raw) {
            return {
                directories: [] as string[],
                files: {} as Record<string, string>,
            };
        }
        const parsed = JSON.parse(raw) as {
            directories?: string[];
            files?: Record<string, string>;
        };
        return {
            directories: parsed.directories ?? [],
            files: parsed.files ?? {},
        };
    } catch {
        return {
            directories: [] as string[],
            files: {} as Record<string, string>,
        };
    }
}

class BrowserVirtualFs {
    private readonly directories = new Set<string>();
    private readonly files = new Map<string, string>();

    constructor() {
        this.hydrate();
        this.ensureDir('/');
        this.ensureDir(BROWSER_DATA_ROOT);
        this.ensureDir(SPECIAL_PATHS.desktop);
        this.ensureDir(SPECIAL_PATHS.downloads);
        this.ensureDir(SPECIAL_PATHS.temp);
        this.persist();
    }

    private hydrate() {
        const data = readVirtualFsStore();
        for (const dirPath of data.directories) {
            this.directories.add(normalizePath(dirPath));
        }
        for (const [filePath, base64] of Object.entries(data.files)) {
            this.files.set(normalizePath(filePath), base64);
            this.ensureDir(dirname(filePath));
        }
    }

    private persist() {
        const files = Object.fromEntries(this.files.entries());
        const directories = Array.from(this.directories.values()).sort(
            (left, right) => {
                return left.localeCompare(right);
            },
        );
        globalThis.localStorage.setItem(
            BROWSER_FS_STORAGE_KEY,
            JSON.stringify({ directories, files }),
        );
    }

    ensureDir(dirPath: string) {
        const normalized = normalizePath(dirPath);
        const parts = normalized.split('/').filter(Boolean);
        const hasDriveRoot = /^[A-Za-z]:\//.test(normalized);
        if (normalized.startsWith('/')) {
            this.directories.add('/');
        }
        if (hasDriveRoot) {
            this.directories.add(`${parts[0]}/`);
        }
        let current = '';
        if (normalized.startsWith('/')) {
            current = '/';
        } else if (hasDriveRoot) {
            current = `${parts[0]}/`;
        }
        if (current) {
            this.directories.add(current);
        }
        for (const part of hasDriveRoot ? parts.slice(1) : parts) {
            if (current === '/') {
                current = `/${part}`;
            } else if (current) {
                current = joinPath(current, part);
            } else {
                current = part;
            }
            this.directories.add(current);
        }
        this.persist();
    }

    writeFile(filePath: string, data: FileDataInput) {
        const normalized = normalizePath(filePath);
        this.ensureDir(dirname(normalized));
        const bytes = toUint8Array(data);
        this.files.set(normalized, toDataUrl(bytes).split(',')[1]);
        this.persist();
    }

    readFile(filePath: string) {
        const normalized = normalizePath(filePath);
        const base64 = this.files.get(normalized);
        if (base64 === undefined) {
            throw new Error(`File not found: ${normalized}`);
        }
        return base64ToBytes(base64);
    }

    exists(filePath: string) {
        const normalized = normalizePath(filePath);
        return this.files.has(normalized) || this.directories.has(normalized);
    }

    stat(filePath: string): StatResult {
        const normalized = normalizePath(filePath);
        if (this.files.has(normalized)) {
            return {
                isFile: () => true,
                isDirectory: () => false,
            };
        }
        if (this.directories.has(normalized)) {
            return {
                isFile: () => false,
                isDirectory: () => true,
            };
        }
        const error = new Error(`Path not found: ${normalized}`);
        (error as any).code = 'ENOENT';
        throw error;
    }

    removeFile(filePath: string) {
        const normalized = normalizePath(filePath);
        if (!this.files.delete(normalized)) {
            const error = new Error(`File not found: ${normalized}`);
            (error as any).code = 'ENOENT';
            throw error;
        }
        this.persist();
    }

    removeDir(dirPath: string) {
        const normalized = normalizePath(dirPath);
        for (const filePath of Array.from(this.files.keys())) {
            if (
                filePath === normalized ||
                filePath.startsWith(`${normalized}/`)
            ) {
                this.files.delete(filePath);
            }
        }
        for (const path of Array.from(this.directories.values())) {
            if (path === normalized || path.startsWith(`${normalized}/`)) {
                this.directories.delete(path);
            }
        }
        this.ensureDir('/');
        this.persist();
    }

    rename(fromPath: string, toPath: string) {
        const normalizedFrom = normalizePath(fromPath);
        const normalizedTo = normalizePath(toPath);
        if (this.files.has(normalizedFrom)) {
            const currentValue = this.files.get(normalizedFrom);
            this.files.delete(normalizedFrom);
            if (currentValue !== undefined) {
                this.writeFile(normalizedTo, base64ToBytes(currentValue));
            }
            this.persist();
            return;
        }
        if (!this.directories.has(normalizedFrom)) {
            throw new Error(`Path not found: ${normalizedFrom}`);
        }
        const fileEntries = Array.from(this.files.entries());
        for (const [filePath, fileData] of fileEntries) {
            if (filePath.startsWith(`${normalizedFrom}/`)) {
                const nextPath = filePath.replace(normalizedFrom, normalizedTo);
                this.files.delete(filePath);
                this.files.set(nextPath, fileData);
            }
        }
        const dirEntries = Array.from(this.directories.values()).sort(
            (left, right) => {
                return left.localeCompare(right);
            },
        );
        for (const dirEntry of dirEntries) {
            if (
                dirEntry === normalizedFrom ||
                dirEntry.startsWith(`${normalizedFrom}/`)
            ) {
                this.directories.delete(dirEntry);
                this.directories.add(
                    dirEntry.replace(normalizedFrom, normalizedTo),
                );
            }
        }
        this.ensureDir(dirname(normalizedTo));
        this.persist();
    }

    readdir(dirPath: string) {
        const normalized = normalizePath(dirPath);
        const prefix = normalized === '/' ? '/' : `${normalized}/`;
        const results = new Set<string>();
        for (const filePath of this.files.keys()) {
            if (!filePath.startsWith(prefix)) {
                continue;
            }
            const child = filePath.slice(prefix.length).split('/')[0];
            if (child) {
                results.add(child);
            }
        }
        for (const childPath of this.directories.values()) {
            if (childPath === normalized || !childPath.startsWith(prefix)) {
                continue;
            }
            const child = childPath.slice(prefix.length).split('/')[0];
            if (child) {
                results.add(child);
            }
        }
        return Array.from(results.values()).sort((left, right) => {
            return left.localeCompare(right);
        });
    }

    async readExternal(filePath: string) {
        const normalized = normalizePath(filePath);
        if (this.files.has(normalized)) {
            return this.readFile(normalized);
        }
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Unable to read resource: ${filePath}`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }
}

class MockEventEmitter {
    protected readonly listeners = new Map<
        string,
        ((...args: any[]) => void)[]
    >();

    on(event: string, listener: (...args: any[]) => void) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push(listener);
        this.listeners.set(event, listeners);
        return this;
    }

    once(event: string, listener: (...args: any[]) => void) {
        const wrapped = (...args: any[]) => {
            this.removeListener(event, wrapped);
            listener(...args);
        };
        return this.on(event, wrapped);
    }

    protected removeListener(
        event: string,
        listener: (...args: any[]) => void,
    ) {
        const listeners = this.listeners.get(event) ?? [];
        this.listeners.set(
            event,
            listeners.filter((entry) => entry !== listener),
        );
    }

    protected emit(event: string, ...args: any[]) {
        for (const listener of this.listeners.get(event) ?? []) {
            listener(...args);
        }
    }
}

class MockReadableStream extends MockEventEmitter {
    constructor(
        private readonly fs: BrowserVirtualFs,
        private readonly filePath: string,
    ) {
        super();
        queueMicrotask(async () => {
            try {
                const data = await this.fs.readExternal(this.filePath);
                this.emit('data', data);
                this.emit('end');
            } catch (error) {
                this.emit('error', error);
            }
        });
    }

    override on(event: string, listener: (...args: any[]) => void) {
        return super.on(event, listener);
    }
}

class MockWriteStream extends MockEventEmitter {
    writable = true;
    private readonly chunks: Uint8Array[] = [];

    constructor(
        private readonly fs: BrowserVirtualFs,
        private readonly filePath: string,
    ) {
        super();
    }

    write(chunk: FileDataInput, callback?: (error?: Error | null) => void) {
        if (!this.writable) {
            callback?.(new Error('Write stream is closed'));
            return false;
        }
        this.chunks.push(toUint8Array(chunk));
        callback?.(null);
        return true;
    }

    end() {
        this.close();
    }

    close() {
        const size = this.chunks.reduce(
            (total, chunk) => total + chunk.length,
            0,
        );
        const merged = new Uint8Array(size);
        let offset = 0;
        for (const chunk of this.chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        this.fs.writeFile(this.filePath, merged);
        this.writable = false;
        this.emit('close');
    }

    destroy() {
        this.writable = false;
        this.emit('close');
    }

    override on(event: string, listener: (...args: any[]) => void) {
        return super.on(event, listener);
    }
}

function toEventHandlers(
    listeners: Map<string, Set<Listener>>,
    channel: string,
) {
    return Array.from(listeners.get(channel) ?? []);
}

function getPathname() {
    return globalThis.location?.pathname || '/';
}

function getCurrentTheme() {
    const stored = globalThis.localStorage.getItem(BROWSER_THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
    }
    return DEFAULT_THEME;
}

const virtualFs = new BrowserVirtualFs();
const messageListeners = new Map<string, Set<Listener>>();

function emitMessage(channel: string, event: MessageEventType, args: any[]) {
    for (const listener of toEventHandlers(messageListeners, channel)) {
        listener(event, ...args);
    }
}

function syncMessageFallback(channel: string, args: any[]) {
    if (channel === 'main:app:get-theme') {
        return getCurrentTheme();
    }
    if (channel === 'main:app:get-data-path') {
        return BROWSER_DATA_ROOT;
    }
    if (channel === 'main:app:get-app-path') {
        return BROWSER_DATA_ROOT;
    }
    if (channel === 'main:app:get-special-path') {
        const pathType = args[0] as keyof typeof SPECIAL_PATHS;
        return SPECIAL_PATHS[pathType] ?? BROWSER_DATA_ROOT;
    }
    if (channel === 'all:app:get-zoom-factor') {
        return 1;
    }
    if (channel === 'main:app:get-screens') {
        return [];
    }
    if (channel === 'all:app:get-is-window-on-top') {
        return false;
    }
    if (channel === 'main:app:set-theme') {
        const theme = args[0];
        if (theme === 'light' || theme === 'dark' || theme === 'system') {
            globalThis.localStorage.setItem(BROWSER_THEME_STORAGE_KEY, theme);
        }
        return true;
    }
    return true;
}

const messageMockChannelMap = {
    'main:app:get-displays': () => {
        const displays: Display[] = [
            {
                id: 0,
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                workArea: { x: 0, y: 0, width: 1920, height: 1080 },
                size: { width: 1920, height: 1080 },
                scaleFactor: 1,
                rotation: 0,
                touchSupport: 'unknown',
            } as Display,
        ];
        return {
            primaryDisplay: displays[0],
            displays,
        };
    },
};

function dispatchMessage(channel: string, args: any[], isSync: boolean) {
    if (channel in messageMockChannelMap) {
        const handler = (messageMockChannelMap as any)[channel] as () => any;
        const result = handler();
        if (isSync) {
            return result;
        } else {
            const event: MessageEventType = { returnValue: result };
            emitMessage(channel, event, args);
        }
        return;
    }
    if (channel === 'main:app:set-theme') {
        syncMessageFallback(channel, args);
    }
    const event: MessageEventType = { returnValue: undefined };
    emitMessage(channel, event, args);
    if (isSync && event.returnValue !== undefined) {
        return event.returnValue;
    }
    if (isSync) {
        return syncMessageFallback(channel, args);
    }
    return undefined;
}

function getPageProps() {
    const currentHomePage = getPathname();
    const appDocumentEditorHomePage = `/${htmlFiles.appDocumentEditor}`;
    const presenterHomePage = `/${htmlFiles.presenter}`;
    const screenHomePage = `/${htmlFiles.screen}`;
    const readerHomePage = `/${htmlFiles.reader}`;
    const settingHomePage = `/${htmlFiles.setting}`;
    const finderHomePage = `/${htmlFiles.finder}`;
    const lwShareHomePage = `/${htmlFiles.lwShare}`;
    const aboutHomePage = `/${htmlFiles.about}`;
    const experimentHomePage = `/${htmlFiles.experiment}`;
    const lyricEditorHomePage = `/${htmlFiles.lyricEditor}`;
    const bibleNoteHomePage = `/${htmlFiles.bibleNote}`;
    const webEditorHomePage = `/${htmlFiles.webEditor}`;
    return {
        currentHomePage,
        appDocumentEditorHomePage,
        presenterHomePage,
        screenHomePage,
        readerHomePage,
        settingHomePage,
        finderHomePage,
        lwShareHomePage,
        aboutHomePage,
        experimentHomePage,
        lyricEditorHomePage,
        bibleNoteHomePage,
        webEditorHomePage,
        isPageAppDocumentEditor: currentHomePage.startsWith(
            appDocumentEditorHomePage,
        ),
        isPagePresenter: currentHomePage.startsWith(presenterHomePage),
        isPageScreen: currentHomePage.startsWith(screenHomePage),
        isPageReader: currentHomePage.startsWith(readerHomePage),
        isPageSetting: currentHomePage.startsWith(settingHomePage),
        isPageFinder: currentHomePage.startsWith(finderHomePage),
        isPageAbout: currentHomePage.startsWith(aboutHomePage),
        isPageLWShare: currentHomePage.startsWith(lwShareHomePage),
        isPageExperiment: currentHomePage.startsWith(experimentHomePage),
        isPageLyricEditor: currentHomePage.startsWith(lyricEditorHomePage),
    };
}

async function generateFileMD5(filePath: string) {
    try {
        const bytes = await virtualFs.readExternal(filePath);
        return createHexDigest(bytes);
    } catch {
        return createHexDigest(new TextEncoder().encode(filePath));
    }
}

const appInfo = {
    name: packageInfo.name,
    title: packageInfo.build.productName,
    titleFull: `${packageInfo.build.productName} (Browser mock)`,
    description: packageInfo.description,
    author: packageInfo.author,
    homepage: packageInfo.homepage.replace(/\/+$/, ''),
    gitRepository: packageInfo.gitRepository,
    version: packageInfo.version,
    versionNumber: toVersionNumber(packageInfo.version),
};

async function initLyricMock() {
    const { LOCAL_STORAGE_FOLDER_NAME } =
        await import('../setting/directory-setting/appLocalStorage');
    const { defaultDataDirNames, dirSourceSettingNames } =
        await import('../helper/constants');
    const { default: Lyric } = await import('../lyric-list/Lyric');
    const { setParamFileFullName } = await import('../helper/domHelpers');
    const { SELECTED_PARENT_DIR_SETTING_NAME } =
        await import('../setting/directory-setting/appLocalStorage');

    if (!location.pathname.includes('lyricEditor.html')) {
        return;
    }
    globalThis.localStorage.setItem(
        SELECTED_PARENT_DIR_SETTING_NAME,
        BROWSER_DATA_ROOT,
    );
    const dataDirPath = `${BROWSER_DATA_ROOT}/data`;
    const storageDirPath = `${BROWSER_DATA_ROOT}/${LOCAL_STORAGE_FOLDER_NAME}`;
    for (const [key, value] of Object.entries(dirSourceSettingNames)) {
        const localStorageFilePath = `${storageDirPath}/${value}`;
        const folderName =
            defaultDataDirNames[key as keyof typeof defaultDataDirNames];
        const filePath = `${dataDirPath}/${folderName}`;
        if (key === 'LYRIC') {
            const data = Lyric.getDefaultContentJsonData();
            const fileFullName = 'test-lyric.owl';
            setParamFileFullName(fileFullName);
            virtualFs.writeFile(
                `${filePath}/${fileFullName}`,
                JSON.stringify(data),
            );
            console.log(virtualFs);
        }
        virtualFs.writeFile(localStorageFilePath, filePath);
    }
}

const appProviderMock = {
    ...getPageProps(),
    appType: 'web' as AppProviderType['appType'],
    isDesktop: false,
    fontUtils: {
        getFonts: async () => ({}),
    },
    cryptoUtils: {
        encrypt: (text: string, key: string) => {
            return encodeBase64(JSON.stringify({ key, text }));
        },
        decrypt: (text: string, key: string) => {
            try {
                const parsed = JSON.parse(decodeBase64(text));
                return parsed.key === key ? parsed.text : '';
            } catch {
                return '';
            }
        },
        createHash: () => {
            return createHashAdapter();
        },
    },
    browserUtils: {
        pathToFileURL: (filePath: string) => {
            if (/^[a-zA-Z]+:/.test(filePath)) {
                return filePath;
            }
            try {
                const bytes = virtualFs.readFile(filePath);
                return toDataUrl(bytes, getMimeType(filePath));
            } catch {
                return new URL(filePath, globalThis.location.href).toString();
            }
        },
        openExternalURL: (url: string) => {
            globalThis.open(url, '_blank', 'noopener,noreferrer');
        },
    },
    messageUtils: {
        messageChannels: { screenMessage: 'app:screen:message' },
        sendData: (channel: string, ...args: any[]) => {
            dispatchMessage(channel, args, false);
        },
        sendDataSync: (channel: string, ...args: any[]) => {
            return dispatchMessage(channel, args, true);
        },
        listenForData: (channel: string, callback: Listener) => {
            const listeners =
                messageListeners.get(channel) ?? new Set<Listener>();
            listeners.add(callback);
            messageListeners.set(channel, listeners);
        },
        listenOnceForData: (channel: string, callback: Listener) => {
            const wrapped: Listener = (event, ...args) => {
                const listeners = messageListeners.get(channel);
                listeners?.delete(wrapped);
                callback(event, ...args);
            };
            const listeners =
                messageListeners.get(channel) ?? new Set<Listener>();
            listeners.add(wrapped);
            messageListeners.set(channel, listeners);
        },
    },
    httpUtils: {
        request: (() => {
            throw new Error(
                'Browser mock does not implement node:http request',
            );
        }) as any,
    },
    fileUtils: {
        createWriteStream: ((filePath: string) => {
            return new MockWriteStream(virtualFs, filePath);
        }) as any,
        createReadStream: ((filePath: string) => {
            return new MockReadableStream(virtualFs, filePath);
        }) as any,
        readdir: ((
            dirPath: string,
            callback: (error: Error | null, files?: string[]) => void,
        ) => {
            try {
                callback(null, virtualFs.readdir(dirPath));
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        stat: ((
            filePath: string,
            callback: (error: Error | null, stat?: StatResult) => void,
        ) => {
            try {
                callback(null, virtualFs.stat(filePath));
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        mkdir: ((
            dirPath: string,
            _options: any,
            callback: (error?: Error | null) => void,
        ) => {
            try {
                virtualFs.ensureDir(dirPath);
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        writeFile: ((
            filePath: string,
            data: string | ArrayBuffer | Uint8Array,
            _options: any,
            callback: (error?: Error | null) => void,
        ) => {
            try {
                virtualFs.writeFile(filePath, data);
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        rename: ((
            oldPath: string,
            newPath: string,
            callback: (error?: Error | null) => void,
        ) => {
            try {
                virtualFs.rename(oldPath, newPath);
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        unlink: ((
            filePath: string,
            callback: (error?: Error | null) => void,
        ) => {
            try {
                virtualFs.removeFile(filePath);
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        rmdir: ((
            dirPath: string,
            _options: any,
            callback: (error?: Error | null) => void,
        ) => {
            try {
                virtualFs.removeDir(dirPath);
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        readFile: ((
            filePath: string,
            options: any,
            callback: (error: Error | null, data?: string | Uint8Array) => void,
        ) => {
            try {
                const bytes = virtualFs.readFile(filePath);
                callback(
                    null,
                    options === 'utf8' || options?.encoding === 'utf8'
                        ? toStringContent(bytes)
                        : bytes,
                );
            } catch (error) {
                callback(error as Error);
            }
        }) as any,
        readFileSync: ((filePath: string, options?: any) => {
            const bytes = virtualFs.readFile(filePath);
            if (options === 'utf8' || options?.encoding === 'utf8') {
                return toStringContent(bytes);
            }
            return bytes;
        }) as any,
        openSync: ((filePath: string) => {
            const fd = mockNextFd++;
            mockOpenFiles.set(fd, virtualFs.readFile(filePath));
            return fd;
        }) as any,
        readSync: ((
            fd: number,
            buffer: Uint8Array,
            offset: number,
            length: number,
            position: number | null,
        ) => {
            const bytes = mockOpenFiles.get(fd);
            if (bytes === undefined) {
                return 0;
            }
            const start = position ?? 0;
            const slice = bytes.subarray(start, start + length);
            buffer.set(slice, offset);
            return slice.length;
        }) as any,
        fstatSync: ((fd: number) => {
            const bytes = mockOpenFiles.get(fd);
            return { size: bytes?.length ?? 0 } as any;
        }) as any,
        closeSync: ((fd: number) => {
            mockOpenFiles.delete(fd);
        }) as any,
        gunzipSync: ((buffer: Uint8Array) => buffer) as any,
        writeFileSync: ((
            filePath: string,
            data: string | Uint8Array | ArrayBuffer,
        ) => {
            virtualFs.writeFile(filePath, data);
        }) as any,
        unlinkSync: ((filePath: string) => {
            virtualFs.removeFile(filePath);
        }) as any,
        existsSync: ((filePath: string) => {
            return virtualFs.exists(filePath);
        }) as any,
        mkdirSync: ((dirPath: string) => {
            virtualFs.ensureDir(dirPath);
        }) as any,
        copyFile: ((
            source: string,
            dest: string,
            callback: (error?: Error | null) => void,
        ) => {
            virtualFs
                .readExternal(source)
                .then((data) => {
                    virtualFs.writeFile(dest, data);
                    callback(null);
                })
                .catch((error) => {
                    callback(error as Error);
                });
        }) as any,
        copyBlobFile: ((
            blobUrl: string,
            dest: string,
            callback: (error?: Error | null) => void,
        ) => {
            fetch(blobUrl)
                .then((response) => response.arrayBuffer())
                .then((data) => {
                    virtualFs.writeFile(dest, data);
                    callback(null);
                })
                .catch((error) => {
                    callback(error as Error);
                });
        }) as any,
        watch: ((_: string, __: any, ___?: any) => {
            return {
                close: () => {},
            };
        }) as any,
        writeFileFromBase64Sync: (filePath: string, base64: string) => {
            const rawBase64 = base64.includes(',')
                ? base64.split(',')[1]
                : base64;
            virtualFs.writeFile(filePath, base64ToBytes(rawBase64));
        },
    },
    pathUtils: {
        sep: '/',
        basename,
        dirname,
        resolve: resolvePath,
        join: joinPath,
    },
    systemUtils: {
        copyToClipboard: (text: string) => {
            globalThis.localStorage.setItem(
                BROWSER_CLIPBOARD_STORAGE_KEY,
                text,
            );
            void globalThis.navigator?.clipboard?.writeText?.(text);
        },
        commitHash: undefined,
        isDev: true,
        isWindows: false,
        is64System: true,
        isMac: false,
        isArm64: false,
        isLinux: false,
        isUbuntu: false,
        isFedora: false,
        openFile: (filePath: string) => {
            globalThis.open(
                appProviderMock.browserUtils.pathToFileURL(filePath),
                '_blank',
            );
        },
        generateFileMD5,
        generateMD5: (input: string) => {
            return createHexDigest(new TextEncoder().encode(input));
        },
    },
    appInfo,
    reload: () => {
        globalThis.dispatchEvent(new CustomEvent('app-provider:reload'));
        globalThis.location.reload();
    },
    appUtils: {
        handleError: (error: any) => {
            console.error(error);
        },
        base64Encode: encodeBase64,
        base64Decode: decodeBase64,
    },
    databaseUtils: {
        getSQLiteDatabaseInstance: async () => {
            return {
                database: {
                    close: () => {},
                    loadExtension: () => {},
                    enableLoadExtension: () => {},
                    exec: () => {},
                    open: () => {},
                    prepare: () => ({
                        all: () => [],
                        get: () => null,
                        run: () => {},
                    }),
                    createSession: () => ({}),
                    applyChangeset: () => {},
                },
                exec: () => {},
                createTable: () => {},
                getAll: () => [],
                close: () => {},
            };
        },
    },
    ytUtils: {
        getYTHelper: async () => {
            const helper = {
                on: () => helper,
                off: () => helper,
                exec: () => helper,
                ytDlpProcess: { pid: 0 },
            };
            return helper;
        },
        ffmpegBinPath: '',
        denoBinPath: '',
        jsRuntimeBinPath: null,
    },
    windowTitle: globalThis.document.title,
    POPUP_FRAME_NAME_PREFIX,
    envUtils: {
        isFEUseEffectWarning: false,
    },
    getIsMouseOverApp: () => false,
    getIsWindowFocused: () => globalThis.document.hasFocus(),
    init: async () => {
        await initLyricMock();
    },
    isMainPage: false,
} as AppProviderType;

export default appProviderMock;
