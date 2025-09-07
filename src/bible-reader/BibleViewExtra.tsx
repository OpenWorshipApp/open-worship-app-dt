import {
    createContext,
    Fragment,
    ReactNode,
    use,
    useMemo,
    useState,
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
import {
    ReadIdOnlyBibleItem,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import {
    BIBLE_VERSE_TEXT_TITLE,
    checkIsVerticalPartialInvisible,
} from '../helper/helpers';
import {
    bibleRenderHelper,
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
import { bibleTextToSpeech, getAudioAISetting } from '../helper/aiHelpers';
import FileSource from '../helper/FileSource';

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
            <ItemColorNoteComp item={colorNoteHandler} />
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
                            className="bg-primary small app-caught-hover-pointer"
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
            className="card-header d-flex app-top-hover-motion-1"
            style={{ ...fontSizeToHeightStyle(fontSize) }}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={(
                    isContextMenu: boolean,
                    _oldBibleKey: string,
                    newBibleKey: string,
                ) => {
                    console.log(isContextMenu, newBibleKey);

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

function AudioPlayerComp({
    src,
    onEnd,
}: Readonly<{
    src: string | undefined | null;
    onEnd: (audio: HTMLAudioElement) => void;
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
    return (
        <audio
            className="verse-audio"
            ref={(el) => {
                if (el !== null && el.checkVisibility()) {
                    el.play();
                }
            }}
            controls
            onPlay={(event) => {
                const el = event.currentTarget;
                document.querySelectorAll('audio').forEach((el1) => {
                    if (el1 !== el) {
                        el1.pause();
                    }
                });
            }}
            onEnded={(event) => {
                const el = event.currentTarget;
                if (el && el.checkVisibility()) {
                    onEnd(el);
                }
            }}
        >
            <source src={src} />
            <track kind="captions" />
            Browser does not support audio.
        </audio>
    );
}

function handleNext(audio: HTMLAudioElement) {
    const audioAISetting = getAudioAISetting();
    if (!audioAISetting.isAutoPlay) {
        return;
    }
    const nextTarget =
        audio.parentElement?.nextElementSibling?.nextElementSibling;
    if (
        !(nextTarget instanceof HTMLDivElement) ||
        !nextTarget.classList.contains(VERSE_TEXT_CLASS)
    ) {
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

function RenderVerseTextComp({
    bibleItem,
    verseInfo,
    index,
    extraVerseInfoList = [],
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    extraVerseInfoList?: CompiledVerseType[];
    index: number;
}>) {
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
    const verseInfoList = [verseInfo, ...extraVerseInfoList];
    const loadAudio = async () => {
        if (!isExtraVerses) {
            return;
        }
        const { text, bibleKey, key } = verseInfo;
        setAudioSrcMap1(key, undefined);
        bibleTextToSpeech({
            text,
            bibleKey,
            key,
        }).then((speechFile) => {
            if (speechFile === null) {
                setAudioSrcMap1(key, null);
                return;
            }
            setAudioSrcMap1(key, FileSource.getInstance(speechFile).src);
        });
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
        loadAudio();
    };
    return (
        <>
            {viewController.shouldNewLine &&
            verseInfo.isNewLine &&
            index > 0 ? (
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
                <div data-bible-key={verseInfo.bibleKey}>
                    {verseInfo.isNewLine ? (
                        <span className="verse-number-text">&nbsp;&nbsp;</span>
                    ) : null}
                    {verseInfoList.map((extraVerseInfo, i) => (
                        <Fragment key={extraVerseInfo.bibleKey}>
                            {i > 0 ? ', ' : null}
                            {extraVerseInfo.localeVerse}
                        </Fragment>
                    ))}
                </div>
            </div>
            <div
                className={
                    VERSE_TEXT_CLASS + (isExtraVerses ? ' extra-verses' : '')
                }
                data-kjv-verse-key={verseInfo.kjvBibleVersesKey}
                data-verse-key={verseInfo.bibleVersesKey}
                title={BIBLE_VERSE_TEXT_TITLE}
                onClick={handleVerseClicking}
                onDoubleClick={handleVerseDBClicking}
            >
                {verseInfoList.map(({ bibleKey, text, key }, i) => (
                    <Fragment key={bibleKey}>
                        {i > 0 ? <br /> : null}
                        {Object.keys(audioSrcMap).includes(key) ? (
                            <AudioPlayerComp
                                src={audioSrcMap[key]}
                                onEnd={handleNext}
                            />
                        ) : null}
                        <span data-bible-key={bibleKey}>{text}</span>
                    </Fragment>
                ))}
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
