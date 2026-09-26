import { type ChangeEvent, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import {
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ScreenForegroundManager, {
    MESSAGE_ALL_ID,
} from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import { getSelectedScreenManagerBases } from '../_screen/managers/screenManagerBaseHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import PropRowComp from './ForegroundPropRowComp';
import type { ForegroundMessageDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { useForegroundSessions } from './foregroundSessionHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    DEFAULT_MESSAGE_LINE_HEIGHT,
    type ForegroundDecorationType,
    getDecorationBorderWidth,
    getForegroundDecoration,
} from './foregroundDecorationHelpers';

/**
 * Words on the screen that stay there until somebody takes them down.
 *
 * ONE session holds SEVERAL message editors, and each editor is its own
 * message with its own controls -- show it, hide it, move it, remove it. Two
 * messages can be on a screen at once, keyed by the editor that put them
 * there, exactly the way the clock widget keys its clocks.
 *
 * It shipped first as two widgets, Alert and Announcements, and they were
 * merged on sight: side by side they were the same panel rendering the same
 * plain text in the same place, and one notice in Announcements simply WAS an
 * alert. What survives of that split is one button -- "show all in turn" --
 * which puts the whole session up as a single rotating item for the notice
 * board before a service.
 *
 * SEVERAL SESSIONS hold several such sets, each with its own editors and its
 * own Properties -- the pre-service notice board in one, the mid-service
 * alerts in another, already the right size in the right corner. A session's
 * suffix rides every editor id, so two sessions can have messages up at once
 * and each panel still knows which are its own.
 */

// The message key. It sits one below `F5` (show/hide the screen) and above the
// `F6`-`F10` clear block, so the whole "put something on the wall / get it off
// again" row is in one place under the operator's hand.
const MESSAGE_EVENT_MAP = { key: 'F4' };
// The settings prefix this widget's Properties are filed under, per session.
// Named because the stacking below has to read the same dressing the style
// was built from.
function toMessagePrefix(suffix: string) {
    return `message${suffix}`;
}

/** The keys ONE session owns beyond its Properties. */
function genOwnSettingNames(suffix: string) {
    return [
        `foreground-message-setting${suffix}`,
        `foreground-message-is-rotating${suffix}`,
        `foreground-message-interval${suffix}`,
    ];
}

/**
 * An editor's id carries its SESSION: `message-2` is the Default session's
 * third editor, `message-2-s5k1` is Session 2's. The reserved "all" id takes
 * the same suffix.
 *
 * Reading the session back OUT of the id rather than off a setting is what
 * lets the strip mark a session that has something up without reading every
 * session's text on every screen event. An id that matches nothing here --
 * the bare `message-all` a stored run-sheet row replays under, a hand-edited
 * file -- is the Default session's, which is where the controls for it are.
 */
const MESSAGE_ID_REGEX = /^message-(?:\d+|all)(?:-(.+))?$/;
function toMessageSessionId(id: string) {
    return MESSAGE_ID_REGEX.exec(id)?.[1] ?? '';
}
function toMessageAllId(suffix: string) {
    return `${MESSAGE_ALL_ID}${suffix}`;
}
const DEFAULT_INTERVAL_SECOND = 8;
// A session is stored as its messages separated by a BLANK LINE, so one
// message can itself be several lines and a saved session is still readable
// text -- which is what `SavedTextSessionButtonsComp` previews and what a
// person sees if they ever look at the setting.
const MESSAGE_SEPARATOR = '\n\n';
// One blank line (with any spaces on it) is what separates two messages.
const BLANK_LINE_REGEX = /\n\s*\n/;
const TRAILING_WS_REGEX = /\s+$/;

type MessageEditorType = {
    id: string;
    text: string;
};

function toStoredText(messageList: MessageEditorType[]) {
    const storedText = messageList
        .map((message) => {
            return message.text;
        })
        .join(MESSAGE_SEPARATOR);
    // A session of one EMPTY editor would serialize to the empty string, which
    // reads back as no editors at all -- so pressing Add Message on an empty
    // session would add a row that vanished on the next render. One space is
    // the smallest thing that survives the round trip.
    return storedText.trim() === '' && messageList.length > 0
        ? ' '
        : storedText;
}

/**
 * Empty editors are KEPT, unlike a plain "drop the blanks" split: an editor
 * that has just been added has no text yet, and it has to stay on screen long
 * enough to be typed into. Only a completely empty session has no editors.
 */
function toMessageList(
    storedText: string,
    suffix: string,
): MessageEditorType[] {
    if (storedText === '') {
        return [];
    }
    return storedText.split(BLANK_LINE_REGEX).map((text, index) => {
        // The id is the SLOT, not a fresh uuid. It is the handle for "this
        // editor's message on that screen", and it has to survive the panel
        // being re-parsed -- a reload with random ids left two messages on a
        // screen that the panel no longer recognised as its own, so every row
        // offered to Show something that was already up and nothing could take
        // it down but the chips.
        return {
            id: `message-${index}${suffix}`,
            text: text.replace(TRAILING_WS_REGEX, ''),
        };
    });
}

/** The lines ONE editor puts on the screen. Trailing blanks are dropped. */
function toLineList(text: string) {
    return text.split('\n').filter((line, index, lines) => {
        return line.trim() !== '' || index < lines.length - 1;
    });
}

/**
 * Lay the shown messages out one under another.
 *
 * Several messages can be up at once, and they all come from the SAME
 * Properties -- one position, one size -- so without this they render in
 * exactly the same box and the newest simply hides the rest. Measured live:
 * two messages shown together read as one message with a ghost behind it.
 *
 * It counts the LINES above rather than the messages above -- a three-line
 * message must push the next one three lines down, not one -- and it has to
 * count the BOX above as well, because a message with padding and a frame is
 * taller than its own text. Lines and padding are in `em`, so they follow the
 * font size the way the text does; a border is in pixels, because that is what
 * a border is. `marginTop` rather than a `transform`, so it cannot clobber
 * anything the position pad has already put in the style.
 */
function withStackOffset(
    extraStyle: CSSProperties,
    {
        lineCountAbove,
        messageCountAbove,
        decoration,
    }: {
        lineCountAbove: number;
        messageCountAbove: number;
        decoration: ForegroundDecorationType;
    },
): CSSProperties {
    if (messageCountAbove === 0) {
        return extraStyle;
    }
    const lineHeight =
        decoration.lineHeight > 0
            ? decoration.lineHeight
            : DEFAULT_MESSAGE_LINE_HEIGHT;
    const emOffset =
        lineCountAbove * lineHeight +
        messageCountAbove * 2 * decoration.padding;
    const pixelOffset =
        messageCountAbove * 2 * getDecorationBorderWidth(decoration);
    return {
        ...extraStyle,
        marginTop:
            pixelOffset === 0
                ? `${emOffset}em`
                : `calc(${emOffset}em + ${pixelOffset}px)`,
    };
}

/**
 * The shown messages of ONE screen, in session order, stacked.
 *
 * Module level and pure so the two callers cannot drift: the Show/Hide press
 * builds it from the style it has just generated, and a Properties change
 * rebuilds it from the style it was handed. That second one used to re-send
 * each datum with the new `extraStyle` spread over it, which threw the
 * `marginTop` away -- so touching any control while two messages were up
 * dropped them back on top of each other.
 */
function genStackedMessageDataList(
    messageList: MessageEditorType[],
    shownIdList: string[],
    extraStyle: CSSProperties,
    prefix: string,
) {
    const shownIdSet = new Set(shownIdList);
    const decoration = getForegroundDecoration(prefix, true);
    const dataList: ForegroundMessageDataType[] = [];
    let lineCountAbove = 0;
    let messageCountAbove = 0;
    for (const message of messageList) {
        if (!shownIdSet.has(message.id)) {
            continue;
        }
        const textList = toLineList(message.text);
        if (textList.length === 0) {
            continue;
        }
        dataList.push({
            id: message.id,
            textList,
            intervalSecond: null,
            extraStyle: withStackOffset(extraStyle, {
                lineCountAbove,
                messageCountAbove,
                decoration,
            }),
        });
        lineCountAbove += textList.length;
        messageCountAbove += 1;
    }
    return dataList;
}

function checkIsShowingId(
    showingScreenIdDataList: [number, ForegroundMessageDataType][],
    id: string,
) {
    return showingScreenIdDataList.some(([, data]) => {
        return data.id === id;
    });
}

/**
 * The panel, ON ONE SESSION. Every field reads its setting when it mounts, so
 * the wrapper underneath keys this by the session.
 */
function MessageBodyComp({
    suffix,
    prefix,
}: Readonly<{ suffix: string; prefix: string }>) {
    // This session's editors, as one setting. Kept as text rather than JSON
    // so a saved session stays something a person can read.
    const [storedText, setStoredText] = useStateSettingString<string>(
        `foreground-message-setting${suffix}`,
        '',
    );
    const [isRotating, setIsRotating] = useStateSettingBoolean(
        `foreground-message-is-rotating${suffix}`,
        false,
    );
    const [intervalSecond, setIntervalSecond] = useStateSettingNumber(
        `foreground-message-interval${suffix}`,
        DEFAULT_INTERVAL_SECOND,
    );
    const messageAllId = toMessageAllId(suffix);
    // Ids are minted per PARSE, so they are stable only while the panel is
    // mounted. That is on purpose: an id is the handle for "this editor's
    // message on that screen", and a session reloaded from disk has nothing on
    // a screen yet.
    const messageList = useMemo(() => {
        return toMessageList(storedText, suffix);
    }, [storedText, suffix]);
    // PER-INSTANCE, not module-level: a module-level timer collapses every
    // mount into one, and nothing here may assume this panel stays a single
    // mount for good -- that assumption is what left only one stage refreshing
    // in `useVarySlidesData`.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);

    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return (data.messageDataList ?? []).length > 0;
        },
    ).flatMap(([screenId, data]): [number, ForegroundMessageDataType][] => {
        return (data.messageDataList ?? []).map((item) => {
            return [screenId, item];
        });
    });
    const showingScreenIdDataListRef = useAppCurrentRef(
        showingScreenIdDataList,
    );

    const {
        genStyle,
        fontFamily,
        fontWeight,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix,
        onChange: (extraStyle: CSSProperties) => {
            attemptTimeout(() => {
                const screenIdSet = new Set(
                    showingScreenIdDataListRef.current.map(([screenId]) => {
                        return screenId;
                    }),
                );
                const ownIdSet = new Set(
                    messageListRef.current.map((message) => {
                        return message.id;
                    }),
                );
                for (const screenId of screenIdSet) {
                    const shownDataList = showingScreenIdDataListRef.current
                        .filter(([itemScreenId]) => {
                            return itemScreenId === screenId;
                        })
                        .map(([, data]) => {
                            return data;
                        });
                    // "Show all in turn" is ONE rotating item holding every
                    // message rather than one of the stacked ones, so it keeps
                    // its own text and interval and takes only the new style.
                    const allData = shownDataList.find((data) => {
                        return data.id === messageAllIdRef.current;
                    });
                    // Another session's messages are left exactly as they
                    // are: they were dressed by ITS Properties, and this
                    // panel rewrites the whole list on every change.
                    const keptDataList = shownDataList.filter((data) => {
                        return (
                            data.id !== messageAllIdRef.current &&
                            !ownIdSet.has(data.id)
                        );
                    });
                    const shownIdList = shownDataList
                        .filter((data) => {
                            return ownIdSet.has(data.id);
                        })
                        .map((data) => {
                            return data.id;
                        });
                    const dataList = [
                        ...keptDataList,
                        ...genStackedMessageDataList(
                            messageListRef.current,
                            shownIdList,
                            extraStyle,
                            prefixRef.current,
                        ),
                    ];
                    if (allData !== undefined) {
                        dataList.push({ ...allData, extraStyle });
                    }
                    getScreenForegroundManagerInstances(
                        screenId,
                        (screenForegroundManager) => {
                            screenForegroundManager.setMessageDataList(
                                dataList,
                            );
                        },
                    );
                }
            });
        },
        isFontSize: true,
    });
    const genStyleRef = useAppCurrentRef(genStyle);
    const prefixRef = useAppCurrentRef(prefix);
    const messageAllIdRef = useAppCurrentRef(messageAllId);
    const messageListRef = useAppCurrentRef(messageList);
    const setStoredTextRef = useAppCurrentRef(setStoredText);
    const isRotatingRef = useAppCurrentRef(isRotating);
    const intervalSecondRef = useAppCurrentRef(intervalSecond);

    const handleTextChange = useCallback(
        (id: string, text: string) => {
            const newMessageList = messageListRef.current.map((message) => {
                return message.id === id ? { ...message, text } : message;
            });
            setStoredTextRef.current(toStoredText(newMessageList));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleAdding = useCallback(() => {
        setStoredTextRef.current(
            toStoredText([...messageListRef.current, { id: '', text: '' }]),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemoving = useCallback((id: string) => {
        // Off every screen FIRST: a removed editor can no longer be pressed to
        // take its own message down, and a message with no way back off the
        // wall is the one thing this panel must never leave behind.
        for (const [screenId, data] of showingScreenIdDataListRef.current) {
            if (data.id !== id) {
                continue;
            }
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.removeMessageData(id);
                },
            );
        }
        const newMessageList = messageListRef.current.filter((message) => {
            return message.id !== id;
        });
        setStoredTextRef.current(toStoredText(newMessageList));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMoving = useCallback((id: string, offset: number) => {
        const currentList = messageListRef.current;
        const index = currentList.findIndex((message) => {
            return message.id === id;
        });
        const newIndex = index + offset;
        if (index === -1 || newIndex < 0 || newIndex >= currentList.length) {
            return;
        }
        const newMessageList = [...currentList];
        const [moved] = newMessageList.splice(index, 1);
        newMessageList.splice(newIndex, 0, moved);
        setStoredTextRef.current(toStoredText(newMessageList));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Rewrite every message this widget has on ONE screen so the shown ones
     * sit in session order with no overlap and no gap. Show and hide both go
     * through here: a message coming off has to close the space it left.
     */
    const applyToManager = useCallback(
        (screenForegroundManager: any, shownIdList: string[]) => {
            const ownIdSet = new Set(
                messageListRef.current.map((message) => {
                    return message.id;
                }),
            );
            // Everything on this screen that is NOT one of this session's
            // editors stays: another session's messages, and this session's
            // own rotating "all" item, which is not one of the stacked ones.
            const keptDataList = (
                screenForegroundManager.foregroundData
                    .messageDataList as ForegroundMessageDataType[]
            ).filter((item) => {
                return !ownIdSet.has(item.id);
            });
            screenForegroundManager.setMessageDataList([
                ...keptDataList,
                ...genStackedMessageDataList(
                    messageListRef.current,
                    shownIdList.filter((id) => {
                        return ownIdSet.has(id);
                    }),
                    genStyleRef.current(),
                    prefixRef.current,
                ),
            ]);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const genAllMessageData =
        useCallback((): ForegroundMessageDataType | null => {
            const textList = messageListRef.current
                .map((message) => {
                    return message.text.trim();
                })
                .filter((text) => {
                    return text !== '';
                });
            if (textList.length === 0) {
                return null;
            }
            return {
                id: messageAllIdRef.current,
                textList,
                intervalSecond: isRotatingRef.current
                    ? intervalSecondRef.current
                    : null,
                extraStyle: genStyleRef.current(),
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

    const handleHidingId = useCallback((id: string) => {
        const screenIdSet = new Set(
            showingScreenIdDataListRef.current
                .filter(([, data]) => {
                    return data.id === id;
                })
                .map(([screenId]) => {
                    return screenId;
                }),
        );
        for (const screenId of screenIdSet) {
            const shownIdList = showingScreenIdDataListRef.current
                .filter(([itemScreenId, data]) => {
                    return itemScreenId === screenId && data.id !== id;
                })
                .map(([, data]) => {
                    return data.id;
                });
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    applyToManager(screenForegroundManager, shownIdList);
                },
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTogglingId = useCallback((event: any, id: string) => {
        if (checkIsShowingId(showingScreenIdDataListRef.current, id)) {
            handleHidingId(id);
            return;
        }
        ScreenForegroundManager.setData(
            event,
            (screenForegroundManager: any) => {
                // Read this SCREEN's own shown set: two screens can be holding
                // different messages, and each has to keep its own stack.
                const shownIdList =
                    screenForegroundManager.foregroundData.messageDataList.map(
                        (item: ForegroundMessageDataType) => {
                            return item.id;
                        },
                    );
                applyToManager(screenForegroundManager, [...shownIdList, id]);
            },
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // F4 takes EVERYTHING down when anything is up -- the panic half of the
    // key -- and otherwise puts the whole session up. It deliberately does not
    // go through `addMessageData`'s static, whose `chooseScreenIds` opens a
    // context menu at the event's position when no screen is ticked, and a
    // keyboard event has no position.
    const handleTogglingAll = useCallback(() => {
        if (showingScreenIdDataListRef.current.length > 0) {
            for (const [screenId, data] of showingScreenIdDataListRef.current) {
                getScreenForegroundManagerInstances(
                    screenId,
                    (screenForegroundManager) => {
                        screenForegroundManager.removeMessageData(data.id);
                    },
                );
            }
            return;
        }
        const data = genAllMessageData();
        if (data === null) {
            return;
        }
        const screenManagerBases = getSelectedScreenManagerBases();
        if (screenManagerBases.length === 0) {
            showSimpleToast(
                tran('Tick a screen first, then press the key again'),
                tran('Messages'),
            );
            return;
        }
        for (const { screenId } of screenManagerBases) {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.addMessageData(data);
                },
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useKeyboardRegistering([MESSAGE_EVENT_MAP], handleTogglingAll, []);

    const handleShowingAll = useCallback((event: any) => {
        const data = genAllMessageData();
        if (data === null) {
            return;
        }
        ScreenForegroundManager.addMessageData(event, data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleByDropped = useCallback((event: any) => {
        const screenForegroundManager =
            getScreenForegroundManagerByDropped(event);
        if (screenForegroundManager === null) {
            return;
        }
        const data = genAllMessageData();
        if (data !== null) {
            screenForegroundManager.addMessageData(data);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const handleMessageDragStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf('message', () => {
                const data = genAllMessageData();
                return {
                    textList: data?.textList ?? [],
                    intervalSecond: data?.intervalSecond ?? null,
                    extraStyle: genStyleRef.current(),
                };
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleIsRotatingChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsRotatingRef.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setIsRotatingRef = useAppCurrentRef(setIsRotating);
    const setIntervalSecondRef = useAppCurrentRef(setIntervalSecond);
    const handleIntervalChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIntervalSecondRef.current(
                Number.parseInt(event.target.value, 10),
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const isShowingAll = checkIsShowingId(
        showingScreenIdDataList,
        messageAllId,
    );
    return (
        <>
            {propsSetting}
            <div className="fg-body">
                <div className="d-flex align-items-center gap-2">
                    <button
                        className="btn btn-sm btn-outline-primary"
                        title={tran('Add Message')}
                        onClick={handleAdding}
                    >
                        <i className="bi bi-plus-lg" /> {tran('Add Message')}
                    </button>
                    <div className="ms-auto d-flex gap-2">
                        <SavedTextSessionButtonsComp
                            // Deliberately NOT keyed by the session: this is
                            // a library of texts to pick FROM, and a text
                            // saved while on one session is exactly what the
                            // next one is being built out of.
                            settingName="foreground-message-saved-sessions"
                            label="Messages"
                            text={storedText}
                            onPickText={setStoredText}
                        />
                    </div>
                </div>
                {messageList.length === 0 ? (
                    <div className="app-border-white-round p-2 my-1">
                        <small className="text-muted">
                            {tran('No message yet')}
                        </small>
                    </div>
                ) : null}
                {messageList.map((message, index) => {
                    const isShowing = checkIsShowingId(
                        showingScreenIdDataList,
                        message.id,
                    );
                    // Every control carries its message NUMBER. Without it a
                    // session of three messages has three controls called
                    // "Show Message" -- one name a screen reader reads three
                    // times, and one name `owa_click` cannot aim with.
                    const showHideLabel = `${
                        isShowing ? tran('Hide Message') : tran('Show Message')
                    } ${index + 1}`;
                    const removeLabel = `${tran('Remove Message')} ${index + 1}`;
                    return (
                        <div
                            key={message.id}
                            className="app-border-white-round p-1 my-1"
                        >
                            <div className="d-flex align-items-center gap-1">
                                <small className="text-muted px-1">
                                    {index + 1}
                                </small>
                                <button
                                    className={
                                        'btn btn-sm btn-' +
                                        (isShowing
                                            ? 'primary'
                                            : 'outline-primary')
                                    }
                                    title={showHideLabel}
                                    aria-label={showHideLabel}
                                    aria-pressed={isShowing}
                                    disabled={message.text.trim() === ''}
                                    onClick={(event) => {
                                        handleTogglingId(event, message.id);
                                    }}
                                >
                                    <i
                                        className={
                                            'bi bi-' +
                                            (isShowing
                                                ? 'eye-slash'
                                                : 'display')
                                        }
                                    />
                                </button>
                                <div className="ms-auto d-flex gap-1">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        title={`${tran('Move up')} ${index + 1}`}
                                        aria-label={`${tran('Move up')} ${index + 1}`}
                                        disabled={index === 0}
                                        onClick={() => {
                                            handleMoving(message.id, -1);
                                        }}
                                    >
                                        <i className="bi bi-chevron-up" />
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        title={`${tran('Move down')} ${index + 1}`}
                                        aria-label={`${tran('Move down')} ${index + 1}`}
                                        disabled={
                                            index === messageList.length - 1
                                        }
                                        onClick={() => {
                                            handleMoving(message.id, 1);
                                        }}
                                    >
                                        <i className="bi bi-chevron-down" />
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        title={removeLabel}
                                        aria-label={removeLabel}
                                        onClick={() => {
                                            handleRemoving(message.id);
                                        }}
                                    >
                                        <i className="bi bi-x-lg" />
                                    </button>
                                </div>
                            </div>
                            <textarea
                                className="fg-text-editor w-100"
                                aria-label={`${tran('Message')} ${index + 1}`}
                                value={message.text}
                                onChange={(event) => {
                                    handleTextChange(
                                        message.id,
                                        event.target.value,
                                    );
                                }}
                                placeholder={tran('Type a message')}
                                style={{
                                    fontFamily: fontFamily || undefined,
                                    fontWeight: fontWeight || undefined,
                                    height: '60px',
                                }}
                            />
                        </div>
                    );
                })}
                {/*
                 * Rotation belongs to the SESSION, not to one editor: it is
                 * the pre-service notice board, which is every message in
                 * turn. The seconds box only appears once it is on, so the
                 * common case -- one message up in a hurry -- never has a
                 * number in front of it.
                 */}
                <div className="fg-props-tail fg-props-tail-plain">
                    <PropRowComp
                        iconClassName="bi bi-arrow-repeat"
                        label={tran('Rotate')}
                        title={tran('Show each message in turn')}
                        isEngaged={isRotating}
                    >
                        <input
                            type="checkbox"
                            className="form-check-input"
                            aria-label={tran('Show each message in turn')}
                            checked={isRotating}
                            onChange={handleIsRotatingChange}
                        />
                        {isRotating ? (
                            <>
                                <input
                                    className="fg-num ms-2"
                                    type="number"
                                    min="1"
                                    aria-label={tran(
                                        'Seconds each message stays before the next',
                                    )}
                                    title={tran(
                                        'Seconds each message stays before the next',
                                    )}
                                    value={intervalSecond}
                                    onChange={handleIntervalChange}
                                />
                                <span className="fg-unit-static">s</span>
                            </>
                        ) : null}
                    </PropRowComp>
                </div>
                <div className="fg-actions">
                    <button
                        className="btn btn-primary"
                        title={tran('Show All Messages')}
                        disabled={messageList.length === 0}
                        aria-pressed={isShowingAll}
                        onClick={handleShowingAll}
                        draggable
                        onDragStart={handleMessageDragStart}
                    >
                        <i className="bi bi-chat-left-text" />{' '}
                        {tran('Show All Messages')}
                    </button>
                    <ContextMenuDotsButtonComp
                        label={tran('Show on Screens')}
                        onOpening={handleShowingAll}
                    />
                    <ScreensRendererComp
                        showingScreenIdDataList={showingScreenIdDataList}
                        genTitle={(data: ForegroundMessageDataType) => {
                            return data.textList[0] ?? '';
                        }}
                        buttonText={tran('Hide Messages')}
                        handleForegroundHiding={(
                            screenId: number,
                            data: ForegroundMessageDataType,
                        ) => {
                            getScreenForegroundManagerInstances(
                                screenId,
                                (screenForegroundManager) => {
                                    screenForegroundManager.removeMessageData(
                                        data.id,
                                    );
                                },
                            );
                        }}
                    />
                </div>
            </div>
        </>
    );
}

export default function ForegroundMessageComp() {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return (data.messageDataList ?? []).length > 0;
        },
    ).flatMap(([screenId, data]): [number, ForegroundMessageDataType][] => {
        return (data.messageDataList ?? []).map((item) => {
            return [screenId, item];
        });
    });
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    const {
        activeId,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'message',
        toPrefix: toMessagePrefix,
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId) => {
            return showingScreenIdDataList.some(([, data]) => {
                return toMessageSessionId(data.id) === sessionId;
            });
        },
        hideSession: (sessionId) => {
            for (const [screenId, data] of showingRef.current) {
                if (toMessageSessionId(data.id) !== sessionId) {
                    continue;
                }
                getScreenForegroundManagerInstances(
                    screenId,
                    (screenForegroundManager) => {
                        screenForegroundManager.removeMessageData(data.id);
                    },
                );
            }
        },
    });
    return (
        <ForegroundLayoutComp target="message">
            {sessionsElement}
            {/* Keyed by the session: every field below reads its setting
                once, when it mounts. */}
            <MessageBodyComp key={activeId} suffix={suffix} prefix={prefix} />
        </ForegroundLayoutComp>
    );
}
