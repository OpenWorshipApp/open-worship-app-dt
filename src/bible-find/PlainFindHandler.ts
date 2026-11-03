import { fsReadFile } from '../server/fileHelpers';
import type { BibleFindForType, BibleFindResultType } from './bibleFindHelpers';
import { prepareFindQuery, toFoundVerseItem } from './bibleFindQueryHelpers';
import { finishSuggestionWords } from './suggestionWordHelpers';

// The minimal find used when the runtime has no `node:sqlite` -- Electron
// 32's Node 20, the build for older Intel Macs. It answers the same two
// questions the SQLite index does (verses whose sanitized text holds the
// words in order, and suggestion words holding the typed letters) from a
// plain JSON index on disk. The index is read only while finding and dropped
// after a short idle, so nothing stays in memory between searches.

const RELEASE_AFTER_MS = 30_000;

export type PlainFindIndexType = {
    // [`BOOK.chapter:verse=>text`, sanitized text lowered like SQLite LIKE]
    verses: [string, string][];
    // [word, space-joined book keys holding it]
    words: [string, string][];
};

/** SQLite's `LIKE` folds ASCII letters only; so does the plain find. */
export function toLikeLowerText(text: string) {
    return text.replaceAll(/[A-Z]+/g, (part) => part.toLowerCase());
}

/** `LIKE '%a%%b%'`: every needle, in order, without overlapping. */
export function checkIsHoldingInOrder(text: string, needles: string[]) {
    let position = 0;
    for (const needle of needles) {
        const index = text.indexOf(needle, position);
        if (index === -1) {
            return false;
        }
        position = index + needle.length;
    }
    return true;
}

export default class PlainFindHandler {
    readonly indexFilePath: string;
    private data: PlainFindIndexType | null;
    private loading: Promise<PlainFindIndexType> | null = null;
    private releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(indexFilePath: string, data: PlainFindIndexType | null = null) {
        this.indexFilePath = indexFilePath;
        this.data = data;
        if (data !== null) {
            this.scheduleRelease();
        }
    }

    private scheduleRelease() {
        if (this.releaseTimeoutId !== null) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.releaseTimeoutId = setTimeout(() => {
            this.releaseTimeoutId = null;
            this.data = null;
        }, RELEASE_AFTER_MS);
    }

    private async getData() {
        if (this.data === null) {
            this.loading ??= fsReadFile(this.indexFilePath)
                .then((text) => JSON.parse(text) as PlainFindIndexType)
                .finally(() => {
                    this.loading = null;
                });
            this.data = await this.loading;
        }
        this.scheduleRelease();
        return this.data;
    }

    close() {
        if (this.releaseTimeoutId !== null) {
            clearTimeout(this.releaseTimeoutId);
            this.releaseTimeoutId = null;
        }
        this.data = null;
    }

    async doFinding(
        bibleKey: string,
        findData: BibleFindForType,
    ): Promise<BibleFindResultType | null> {
        const query = await prepareFindQuery(bibleKey, findData);
        if (query === null) {
            return null;
        }
        const { fromLineNumber, toLineNumber, count, wildCardText } = query;
        const needles = toLikeLowerText(wildCardText)
            .split('%')
            .filter((needle) => needle !== '');
        const bookKeys = findData.bookKeys ?? [];
        const { verses } = await this.getData();
        const content: BibleFindResultType['content'] = [];
        let maxLineNumber = 0;
        for (const [text, sText] of verses) {
            if (
                bookKeys.length > 0 &&
                !bookKeys.some((bookKey) => text.startsWith(bookKey))
            ) {
                continue;
            }
            if (!checkIsHoldingInOrder(sText, needles)) {
                continue;
            }
            if (maxLineNumber >= fromLineNumber && content.length < count) {
                content.push(toFoundVerseItem(text));
            }
            maxLineNumber++;
        }
        return { maxLineNumber, fromLineNumber, toLineNumber, content };
    }

    async loadSuggestionWords(
        attemptingWord: string,
        limit: number,
        bookKeys: string[] = [],
    ): Promise<string[]> {
        if (!attemptingWord) {
            return [];
        }
        // FTS5's `MATCH 'l o v'` asks for a word holding every letter.
        const letters = [
            ...new Set(Array.from(attemptingWord.toLowerCase())),
        ].filter((letter) => letter.trim() !== '');
        const { words } = await this.getData();
        const found = words
            .filter(([word]) => {
                return letters.every((letter) => word.includes(letter));
            })
            .sort((a, b) => a[0].length - b[0].length)
            .map(([text, foundBookKeys]) => {
                return { text, bookKeys: foundBookKeys };
            });
        return finishSuggestionWords(found, attemptingWord, limit, bookKeys);
    }
}
