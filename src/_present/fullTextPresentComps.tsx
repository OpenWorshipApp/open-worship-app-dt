import { Fragment } from 'react';
import { LocaleType } from '../lang';
import { getFontFace, getFontFamilyByLocal } from '../server/fontHelpers';

export type BibleRenderVerseType = {
    num: string,
    text: string,
};
export type BibleItemRenderedType = {
    locale: LocaleType,
    bibleKey: string,
    title: string,
    verses: BibleRenderVerseType[]
};
export type LyricRenderedType = {
    title: string,
    items: {
        num: number,
        text: string,
    }[]
};

export function FTBibleTable({
    bibleRenderedList,
    isLineSync,
    versesCount,
}: {
    bibleRenderedList: BibleItemRenderedType[],
    isLineSync: boolean,
    versesCount: number,
}) {
    const fontFaceList = bibleRenderedList.map(({ locale }) => {
        return getFontFace(locale);
    });
    return (
        <div>
            <style dangerouslySetInnerHTML={{
                __html: fontFaceList.join('\n'),
            }} />
            <table>
                <thead>
                    <tr>
                        {bibleRenderedList.map(({ locale, bibleKey, title }, i) => {
                            return (
                                <th key={i}
                                    style={{
                                        fontFamily: getFontFamilyByLocal(locale),
                                    }}>
                                    <span className='bible highlight bible-name'
                                        data-index={i}>
                                        {bibleKey}
                                    </span>
                                    |<span className='title'>{title}</span >
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {isLineSync ? Array.from({ length: versesCount }).map((_, i) => {
                        return (
                            <tr key={i}>
                                {bibleRenderedList.map(({ locale, verses }, j) => {
                                    const { num, text } = verses[i];
                                    return (
                                        <td key={j}
                                            style={{
                                                fontFamily: getFontFamilyByLocal(locale),
                                            }}>
                                            <span className='highlight'
                                                data-highlight={i}>
                                                <span className='verse-number'>
                                                    {num}
                                                </span>: {text}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    }) : <tr>
                        {bibleRenderedList.map(({ locale, verses }, i) => {
                            return (
                                <td key={i}>
                                    {verses.map(({ num, text }, j) => {
                                        return (
                                            <span key={j}
                                                className='highlight'
                                                style={{
                                                    fontFamily: getFontFamilyByLocal(locale),
                                                }}
                                                data-highlight={j}>
                                                <span className='verse-number'>
                                                    {num}
                                                </span>: {text}
                                            </span>
                                        );
                                    })}
                                </td>
                            );
                        })}
                    </tr>}
                </tbody>
            </table>
        </div>
    );
}

export function FTLyricItem({
    lyricRenderedList,
    isLineSync,
    itemsCount,
}: {
    lyricRenderedList: LyricRenderedType[],
    isLineSync: boolean,
    itemsCount: number,
}) {
    return (
        <table>
            <thead>
                <tr>
                    {lyricRenderedList.map(({ title }, i) => {
                        return (
                            <th key={i}>
                                <span className='title'>{title}</span >
                            </th>
                        );
                    })}
                </tr>
            </thead>
            <tbody>
                {isLineSync ? Array.from({ length: itemsCount }).map((_, i) => {
                    return (
                        <tr key={i}>
                            {lyricRenderedList.map(({ items }, j) => {
                                const { num, text } = items[i];
                                return (
                                    <td key={j}>
                                        <span data-highlight={num}>
                                            {text}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    );
                }) : <tr>
                    {lyricRenderedList.map(({ items }, i) => {
                        return (
                            <td key={i}>
                                {items.map(({ num, text }, j) => {
                                    return (
                                        <Fragment key={j}>
                                            <span className='highlight'
                                                data-highlight={j}>
                                                <span className='verse-number'>
                                                    {num}
                                                </span>: {text}
                                            </span>
                                            <br />
                                        </Fragment>
                                    );
                                })}
                            </td>
                        );
                    })}
                </tr>}
            </tbody>
        </table>
    );
}
