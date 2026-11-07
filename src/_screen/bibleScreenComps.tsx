import type { ReactNode } from 'react';
import { Fragment, useMemo } from 'react';

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
    // Only on the first verse of each chapter of a passage crossing
    // chapters: the number its chapter divider shows.
    chapterLabel?: string;
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
// family chosen in Bible/LongText Properties has to be read here to win at all. The
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

// `-2-----` before the first verse of each chapter of a passage crossing
// chapters. Spans, not divs: the screen's stylesheet lays every div of the
// view out inline. No `tran` here -- this markup is also drawn in the screen
// window, which may not have its language loaded yet.
function ScreenChapterDividerComp({
    chapterLabel,
    fontFamily,
}: Readonly<{ chapterLabel: string; fontFamily: string | undefined }>) {
    return (
        <span className="bible-chapter-divider" role="separator">
            <span
                className="bible-chapter-divider-label"
                style={{ fontFamily }}
            >
                {chapterLabel}
            </span>
        </span>
    );
}

function SectionTextElementComp({
    fontFamily,
    section,
    isNumHidden = false,
}: Readonly<{
    fontFamily: string | undefined;
    section: LongTextSectionType;
    // A stacked row says its numbers once, on a line of their own.
    isNumHidden?: boolean;
}>) {
    return (
        <>
            {section.chapterLabel === undefined ? null : (
                <ScreenChapterDividerComp
                    chapterLabel={section.chapterLabel}
                    fontFamily={fontFamily}
                />
            )}
            <span
                className="highlight"
                data-kjv-verse-key={section.key}
                data-verse-key={section.verseKey}
                style={{ fontFamily }}
            >
                {isNumHidden ? null : (
                    <div className="verse-number">{section.num}</div>
                )}
                {section.text}
            </span>
        </>
    );
}

export const SCREEN_BIBLE_MORE_CHAPTER_ATTRIBUTE = 'data-bible-more-chapter';

// `...` under the chapters shown: the OPERATOR's, drawn only where a label
// was handed in -- never on the projector itself.
function ScreenShowMoreChapterRowComp({
    label,
    colSpan,
}: Readonly<{ label: string; colSpan: number }>) {
    return (
        <tr>
            <td colSpan={colSpan}>
                <button
                    type="button"
                    className="bible-more-chapter-button"
                    title={label}
                    aria-label={label}
                    {...{ [SCREEN_BIBLE_MORE_CHAPTER_ATTRIBUTE]: '1' }}
                >
                    ...
                </button>
            </td>
        </tr>
    );
}

/**
 * Columns of numbered sections under a title: several Bibles, or one long
 * text in several languages.
 *
 * `isLongText` is what a long text does differently: its header chip is a
 * language code and opens nothing (a Bible's opens the versions menu). Its
 * look is the Bible's, every value of it (Bible/LongText Properties), but a
 * column may name a font family and a size of its own -- unset, it follows
 * the screen's.
 *
 * `isStacked` (a long text's Stack) puts every language in the SAME row, one
 * under the other, the way the Bible Reader shows versions merged: the row's
 * numbers on a line of their own, each in its language's digits and font,
 * then each language's words. One header says every code and every title,
 * `EN | KM`. `isNumberHidden` (a long text's Hide Number) draws no number and
 * no language code in the header, side by side or stacked -- the titles stay.
 */
