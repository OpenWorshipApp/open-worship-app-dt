import { useMemo } from 'react';

import type { LanguageDataType, LocaleType } from '../lang/langHelpers';
import { checkIsRtl } from '../lang/langHelpers';
import { BIBLE_TEXT_FONT_FAMILY_VAR } from './bibleTextStyleHelpers';
import {
    SCREEN_BIBLE_COLUMNS_CLASSNAME,
    SCREEN_BIBLE_COLUMN_CLASSNAME,
    toScreenBibleColumnClassName,
} from './screenBibleColumnHelpers';
import type {
    LongTextColumnType,
    LongTextSectionType,
} from './screenLongTextTypeHelpers';
import {
    SCREEN_LONG_TEXT_CLASSNAME,
    genLongTextColumnCss,
    genLongTextFontFamilyCss,
    readLongTextColumnStyle,
    toBibleLongTextColumns,
    toLongTextColumnClassName,
} from './screenLongTextTypeHelpers';

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
export type LongTextColumnLangType = LongTextColumnType & {
    langData: LanguageDataType;
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

// A column that names a family of its own says THAT inline instead, without
// the variable: it is this column's, whatever the screen's is.
function genColumnFontFamily({ style, langData }: LongTextColumnLangType) {
    if (style?.fontFamily === undefined) {
        return genLangFontFamily(langData);
    }
    return genLongTextFontFamilyCss(style.fontFamily, langData.fontFamily);
}

function SectionTextElementComp({
    fontFamily,
    section,
}: Readonly<{
    fontFamily: string | undefined;
    section: LongTextSectionType;
}>) {
    return (
        <span
            className="highlight"
            data-kjv-verse-key={section.key}
            data-verse-key={section.verseKey}
            style={{ fontFamily }}
        >
            <div className="verse-number">{section.num}</div>
            {section.text}
        </span>
    );
}

/**
 * Columns of numbered sections under a title: several Bibles, or one long
 * text in several languages.
 *
 * `isLongText` is what a long text does differently: its header chip is a
 * language code and opens nothing (a Bible's opens the versions menu), and
 * each column may carry a style of its own.
 */
export function LongTextTableComp({
    columns: rawColumns,
    isLineSync,
    isLongText,
}: Readonly<{
    columns: LongTextColumnLangType[];
    isLineSync: boolean;
    isLongText: boolean;
}>) {
    // Read once, here: a style reaches a screen from a setting file or a
    // Screen Mirror peer, and all of it is about to be written into CSS.
    const columns = useMemo(() => {
        if (!isLongText) {
            return rawColumns;
        }
        return rawColumns.map((column) => {
            return { ...column, style: readLongTextColumnStyle(column.style) };
        });
    }, [rawColumns, isLongText]);
    const styleText = useMemo(() => {
        return columns
            .flatMap(({ langData, style, locale }, i) => {
                return [
                    langData.genCss(),
                    isLongText
                        ? genLongTextColumnCss(i, style, checkIsRtl(locale))
                        : '',
                ];
            })
            .filter((text) => {
                return text !== '';
            })
            .join('\n');
    }, [columns, isLongText]);
    // The longest column: a shorter one is drawn with blank cells under it,
    // never read past its end.
    const rowCount = Math.max(
        0,
        ...columns.map(({ sections }) => {
            return sections.length;
        }),
    );
    const genColumnClassName = (i: number) => {
        return isLongText ? toLongTextColumnClassName(i) : undefined;
    };
    const rendTableHeader = (column: LongTextColumnLangType, i: number) => {
        const direction = genDirectionStyle(column.locale);
        const columnClassName = genColumnClassName(i);
        return (
            <th
                key={i}
                className={
                    'header' +
                    (columnClassName === undefined ? '' : ` ${columnClassName}`)
                }
                dir={direction?.dir}
                style={{
                    fontFamily: genColumnFontFamily(column),
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
                        className={
                            isLongText
                                ? 'bible bible-key'
                                : 'bible highlight bible-name bible-key'
                        }
                        data-index={i}
                    >
                        {column.code}
                    </div>
                    <div className="title">
                        <div>{column.title}</div>
                    </div>
                </div>
            </th>
        );
    };
    const renderTrBody = (_: any, i: number) => {
        return (
            <tr key={i}>
                {columns.map((column, j) => {
                    const direction = genDirectionStyle(column.locale);
                    const section = column.sections[i];
                    return (
                        <td
                            key={j}
                            className={genColumnClassName(j)}
                            dir={direction?.dir}
                            style={direction?.style}
                        >
                            {section === undefined ? null : (
                                <SectionTextElementComp
                                    fontFamily={genColumnFontFamily(column)}
                                    section={section}
                                />
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    };
    const renderTdBody = (column: LongTextColumnLangType, i: number) => {
        const direction = genDirectionStyle(column.locale);
        const fontFamily = genColumnFontFamily(column);
        return (
            <td
                key={i}
                className={genColumnClassName(i)}
                dir={direction?.dir}
                style={direction?.style}
            >
                {column.sections.map((section, j) => {
                    return (
                        <SectionTextElementComp
                            key={j}
                            fontFamily={fontFamily}
                            section={section}
                        />
                    );
                })}
            </td>
        );
    };
    const styleElement = (
        <style
            dangerouslySetInnerHTML={{
                __html: styleText,
            }}
        />
    );
    // Without Line Sync the Bibles are not row by row, so each one is a
    // table -- and a scroller -- of its own: in one table the shorter
    // translation ended while the longer was still verses away
    // (`screenBibleColumnHelpers`).
    if (!isLineSync && columns.length > 1) {
        const width = 100 / columns.length;
        return (
            <div className={SCREEN_BIBLE_COLUMNS_CLASSNAME}>
                {styleElement}
                {columns.map((column, i) => {
                    return (
                        <div
                            key={i}
                            className={
                                `${SCREEN_BIBLE_COLUMN_CLASSNAME} ` +
                                toScreenBibleColumnClassName(i)
                            }
                            data-column-index={i}
                            style={{
                                left: `${width * i}%`,
                                width: `${width}%`,
                            }}
                        >
                            <table>
                                <thead>
                                    <tr>{rendTableHeader(column, i)}</tr>
                                </thead>
                                <tbody>
                                    <tr>{renderTdBody(column, i)}</tr>
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        );
    }
    return (
        <div className={isLongText ? SCREEN_LONG_TEXT_CLASSNAME : undefined}>
            {styleElement}
            <table>
                <thead>
                    <tr>{columns.map(rendTableHeader)}</tr>
                </thead>
                <tbody>
                    {isLineSync ? (
                        Array.from({ length: rowCount }).map(renderTrBody)
                    ) : (
                        <tr>{columns.map(renderTdBody)}</tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

/** Several Bibles, as the columns `LongTextTableComp` draws. */
export function BibleBibleTableComp({
    bibleRenderingList,
    isLineSync,
}: Readonly<{
    bibleRenderingList: BibleItemRenderingLangType[];
    isLineSync: boolean;
}>) {
    const columns = useMemo(() => {
        return toBibleLongTextColumns(bibleRenderingList).map((column, i) => {
            return { ...column, langData: bibleRenderingList[i].langData };
        });
    }, [bibleRenderingList]);
    return (
        <LongTextTableComp
            columns={columns}
            isLineSync={isLineSync}
            isLongText={false}
        />
    );
}
