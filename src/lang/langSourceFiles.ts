import type { LangPluginType } from '../../electron/langPluginProtocol';

// The language packages as SOURCE (`src/lang/data/online/<code>/`), for code that
// runs where no language plugin is installed: a unit test.
//
// In the app every language but English is a plugin (`langPluginRegistry.ts`),
// so the app holds none of their files and this module answers nothing -- it
// is what keeps every other language out of `dist/`. Under vitest it is
// replaced by `langSourceFiles.vitest.ts` (`vitest.config.ts`), which reads
// the packages of the checkout, so a test sees the languages the tree holds
// -- and, with a package folder deleted, does not.

export function listSourceLangPlugins(): LangPluginType[] {
    return [];
}

export async function loadSourceLangData(_langCode: string): Promise<any> {
    return null;
}

export async function loadSourceLangFile(
    _langCode: string,
    _fileName: string,
): Promise<unknown> {
    return null;
}
