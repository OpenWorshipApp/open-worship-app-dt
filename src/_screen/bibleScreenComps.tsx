import { useMemo } from 'react';

import type { LanguageDataType, LocaleType } from '../lang/langHelpers';

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
    langData,
    verseInfo,
}: Readonly<{
    langData: LanguageDataType;
    verseInfo: BibleRenderVerseType;
}>) {
    return (
        <span
            className="highlight"
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
    const fontFaceList = useMemo(() => {
        return bibleRenderingList.map(({ langData }) => {
            return langData.genCss();
        });
    }, [bibleRenderingList]);
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
                    height: '118px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                    }}
                >
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
                {bibleRenderingList.map(({ langData, verses }, j) => {
                    return (
                        <td key={j}>
                            <VerseTextElementComp
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
        { langData, verses }: BibleItemRenderingLangType,
        i: number,
    ) => {
        return (
            <td key={i}>
                {verses.map((verseInfo, j) => {
                    return (
                        <VerseTextElementComp
                            key={j}
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
