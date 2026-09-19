/**
 * A data folder carried between computers -- a flash drive that mounts as
 * `E:\` on one Windows machine, `F:\` on the next and `/Volumes/USB` on a Mac
 * -- must not hold its own absolute path inside any file. Everything written
 * INSIDE it stores that prefix as `DATA_DIR_PATH_ALIAS`, and every read expands
 * it back to wherever the folder is now. `fileHelpers` applies it to the four
 * text primitives; this module is pure so both operating systems can be tested
 * from either one.
 *
 * A plain replace is not enough, and every piece below is here for a reason:
 * - the path is stored in more than one FORM: raw, JSON-escaped once (a
 *   document), twice (a note's content, an agent backup's text) or three
 *   times, and as a `file://` URL. Restoring `E:\data` raw inside JSON makes
 *   `JSON.parse` throw, so the escape level is kept in the stored text;
 * - separators must be NATIVE when read back (`FileSource` splits on the OS
 *   separator only), so a tail written on the other OS family is converted;
 * - a `$` in a replacement string is a pattern (`$&`), so every replacement is
 *   a function.
 */
export const DATA_DIR_PATH_ALIAS = '$DATA_DIR_PATH';
// A URL has no escape levels and the same separator everywhere, so its alias
// is portable as it stands.
const URL_ALIAS = `file:///${DATA_DIR_PATH_ALIAS}/`;

export type DataDirAliasType = {
    dirPath: string;
    // `dirPath` ending in exactly one separator. Only this is aliased, so a
    // sibling `open-worship-data-dev` is never taken for `open-worship-data`.
    prefix: string;
    sep: string;
    urlPrefix: string;
    // [real, portable], the URL first: on macOS/Linux the plain prefix is a
    // substring of its own URL.
    pairs: [string, string][];
};

// A path inside N JSON strings is escaped N times.
function escapeJson(text: string, level: number) {
    for (let i = 0; i < level; i++) {
        text = JSON.stringify(text).slice(1, -1);
    }
    return text;
}

export function genDataDirAlias(
    dirPath: string,
    sep: string,
    toFileUrl: (filePath: string) => string,
): DataDirAliasType {
    const prefix = dirPath.endsWith(sep) ? dirPath : dirPath + sep;
    const urlPrefix = toFileUrl(prefix);
    const pairs: [string, string][] = [[urlPrefix, URL_ALIAS]];
    for (const level of [0, 1, 2, 3]) {
        const real = escapeJson(prefix, level);
        // On macOS/Linux every level is the same text.
        if (
            pairs.every(([existing]) => {
                return existing !== real;
            })
        ) {
            pairs.push([real, escapeJson(DATA_DIR_PATH_ALIAS + sep, level)]);
        }
    }
    return { dirPath, prefix, sep, urlPrefix, pairs };
}

export function toPortableText(text: string, alias: DataDirAliasType) {
    for (const [real, portable] of alias.pairs) {
        text = text.replaceAll(real, () => {
            return portable;
        });
    }
    return text;
}

/**
 * What follows an alias, as written by either OS family:
 * 1. Windows: a run of 1, 2, 4 or 8 backslashes (JSON level 0-3), names joined
 *    by exactly that same run, and an optional trailing run. A shorter run is
 *    a JSON escape (`\n` after a path), never a separator.
 * 2. macOS/Linux: a `/` path.
 * A name is any exFAT-legal character and never runs into the next alias.
 */
const ALIAS_PATH_REGEX =
    /\$DATA_DIR_PATH(?:(\\{8}|\\{4}|\\{2}|\\)((?:(?:(?!\$DATA_DIR_PATH[\\/])[^\\/:*?"<>|\r\n\t])+(?:\1(?:(?!\$DATA_DIR_PATH[\\/])[^\\/:*?"<>|\r\n\t])+)*(?:\1)?)?)|(\/(?:(?!\$DATA_DIR_PATH[\\/])[^\\:*?"<>|\r\n\t])*))/g;

export function fromPortableText(text: string, alias: DataDirAliasType) {
    if (!text.includes(DATA_DIR_PATH_ALIAS)) {
        return text;
    }
    const base = alias.prefix.slice(0, -1);
    let scannedIndex = -1;
    let quoteLevel = 0;
    return text
        .replaceAll(URL_ALIAS, () => {
            return alias.urlPrefix;
        })
        .replace(
            ALIAS_PATH_REGEX,
            (
                _match: string,
                run: string | undefined,
                windowsTail: string | undefined,
                posixTail: string | undefined,
                index: number,
                whole: string,
            ) => {
                let level: number;
                if (run === undefined) {
                    // A `/` carries no escape level, so it is read off the
                    // nearest `"` on the same line: 2^(k-1)-1 backslashes
                    // before it means k strings deep, no quote means raw. For
                    // valid JSON this is never too SHALLOW (which would break
                    // `JSON.parse`), only sometimes too deep (doubled
                    // backslashes, still the same file). Line-local, so a
                    // patch line resolves exactly like the file line it
                    // copies; `scannedIndex` keeps it one pass per line.
                    for (let i = index - 1; i > scannedIndex; i--) {
                        if (whole[i] === '\n') {
                            quoteLevel = 0;
                            break;
                        }
                        if (whole[i] === '"') {
                            let count = 0;
                            while (whole[i - 1 - count] === '\\') {
                                count++;
                            }
                            quoteLevel = Math.floor(Math.log2(count + 1)) + 1;
                            break;
                        }
                    }
                    scannedIndex = index;
                    level = quoteLevel;
                } else {
                    level = Math.log2(run.length);
                }
                const sep = escapeJson(alias.sep, level);
                const tail =
                    run === undefined
                        ? (posixTail ?? '').split('/').join(sep)
                        : sep + (windowsTail ?? '').split(run).join(sep);
                return escapeJson(base, level) + tail;
            },
        );
}
