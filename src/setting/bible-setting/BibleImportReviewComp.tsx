import { useState } from 'react';
import {
    BIBLE_BOOK_KEYS,
    getBibleNumberChoices,
} from '../../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { allLocalesMap, tran, type LocaleType } from '../../lang/langHelpers';
import {
    getAllXMLFileKeys,
    type BibleXMLJsonType,
} from './bibleXMLJsonDataHelpers';
import { getDownloadedBibleInfoList } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { checkIsBibleKeyTaken } from './bibleKeyHelpers';
import { checkAgentFileName } from '../../../tools/owa-devtools-mcp/agentFileName.mjs';
import { saveNewBibleImport } from './bibleImportSaveHelpers';
type NamesResultType = {
    bookNames: string[][];
    sources: {
        label: string;
        url: string | null;
        references?: { label: string; url: string }[];
    }[];
    warnings: string[];
    searchUrl: string;
    moreAvailable: boolean;
    nextOffset: number;
};

function mergeNameResults(
    previous: NamesResultType | null,
    next: NamesResultType,
) {
    if (!previous) return next;
    const combined = {
        ...next,
        bookNames: [...previous.bookNames],
        sources: [...previous.sources],
    };
    next.bookNames.forEach((names, index) => {
        const existingIndex = combined.bookNames.findIndex((existing) =>
            existing.every((name, book) => name === names[book]),
        );
        const source = next.sources[index];
        if (existingIndex < 0) {
            combined.bookNames.push(names);
            combined.sources.push(source);
            return;
        }
        const existing = combined.sources[existingIndex];
        const references = [...(existing.references ?? [])];
        for (const reference of [
            ...(source.url ? [{ label: source.label, url: source.url }] : []),
            ...(source.references ?? []),
        ]) {
            if (
                reference.url !== existing.url &&
                !references.some((item) => item.url === reference.url)
            )
                references.push(reference);
        }
        combined.sources[existingIndex] = { ...existing, references };
    });
    return combined;
}

async function readBuiltInNames(locale: string): Promise<NamesResultType> {
    const language = locale.split('-')[0];
    const sets =
        language === 'km'
            ? (await import('../../lang/data/km/bibleBooks.json')).default
            : language === 'fr'
              ? (await import('../../lang/data/fr/bibleBooks.json')).default
              : language === 'en'
                ? (await import('../../lang/data/en/bibleBooks.json')).default
                : [];
    return {
        bookNames: sets.map((set) => set.books),
        sources: sets.map((set) => ({
            label: set.keys.join(' / '),
            url: null,
        })),
        warnings: [],
        searchUrl: '',
        moreAvailable: false,
        nextOffset: 0,
    };
}

