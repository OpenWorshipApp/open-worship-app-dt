import { useMemo, useState } from 'react';

import { useAppEffect, useAppStateAsync } from '../../helper/debuggerHelpers';
import {
    genBookMatches,
    useChapterMatch,
} from '../../helper/bible-helpers/bibleLogicHelpers1';
import LoadingComp from '../../others/LoadingComp';
import BibleXMLEditorComp from './BibleXMLEditorComp';

import { showSimpleToast } from '../../toast/toastHelpers';
import { getChapterData } from '../../helper/bible-helpers/bibleInfoHelpers';
import type { BibleChapterType } from '../../helper/bible-helpers/BibleDataReader';
import {
    getBibleXMLDataFromKey,
    saveJsonDataToXMLfile,
} from './bibleXMLHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { forceReloadAppWindows } from '../settingHelpers';
import { bookChapterEditorSchemaHandler } from './schemas/bibleSchemaHelpers';
import { bibleBookChapterUri } from './schemas/bibleEditorUriHelpers';

function RenderBookOptionsComp({
    bibleKey,
    selectedBookKey,
    setSelectedBookKey,
}: Readonly<{
    bibleKey: string;
    selectedBookKey: string;
    setSelectedBookKey: (bookKey: string) => void;
}>) {
    const [booksAvailable] = useAppStateAsync(() => {
        return genBookMatches(bibleKey);
    }, [bibleKey]);
    useAppEffect(() => {
        if (
            selectedBookKey !== '' ||
            !booksAvailable ||
            booksAvailable.length === 0
        ) {
            return;
        }
        const book =
            booksAvailable.find(({ isAvailable }) => isAvailable) ?? null;
        if (book === null) {
            return;
        }
        setSelectedBookKey(book.bookKey);
    }, [selectedBookKey, booksAvailable]);
    if (booksAvailable === undefined) {
        return <LoadingComp />;
    }
    if (booksAvailable === null) {
        return <div>Unable to load book list.</div>;
    }
    return (
        <div className="w-100 h-100">
            <div className="w-100 d-flex">
                <select
                    className="form-select"
                    value={selectedBookKey}
                    data-bible-key={bibleKey}
                    onChange={(e) => {
                        setSelectedBookKey(e.target.value);
                    }}
                >
                    {booksAvailable.map(({ bookKey, book, isAvailable }) => {
                        return (
                            <option
                                key={bookKey}
                                value={bookKey}
                                disabled={!isAvailable}
                                data-bible-key={bibleKey}
                            >
                                {book}
                                {book === bookKey ? '' : ` (${bookKey})`}
                            </option>
                        );
                    })}
                </select>
            </div>
        </div>
    );
}

function RenderChapterOptionsComp({
    bibleKey,
    selectedBookKey,
    selectedChapter,
    setSelectedChapter,
}: Readonly<{
    bibleKey: string;
    selectedBookKey: string;
    selectedChapter: number;
    setSelectedChapter: (chapter: number) => void;
}>) {
    const chapterList = useChapterMatch(bibleKey, selectedBookKey, null);
    if (chapterList === null) {
        return <div>Unable to load chapter list.</div>;
    }
    return (
        <div className="w-100 h-100">
            <div className="w-100 d-flex">
                <select
                    className="form-select"
                    value={selectedChapter}
                    data-bible-key={bibleKey}
                    onChange={(e) => {
                        setSelectedChapter(Number(e.target.value));
                    }}
                >
                    {chapterList.map(({ chapter, chapterLocaleString }) => {
                        return (
                            <option
                                key={chapter}
                                value={chapter}
                                data-bible-key={bibleKey}
                            >
                                {chapterLocaleString}
                                {chapterLocaleString === `${chapter}`
                                    ? ''
                                    : ` (${chapter})`}
                            </option>
                        );
                    })}
                </select>
            </div>
        </div>
    );
}

type DataType = BibleChapterType & {
    bibleKey: string;
    bookKey: string;
    chapter: number;
};

