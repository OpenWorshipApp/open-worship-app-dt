import {
    toLangPluginBaseUrl,
    type LangPluginType,
} from '../../electron/langPluginProtocol';

// `appProvider.langUtils` for a BROWSER watching a virtual display: no Node,
// no disk -- the Screen Mirror server answers the list of the app's language
// plugins (`/@lang/plugins.json`) and their files (`/@lang/<code>/...`), and a
// plugin's factory is loaded as a classic same-origin script, which registers
// itself (`extra-work/build-lang-plugins.mjs`) where the page's CSP admits it.
// Nothing is installed or written from here.

const FACTORIES_NAME = '__owaLangPluginFactories';

type LangPluginFactoryType = (host: unknown) => any;

let pluginListPromise: Promise<LangPluginType[]> | null = null;
const dataPromiseMap = new Map<string, Promise<any>>();

function getOrigin() {
    return globalThis.location.origin;
}

function getLangPlugins(): Promise<LangPluginType[]> {
    pluginListPromise ??= fetch(`${getOrigin()}/@lang/plugins.json`, {
        cache: 'no-store',
    })
        .then((response) => {
            return response.ok ? response.json() : [];
        })
        .then((list) => {
            return Array.isArray(list) ? list : [];
        })
        .catch(() => {
            return [];
        });
    return pluginListPromise;
}

async function getLangPlugin(langCode: string) {
    const pluginList = await getLangPlugins();
    return (
        pluginList.find((plugin) => {
            return plugin.langCode === langCode;
        }) ?? null
    );
}

function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => {
            reject(new Error(`Failed to load ${src}`));
        };
        document.head.appendChild(script);
    });
}

async function loadLangData(langCode: string) {
    const plugin = await getLangPlugin(langCode);
    if (plugin === null) {
        return null;
    }
    const baseUrl = toLangPluginBaseUrl(getOrigin(), langCode);
    await loadScript(`${baseUrl}index.js`);
    const factory = (globalThis as any)[FACTORIES_NAME]?.[langCode] as
        LangPluginFactoryType | undefined;
    if (typeof factory !== 'function') {
        return null;
    }
    const data = factory({
        langCode,
        baseUrl,
        dirPath: null,
        assetUrl(relativePath: string) {
            return new URL(relativePath, baseUrl).href;
        },
        toFilePath() {
            return '';
        },
        onOpenLyricInternal() {},
        // The viewer loads the plugin from the page's own server, so its
        // workers are same-origin already.
        createWorker(url: string | URL, options?: WorkerOptions) {
            return new Worker(url, options);
        },
    });
    return data ?? null;
}

function getLangData(langCode: string) {
    let promise = dataPromiseMap.get(langCode);
    if (promise === undefined) {
        promise = loadLangData(langCode).catch((error) => {
            dataPromiseMap.delete(langCode);
            console.error(error);
            return null;
        });
        dataPromiseMap.set(langCode, promise);
    }
    return promise;
}

async function readLangPluginJson(langCode: string, fileName: string) {
    if (!/^[A-Za-z0-9_-]+\.json$/.test(fileName)) {
        return null;
    }
    try {
        const response = await fetch(
            `${toLangPluginBaseUrl(getOrigin(), langCode)}${fileName}`,
        );
        return response.ok ? await response.json() : null;
    } catch (_error) {
        return null;
    }
}

export function genWebLangUtils() {
    return {
        getLangPlugins,
        getLangPlugin,
        getLangData,
        readLangPluginJson,
        getLangPluginsDirPath: () => null,
        getLangAssetBaseUrl: (langCode: string) => {
            return toLangPluginBaseUrl(getOrigin(), langCode);
        },
    };
}
