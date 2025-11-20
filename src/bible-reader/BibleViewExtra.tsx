import {
    createContext,
    Fragment,
    ReactNode,
    RefObject,
    use,
    useMemo,
    useRef,
    useState,
    MouseEvent as ReactMouseEvent,
} from 'react';

import { BibleSelectionMiniComp } from '../bible-lookup/BibleSelectionComp';
import {
    BIBLE_VIEW_TEXT_CLASS,
    fontSizeToHeightStyle,
    useBibleViewFontSizeContext,
    VERSE_TEXT_CLASS,
} from '../helper/bibleViewHelpers';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import ColorNoteInf from '../helper/ColorNoteInf';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import {
    BIBLE_VERSE_TEXT_TITLE,
    checkIsVerticalPartialInvisible,
} from '../helper/helpers';
import {
    bibleRenderHelper,
    BibleTargetType,
    CompiledVerseType,
} from '../bible-list/bibleRenderHelpers';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';
import {
    getVersesCount,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import RenderActionButtonsComp from '../bible-lookup/RenderActionButtonsComp';
import { HoverMotionHandler } from '../helper/domHelpers';
import { getSelectedText } from '../helper/textSelectionHelpers';
import LoadingComp from '../others/LoadingComp';
import { getAISetting } from '../helper/ai/aiHelpers';
import FileSource from '../helper/FileSource';
import LookupBibleItemController from './LookupBibleItemController';
import { AudioAIEnablingComp } from './AudioAIEnablingComp';
import appProvider from '../server/appProvider';
import BibleItem from '../bible-list/BibleItem';
import {
    bibleTextToSpeech,
    checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled,
} from '../helper/ai/openAIAudioHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { getBibleInfoIsRtl } from '../helper/bible-helpers/bibleInfoHelpers';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import RenderCustomVerseComp from './RenderCustomVerseComp';

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
    onBibleKeyChange?: (
        isContextMenu: boolean,
        oldBibleKey: string,
        newBibleKey: string,
    ) => void;
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
            <div className="d-flex">
                <div>
                    <ItemColorNoteComp item={colorNoteHandler} />
                </div>
                <div className="mx-1">
                    <AudioAIEnablingComp bibleItem={bibleItem} />
                </div>
            </div>
            <div className="d-flex flex-fill">
                <div className="d-flex ps-1">
                    <div style={{ margin: 'auto' }}>
                        <BibleSelectionMiniComp
                            bibleKey={bibleItem.bibleKey}
                            onBibleKeyChange={onBibleKeyChange}
                            contextMenuTitle="`Add Extra Bible"
                        />
                    </div>
                    {bibleItem.extraBibleKeys.map((extraBibleKey) => (
                        <span
                            className="bible-extra-key bg-primary small app-caught-hover-pointer"
                            title={`Click to remove extra Bible ${extraBibleKey}`}
                            data-bible-key={extraBibleKey}
                            key={extraBibleKey}
                            style={{
                                borderRadius: '8px',
                                fontSize: '10px',
                                padding: '2px',
                                margin: 'auto 1px',
                            }}
                            onClick={() => {
                                viewController.applyTargetOrBibleKey(
                                    bibleItem,
                                    {
                                        extraBibleKeys:
                                            bibleItem.extraBibleKeys.filter(
                                                (key) => key !== extraBibleKey,
                                            ),
                                    },
                                );
                            }}
                        >
                            <i className="bi bi-x" style={{ color: 'red' }} />
                            {extraBibleKey}
                        </span>
                    ))}
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
            className="card-header d-flex app-top-hover-motion-1 p-0"
            style={{ ...fontSizeToHeightStyle(fontSize) }}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={(
                    isContextMenu: boolean,
                    _oldBibleKey: string,
                    newBibleKey: string,
                ) => {
                    viewController.applyTargetOrBibleKey(
                        bibleItem,
                        isContextMenu
                            ? {
                                  extraBibleKeys: [
                                      ...bibleItem.extraBibleKeys,
                                      newBibleKey,
                                  ],
                              }
                            : {
                                  bibleKey: newBibleKey,
                              },
                    );
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
            className="title app-border-white-round m-1 px-1 app-found-highlight"
        >
            {title}
        </span>
    );
}

export function BibleViewTitleWrapperComp({
    children,
    bibleKey,
}: Readonly<{
    children: ReactNode;
    bibleKey: string;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    return (
        <span
            className="title full-view-reset-font-size"
            data-bible-key={bibleKey}
            style={{ fontSize }}
        >
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
    children?: ReactNode;
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

function cleanupVerseNumberClicked(event: ReactMouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setTimeout(() => {
        const selection = globalThis.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }, 2e3);
}

function AudioPlayerComp({
    src,
    onStart,
    onEnd,
    refreshAudio,
}: Readonly<{
    src: string | undefined | null;
    onStart: (audio: HTMLAudioElement) => void;
    onEnd: (audio: HTMLAudioElement) => void;
    refreshAudio: () => void;
}>) {
    if (src === undefined) {
        return (
            <div
                className="verse-audio"
                style={{
                    width: '40px',
                    height: '40px',
                }}
            >
                <LoadingComp />
            </div>
        );
    }
    if (src === null) {
        return null;
    }
    const handleContextMenuOpening = (event: any) => {
        showAppContextMenu(event, [
            {
                menuElement: '`Refresh',
                onSelect: refreshAudio,
            },
        ]);
    };
    return (
        <audio
            className="verse-audio"
            ref={(element) => {
                const openAISetting = getAISetting();
                if (
                    appProvider.isPageReader &&
                    openAISetting.isAutoPlay &&
                    element?.checkVisibility()
                ) {
                    element.play();
                    element.focus();
                    onStart(element);
                }
            }}
            controls
            onPlay={(event) => {
                const el = event.currentTarget;
                for (const el1 of document.querySelectorAll('audio')) {
                    if (el1 !== el) {
                        el1.pause();
                    }
                }
            }}
            onEnded={(event) => {
                const el = event.currentTarget;
                if (el && el.checkVisibility()) {
                    onEnd(el);
                }
            }}
            onContextMenu={handleContextMenuOpening}
        >
            <source src={src} />
            <track kind="captions" />
            Browser does not support audio.
        </audio>
    );
}

function handleNextChapterSelection(
    lookupBibleItemController: LookupBibleItemController,
    targetElement: HTMLDivElement,
) {
    targetElement.click();
    lookupBibleItemController.shouldSelectFirstItem = true;
    lookupBibleItemController.tryJumpingChapter(true);
}

function handleNextVersionSelection(
    currentTarget: HTMLDivElement,
    nextKjvVerseKey: string,
) {
    const audioAISetting = getAISetting();
    if (!audioAISetting.isAutoPlay || !appProvider.isPageReader) {
        return;
    }
    const parentElement = currentTarget.parentElement;
    if (parentElement === null) {
        return;
    }
    const nextTarget = parentElement.querySelector(
        `[data-kjv-verse-key="${nextKjvVerseKey}"]`,
    );
    if (!(nextTarget instanceof HTMLDivElement)) {
        return;
    }
    if (
        nextTarget.parentElement?.parentElement &&
        checkIsVerticalPartialInvisible(
            nextTarget.parentElement.parentElement,
            nextTarget,
        )
    ) {
        const dblclickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
        });
        nextTarget.dispatchEvent(dblclickEvent);
    } else {
        nextTarget.click();
    }
}

function RenderVerseTextViewComp({
    bibleItem,
    verseInfo,
    isAudioEnabled,
    isExtraVerses,
    audioSrcMap,
    refreshAudio,
    handleAudioStarting,
    handleAudioEnding,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    isAudioEnabled: boolean;
    isExtraVerses: boolean;
    audioSrcMap: { [key: string]: string | undefined | null };
    refreshAudio: () => void;
    handleAudioStarting: () => void;
    handleAudioEnding: () => void;
}>) {
    const { bibleKey, text, customText, bibleVersesKey, isRtl } = verseInfo;
    const textElement =
        customText === null ? (
            text
        ) : (
            <RenderCustomVerseComp
                bibleItem={bibleItem}
                customHtml={customText}
            />
        );
    return (
        <Fragment key={bibleKey}>
            {isAudioEnabled &&
            Object.keys(audioSrcMap).includes(bibleVersesKey) ? (
                <AudioPlayerComp
                    src={audioSrcMap[bibleVersesKey]}
                    onStart={handleAudioStarting}
                    onEnd={handleAudioEnding}
                    refreshAudio={refreshAudio}
                />
            ) : null}
            {isExtraVerses ? (
                <div className="text d-flex" data-bible-key={bibleKey}>
                    <div className={'flex-fill' + (isRtl ? ' rtl' : '')}>
                        {textElement}
                    </div>
                </div>
            ) : (
                <span data-bible-key={bibleKey}>{textElement}</span>
            )}
        </Fragment>
    );
}

function RenderVerseTextDetailListComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    extraVerseInfoList = [],
    verseTextRef,
    audioSrcMap,
    refreshAudio,
    isExtraVerses,
}: Readonly<{
    bibleItem: BibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    verseTextRef: RefObject<HTMLDivElement | null>;
    audioSrcMap: { [key: string]: string | undefined | null };
    refreshAudio: () => void;
    isExtraVerses: boolean;
}>) {
    const { isAudioEnabled } = useIsAudioAIEnabled(bibleItem);
    const bibleItemViewController = useBibleItemsViewControllerContext();
    const verseInfoList = [verseInfo, ...extraVerseInfoList];
    const handleAudioStarting = () => {
        if (nextVerseInfo === null) {
            return;
        }
        bibleTextToSpeech(nextVerseInfo);
    };
    const handleAudioEnding = () => {
        if (verseTextRef.current === null) {
            return;
        }
        if (
            verseInfo.isLast &&
            bibleItemViewController instanceof LookupBibleItemController
        ) {
            handleNextChapterSelection(
                bibleItemViewController,
                verseTextRef.current,
            );
        }
        if (nextVerseInfo === null) {
            return;
        }
        handleNextVersionSelection(
            verseTextRef.current,
            nextVerseInfo.kjvBibleVersesKey,
        );
    };
    return verseInfoList.map((verseInfo) => {
        return (
            <RenderVerseTextViewComp
                key={verseInfo.bibleKey}
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                isAudioEnabled={isAudioEnabled}
                isExtraVerses={isExtraVerses}
                audioSrcMap={audioSrcMap}
                refreshAudio={refreshAudio}
                handleAudioStarting={handleAudioStarting}
                handleAudioEnding={handleAudioEnding}
            />
        );
    });
}

function RenderVerseTextDetailComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    extraVerseInfoList = [],
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    index: number;
}>) {
    const bibleItemViewController = useBibleItemsViewControllerContext();
    const verseTextRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (
            verseInfo.isFirst &&
            verseTextRef.current !== null &&
            bibleItemViewController.shouldSelectFirstItem
        ) {
            bibleItemViewController.shouldSelectFirstItem = false;
            verseTextRef.current.click();
        }
    }, [verseTextRef.current, verseInfo]);
    const [audioSrcMap, setAudioSrcMap] = useState<{
        [key: string]: string | undefined | null;
    }>({});
    const setAudioSrcMap1 = (key: string, value: string | undefined | null) => {
        setAudioSrcMap((oldAudioSrcMap) => {
            return {
                ...oldAudioSrcMap,
                [key]: value,
            };
        });
    };
    const viewController = useBibleItemsViewControllerContext();
    const isExtraVerses = extraVerseInfoList.length > 0;
    const loadAudio = async (isForce?: boolean) => {
        const isAudioEnabled = await checkIsAIAudioAvailableForBible(bibleItem);
        if (!isAudioEnabled) {
            return;
        }
        const { bibleVersesKey } = verseInfo;
        setAudioSrcMap1(bibleVersesKey, undefined);
        const speechFile = await bibleTextToSpeech(verseInfo, isForce);
        if (speechFile === null) {
            setAudioSrcMap1(bibleVersesKey, null);
            return;
        }
        setAudioSrcMap1(bibleVersesKey, FileSource.getInstance(speechFile).src);
    };
    const handleVerseClicking = (event: any) => {
        if (getSelectedText()) {
            return;
        }
        viewController.handleVersesSelecting(
            event.currentTarget,
            event.altKey,
            false,
            bibleItem,
        );
        loadAudio();
    };
    const handleVerseDBClicking = (event: any) => {
        event.stopPropagation();
        event.preventDefault();
        const selection = globalThis.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        viewController.handleVersesSelecting(
            event.currentTarget,
            true,
            false,
            bibleItem,
        );
        loadAudio();
    };
    const handleAudioRefreshing = () => {
        loadAudio(true);
    };
    return (
        <div
            ref={verseTextRef}
            className={
                VERSE_TEXT_CLASS + (isExtraVerses ? ' extra-verses' : '')
            }
            data-kjv-verse-key={verseInfo.kjvBibleVersesKey}
            data-verse-key={verseInfo.bibleVersesKey}
            data-is-first={verseInfo.isFirst ? '1' : '0'}
            data-is-last={verseInfo.isLast ? '1' : '0'}
            title={BIBLE_VERSE_TEXT_TITLE}
            onClick={handleVerseClicking}
            onDoubleClick={handleVerseDBClicking}
        >
            <RenderVerseTextDetailListComp
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                verseTextRef={verseTextRef}
                audioSrcMap={audioSrcMap}
                refreshAudio={handleAudioRefreshing}
                isExtraVerses={isExtraVerses}
            />
        </div>
    );
}

function RenderVerseTextComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    index,
    extraVerseInfoList = [],
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    index: number;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const isExtraVerses = extraVerseInfoList.length > 0;
    const verseInfoList = [verseInfo, ...extraVerseInfoList];
    const isNewLine =
        !isExtraVerses &&
        viewController.shouldNewLine &&
        (verseInfo.isNewLine ||
            (viewController.shouldKJVNewLine && verseInfo.isKJVNewLine));
    return (
        <>
            {!isNewLine || verseInfo.newLineTitlesHtmlText === null ? null : (
                <>
                    {index > 0 ? <br /> : null}
                    <div className="mt-2">
                        <RenderCustomVerseComp
                            bibleItem={bibleItem}
                            customHtml={verseInfo.newLineTitlesHtmlText}
                        />
                    </div>
                </>
            )}
            {isNewLine && verseInfo.newLineTitlesHtmlText === null ? (
                <br />
            ) : null}
            <div
                className={
                    'verse-number app-caught-hover-pointer' +
                    (isExtraVerses ? ' extra-verses' : '')
                }
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
                <div>
                    {verseInfo.isNewLine ? (
                        <span className="verse-number-text">&nbsp;&nbsp;</span>
                    ) : null}
                    {verseInfoList.map((extraVerseInfo, i) => (
                        <Fragment key={extraVerseInfo.bibleKey}>
                            {i > 0 ? ', ' : null}
                            <span data-bible-key={extraVerseInfo.bibleKey}>
                                {extraVerseInfo.localeVerse}
                            </span>
                        </Fragment>
                    ))}
                </div>
            </div>
            <RenderVerseTextDetailComp
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                index={index}
            />
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
        <div className="app-not-selectable-text">
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
        </div>
    );
}

