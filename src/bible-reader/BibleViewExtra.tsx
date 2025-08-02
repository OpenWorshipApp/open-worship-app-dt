import { createContext, ReactNode, use, useMemo } from 'react';

import { BibleSelectionMiniComp } from '../bible-lookup/BibleSelectionComp';
import {
    BIBLE_VIEW_TEXT_CLASS,
    fontSizeToHeightStyle,
    useBibleViewFontSizeContext,
    VERSE_TEXT_CLASS,
} from '../helper/bibleViewHelpers';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import ColorNoteInf from '../helper/ColorNoteInf';
import {
    ReadIdOnlyBibleItem,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import { BIBLE_VERSE_TEXT_TITLE } from '../helper/helpers';
import {
    BibleTargetType,
    CompiledVerseType,
} from '../bible-list/bibleRenderHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';
import {
    getVersesCount,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import RenderActionButtonsComp from '../bible-lookup/RenderActionButtonsComp';
import { HoverMotionHandler } from '../helper/domHelpers';
import { getSelectedText } from '../helper/textSelectionHelpers';
import LoadingComp from '../others/LoadingComp';

export const BibleViewTitleMaterialContext = createContext<{
    titleElement: ReactNode;
} | null>(null);

export function useBibleViewTitleMaterialContext() {
    const context = use(BibleViewTitleMaterialContext);
    if (context === null) {
        throw new Error(
            'useBibleViewTitleMaterialContext must be used within a ' +
                'BibleViewTitleMaterialContext',
        );
    }
    return context;
}

export function RenderTitleMaterialComp({
    bibleItem,
    onBibleKeyChange,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    onBibleKeyChange?: (oldBibleKey: string, newBibleKey: string) => void;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const materialContext = useBibleViewTitleMaterialContext();
    const colorNoteHandler: ColorNoteInf = {
        getColorNote: async () => {
            return viewController.getColorNote(bibleItem);
        },
        setColorNote: async (color) => {
            viewController.setColorNote(bibleItem, color);
        },
    };
    return (
        <div
            className="d-flex text-nowrap w-100 h-100"
            style={{
                overflowX: 'auto',
            }}
        >
            <ItemColorNoteComp item={colorNoteHandler} />
            <div className="d-flex flex-fill">
                <div className="d-flex ps-1">
                    <div style={{ margin: 'auto' }}>
                        <BibleSelectionMiniComp
                            bibleKey={bibleItem.bibleKey}
                            onBibleKeyChange={onBibleKeyChange}
                        />
                    </div>
                </div>
                <div className="flex-item">{materialContext.titleElement}</div>
            </div>
        </div>
    );
}

export function RenderHeaderComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const fontSize = useBibleViewFontSizeContext();
    return (
        <div
            className="card-header d-flex app-top-hover-motion-1"
            style={{ ...fontSizeToHeightStyle(fontSize) }}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={(
                    _oldBibleKey: string,
                    newBibleKey: string,
                ) => {
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        bibleKey: newBibleKey,
                    });
                }}
            />
            <div
                className={`${HoverMotionHandler.lowClassname}-1`}
                data-min-parent-width="550"
            >
                <RenderActionButtonsComp bibleItem={bibleItem} />
            </div>
            <div
                className={`${HoverMotionHandler.lowClassname}-0`}
                data-min-parent-width="550"
            >
                <i
                    className="bi bi-x-lg app-caught-hover-pointer"
                    style={{
                        color: 'var(--bs-danger-text-emphasis)',
                    }}
                    onClick={() => {
                        viewController.deleteBibleItem(bibleItem);
                    }}
                />
            </div>
        </div>
    );
}

export function BibleDirectViewTitleComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem.bibleKey, bibleItem.target]);
    return (
        <span
            data-bible-key={bibleItem.bibleKey}
            className="title app-border-white-round m-1 px-1"
        >
            {title}
        </span>
    );
}

