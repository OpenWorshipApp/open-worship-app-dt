// The provider of a Screen Show copy: the app's screen page drawing ANOTHER
// screen inside an iframe of a screen window or of the presenter.
//
// The window holding the iframe hands over, through `parent`, a host made by
// `mountScreenShowFrame` (`screenShowFrameHelpers`): its own provider to start
// from, the source screen's state and changes, and its files as addresses.
// What the page does with its hands -- a scroll, a verse picked, its video's
// time, its "init" -- is NOT sent anywhere: this copy follows the presenter,
// it never drives it. Only "init" is answered, with the source's whole state.
//
// Nothing here may import `appProvider`: it is what `appProvider` reads. And
// everything that touches `globalThis` is written here, in the iframe's realm,
// because a function the parent wrote would reach the PARENT's window.
import type {
    ScreenShowFrameHostType,
    ScreenShowFrameStateType,
} from './screenShowFrameHelpers';
import type { ScreenMessageType } from './screenTypeHelpers';

const HOSTS_KEY = '__owaScreenShowFrameHosts';
const SCREEN_HOME_PAGE = '/vd-screen.html';

type ListenerType = (event: unknown, ...args: any[]) => void;

function findHost(key: string): ScreenShowFrameHostType | null {
    try {
        const hosts = (globalThis.parent as any)?.[HOSTS_KEY];
        return hosts?.get?.(key) ?? null;
    } catch {
        // Not the app's own parent page.
        return null;
    }
}

export function connectScreenShowFrame(): Record<string, unknown> {
    const params = new URLSearchParams(globalThis.location.search);
    const key = params.get('screenShow') ?? '';
    const sourceScreenId = Number(params.get('screenId'));
    const host = findHost(key);
    if (host === null || host.sourceScreenId !== sourceScreenId) {
        throw new Error('This Screen Show has no screen to draw');
    }
    // The holding window's own provider, without what names ITS page: this
    // page is named from its own address (`toPageFlags`).
    const base = Object.fromEntries(
        Object.entries(host.baseProvider as Record<string, any>).filter(
            ([name]) => {
                return !/^isPage[A-Z]/.test(name) && name !== 'isMainPage';
            },
        ),
    );
    const screenMessageChannel: string =
        base.messageUtils?.messageChannels?.screenMessage ??
        'app:screen:message';
    // Into THIS realm: a parent's object fails `instanceof` here (a Date, an
    // Array), and the page keeps what it is given.
    const clone = <T>(value: T): T => {
        try {
            return structuredClone(value);
        } catch {
            // Something that cannot be copied is used as it is.
            return value;
        }
    };
    const listeners = new Map<string, Set<ListenerType>>();
    const heldMessages: ScreenMessageType[] = [];
    const deliver = (channel: string, payload: unknown) => {
        const set = listeners.get(channel);
        if (set === undefined || set.size === 0) {
            if (channel === screenMessageChannel) {
                heldMessages.push(payload as ScreenMessageType);
            }
            return;
        }
        for (const listener of set) {
            listener({}, payload);
        }
    };
    const state: ScreenShowFrameStateType = clone(host.getState());
    const context = {
        screenId: sourceScreenId,
        stage: state.stage,
        // Read from the holding window when asked: a screen page only ever
        // asks for one key at a time (`appLocalStorage.getItem`).
        settings: new Proxy({} as Record<string, string>, {
            get(_target, name) {
                return typeof name === 'string'
                    ? (host.getSetting(name) ?? undefined)
                    : undefined;
            },
        }),
        resources: {},
        fontCss: state.fontCss,
        isWindows: state.isWindows,
        remote: false,
        isSoundOwner: false,
        isScreenShowFrame: true,
        messages: state.messages,
    };
    // The same scheme as the iframe element (`mountScreenShowFrame`): any
    // other and Chromium fills the frame white where it should be clear.
    globalThis.document.documentElement.style.colorScheme = 'normal';
    const stopListening = host.listen((messages) => {
        for (const message of messages) {
            deliver(screenMessageChannel, clone(message));
        }
    });
    globalThis.addEventListener('pagehide', stopListening);

    const messageUtils = {
        messageChannels: base.messageUtils?.messageChannels ?? {
            screenMessage: screenMessageChannel,
        },
        sendData(channel: string, payload?: any) {
            if (channel === screenMessageChannel && payload?.type === 'init') {
                host.requestSnapshot();
                return;
            }
            if (channel === 'main:app:ask-camera-access') {
                const reply = payload?.replyEventName;
                if (typeof reply === 'string') {
                    host.askCameraAccess().then(
                        (canAccess) => deliver(reply, canAccess),
                        () => deliver(reply, false),
                    );
                }
            }
        },
        sendDataSync(channel: string, ...args: any[]) {
            if (channel === 'mirror:screen-context') {
                return context;
            }
            if (channel === 'mirror:resource') {
                return host.resolveResource(String(args[0]?.filePath ?? ''));
            }
            if (channel === 'main:app:get-screens') {
                return [sourceScreenId];
            }
            // A read the holding window can answer (the displays, the theme).
            return base.messageUtils?.sendDataSync?.(channel, ...args);
        },
        listenForData(channel: string, listener: ListenerType) {
            let set = listeners.get(channel);
            if (set === undefined) {
                set = new Set();
                listeners.set(channel, set);
            }
            set.add(listener);
            if (channel === screenMessageChannel && heldMessages.length > 0) {
                const held = heldMessages.splice(0);
                queueMicrotask(() => {
                    for (const message of held) {
                        listener({}, message);
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
    return {
        ...base,
        screenHomePage: SCREEN_HOME_PAGE,
        currentHomePage: globalThis.location.pathname,
        isPageScreen: true,
        messageUtils,
        screenUtils: { getContext: () => context },
        browserUtils: {
            ...base.browserUtils,
            pathToFileURL: (filePath: string) => {
                return host.resolveResource(filePath);
            },
            openExternalURL() {},
        },
        reload() {
            globalThis.location.reload();
        },
        init: () => Promise.resolve(),
    };
}
