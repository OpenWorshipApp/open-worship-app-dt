import type { LanguageDataType, LocaleType } from '../lang/langHelpers';
import { BIBLE_VERSE_TEXT_TITLE } from '../helper/helpers';

export type BibleRenderVerseType = {
    num: string;
    text: string;
    verseKey: string;
    kjvVerseKey: string;
};
export type BibleItemRenderingType = {
    locale: LocaleType;
    bibleKey: string;
    title: string;
    verses: BibleRenderVerseType[];
};
export type BibleItemRenderingLangType = BibleItemRenderingType & {
    langData: LanguageDataType;
};
export type LyricRenderedType = {
    title: string;
    items: {
        num: number;
        text: string;
    }[];
};

function VerseTextElementComp({
    bibleKey,
    langData,
    verseInfo,
}: Readonly<{
    bibleKey: string;
    langData: LanguageDataType;
    verseInfo: BibleRenderVerseType;
}>) {
    return (
        <span
            className="highlight"
            title={BIBLE_VERSE_TEXT_TITLE}
            data-bible-key={bibleKey}
            data-kjv-verse-key={verseInfo.kjvVerseKey}
            data-verse-key={verseInfo.verseKey}
            style={{
                fontFamily: langData.fontFamily,
            }}
        >
            <div className="verse-number">{verseInfo.num}</div>
            {verseInfo.text}
        </span>
    );
}

export function BibleBibleTable({
    bibleRenderingList,
    isLineSync,
    versesCount,
}: Readonly<{
    bibleRenderingList: BibleItemRenderingLangType[];
    isLineSync: boolean;
    versesCount: number;
}>) {
    const fontFaceList = bibleRenderingList.map(({ langData }) => {
        return langData.genCss();
    });
    const rendTableHeader = (
        { langData, bibleKey, title }: BibleItemRenderingLangType,
        i: number,
    ) => {
        return (
            <th
                key={title}
                className="header"
                style={{
                    fontFamily: langData.fontFamily,
                }}
            >
                <div style={{ display: 'flex' }}>
                    <div
                        className="bible highlight bible-name bible-key"
                        data-index={i}
                    >
                        {bibleKey}
                    </div>
                    <div className="title">
                        <div>{title}</div>
                    </div>
                </div>
            </th>
        );
    };
    const renderTrBody = (_: any, i: number) => {
        return (
            <tr key={i}>
                {bibleRenderingList.map(({ langData, verses, bibleKey }, j) => {
                    return (
                        <td key={j}>
                            <VerseTextElementComp
                                bibleKey={bibleKey}
                                langData={langData}
                                verseInfo={verses[i]}
                            />
                        </td>
                    );
                })}
            </tr>
        );
    };
    const renderTdBody = (
        { langData, verses, bibleKey }: BibleItemRenderingLangType,
        i: number,
    ) => {
        return (
            <td key={i}>
                {verses.map((verseInfo, j) => {
                    return (
                        <VerseTextElementComp
                            key={j}
                            bibleKey={bibleKey}
                            langData={langData}
                            verseInfo={verseInfo}
                        />
                    );
                })}
            </td>
        );
    };
    return (
        <div>
            <style
                dangerouslySetInnerHTML={{
                    __html: fontFaceList.join('\n'),
                }}
            />
            <table>
                <thead>
                    <tr>{bibleRenderingList.map(rendTableHeader)}</tr>
                </thead>
                <tbody>
                    {isLineSync ? (
                        Array.from({ length: versesCount }).map(renderTrBody)
                    ) : (
                        <tr>{bibleRenderingList.map(renderTdBody)}</tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
