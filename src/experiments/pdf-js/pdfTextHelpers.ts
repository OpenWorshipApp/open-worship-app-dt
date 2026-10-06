import englishBookList from '../../lang/data/en/bibleBooks.json';
import { setPdfTextRange, type PdfTextRangeType } from './pdfTextRanges';

const books = englishBookList[0].books;
const aliases = new Map<string, string>();
for (const book of books) {
    aliases.set(book.toLowerCase(), book);
    const prefix = /^(?:[123] )?/.exec(book)![0];
    const name = book.slice(prefix.length);
    for (let length = 3; length <= name.length; length++) {
        const abbreviation = prefix + name.slice(0, length);
        if (
            books.filter((candidate) => candidate.startsWith(abbreviation))
                .length === 1
        ) {
            aliases.set(abbreviation.toLowerCase(), book);
        }
    }
}
for (const [alias, book] of Object.entries({
    ps: 'Psalm',
    psalms: 'Psalm',
    jn: 'John',
    mt: 'Matthew',
    mk: 'Mark',
    lk: 'Luke',
    rom: 'Romans',
    song: 'Song of Solomon',
    '1 cor': '1 Corinthians',
    '2 cor': '2 Corinthians',
    '1 jn': '1 John',
    '2 jn': '2 John',
    '3 jn': '3 John',
})) {
    aliases.set(alias, book);
}
const bookPattern = [...aliases.keys()]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/ /g, '\\s*'))
    .join('|');
const compactAliases = new Map(
    [...aliases].map(([alias, book]) => [alias.replace(/ /g, ''), book]),
);

export type ReferenceMatchType = {
    start: number;
    end: number;
    reference: string;
};
export type PdfTextClickType = {
    text: string;
    reference: string | null;
    pageNumber: number;
    fileName: string;
    action?: 'click' | 'contextmenu';
    start?: number;
    end?: number;
};

export function findBibleReferences(text: string): ReferenceMatchType[] {
    const pattern = new RegExp(
        `(?<![\\p{L}\\d])(${bookPattern})\\.?\\s*(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?(?!\\d)`,
        'giu',
    );
    return [...text.matchAll(pattern)].flatMap((match) => {
        const book = compactAliases.get(
            match[1].replace(/\s/g, '').toLowerCase(),
        );
        const chapter = Number(match[2]);
        const verse = Number(match[3]);
        const endVerse = match[4] ? Number(match[4]) : verse;
        if (!book || !chapter || !verse || endVerse < verse) {
            return [];
        }
        return [
            {
                start: match.index!,
                end: match.index! + match[0].length,
                reference: `${book} ${chapter}:${verse}${endVerse === verse ? '' : `-${endVerse}`}`,
            },
        ];
    });
}

// Read all geometry before changing DOM. Separate distant columns/blocks so a
// book at the end of one column cannot borrow numbers from the next column.
export function createPdfTextMap(elements: HTMLElement[]) {
    const runs = elements
        .filter((element) => element.textContent?.trim())
        .map((element) => ({
            element,
            text: element.textContent!,
            rect: element.getBoundingClientRect(),
            start: 0,
        }));
    let source = '';
    runs.forEach((run, index) => {
        const previous = runs[index - 1];
        if (previous) {
            const height = Math.max(run.rect.height, previous.rect.height, 1);
            const sameLine =
                Math.abs(run.rect.top - previous.rect.top) < height * 0.6;
            const gap = run.rect.left - previous.rect.right;
            const nextLine =
                Math.abs(run.rect.top - previous.rect.top) < height * 1.8 &&
                Math.abs(run.rect.left - previous.rect.left) < height * 2;
            source +=
                sameLine && gap >= -height && gap < height * 2
                    ? gap < height * 0.12
                        ? ''
                        : ' '
                    : nextLine
                      ? '\n'
                      : '\0';
        }
        run.start = source.length;
        source += run.text;
    });
    for (const run of runs) {
        const { element, text } = run;
        element.title = text;
        element.dataset.pdfText = text;
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', text);
    }
    return { source, runs };
}

export function decoratePdfText(
    elements: HTMLElement[],
    handlers: {
        onClick?: (
            event: MouseEvent,
            range: PdfTextRangeType,
            reference: string,
        ) => void;
        onContextMenu?: (
            event: MouseEvent,
            range: PdfTextRangeType,
            reference: string,
        ) => void;
    } = {},
) {
    const map = createPdfTextMap(elements);
    const matches = findBibleReferences(map.source);
    const annotations = matches.map((match) => {
        const annotation = setPdfTextRange(map, match.start, match.end, {
            title: match.reference,
            onClick: handlers.onClick
                ? (event, range) =>
                      handlers.onClick!(event, range, match.reference)
                : undefined,
            onContextMenu: handlers.onContextMenu
                ? (event, range) =>
                      handlers.onContextMenu!(event, range, match.reference)
                : undefined,
        });
        annotation.elements.forEach((element) => {
            element.dataset.bibleReference = match.reference;
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', match.reference);
            element.tabIndex = 0;
            element.parentElement?.setAttribute('role', 'group');
        });
        return annotation;
    });
    return Object.assign(map, {
        matches,
        dispose: () => annotations.forEach((item) => item.dispose()),
    });
}

export async function readAppBibleVerse(reference: string) {
    const [{ default: BibleItem }, { getAllLocalBibleInfoList }] =
        await Promise.all([
            import('../../bible-list/BibleItem'),
            import('../../helper/bible-helpers/bibleDownloadHelpers'),
        ]);
    const versions = [...((await getAllLocalBibleInfoList()) ?? [])];
    versions.sort((a, b) => Number(b.key === 'KJV') - Number(a.key === 'KJV'));
    for (const version of versions) {
        try {
            const item = await BibleItem.fromTitleText(version.key, reference);
            if (item) {
                return {
                    reference: await item.toTitle(),
                    text: await item.toText(),
                    version: version.key,
                };
            }
        } catch {
            // A damaged or incompatible translation must not block the next one.
        }
    }
    return null;
}
