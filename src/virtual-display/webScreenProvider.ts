// What a screen page needs from the desktop app, supplied in a plain browser.
//
// The app's screen page (`screen.tsx`) is written against the Electron
// preload's `provider`. A browser watching a virtual display runs that same
// page, so this builds a stand-in from what the display sends over its
// WebSocket: the screen's context first (its settings, its layers, its files
// as addresses on this server), then every message the presenter sends it.
// It answers only what a screen page asks while it draws; anything that
// would reach the disk or the operating system is simply not there.
//
// Nothing here may import `appProvider`: it is what `appProvider` reads.
import {
    VIRTUAL_DISPLAY_VIEWER_FEEDBACK_TYPES,
    readScreenMessageCameras,
    toVirtualDisplayCameraId,
    type VirtualDisplayWebContext,
} from '../../electron/virtualDisplayProtocol';
import { md5Hex } from './md5Helpers';

const SCREEN_MESSAGE_CHANNEL = 'app:screen:message';
const RECONNECT_DELAY_MILLISECOND = 2000;

type ListenerType = (event: unknown, ...args: any[]) => void;

function toPathUtils(isWindows: boolean) {
    const sep = isWindows ? '\\' : '/';
    const split = (filePath: string) => filePath.split(/[\\/]+/);
    const join = (...parts: string[]) => {
        const joined = parts
            .filter((part) => typeof part === 'string' && part.length > 0)
            .join(sep);
        const collapsed = joined.replace(/[\\/]+/g, sep);
        // A network path (`\\server\share`) keeps both of its leading slashes.
        return isWindows && /^[\\/]{2}[^\\/]/.test(joined)
            ? sep + collapsed
            : collapsed;
    };
    return {
        sep,
        basename(filePath: string, extension?: string) {
            const parts = split(filePath).filter(Boolean);
            const name = parts.at(-1) ?? '';
            return extension && name.endsWith(extension)
                ? name.slice(0, -extension.length)
                : name;
        },
        dirname(filePath: string) {
            const index = Math.max(
                filePath.lastIndexOf('/'),
                filePath.lastIndexOf('\\'),
            );
            if (index < 0) {
                return '.';
            }
            // The folder of `/a` is `/`, and of `C:\a` is `C:\`, not `C:`.
            const isRoot =
                index === 0 || /^[A-Za-z]:$/.test(filePath.slice(0, index));
            return filePath.slice(0, isRoot ? index + 1 : index);
        },
        join,
        // `.` and `..` taken out, as Node's `path.resolve` gives an absolute
        // path: a slide's `./media/a.png` must meet the key the server
        // published. Never climbs above the root (`/`, `C:`, `\\server\share`).
        resolve(...parts: string[]) {
            const joined = join(...parts);
            const segments = joined.split(sep);
            const rootLength =
                isWindows && /^\\\\[^\\]+\\[^\\]+/.test(joined)
                    ? 4
                    : segments[0] === '' || /^[A-Za-z]:$/.test(segments[0])
                      ? 1
                      : 0;
            const kept: string[] = [];
            segments.forEach((segment, index) => {
                if (index < rootLength) {
                    kept.push(segment);
                } else if (segment === '..') {
                    if (kept.length > rootLength) {
                        kept.pop();
                    }
                } else if (segment !== '.') {
                    kept.push(segment);
                }
            });
            return kept.join(sep) || (rootLength > 0 ? sep : '.');
        },
    };
}

type PathUtilsType = ReturnType<typeof toPathUtils>;

// The cameras on this screen, named the way a browser can have them: this
// computer's cameras are not this device's, so each becomes Screen Mirror's
// remote-camera id and the screen page asks the app for a stream. The list
// is what `mirror:cameras` answers -- only what is on the screen.
function genCameraMapper(hostId: string) {
    type CameraType = { deviceId: string; label: string };
    const layers: Record<'foreground' | 'background', CameraType[]> = {
        foreground: [],
        background: [],
    };
    const toRemoteId = (id: string) => {
        return id.startsWith('mirror-camera:')
            ? id
            : toVirtualDisplayCameraId(hostId, id);
    };
    const map = (message: any) => {
        const read =
            message !== null && typeof message === 'object'
                ? readScreenMessageCameras(message)
                : null;
        if (read === null) {
            return message;
        }
        layers[read.layer] = read.cameras.map((camera) => {
            return { deviceId: toRemoteId(camera.id), label: camera.label };
        });
        const { data } = message;
        if (
            read.layer === 'foreground' &&
            Array.isArray(data?.cameraDataList)
        ) {
            return {
                ...message,
                data: {
                    ...data,
                    cameraDataList: data.cameraDataList.map((item: any) => {
                        return typeof item?.id === 'string'
                            ? { ...item, id: toRemoteId(item.id) }
                            : item;
                    }),
                },
            };
        }
        if (data?.type === 'camera' && typeof data.src === 'string') {
            return { ...message, data: { ...data, src: toRemoteId(data.src) } };
        }
        return message;
    };
    const list = () => {
        return [...layers.foreground, ...layers.background].map((camera) => {
            return { ...camera, groupId: '', kind: 'videoinput' };
        });
    };
    return { map, list };
}

