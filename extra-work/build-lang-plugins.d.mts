// Types for `build-lang-plugins.mjs`, read by `src/lang/langPluginFacts.test.ts`:
// the part of the plugin build that writes `langFacts.json` (EN-59).

/** `electron/langPluginProtocol.ts`'s `LANG_PLUGIN_FACTS_FILE_NAME`. */
export const LANG_PLUGIN_FACTS_FILE_NAME: string;

/** A build plugin recording, per emitted asset, the source file(s) it came from. */
export function assetSourcePlugin(assetMap: Map<string, string>): {
    name: string;
    generateBundle: (options: unknown, bundle: Record<string, unknown>) => void;
};

/** `langFacts.json` for one package folder, from that folder's build. */
export function genLangFacts(options: {
    code: string;
    srcDir: string;
    assetMap: Map<string, string>;
}): {
    fonts: unknown;
    fontFiles?: Record<string, string>;
    hasLookupData: boolean;
};