export default function BibleImportReviewComp({
    data,
    keyChoices,
    onCancel,
    onImported,
}: Readonly<{
    data: BibleXMLJsonType;
    keyChoices: string[];
    onCancel: () => void;
    onImported: () => void;
}>) {
    const [bibleKey, setBibleKey] = useState(data.info.key);
    const [takenKeys, setTakenKeys] = useState<string[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [locale, setLocale] = useState<string>(data.info.locale);
    const localeRef = useAppCurrentRef(locale);
    const [localeDraft, setLocaleDraft] = useState<string>(data.info.locale);
    const [numbers, setNumbers] = useState(() => {
        const existing = Array.from(
            { length: 10 },
            (_, index) => data.info.numbersMap[String(index)],
        );
        return existing.every(
            (digit) => typeof digit === 'string' && digit.length > 0,
        ) && existing.join('') !== '0123456789'
            ? existing
            : getBibleNumberChoices(data.info.locale)[0];
    });
    const [books, setBooks] = useState<string[] | null>(null);
    const [result, setResult] = useState<NamesResultType | null>(null);
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);
    const valid = Object.hasOwn(allLocalesMap, locale);
    const numberChoices = valid ? getBibleNumberChoices(locale) : [];
    if (!numberChoices.some((choice) => choice.join('') === numbers.join('')))
        numberChoices.push(numbers);
    const recommendedIndex = Math.max(
        0,
        result?.sources.findIndex((source) =>
            [data.info.key, ...keyChoices].some(
                (key) =>
                    key.length >= 2 &&
                    source.label.split(/\s*\/\s*/).includes(key),
            ),
        ) ?? 0,
    );
    const keyValid =
        bibleKey.trim().length > 0 &&
        checkAgentFileName(bibleKey.trim()) === null;
    const keyTaken =
        takenKeys !== null && checkIsBibleKeyTaken(bibleKey, takenKeys);
    const languageKey = data.info.locale.split('-')[0].toUpperCase();
    const year = data.info.title.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '';
    const suggestedKeys = Array.from(
        new Set([languageKey + year, languageKey, ...keyChoices]),
    )
        .filter(
            (key) =>
                key.length >= 2 &&
                key.length <= 24 &&
                /\p{L}/u.test(key) &&
                !/^(?:standard|version|public|domain|no|data)$/i.test(key) &&
                checkAgentFileName(key) === null &&
                !checkIsBibleKeyTaken(key, takenKeys ?? []),
        )
        .slice(0, 8);
    useAppEffect(() => {
        let active = true;
        Promise.all([getAllXMLFileKeys(), getDownloadedBibleInfoList()])
            .then(([keys, downloaded]) => {
                if (downloaded === null)
                    throw new Error('Cannot read Bible keys');
                if (active)
                    setTakenKeys([
                        ...Object.keys(keys),
                        ...downloaded.map((item) => item.key),
                    ]);
            })
            .catch(() => {
                if (active)
                    setSaveError(tran('Could not check installed Bible keys'));
            });
        return () => {
            active = false;
        };
    }, []);
    useAppEffect(() => {
        if (!valid) return;
        let active = true;
        const abort = new AbortController();
        setPending(true);
        setResult(null);
        setFailed(false);
        // One request per chosen locale, never per keystroke. The editable
        // locale is committed on blur below; late answers cannot replace it.
        readBuiltInNames(locale)
            .then(async (builtIn) => {
                if (!active) return;
                setResult(builtIn);
                const { callTool, parseToolJson } =
                    await import('../../chatbot/mcpClient');
                const text = await callTool(
                    'owa_bible_xml',
                    { action: 'names', locale },
                    abort.signal,
                );
                if (active)
                    setResult((previous) =>
                        mergeNameResults(previous, parseToolJson(text)),
                    );
            })
            .catch(() => {
                if (active) setFailed(true);
            })
            .finally(() => {
                if (active) setPending(false);
            });
        return () => {
            active = false;
            abort.abort();
        };
    }, [locale]);
    return (
        <div
            className="app-border-white-round p-2"
            style={{ maxWidth: '850px' }}
        >
            <h3>{tran('Review Bible import')}</h3>
            <p>{data.info.title}</p>
            <label className="d-block mb-2">
                {tran('Bible key')}
                <input
                    className="form-control"
                    aria-label={tran('Bible key')}
                    value={bibleKey}
                    disabled={saving}
                    onChange={(event) => setBibleKey(event.target.value)}
                />
            </label>
            {keyTaken ? (
                <p role="alert">{tran('Key is already taken')}</p>
            ) : null}
            {bibleKey && !keyValid ? (
                <p role="alert">{tran('Invalid Bible key')}</p>
            ) : null}
            <div>
                {suggestedKeys.map((key) => (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-info m-1"
                        key={key}
                        disabled={saving}
                        onClick={() => setBibleKey(key)}
                    >
                        {key}
                    </button>
                ))}
            </div>
            <p>
                {tran(
                    'Review the language and mappings before importing. The file name is only a language hint.',
                )}
            </p>
            <label className="d-block mb-2">
                {tran('Locale')}
                <input
                    className="form-control"
                    aria-label={tran('Locale')}
                    value={localeDraft}
                    disabled={saving}
                    onChange={(event) => setLocaleDraft(event.target.value)}
                    list="bible-import-locales"
                    onBlur={(event) => {
                        const next = event.currentTarget.value.trim();
                        if (next === locale) return;
                        setLocale(next);
                        setBooks(null);
                        if (Object.hasOwn(allLocalesMap, next))
                            setNumbers(getBibleNumberChoices(next)[0]);
                    }}
                />
                <datalist id="bible-import-locales">
                    {Object.keys(allLocalesMap).map((value) => (
                        <option key={value} value={value} />
                    ))}
                </datalist>
            </label>
            {!Object.hasOwn(allLocalesMap, localeDraft) ? (
                <p role="alert">{tran('Choose a valid locale')}</p>
            ) : null}
            <label className="d-block mb-2">
                {tran('Number mapping')}
                <select
                    className="form-select"
                    aria-label={tran('Number mapping')}
                    disabled={saving}
                    value={numbers.join(' ')}
                    onChange={(event) =>
                        setNumbers(event.target.value.split(' '))
                    }
                >
                    {numberChoices.map((digits, index) => (
                        <option key={digits.join('')} value={digits.join(' ')}>
                            {digits.join(' ')}
                            {index === 0 ? ` (${tran('Recommended')})` : ''}
                        </option>
                    ))}
                </select>
            </label>
            <label className="d-block mb-2">
                {tran('Book name mapping')}
                <select
                    className="form-select"
                    aria-label={tran('Book name mapping')}
                    disabled={saving}
                    value={
                        books === null
                            ? '-1'
                            : String(
                                  result?.bookNames.findIndex((names) =>
                                      names.every(
                                          (name, index) =>
                                              name === books[index],
                                      ),
                                  ),
                              )
                    }
                    onChange={(event) =>
                        setBooks(
                            result?.bookNames[Number(event.target.value)] ??
                                null,
                        )
                    }
                >
                    <option value="-1">
                        {tran('Keep existing book names')}
                    </option>
                    {result?.sources.map((source, index) => (
                        <option key={index} value={index}>
                            {source.label} —{' '}
                            {result.bookNames[index].slice(0, 3).join(', ')}
                            {index === recommendedIndex
                                ? ` (${tran('Recommended')})`
                                : ''}
                        </option>
                    ))}
                </select>
            </label>
            {pending ? (
                <p role="status">
                    {tran('Searching online for Bible book names...')}
                </p>
            ) : null}
            {failed || result?.warnings.length ? (
                <p>
                    {tran(
                        'Some online sources are unavailable. You can keep the existing names or try another locale.',
                    )}
                </p>
            ) : null}
            {result?.sources.map((source, index) => (
                <details key={index}>
                    <summary>
                        {source.label} — {tran('Preview book names')}
                    </summary>
                    {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer">
                            {source.url}
                        </a>
                    ) : (
                        <span>{tran('Built-in names')}</span>
                    )}
                    {source.references?.map((reference) => (
                        <p key={reference.url}>
                            <a
                                href={reference.url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {reference.label}
                            </a>
                        </p>
                    ))}
                    <p>{result.bookNames[index].join(' · ')}</p>
                </details>
            ))}
            {result?.searchUrl ? (
                <p>
                    <a href={result.searchUrl} target="_blank" rel="noreferrer">
                        {tran('Search for more book name lists')}
                    </a>
                </p>
            ) : null}
            {result?.moreAvailable ? (
                <button
                    className="btn btn-sm btn-outline-info"
                    disabled={pending || saving}
                    onClick={async () => {
                        const requestedLocale = locale;
                        setPending(true);
                        try {
                            const { callTool, parseToolJson } =
                                await import('../../chatbot/mcpClient');
                            const more: NamesResultType = parseToolJson(
                                await callTool('owa_bible_xml', {
                                    action: 'names',
                                    locale,
                                    offset: result.nextOffset,
                                }),
                            );
                            if (localeRef.current !== requestedLocale) return;
                            setResult((previous) =>
                                mergeNameResults(previous, more),
                            );
                        } catch {
                            if (localeRef.current === requestedLocale)
                                setFailed(true);
                        } finally {
                            if (localeRef.current === requestedLocale)
                                setPending(false);
                        }
                    }}
                >
                    {tran('Find more editions')}
                </button>
            ) : null}
            {saveError ? <p role="alert">{saveError}</p> : null}
            <div className="d-flex gap-2 mt-2">
                <button
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={onCancel}
                >
                    {tran('Cancel')}
                </button>
                <button
                    className="btn btn-primary"
                    disabled={
                        saving ||
                        !valid ||
                        localeDraft !== locale ||
                        !keyValid ||
                        keyTaken ||
                        takenKeys === null
                    }
                    onClick={async () => {
                        setSaving(true);
                        setSaveError('');
                        try {
                            const edited = {
                                ...data,
                                info: {
                                    ...data.info,
                                    key: bibleKey.trim(),
                                    locale: locale as LocaleType,
                                    numbersMap: Object.fromEntries(
                                        numbers.map((value, index) => [
                                            String(index),
                                            value,
                                        ]),
                                    ),
                                    keyBookMap: books
                                        ? Object.fromEntries(
                                              BIBLE_BOOK_KEYS.map(
                                                  (key, index) => [
                                                      key,
                                                      books[index],
                                                  ],
                                              ),
                                          )
                                        : data.info.keyBookMap,
                                },
                            };
                            if (await saveNewBibleImport(edited)) onImported();
                            else
                                setSaveError(tran('Failed to save Bible data'));
                        } catch (error) {
                            setSaveError(String((error as Error).message));
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    {saving ? tran('Saving...') : tran('Import')}
                </button>
            </div>
        </div>
    );
}