// The address of a file the screen page asks for: published by name, or --
// for a PowerPoint slide's pictures beside its HTML -- inside the folder of a
// published page or style sheet, which the server serves whole under that
// page's address. A screen window's own resolver (`mirror:resource`) does the
// same; this page cannot ask the server, so the folders are worked out here.
// The folder list is rebuilt only when the screen's state changes.
function genResourceResolver(pathUtils: PathUtilsType, isWindows: boolean) {
    let rootsOf: Record<string, string> | null = null;
    let roots: { prefix: string; baseUrl: string }[] = [];
    const fold = (text: string) => (isWindows ? text.toLowerCase() : text);
    return (resources: Record<string, string>, filePath: string) => {
        const direct = resources[filePath];
        if (direct !== undefined) {
            return direct;
        }
        if (rootsOf !== resources) {
            rootsOf = resources;
            roots = Object.entries(resources)
                .filter(([published]) => /\.(?:html?|css)$/i.test(published))
                .map(([published, url]) => {
                    const folder = pathUtils.dirname(published);
                    return {
                        prefix: fold(
                            folder.endsWith(pathUtils.sep)
                                ? folder
                                : folder + pathUtils.sep,
                        ),
                        baseUrl: url.slice(0, url.lastIndexOf('/') + 1),
                    };
                });
        }
        if (roots.length === 0) {
            return '';
        }
        const target = pathUtils.resolve(filePath);
        const folded = fold(target);
        for (const { prefix, baseUrl } of roots) {
            if (folded.startsWith(prefix) && folded.length > prefix.length) {
                return (
                    baseUrl +
                    target
                        .slice(prefix.length)
                        .split(pathUtils.sep)
                        .map(encodeURIComponent)
                        .join('/')
                );
            }
        }
        return '';
    };
}

function unavailable(name: string) {
    return (...args: any[]) => {
        const callback = args.at(-1);
        const error = new Error(`${name} is not available in a browser`);
        if (typeof callback === 'function') {
            callback(error);
            return undefined;
        }
        throw error;
    };
}

// Every file call fails the way a missing file does.
const fileUtils = new Proxy(
    {},
    {
        get(_target, key) {
            if (key === 'existsSync') {
                return () => false;
            }
            if (key === 'watch') {
                return () => ({
                    close() {},
                    on() {
                        return this;
                    },
                });
            }
            return unavailable(`fileUtils.${String(key)}`);
        },
    },
);

// `crypto.randomUUID` is given to SECURE pages only, and a browser on this
// network reaches the app over plain http (`http://127.0.0.1` alone counts as
// secure). The screen page names its caches with it while it loads, so on a
// phone it stopped at the first one and drew nothing but the wallpaper.
// `getRandomValues` is there either way; this is the same version-4 UUID.
export function ensureRandomUUID(target: Crypto = globalThis.crypto) {
    if (typeof (target as { randomUUID?: unknown }).randomUUID === 'function') {
        return;
    }
    Object.defineProperty(target, 'randomUUID', {
        configurable: true,
        value: () => {
            const bytes = target.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (byte) => {
                return byte.toString(16).padStart(2, '0');
            }).join('');
            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20),
            ].join('-');
        },
    });
}

export type WebScreenConnectionType = {
    context: VirtualDisplayWebContext;
    provider: Record<string, unknown>;
};

