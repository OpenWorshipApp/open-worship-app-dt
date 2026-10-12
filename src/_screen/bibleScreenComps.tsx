import { useMemo } from 'react';

import type { LanguageDataType, LocaleType } from '../lang/langHelpers';
import { checkIsRtl } from '../lang/langHelpers';
import { BIBLE_TEXT_FONT_FAMILY_VAR } from './bibleTextStyleHelpers';

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

// A column reads the way its own Bible does, whatever the rest of the screen
// is doing: the table's stylesheet hardcodes `text-align: left`, so a
// right-to-left Bible has to say so here or its lines come out ragged on the
// wrong side of the column.
function genDirectionStyle(locale: LocaleType) {
    if (!checkIsRtl(locale)) {
        return null;
    }
    return { dir: 'rtl', style: { textAlign: 'right' as const } };
}

// The font a language brings (Khmer's Battambang) is said inline, so the
// family chosen in Bible Properties has to be read here to win at all. The
// language's own stays behind it: a Latin family picked for the English column
// must not leave the Khmer one beside it in whatever the system falls back to.
// With nothing chosen the variable is unset and this is the font it always was.
function genLangFontFamily({ fontFamily }: LanguageDataType) {
    if (!fontFamily) {
        return undefined;
    }
    return `var(${BIBLE_TEXT_FONT_FAMILY_VAR}, ${fontFamily}), ${fontFamily}`;
}

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
                fontFamily: genLangFontFamily(langData),
            }}
        >
            <div className="verse-number">{verseInfo.num}</div>
            {verseInfo.text}
        </span>
    );
}

export function BibleBibleTableComp({
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
        { langData, bibleKey, title, locale }: BibleItemRenderingLangType,
        i: number,
    ) => {
        const direction = genDirectionStyle(locale);
        return (
            <th
                key={title}
                className="header"
                dir={direction?.dir}
                style={{
                    fontFamily: genLangFontFamily(langData),
                    height: '118px',
                    overflow: 'hidden',
                    ...direction?.style,
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
                {bibleRenderingList.map(({ langData, verses, locale }, j) => {
                    const direction = genDirectionStyle(locale);
                    return (
                        <td
                            key={j}
                            dir={direction?.dir}
                            style={direction?.style}
                        >
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
        { langData, verses, locale }: BibleItemRenderingLangType,
        i: number,
    ) => {
        const direction = genDirectionStyle(locale);
        return (
            <td key={i} dir={direction?.dir} style={direction?.style}>
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