async function handleSaving(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    newJsonData: BibleChapterType,
) {
    const xmlBibleData = await getBibleXMLDataFromKey(bibleKey);
    if (!xmlBibleData) {
        showSimpleToast(
            'Saving Bible Data',
            `Bible Data not found for key ${bibleKey}`,
        );
        return;
    }
    xmlBibleData.customVersesMap = {
        ...xmlBibleData.customVersesMap,
        ...newJsonData.customVersesMap,
    };
    xmlBibleData.newLinesTitleMap = {
        ...xmlBibleData.newLinesTitleMap,
        ...newJsonData.newLinesTitleMap,
    };
    xmlBibleData.newLines = xmlBibleData.newLines ?? [];
    for (const newLine of newJsonData.newLines ?? []) {
        if (!xmlBibleData.newLines.includes(newLine)) {
            xmlBibleData.newLines.push(newLine);
        }
    }
    const bookData = xmlBibleData.books[bookKey];
    bookData[chapter.toString()] = {
        ...bookData[chapter.toString()],
        ...newJsonData.verses,
    };
    const isSuccess = await saveJsonDataToXMLfile(xmlBibleData);
    if (isSuccess) {
        forceReloadAppWindows();
    }
}

function EditorComp({
    bibleKey,
    bookKey,
    chapter,
}: Readonly<{
    bibleKey: string;
    bookKey: string;
    chapter: number;
}>) {
    const [chapterData] =
        useAppStateAsync<BibleChapterType | null>(async () => {
            const localChapterData = await getChapterData(
                bibleKey,
                bookKey,
                chapter,
            );
            if (chapter === 0 && localChapterData === null) {
                return {
                    title: 'Introduction',
                    verses: {},
                    newLines: [],
                    newLinesTitleMap: {},
                    customVersesMap: {},
                };
            }
            return localChapterData;
        }, [bibleKey, bookKey, chapter]);
    const jsonData: DataType | AnyObjectType = useMemo(() => {
        if (!chapterData) {
            return {};
        }
        return {
            bibleKey,
            bookKey,
            chapter,
            verses: chapterData.verses,
            newLines: chapterData.newLines ?? [],
            newLinesTitleMap: chapterData.newLinesTitleMap ?? {},
            customVersesMap: chapterData.customVersesMap ?? {},
        };
    }, [chapterData]);
    if (chapterData === undefined) {
        return <LoadingComp />;
    }
    if (chapterData === null) {
        return <div>Chapter data not found.</div>;
    }
    return (
        <BibleXMLEditorComp
            id={bibleKey}
            jsonData={jsonData}
            onStore={() => {}}
            jsonDataSchema={bookChapterEditorSchemaHandler}
            save={(newJsonData: DataType) => {
                if (newJsonData.bibleKey !== bibleKey) {
                    showSimpleToast(
                        'Saving Bible Data',
                        `Invalid Bible Key ${newJsonData.bibleKey}`,
                    );
                    return;
                }
                if (newJsonData.bookKey !== bookKey) {
                    showSimpleToast(
                        'Saving Bible Data',
                        `Invalid Book Key ${newJsonData.bookKey}`,
                    );
                    return;
                }
                if (newJsonData.chapter !== chapter) {
                    showSimpleToast(
                        'Saving Bible Data',
                        `Invalid Chapter Number ${newJsonData.chapter}`,
                    );
                    return;
                }
                handleSaving(bibleKey, bookKey, chapter, newJsonData);
            }}
            editorUri={bibleBookChapterUri}
        />
    );
}

export default function BibleXMLBookChapterEditorComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
}>) {
    const [selectedBookKey, setSelectedBookKey] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState(1);
    return (
        <>
            <div className="w-100 h-100 d-flex">
                <RenderBookOptionsComp
                    bibleKey={bibleKey}
                    selectedBookKey={selectedBookKey}
                    setSelectedBookKey={setSelectedBookKey}
                />
                {selectedBookKey === '' ? null : (
                    <RenderChapterOptionsComp
                        bibleKey={bibleKey}
                        selectedBookKey={selectedBookKey}
                        selectedChapter={selectedChapter}
                        setSelectedChapter={setSelectedChapter}
                    />
                )}
            </div>
            {selectedBookKey === '' ? null : (
                <EditorComp
                    bibleKey={bibleKey}
                    bookKey={selectedBookKey}
                    chapter={selectedChapter}
                />
            )}
        </>
    );
}