// Opens the screen's socket and resolves once its state has arrived; the
// messages that come before the page is listening are held for it.
export function connectWebScreen(): Promise<WebScreenConnectionType> {
    const params = new URLSearchParams(globalThis.location.search);
    const number = Number(params.get('vd'));
    const screenId = Number(params.get('screenId'));
    const viewer = params.get('viewer') ?? '';
    const isPreview = params.get('preview') === '1';
    // Set by the viewer page once somebody tapped "Turn on sound": before
    // that a browser refuses to start anything unmuted.
    const isSoundOn = params.get('sound') === '1';
    const protocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
        `${protocol}://${globalThis.location.host}/vd/${number}/ws?` +
            new URLSearchParams({
                viewer,
                screenId: String(screenId),
                ...(isPreview ? { preview: '1' } : {}),
            }).toString(),
    );
    const listeners = new Map<string, Set<ListenerType>>();
    const heldMessages: unknown[] = [];
    let context: VirtualDisplayWebContext | null = null;
    // Whether the operator lets this browser scroll and pick verses in the
    // app; until then nothing it does is sent.
    let isInteractive = false;
    // Set once the screen's state (and with it this computer's id) arrives.
    let cameras: ReturnType<typeof genCameraMapper> | null = null;

    const deliver = (channel: string, payload: unknown) => {
        const set = listeners.get(channel);
        if (!set || set.size === 0) {
            if (channel === SCREEN_MESSAGE_CHANNEL) {
                heldMessages.push(payload);
            }
            return;
        }
        const message =
            channel === SCREEN_MESSAGE_CHANNEL && cameras !== null
                ? cameras.map(payload)
                : payload;
        for (const listener of set) {
            listener({}, message);
        }
    };

    // The page reloads to join again: its socket closing means the display
    // went away, the screen moved, or the network dropped.
    socket.addEventListener('close', () => {
        setTimeout(() => {
            globalThis.location.reload();
        }, RECONNECT_DELAY_MILLISECOND);
    });

    return new Promise((resolve) => {
        socket.addEventListener('message', (event) => {
            let packet: any;
            try {
                packet = JSON.parse(String(event.data));
            } catch {
                return;
            }
            if (packet?.type === 'message') {
                deliver(SCREEN_MESSAGE_CHANNEL, packet.message);
            } else if (packet?.type === 'interactive') {
                isInteractive = packet.isInteractive === true;
            } else if (packet?.type === 'camera') {
                deliver('mirror:camera', packet.packet);
            } else if (packet?.type === 'context-update' && context !== null) {
                context = { ...context, ...packet.data };
            } else if (packet?.type === 'context' && context === null) {
                context = packet.context as VirtualDisplayWebContext;
                cameras = genCameraMapper(context.hostId ?? '');
                context = {
                    ...context,
                    messages: context.messages?.map(cameras.map),
                };
                // The app's own preview is on the operator's speakers: it
                // stays silent like a presenter copy. Any other page plays
                // the sound only once it has been tapped for it -- until then
                // every element stays muted, which a browser will start.
                if (isPreview || !isSoundOn) {
                    context = { ...context, isSoundOwner: false };
                }
                resolve({
                    context,
                    provider: buildProvider(),
                });
            }
        });
    });

    function buildProvider() {
        const current = () => context!;
        const { display, isWindows } = current();
        const bounds = {
            x: 0,
            y: 0,
            width: display.width,
            height: display.height,
        };
        const displayObject = {
            id: display.id,
            label: display.label,
            bounds,
            workArea: bounds,
            size: { width: display.width, height: display.height },
            workAreaSize: { width: display.width, height: display.height },
            scaleFactor: 1,
            rotation: 0,
            internal: false,
        };
        const pathUtils = toPathUtils(isWindows);
        const resolveResource = genResourceResolver(pathUtils, isWindows);
        const resourceOf = (filePath: string) => {
            return resolveResource(current().resources, filePath);
        };
        const syncAnswers: Record<string, (...args: any[]) => unknown> = {
            'main:app:get-displays': () => ({
                primaryDisplay: displayObject,
                displays: [displayObject],
            }),
            'main:app:get-screens': () => [screenId],
            'mirror:screen-context': () => current(),
            'mirror:resource': (data: { filePath?: string }) => {
                return resourceOf(String(data?.filePath ?? ''));
            },
            'main:app:get-theme': () => 'dark',
            'all:app:get-zoom-factor': () => 1,
            'main:app:get-data-path': () => '',
            'mirror:cameras': () => cameras?.list() ?? [],
            'mirror:state': () => null,
        };
        const messageUtils = {
            messageChannels: { screenMessage: SCREEN_MESSAGE_CHANNEL },
            // What the screen page reports of a person's hand -- a verse
            // picked, a page scrolled -- goes to the app only while the
            // operator lets this browser interact; nothing else ever does.
            sendData(channel: string, payload?: any) {
                // This device's own camera is never asked for: the cameras
                // on the screen come from this computer, as streams.
                if (channel === 'main:app:ask-camera-access') {
                    const reply = payload?.replyEventName;
                    if (typeof reply === 'string') {
                        queueMicrotask(() => deliver(reply, false));
                    }
                    return;
                }
                if (channel === 'mirror:camera-send') {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(
                            JSON.stringify({ type: 'camera', packet: payload }),
                        );
                    }
                    return;
                }
                if (
                    isInteractive &&
                    channel === SCREEN_MESSAGE_CHANNEL &&
                    payload?.isScreen === true &&
                    VIRTUAL_DISPLAY_VIEWER_FEEDBACK_TYPES.has(payload.type) &&
                    socket.readyState === WebSocket.OPEN
                ) {
                    socket.send(
                        JSON.stringify({
                            type: 'feedback',
                            message: { type: payload.type, data: payload.data },
                        }),
                    );
                }
            },
            sendDataSync(channel: string, ...args: any[]) {
                return syncAnswers[channel]?.(...args);
            },
            listenForData(channel: string, listener: ListenerType) {
                let set = listeners.get(channel);
                if (set === undefined) {
                    set = new Set();
                    listeners.set(channel, set);
                }
                set.add(listener);
                if (channel === SCREEN_MESSAGE_CHANNEL && heldMessages.length) {
                    const held = heldMessages.splice(0);
                    queueMicrotask(() => {
                        for (const payload of held) {
                            listener({}, cameras?.map(payload) ?? payload);
                        }
                    });
                }
            },
            removeListener(channel: string, listener: ListenerType) {
                listeners.get(channel)?.delete(listener);
            },
            listenOnceForData(channel: string, listener: ListenerType) {
                const once: ListenerType = (...args) => {
                    listeners.get(channel)?.delete(once);
                    listener(...args);
                };
                messageUtils.listenForData(channel, once);
            },
        };
        const pages = {
            screenHomePage: '/vd-screen.html',
            presenterHomePage: '/presenter.html',
            readerHomePage: '/reader.html',
            settingHomePage: '/setting.html',
            finderHomePage: '/finder.html',
            appDocumentEditorHomePage: '/appDocumentEditor.html',
            lyricEditorHomePage: '/lyricEditor.html',
            aboutHomePage: '/about.html',
            chatbotHomePage: '/chatbot.html',
            aichatHomePage: '/aichat.html',
            lwShareHomePage: '/lwShare.html',
            bibleNoteHomePage: '/bibleNote.html',
            markdownPreviewHomePage: '/markdownPreview.html',
            webEditorHomePage: '/webEditor.html',
            experimentHomePage: '/experiment.html',
            screenMirrorHomePage: '/screen-mirror.html',
        };
        return {
            ...pages,
            currentHomePage: globalThis.location.pathname,
            isPageScreen: true,
            appType: 'web',
            isDesktop: false,
            POPUP_FRAME_NAME_PREFIX: 'owa-popup-',
            messageUtils,
            screenUtils: { getContext: current },
            browserUtils: {
                pathToFileURL: resourceOf,
                openExternalURL(url: string) {
                    globalThis.open(url, '_blank', 'noopener');
                },
            },
            pathUtils,
            fileUtils,
            systemUtils: {
                copyToClipboard() {},
                commitHash: '',
                isDev: false,
                isWindows,
                isWindowsStore: false,
                is64System: true,
                isMac: false,
                isArm64: false,
                isLinux: false,
                isUbuntu: false,
                isFedora: false,
                isGlassCapable: false,
                openFile() {},
                generateFileMD5: () => Promise.resolve(''),
                generateMD5: md5Hex,
            },
            cryptoUtils: {
                encrypt: unavailable('cryptoUtils.encrypt'),
                decrypt: unavailable('cryptoUtils.decrypt'),
                createHash(algorithm: string) {
                    if (algorithm !== 'md5') {
                        throw new Error(`${algorithm} is not available`);
                    }
                    let text = '';
                    return {
                        update(data: unknown) {
                            text += String(data);
                            return this;
                        },
                        digest() {
                            return md5Hex(text);
                        },
                    };
                },
            },
            appInfo: {
                name: 'open-worship-app',
                title: 'Open Worship',
                titleFull: 'Open Worship App',
                description: '',
                author: '',
                homepage: 'https://www.openworship.app',
                gitRepository: '',
                version: '',
                versionNumber: 0,
            },
            appUtils: {
                handleError(error: unknown) {
                    console.error(error);
                },
                base64Encode(text: string) {
                    return btoa(
                        String.fromCodePoint(...new TextEncoder().encode(text)),
                    );
                },
                base64Decode(text: string) {
                    return new TextDecoder().decode(
                        Uint8Array.from(atob(text), (char) => {
                            return char.codePointAt(0) ?? 0;
                        }),
                    );
                },
            },
            envUtils: { isFEUseEffectWarning: false },
            httpUtils: {
                request: unavailable('httpUtils.request'),
                requestHttp: unavailable('httpUtils.requestHttp'),
            },
            ytUtils: { getYTHelper: () => Promise.reject(new Error('No yt')) },
            fontUtils: { getFonts: () => Promise.resolve({}) },
            databaseUtils: {
                getSQLiteDatabaseInstance: () => {
                    return Promise.reject(new Error('No database'));
                },
            },
            reload() {
                globalThis.location.reload();
            },
            init: () => Promise.resolve(),
        };
    }
}