export function LongTextTableComp({
    columns: rawColumns,
    isLineSync,
    isLongText,
    isStacked = false,
    isNumberHidden = false,
    moreChapterLabel,
}: Readonly<{
    columns: LongTextColumnLangType[];
    isLineSync: boolean;
    isLongText: boolean;
    isStacked?: boolean;
    isNumberHidden?: boolean;
    // The `...` button's label: given only to an operator's view of a
    // passage with chapters still to show.
    moreChapterLabel?: string;
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
            .flatMap(({ langData, style }, i) => {
                return [
                    langData.genCss(),
                    isLongText ? genLongTextColumnCss(i, style) : '',
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
    // Only the cells take it: the one column rule is the size, and the header
    // keeps the screen's (it is resized on every scroll).
    const genColumnClassName = (i: number) => {
        return isLongText ? toLongTextColumnClassName(i) : undefined;
    };
    const rendTableHeader = (column: LongTextColumnLangType, i: number) => {
        const direction = genDirectionStyle(column.locale);
        return (
            <th
                key={i}
                className="header"
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
                    {isLongText && isNumberHidden ? null : (
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
                    )}
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
                                    isNumHidden={isNumberHidden}
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
                            isNumHidden={isNumberHidden}
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
    if (isLongText && isStacked && columns.length > 1) {
        return (
            <LongTextStackedTableComp
                columns={columns}
                rowCount={rowCount}
                styleElement={styleElement}
                isNumberHidden={isNumberHidden}
            />
        );
    }
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
                                    {moreChapterLabel === undefined ? null : (
                                        <ScreenShowMoreChapterRowComp
                                            label={moreChapterLabel}
                                            colSpan={1}
                                        />
                                    )}
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
                    {moreChapterLabel === undefined ? null : (
                        <ScreenShowMoreChapterRowComp
                            label={moreChapterLabel}
                            colSpan={columns.length}
                        />
                    )}
                </tbody>
            </table>
        </div>
    );
}

/**
 * A long text's languages in one column, stacked row by row (`isStacked` of
 * `LongTextTableComp`). Each language keeps what is its own: its direction,
 * its font, and its size -- the column's class is on its lines here, not on
 * the cell. Every line carries the row's key, so a click on any of them marks
 * the row and the mark lights all of them.
 */
function LongTextStackedTableComp({
    columns,
    rowCount,
    styleElement,
    isNumberHidden,
}: Readonly<{
    columns: LongTextColumnLangType[];
    rowCount: number;
    styleElement: ReactNode;
    isNumberHidden: boolean;
}>) {
    const fontFamilies = columns.map(genColumnFontFamily);
    // The numbers line up on the side the first language reads from.
    const firstDirection = genDirectionStyle(columns[0].locale);
    const renderRow = (_: unknown, i: number) => {
        return (
            <tr key={i}>
                <td dir={firstDirection?.dir} style={firstDirection?.style}>
                    {isNumberHidden ? null : (
                        <span style={{ display: 'block' }}>
                            <div
                                className="verse-number"
                                style={{
                                    transformOrigin:
                                        firstDirection === null
                                            ? 'left'
                                            : 'right',
                                }}
                            >
                                {columns.map((column, j) => {
                                    const section = column.sections[i];
                                    return section === undefined ? null : (
                                        <Fragment key={j}>
                                            {j > 0 ? ', ' : null}
                                            <span
                                                style={{
                                                    fontFamily: fontFamilies[j],
                                                }}
                                            >
                                                {section.num}
                                            </span>
                                        </Fragment>
                                    );
                                })}
                            </div>
                        </span>
                    )}
                    {columns.map((column, j) => {
                        const section = column.sections[i];
                        if (section === undefined) {
                            return null;
                        }
                        const direction = genDirectionStyle(column.locale);
                        return (
                            <span
                                key={j}
                                className={toLongTextColumnClassName(j)}
                                dir={direction?.dir}
                                style={{
                                    display: 'block',
                                    ...direction?.style,
                                }}
                            >
                                <SectionTextElementComp
                                    fontFamily={fontFamilies[j]}
                                    section={section}
                                    isNumHidden
                                />
                            </span>
                        );
                    })}
                </td>
            </tr>
        );
    };
    return (
        <div className={SCREEN_LONG_TEXT_CLASSNAME}>
            {styleElement}
            <table>
                <thead>
                    <tr>
                        <th
                            className="header"
                            dir={firstDirection?.dir}
                            style={{
                                height: '118px',
                                overflow: 'hidden',
                                ...firstDirection?.style,
                            }}
                        >
                            <div style={{ display: 'flex' }}>
                                {isNumberHidden ? null : (
                                    <div
                                        className="bible bible-key"
                                        data-index={0}
                                    >
                                        {columns
                                            .map(({ code }) => {
                                                return code;
                                            })
                                            .join(' | ')}
                                    </div>
                                )}
                                <div className="title">
                                    <div>
                                        {columns.map((column, j) => {
                                            const direction = genDirectionStyle(
                                                column.locale,
                                            );
                                            return (
                                                <Fragment key={j}>
                                                    {j > 0 ? ' | ' : null}
                                                    <span
                                                        dir={direction?.dir}
                                                        style={{
                                                            fontFamily:
                                                                fontFamilies[j],
                                                        }}
                                                    >
                                                        {column.title}
                                                    </span>
                                                </Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>{Array.from({ length: rowCount }).map(renderRow)}</tbody>
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