export function BibleViewTextComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const { bibleKey, extraBibleKeys, target } = bibleItem;
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useBibleItemsViewControllerContext();
    const [verseList] = useAppStateAsync(() => {
        return bibleRenderHelper.toVerseTextList(bibleKey, target);
    }, [bibleKey, target]);
    const [extraVerseInfoListList] = useAppStateAsync(async () => {
        const results = await Promise.all(
            extraBibleKeys.map((key) => {
                return bibleRenderHelper.toVerseTextList(key, target);
            }),
        );
        return results.filter((list) => {
            return list !== null;
        });
    }, [extraBibleKeys, target]);
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    const [isRtl] = useAppStateAsync(() => {
        return getBibleInfoIsRtl(bibleKey);
    }, [bibleKey]);
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
    const isExtraVerses = extraBibleKeys.length > 0;
    return (
        <div
            className={`${BIBLE_VIEW_TEXT_CLASS} app-selectable-text p-1`}
            data-bible-item-id={bibleItem.id}
            dir={isRtl && !isExtraVerses ? 'rtl' : undefined}
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
            <div>
                {verseList.map((verseInfo, i) => {
                    const extraVerseInfoList = extraVerseInfoListList
                        ? extraVerseInfoListList
                              .map((verseInfoList) => {
                                  return verseInfoList[i];
                              })
                              .filter((v) => !!v)
                        : [];
                    return (
                        <RenderVerseTextComp
                            key={verseInfo.localeVerse}
                            bibleItem={bibleItem}
                            verseInfo={verseInfo}
                            extraVerseInfoList={extraVerseInfoList}
                            nextVerseInfo={verseList[i + 1] ?? null}
                            index={i}
                        />
                    );
                })}
            </div>
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
