// The manual in the app's other languages: `<the language's folder>/manual/`,
// one page for each page of `docs/manual-sources/`, at the same relative
// path. Each language keeps its manual inside its own package, so a language
// is added -- or taken out -- with its folder: in a checkout
// `src/lang/data/online/<code>/manual/`, in the app the INSTALLED plugin's
// `manual/` (`build-lang-plugins.mjs` copies it there with a search index,
// `manual/index.json`, made by `genManualIndexEntries` below). The app's own
// knowledge bundle carries the English manual alone.
//
// A translation is not generated: `docs/scripts/build-manual.mjs` deletes and
// rewrites `docs/manual-sources/` from the source of truth on every
// `docs:gen`, so the translations live in a tree of their own that nothing
// rewrites. Each carries `translatedFrom` in its front matter -- the hash of
// the English page body it was made from -- so a page that changed since is
// known to be STALE: it is shown nowhere until it is translated again, and
// the English page stands in for it (`extra-work/manual-i18n-status.mjs`
// lists what is missing and stale per language).
//
// A translation keeps every `[en:tran:Key]` template as it is, so each button
// name still resolves to the exact words on the button.
//
// Node only (`node:crypto`, `node:fs`): the builds and the help search read
// it, never the renderer.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toManualPageBody } from './manualPage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');
export const MANUAL_SOURCE_DIR = path.join(REPO_ROOT, 'docs', 'manual-sources');
// The installable language packages of a checkout; a language's manual is its
// `manual/` folder.
export const MANUAL_I18N_DIR = path.join(
    REPO_ROOT,
    'src',
    'lang',
    'data',
    'online',
);
export const MANUAL_DIR_NAME = 'manual';
// A plugin's prebuilt index of its manual, inside its `manual/`.
export const MANUAL_INDEX_FILE_NAME = 'index.json';
// The search reads a manual page WHOLE up to this, and headings to this
// (`build-knowledge.mjs` holds the English pages to the same numbers).
export const MANUAL_SEARCH_TEXT_LIMIT = 120000;
export const MANUAL_HEADINGS_LIMIT = 1500;

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

export function readFrontMatter(content) {
    const match = FRONT_MATTER_PATTERN.exec(String(content ?? ''));
    const data = {};
    if (match === null) {
        return data;
    }
    for (const line of match[1].split(/\r?\n/)) {
        const pair = /^([\w-]+):\s*(.*)$/.exec(line);
        if (pair !== null) {
            data[pair[1]] = pair[2].replace(/^["']|["']$/g, '');
        }
    }
    return data;
}

/**
 * What a translation says it was made from: the English page's body, line
 * endings and edge space left out so a checkout's CRLF does not make every
 * page stale.
 */
export function hashManualPage(englishContent) {
    const body = toManualPageBody(String(englishContent ?? ''))
        .replace(/\r\n/g, '\n')
        .trim();
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

// Kept apart from the body: an excerpt drawn from both would say a line twice.
export function genManualHeadings(body) {
    return String(body ?? '')
        .split(/\r?\n/)
        .filter((line) => {
            return line.startsWith('#') || line.startsWith('**');
        })
        .join('\n')
        .slice(0, MANUAL_HEADINGS_LIMIT);
}

function listMarkdownFiles(dirPath) {
    if (!existsSync(dirPath)) {
        return [];
    }
    const filePaths = [];
    for (const entryName of readdirSync(dirPath).sort()) {
        const entryPath = path.join(dirPath, entryName);
        if (statSync(entryPath).isDirectory()) {
            filePaths.push(...listMarkdownFiles(entryPath));
        } else if (entryName.endsWith('.md')) {
            filePaths.push(entryPath);
        }
    }
    return filePaths;
}

/** The English pages by id: their file and hash. */
export function listEnglishManualPages(sourceDir = MANUAL_SOURCE_DIR) {
    const pageMap = new Map();
    for (const filePath of listMarkdownFiles(sourceDir)) {
        const content = readFileSync(filePath, 'utf-8');
        const id = readFrontMatter(content).id;
        if (id === undefined) {
            continue;
        }
        pageMap.set(id, {
            id,
            relativePath: path.relative(sourceDir, filePath),
            hash: hashManualPage(content),
        });
    }
    return pageMap;
}

/** The languages the manual is translated into. */
export function listManualLanguages(i18nDir = MANUAL_I18N_DIR) {
    if (!existsSync(i18nDir)) {
        return [];
    }
    return readdirSync(i18nDir)
        .filter((name) => {
            const manualDir = path.join(i18nDir, name, MANUAL_DIR_NAME);
            return existsSync(manualDir) && statSync(manualDir).isDirectory();
        })
        .sort();
}

/**
 * One language's translated pages, each with whether it is still a
 * translation of the English page as it stands now (`isStale`). `packDir` is
 * the language's folder -- a source package or an installed plugin.
 */
export function listManualTranslations(
    langCode,
    {
        i18nDir = MANUAL_I18N_DIR,
        packDir = path.join(i18nDir, langCode),
        englishPageMap = listEnglishManualPages(),
    } = {},
) {
    const langDir = path.join(packDir, MANUAL_DIR_NAME);
    return listMarkdownFiles(langDir).map((filePath) => {
        const content = readFileSync(filePath, 'utf-8');
        const frontMatter = readFrontMatter(content);
        const english = englishPageMap.get(frontMatter.id);
        return {
            id: frontMatter.id ?? path.basename(filePath, '.md'),
            lang: langCode,
            title: frontMatter.title ?? path.basename(filePath, '.md'),
            section: frontMatter.section ?? '',
            relativePath: path.relative(langDir, filePath),
            absolutePath: filePath,
            translatedFrom: frontMatter.translatedFrom ?? null,
            isStale:
                english === undefined ||
                frontMatter.translatedFrom !== english.hash,
            content,
        };
    });
}

/**
 * The search entries of one language's manual (`<packDir>/manual/`): what the
 * help search ranks and quotes, and `translatedFrom` for telling a stale page
 * from a current one against whichever English manual is there at the time --
 * an installed language outlives the app release it was built beside.
 * `file` is relative to the `manual/` folder.
 */
export function genManualIndexEntries(packDir) {
    const manualDir = path.join(packDir, MANUAL_DIR_NAME);
    return listMarkdownFiles(manualDir).map((filePath) => {
        const content = readFileSync(filePath, 'utf-8');
        const frontMatter = readFrontMatter(content);
        const body = toManualPageBody(content);
        return {
            id: frontMatter.id ?? path.basename(filePath, '.md'),
            title: frontMatter.title ?? path.basename(filePath, '.md'),
            section: frontMatter.section ?? '',
            file: path.relative(manualDir, filePath).split(path.sep).join('/'),
            translatedFrom: frontMatter.translatedFrom ?? null,
            headings: genManualHeadings(body),
            searchText: body.slice(0, MANUAL_SEARCH_TEXT_LIMIT),
        };
    });
}
