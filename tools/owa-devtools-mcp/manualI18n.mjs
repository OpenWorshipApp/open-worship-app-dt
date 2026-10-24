// The manual in the app's other languages: `docs/manual-i18n/<code>/`, one
// page for each page of `docs/manual-sources/`, at the same relative path.
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
// Node only (`node:crypto`, `node:fs`): the build and the help search read it,
// never the renderer.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toManualPageBody } from './manualPage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');
export const MANUAL_SOURCE_DIR = path.join(REPO_ROOT, 'docs', 'manual-sources');
export const MANUAL_I18N_DIR = path.join(REPO_ROOT, 'docs', 'manual-i18n');

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
            return statSync(path.join(i18nDir, name)).isDirectory();
        })
        .sort();
}

/**
 * One language's translated pages, each with whether it is still a
 * translation of the English page as it stands now (`isStale`).
 */
export function listManualTranslations(
    langCode,
    {
        i18nDir = MANUAL_I18N_DIR,
        englishPageMap = listEnglishManualPages(),
    } = {},
) {
    const langDir = path.join(i18nDir, langCode);
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