export function BibleViewTitleWrapperComp({
    children,
    bibleKey,
}: Readonly<{
    children: React.ReactNode;
    bibleKey: string;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    return (
        <span className="title" data-bible-key={bibleKey} style={{ fontSize }}>
            {children}
        </span>
    );
}
export function BibleViewTitleEditingComp({
    bibleItem,
    onTargetChange,
    children,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    onTargetChange: (bibleTarget: BibleTargetType) => void;
    children?: React.ReactNode;
}>) {
    return (
        <BibleViewTitleWrapperComp bibleKey={bibleItem.bibleKey}>
            <BibleViewTitleEditorComp
                bibleItem={bibleItem}
                onTargetChange={onTargetChange}
            />{' '}
            {children}
        </BibleViewTitleWrapperComp>
    );
}

function cleanupVerseNumberClicked(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setTimeout(() => {
        const selection = window.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }, 2e3);
}

function RenderVerseTextComp({
    bibleItem,
    verseInfo,
    index,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    index: number;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    return (
        <>
            {viewController.shouldNewLine &&
            verseInfo.isNewLine &&
            index > 0 ? (
                <br />
            ) : null}
            <div
                className="verse-number app-caught-hover-pointer"
                title={`Double click to select verse ${verseInfo.localeVerse}`}
                onDoubleClick={(event) => {
                    cleanupVerseNumberClicked(event);
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        target: {
                            ...bibleItem.target,
                            verseStart: verseInfo.verse,
                            verseEnd: verseInfo.verse,
                        },
                    });
                }}
            >
                <div data-bible-key={verseInfo.bibleKey}>
                    {verseInfo.isNewLine ? (
                        <span className="verse-number-text">&nbsp;&nbsp;</span>
                    ) : null}
                    {verseInfo.localeVerse}
                </div>
            </div>
            <div
                className={VERSE_TEXT_CLASS}
                data-bible-key={verseInfo.bibleKey}
                data-kjv-verse-key={verseInfo.kjvBibleVersesKey}
                data-verse-key={verseInfo.bibleVersesKey}
                title={BIBLE_VERSE_TEXT_TITLE}
                onClick={(event) => {
                    if (getSelectedText()) {
                        return;
                    }
                    viewController.handleVersesSelecting(
                        event.currentTarget,
                        event.altKey,
                        false,
                        bibleItem,
                    );
                }}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    const selection = window.getSelection();
                    if (selection !== null && selection.rangeCount > 0) {
                        selection.removeAllRanges();
                    }
                    viewController.handleVersesSelecting(
                        event.currentTarget,
                        true,
                        false,
                        bibleItem,
                    );
                }}
            >
                {verseInfo.text}
            </div>
        </>
    );
}

function RenderRestVerseNumListComp({
    to,
    from,
    bibleItem,
    verseCount,
    onSelect,
    toTitle,
}: Readonly<{
    to?: number;
    from?: number;
    bibleItem: ReadIdOnlyBibleItem;
    verseCount: number;
    onSelect: (verse: number) => void;
    toTitle: (verse: number) => string;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    const actualFrom = from ?? 1;
    const actualTo = to ?? verseCount;
    const numList = useMemo(() => {
        const list = [];
        for (let i = actualFrom; i <= actualTo; i++) {
            list.push(i);
        }
        return list;
    }, [actualFrom, actualTo]);
    const [localeVerseList] = useAppStateAsync(() => {
        return Promise.all(
            numList.map((verse) => {
                return toLocaleNumBible(bibleItem.bibleKey, verse);
            }),
        );
    }, [bibleItem.bibleKey, numList]);
    if (!localeVerseList || localeVerseList.length === 0) {
        return null;
    }
    return (
        <span className="app-not-selectable-text">
            {from !== undefined ? <br /> : null}
            {numList.map((verse, i) => {
                return (
                    <div
                        key={verse}
                        className="verse-number app-caught-hover-pointer"
                        title={`Double click to select verses ${toTitle(verse)}`}
                        onDoubleClick={(event) => {
                            cleanupVerseNumberClicked(event);
                            onSelect(verse);
                        }}
                    >
                        <div
                            className="verse-number-rest app-not-selectable-text"
                            style={{
                                fontSize: `${fontSize * 0.7}px`,
                            }}
                            data-bible-key={bibleItem.bibleKey}
                        >
                            {localeVerseList[i]}
                        </div>
                    </div>
                );
            })}
            {top !== undefined ? <br /> : null}
        </span>
    );
}

export function BibleViewTextComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const { bibleKey, target } = bibleItem;
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useBibleItemsViewControllerContext();
    const [verseList] = useAppStateAsync(() => {
        return bibleItem.toVerseTextList();
    }, [bibleItem.bibleKey, bibleItem.target]);
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    if (verseList === undefined || verseCount === undefined) {
        return <LoadingComp />;
    }
    if (verseList === null || verseCount === null) {
        return (
            <div className={`${BIBLE_VIEW_TEXT_CLASS} p-1`}>
                <span className="text-danger">
                    `No verses found for this Bible item.
                </span>
            </div>
        );
    }
    return (
        <div
            className={`${BIBLE_VIEW_TEXT_CLASS} app-selectable-text p-1`}
            data-bible-item-id={bibleItem.id}
            style={{
                fontSize: `${fontSize}px`,
                paddingBottom: '100px',
            }}
        >
            <RenderRestVerseNumListComp
                to={target.verseStart - 1}
                bibleItem={bibleItem}
                verseCount={verseCount}
                onSelect={(verse) => {
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        target: { ...bibleItem.target, verseStart: verse },
                    });
                }}
                toTitle={(verse) => {
                    return `${verse}-${target.verseStart}`;
                }}
            />
            {verseList.map((verseInfo, i) => {
                return (
                    <RenderVerseTextComp
                        key={verseInfo.localeVerse}
                        bibleItem={bibleItem}
                        verseInfo={verseInfo}
                        index={i}
                    />
                );
            })}
            <RenderRestVerseNumListComp
                from={target.verseEnd + 1}
                bibleItem={bibleItem}
                verseCount={verseCount}
                onSelect={(verse) => {
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        target: { ...bibleItem.target, verseEnd: verse },
                    });
                }}
                toTitle={(verse) => {
                    return `${target.verseStart}-${verse}`;
                }}
            />
        </div>
    );
}
