import './ChatbotAppComp.scss';

import type { MouseEvent as ReactMouseEventType } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { openPopupWindow } from '../helper/domHelpers';
import { setSetting } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useThemeSource } from '../others/themeHelpers';
import appProvider from '../server/appProvider';
import {
    checkCanAddChatSession,
    checkCanClearChatSessions,
    checkCanSoloChatSession,
    genChatSessionTitle,
    genNewChatSession,
    loadChatSessions,
    saveChatSessions,
    toChatSessionTitle,
    toClearableChatSessions,
    type ChatMessageType,
    type ChatSessionStateType,
    type ChatSessionType,
} from './chatSessionHelpers';
import {
    askHelpBot,
    detectOpenerFocus,
    runBotAction,
    BOT_FOCUS_LIST,
    type BotActionType,
    type BotFocusType,
} from './helpBotHelpers';
import {
    askLlmBot,
    genLlmModelTitle,
    getAvailableLlmProviders,
    getLlmModel,
    getLlmModelList,
    getLlmProvider,
    listAllLlmModels,
    setLlmModel,
    setLlmProvider,
    LLM_PROVIDER_LIST,
    type LlmModelType,
    type LlmProviderType,
} from './llmBotHelpers';
import { getAiEndpoints } from './mcpClient';

// Straight to the panel that holds the keys. `openOthersSetting` in
// `src/setting/settingHelpers` does exactly this, but importing that module
// into this popup also registers its module-scope "go to setting home"
// listener here -- and then one menu press opens a second settings window out
// of the help window.
const SETTING_TABS_SETTING_NAME = 'setting-tabs';
const SETTING_OTHERS_TAB = 'o';

function openAiSetting() {
    setSetting(SETTING_TABS_SETTING_NAME, SETTING_OTHERS_TAB);
    openPopupWindow(
        appProvider.settingHomePage,
        `setting_${Date.now()}`,
        'setting',
        { appTopToMain: true },
    );
}

const STARTER_QUESTIONS: Record<BotFocusType, string[]> = {
    presenter: [
        'How do I present a bible verse?',
        'How do I add a background?',
        'Where is the clear button?',
        'Is any screen showing?',
    ],
    reader: [
        'How do I look up a verse?',
        'How do I compare bible versions?',
        'What are verse marks?',
        'Where is the search button?',
    ],
};

// Almost every answer is a short list of things to do, so the list is set
// properly: the marker sits in the margin and wrapped lines align under the
// words, not under the dash. A number is kept (it carries the order); a dash
// is replaced by a tick, because "-" is punctuation the model typed, not
// something the reader needs to see.
const BULLET_PATTERN = /^\s*[-*•]\s+/;
const NUMBERED_PATTERN = /^\s*(\d{1,2}[.)])\s+/;

// A deliberately small renderer: manual excerpts are markdown, and pulling a
// markdown library into a help window would cost more than these few rules.
function renderRichText(text: string) {
    return text.split('\n').map((line, lineIndex) => {
        const numbered = NUMBERED_PATTERN.exec(line);
        const isBullet = numbered === null && BULLET_PATTERN.test(line);
        const content =
            numbered !== null
                ? line.replace(NUMBERED_PATTERN, '')
                : isBullet
                  ? line.replace(BULLET_PATTERN, '')
                  : line;
        const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
        return (
            <p
                key={lineIndex}
                className={
                    'chatbot-line' +
                    (numbered !== null || isBullet ? ' chatbot-item' : '') +
                    (isBullet ? ' chatbot-item-dot' : '')
                }
            >
                {numbered === null ? null : (
                    <span className="chatbot-item-mark">{numbered[1]}</span>
                )}
                {parts.map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return (
                            <strong key={partIndex}>{part.slice(2, -2)}</strong>
                        );
                    }
                    if (part.startsWith('`') && part.endsWith('`')) {
                        return <code key={partIndex}>{part.slice(1, -1)}</code>;
                    }
                    if (part.startsWith('_') && part.endsWith('_')) {
                        return <em key={partIndex}>{part.slice(1, -1)}</em>;
                    }
                    return <span key={partIndex}>{part}</span>;
                })}
            </p>
        );
    });
}

// Both keys can be set at once, and the two do not answer alike -- nor fail
// alike: a rate limit, an expired card or a blocked domain hits one of them and
// not the other. The switch lives in this window rather than in Settings so it
// can be flipped between two questions, without leaving the answer on screen.
function RenderProviderSwitchComp({
    provider,
    availableProviders,
    onChange,
}: Readonly<{
    provider: LlmProviderType | null;
    availableProviders: LlmProviderType[];
    onChange: (provider: LlmProviderType) => void;
}>) {
    return (
        <div className="seg" role="group" aria-label="Which model answers">
            {LLM_PROVIDER_LIST.map((item) => {
                // Shown even without a key, disabled: the pair is what tells
                // the user the other one exists and where to switch it on.
                const isAvailable = availableProviders.includes(item.key);
                return (
                    <button
                        key={item.key}
                        type="button"
                        disabled={!isAvailable}
                        title={
                            isAvailable
                                ? undefined
                                : `Add the ${item.label} API key in ` +
                                  'Settings → Others to use it'
                        }
                        className={
                            'seg-item' + (provider === item.key ? ' is-on' : '')
                        }
                        onClick={() => {
                            onChange(item.key);
                        }}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

// WHICH model, once the provider is settled. A dropdown rather than a second
// row of buttons: this is three choices on a fresh install and as long as the
// account's own catalogue once it has been asked for, and the head row has
// room for one line of text either way. Every name carries what it is good
// for, how long it makes the user wait and what it costs, because that is what
// the choice is actually between; the exact model id and the price units are
// on the hover.
const MORE_MODELS_VALUE = '::more::';

function RenderModelPickerComp({
    model,
    modelList,
    isLoadingModels,
    onChange,
    onLoadingMore,
}: Readonly<{
    model: string;
    modelList: LlmModelType[];
    isLoadingModels: boolean;
    onChange: (model: string) => void;
    onLoadingMore: () => void;
}>) {
    // A model picked out of the account's own list is not in the built-in one,
    // and a select whose value matches no option shows blank.
    const shownModelList = useMemo(() => {
        const isListed = modelList.some((item) => {
            return item.id === model;
        });
        return isListed
            ? modelList
            : [
                  { id: model, label: model, note: '', speed: '', price: '' },
                  ...modelList,
              ];
    }, [model, modelList]);
    const chosenModel = useMemo(() => {
        return (
            shownModelList.find((item) => {
                return item.id === model;
            }) ?? null
        );
    }, [model, shownModelList]);
    return (
        <select
            className="chat-engine"
            aria-label="Which model answers"
            title={chosenModel === null ? model : genLlmModelTitle(chosenModel)}
            value={model}
            disabled={isLoadingModels}
            onChange={(event) => {
                const wanted = event.target.value;
                if (wanted === MORE_MODELS_VALUE) {
                    onLoadingMore();
                    return;
                }
                onChange(wanted);
            }}
        >
            {shownModelList.map((item) => {
                return (
                    <option
                        key={item.id}
                        value={item.id}
                        title={genLlmModelTitle(item)}
                    >
                        {item.label}
                    </option>
                );
            })}
            {/* Asking the account what else it can run costs a request, so it
                is a thing the user does, not something the window does on
                opening. */}
            <option value={MORE_MODELS_VALUE}>
                {isLoadingModels ? 'Loading…' : 'More models…'}
            </option>
        </select>
    );
}

// An answer is written to be taken away -- read out, pasted into a message to
// whoever asked, kept for next Sunday. The alternative in this window is a
// mouse drag across a paragraph while a service is starting.
function RenderCopyButtonComp({ text }: Readonly<{ text: string }>) {
    const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>(
        'idle',
    );
    const timeoutRef = useRef<any>(null);
    useAppEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    const handleCopying = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyState('done');
        } catch (_error) {
            // No clipboard, or permission refused. Said out loud rather than
            // swallowed: a button that looks like it worked and did not is
            // worse than one that admits it.
            setCopyState('failed');
        }
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setCopyState('idle');
        }, 1600);
    };
    return (
        <button
            type="button"
            className="cue-tool"
            title="Copy this answer"
            onClick={handleCopying}
        >
            {copyState === 'done'
                ? '✓ Copied'
                : copyState === 'failed'
                  ? 'Could not copy'
                  : 'Copy'}
        </button>
    );
}

function RenderMessageComp({
    message,
    onAction,
    onReuse,
}: Readonly<{
    message: ChatMessageType;
    onAction: (action: BotActionType) => void;
    onReuse: (text: string) => void;
}>) {
    const isAsked = message.author === 'you';
    const handleReusing = () => {
        // A click that ends a drag is someone selecting the question to copy
        // it, not someone asking it again.
        if ((window.getSelection()?.toString() ?? '').length > 0) {
            return;
        }
        onReuse(message.text);
    };
    return (
        <article className={`cue cue-${message.author}`}>
            <span className="cue-mark" aria-hidden="true" />
            <p className="cue-label">
                {message.author === 'you' ? 'You' : 'Assistant'}
            </p>
            <div className="cue-body">
                {message.note === undefined ? null : (
                    <p className="cue-note">{message.note}</p>
                )}
                {isAsked ? (
                    // The question itself is the button: the same words go
                    // back in the box, ready to be edited into the next one.
                    <div
                        className="cue-said"
                        role="button"
                        tabIndex={0}
                        title="Put this question back in the box"
                        onClick={handleReusing}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                handleReusing();
                            }
                        }}
                    >
                        {renderRichText(message.text)}
                    </div>
                ) : (
                    renderRichText(message.text)
                )}
                {message.actions?.length ? (
                    <div className="cue-actions">
                        {message.actions.map((action) => {
                            // The two walkthroughs are the answers that DO
                            // something, and the demo is the boldest of them;
                            // reading matter stays quiet beside them.
                            const isGuide =
                                action.toolName === 'owa_guide_start';
                            const isDemo = action.args?.mode === 'demo';
                            return (
                                <button
                                    key={action.label}
                                    type="button"
                                    className={
                                        'cue-act' +
                                        (isDemo
                                            ? ' cue-act-demo'
                                            : isGuide
                                              ? ' cue-act-guide'
                                              : '')
                                    }
                                    onClick={() => {
                                        onAction(action);
                                    }}
                                >
                                    {action.label}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
                <div className="cue-tools">
                    {isAsked ? (
                        <button
                            type="button"
                            className="cue-tool"
                            title="Put this question back in the box"
                            onClick={handleReusing}
                        >
                            Ask again
                        </button>
                    ) : (
                        <RenderCopyButtonComp text={message.text} />
                    )}
                </div>
            </div>
        </article>
    );
}

// The menu behind a tab's dots, and the width it is drawn at. The width is a
// constant because the menu has to be kept on screen BEFORE there is anything
// to measure: this window is 460px wide, and a menu opened from a tab at the
// right-hand end would otherwise hang off the edge on its first frame.
const TAB_MENU_WIDTH = 182;

type TabMenuStateType = {
    sessionId: string;
    x: number;
    y: number;
};

// The two actions that take more than one tab at a time, held back until they
// have been asked for twice. Everything else in the menu takes exactly the tab
// it belongs to, and can be undone by reopening the window; these two cannot.
type SweepType =
    | { kind: 'clear' }
    | {
          kind: 'solo';
          sessionId: string;
      };

// The tab strip. Several conversations at once, the way a browser holds
// several pages -- and, unlike a browser, every one of them still there after
// the window is closed and the app restarted.
function RenderSessionTabsComp({
    sessions,
    activeId,
    onChoose,
    onClose,
    onAdd,
    onRename,
    onTogglingLock,
    onSolo,
    onClearAll,
}: Readonly<{
    sessions: ChatSessionType[];
    activeId: string;
    onChoose: (id: string) => void;
    onClose: (id: string) => void;
    onAdd: () => void;
    onRename: (id: string, title: string) => void;
    onTogglingLock: (id: string) => void;
    onSolo: (id: string) => void;
    onClearAll: () => void;
}>) {
    const canAdd = checkCanAddChatSession(sessions);
    // Renaming is a state OF THE STRIP, not of a session: it is over the
    // moment the box is left, and nothing about it is worth writing to disk.
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingText, setRenamingText] = useState('');
    // So is which tab has its menu open, and which sweeping action is waiting
    // to be confirmed. That question is asked in this window rather than in
    // the app's confirm popup because this window loads bootstrap and its own
    // sheet and nothing else -- pulling the popup in here would bring `tran()`
    // and a module-scope listener with it (see `openAiSetting`), for one
    // question with two answers.
    const [menuState, setMenuState] = useState<TabMenuStateType | null>(null);
    const [sweep, setSweep] = useState<SweepType | null>(null);
    // The menu belongs to a tab, and that tab can go out from under it -- by
    // way of the menu's own "Close this chat", most of the time.
    const menuSession =
        sessions.find((session) => {
            return session.id === menuState?.sessionId;
        }) ?? null;
    // What the waiting question would actually take. Locked tabs are not in
    // it, which is the whole point of locking one, and a question that would
    // now take nothing is a question with no answer worth pressing: it goes
    // with the tab or the lock that emptied it.
    const sweepingSessions =
        sweep === null
            ? []
            : toClearableChatSessions(sessions).filter((session) => {
                  return sweep.kind === 'clear'
                      ? true
                      : session.id !== sweep.sessionId;
              });
    if (sweep !== null && sweepingSessions.length === 0) {
        setSweep(null);
    }
    // Only the locks worth mentioning: the tab a solo is being run FROM is
    // staying because it is the one being soloed, not because of its lock, and
    // saying "the locked one stays" about the tab in front reads as a warning
    // about the wrong tab.
    const lockedKeptCount =
        sweep === null
            ? 0
            : sessions.filter((session) => {
                  return (
                      session.isLocked &&
                      (sweep.kind === 'clear' || session.id !== sweep.sessionId)
                  );
              }).length;
    // The strip scrolls now instead of shrinking its tabs, so a tab that is
    // chosen (or opened) off the visible end has to be brought back into view.
    const stripRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        stripRef.current
            ?.querySelector('.chat-tab.is-on')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [activeId]);
    const handleRenamingDone = () => {
        if (renamingId !== null) {
            // An emptied box means "go back to being called after the first
            // question", which is a useful thing to be able to undo to.
            onRename(renamingId, renamingText);
        }
        setRenamingId(null);
    };
    const handleOpeningMenu = (
        event: ReactMouseEventType<HTMLElement>,
        sessionId: string,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        // Hung under the control that was pressed rather than at the pointer,
        // so the menu lands in the same place whether it was opened with the
        // dots or by right-clicking the tab -- and shoved back onto the window
        // when that tab is scrolled up against the right-hand end, which a
        // 460px window makes a routine case rather than an edge one.
        const rect = event.currentTarget.getBoundingClientRect();
        setMenuState({
            sessionId,
            x: Math.max(
                4,
                Math.min(rect.left, window.innerWidth - TAB_MENU_WIDTH - 4),
            ),
            y: rect.bottom + 2,
        });
    };
    const handleClosingMenu = () => {
        setMenuState(null);
    };
    return (
        <>
            <div
                className="chat-tabs"
                role="tablist"
                aria-label="Chats"
                ref={stripRef}
            >
                {sessions.map((session) => {
                    const title = genChatSessionTitle(session);
                    const isOn = session.id === activeId;
                    const isMenuOn = session.id === menuSession?.id;
                    return (
                        <div
                            key={session.id}
                            className={
                                'chat-tab' +
                                (isOn ? ' is-on' : '') +
                                (isMenuOn ? ' is-menu-on' : '')
                            }
                            onContextMenu={(event) => {
                                handleOpeningMenu(event, session.id);
                            }}
                        >
                            {/*
                             * The right-click, spelled out. Nothing on a tab
                             * says a menu is hiding behind it, and the person
                             * this window is written for is not going to try
                             * -- so the dots are always there, dimmed, and
                             * they OPEN the tab: first thing on the left, in
                             * the one spot that does not move as the name
                             * beside it grows, shrinks or is being retyped.
                             */}
                            <button
                                type="button"
                                className="chat-tab-menu"
                                aria-label={`More for ${title}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOn}
                                title="More"
                                onClick={(event) => {
                                    handleOpeningMenu(event, session.id);
                                }}
                            >
                                ⋮
                            </button>
                            {renamingId === session.id ? (
                                <input
                                    className="chat-tab-input"
                                    type="text"
                                    autoFocus
                                    value={renamingText}
                                    aria-label="Name this chat"
                                    onChange={(event) => {
                                        setRenamingText(event.target.value);
                                    }}
                                    onBlur={handleRenamingDone}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleRenamingDone();
                                        } else if (event.key === 'Escape') {
                                            setRenamingId(null);
                                        }
                                    }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isOn}
                                    className="chat-tab-name"
                                    title={`${title} — double-click to rename`}
                                    onClick={() => {
                                        onChoose(session.id);
                                    }}
                                    onDoubleClick={() => {
                                        setRenamingId(session.id);
                                        setRenamingText(title);
                                    }}
                                >
                                    {title}
                                </button>
                            )}
                            {session.isLocked ? (
                                // The close button, replaced by the reason it
                                // is not there. Not a button of its own: a
                                // lock that comes off with one stray press on
                                // the exact spot the close used to be is not a
                                // lock.
                                <span
                                    className="chat-tab-lock"
                                    role="img"
                                    aria-label={`${title} is locked`}
                                    title={
                                        'Locked — unlock it from this tab’s ' +
                                        'menu to close it'
                                    }
                                >
                                    <i className="bi bi-lock-fill" />
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    className="chat-tab-close"
                                    aria-label={`Close ${title}`}
                                    title="Close this chat"
                                    onClick={() => {
                                        onClose(session.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="chat-tab-add"
                    aria-label="New chat"
                    title={
                        canAdd
                            ? 'New chat'
                            : 'Close one of these before starting another'
                    }
                    disabled={!canAdd}
                    onClick={onAdd}
                >
                    +
                </button>
            </div>
            {sweep === null ? null : (
                // Asked on a line of its own rather than inside the menu, and
                // never done on the first press: these conversations are the
                // only record of what the person at this machine was told.
                <div
                    className="chat-clear-confirm"
                    role="alertdialog"
                    aria-label={
                        sweep.kind === 'clear'
                            ? 'Clear all chats'
                            : 'Close other chats'
                    }
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setSweep(null);
                        }
                    }}
                >
                    <span className="chat-clear-ask">
                        {sweep.kind === 'clear' ? 'Clear ' : 'Close '}
                        {sweepingSessions.length} chat
                        {sweepingSessions.length === 1 ? '' : 's'}?
                        {lockedKeptCount === 0
                            ? ''
                            : ` The locked ${
                                  lockedKeptCount === 1
                                      ? 'one stays'
                                      : 'ones stay'
                              }.`}{' '}
                        This cannot be undone.
                    </span>
                    <button
                        type="button"
                        className="chat-clear-no"
                        autoFocus
                        onClick={() => {
                            setSweep(null);
                        }}
                    >
                        Keep them
                    </button>
                    <button
                        type="button"
                        className="chat-clear-yes"
                        onClick={() => {
                            if (sweep.kind === 'clear') {
                                onClearAll();
                            } else {
                                onSolo(sweep.sessionId);
                            }
                            setSweep(null);
                        }}
                    >
                        {sweep.kind === 'clear' ? 'Clear all' : 'Close them'}
                    </button>
                </div>
            )}
            {menuState === null || menuSession === null ? null : (
                // Drawn OUTSIDE the strip and placed against the window: the
                // strip scrolls, so anything inside it is clipped at its
                // edges, and a clipped menu is a menu with items nobody can
                // reach. The sheet behind it is what closes it on the next
                // press anywhere -- cheaper, and harder to get wrong, than a
                // document listener that has to be taken off again.
                <>
                    <div
                        className="chat-menu-sheet"
                        onPointerDown={handleClosingMenu}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            handleClosingMenu();
                        }}
                    />
                    <div
                        className="chat-menu"
                        role="menu"
                        aria-label={genChatSessionTitle(menuSession)}
                        style={{
                            left: menuState.x,
                            top: menuState.y,
                            width: TAB_MENU_WIDTH,
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                handleClosingMenu();
                            }
                        }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            autoFocus
                            onClick={() => {
                                handleClosingMenu();
                                setRenamingId(menuSession.id);
                                setRenamingText(
                                    genChatSessionTitle(menuSession),
                                );
                            }}
                        >
                            Rename this chat
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            onClick={() => {
                                handleClosingMenu();
                                onTogglingLock(menuSession.id);
                            }}
                        >
                            {menuSession.isLocked
                                ? 'Unlock this chat'
                                : 'Lock this chat'}
                        </button>
                        {menuSession.isLocked ? null : (
                            <button
                                type="button"
                                role="menuitem"
                                className="chat-menu-item"
                                onClick={() => {
                                    handleClosingMenu();
                                    onClose(menuSession.id);
                                }}
                            >
                                Close this chat
                            </button>
                        )}
                        {checkCanSoloChatSession(sessions, menuSession.id) ? (
                            <>
                                <div className="chat-menu-line" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="chat-menu-item is-warn"
                                    onClick={() => {
                                        handleClosingMenu();
                                        setSweep({
                                            kind: 'solo',
                                            sessionId: menuSession.id,
                                        });
                                    }}
                                >
                                    Close other chats…
                                </button>
                            </>
                        ) : null}
                        {checkCanClearChatSessions(sessions) ? (
                            <>
                                {checkCanSoloChatSession(
                                    sessions,
                                    menuSession.id,
                                ) ? null : (
                                    <div className="chat-menu-line" />
                                )}
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="chat-menu-item is-warn"
                                    onClick={() => {
                                        handleClosingMenu();
                                        setSweep({ kind: 'clear' });
                                    }}
                                >
                                    Clear all chats…
                                </button>
                            </>
                        ) : null}
                    </div>
                </>
            )}
        </>
    );
}

function genNewSessionDefaults() {
    const focus = detectOpenerFocus() ?? 'presenter';
    const provider = getLlmProvider();
    const model = provider === null ? '' : getLlmModel(provider);
    return { focus, provider, model };
}

function genInitialSessionState(): ChatSessionStateType {
    const { focus, provider, model } = genNewSessionDefaults();
    const loaded = loadChatSessions(focus, provider, model);
    const availableProviders = getAvailableLlmProviders();
    return {
        ...loaded,
        sessions: loaded.sessions.map((session) => {
            // A tab saved against a key that has since been removed -- or one
            // saved before this window had a model picker at all -- is put
            // back on whatever the window can actually ask now.
            if (
                session.provider !== null &&
                availableProviders.includes(session.provider)
            ) {
                return session.model.length > 0
                    ? session
                    : { ...session, model: getLlmModel(session.provider) };
            }
            return { ...session, provider, model };
        }),
    };
}

export default function ChatbotAppComp() {
    // Popup windows carry no theme of their own: without this the help window
    // opens white in front of a dark app.
    const { theme } = useThemeSource();
    // Every conversation this window is holding, and which tab is in front.
    // Read from disk once, at mount: this window is the only thing that writes
    // that file.
    const [sessionState, setSessionState] = useState<ChatSessionStateType>(
        genInitialSessionState,
    );
    const { sessions, activeId } = sessionState;
    // Read by the handlers that rewrite the whole strip at once. They cannot
    // use `setSessionState`'s updater form: they also WRITE the result to disk
    // on the spot, and a side effect inside an updater runs twice under strict
    // mode -- twice with two different new session ids, at that.
    const sessionStateRef = useAppCurrentRef(sessionState);
    const activeSession = useMemo(() => {
        return (
            sessions.find((session) => {
                return session.id === activeId;
            }) ?? sessions[0]
        );
    }, [sessions, activeId]);
    // Everything below reads the tab in front. `isFocusChosen` is per tab too:
    // until the user picks a side themselves the answers follow the window
    // this one was opened from, which is one window that navigates between the
    // presenter and the reader while this window stays open.
    const {
        messages,
        draft: question,
        focus,
        isFocusChosen,
        provider,
        model,
    } = activeSession;
    // Addressed BY ID, never by "whatever is in front". An answer takes as
    // long as the model takes, the tab strip stays live while it does, and a
    // user who checks another tab meanwhile would otherwise have the answer to
    // this question appended to that conversation -- leaving the tab that
    // asked it showing a question nothing ever replied to.
    const updateSession = useCallback(
        (
            id: string,
            updater: (session: ChatSessionType) => ChatSessionType,
        ) => {
            setSessionState((oldState) => {
                return {
                    ...oldState,
                    sessions: oldState.sessions.map((session) => {
                        return session.id === id ? updater(session) : session;
                    }),
                };
            });
        },
        [],
    );
    const activeSessionId = activeSession.id;
    const updateActiveSession = useCallback(
        (updater: (session: ChatSessionType) => ChatSessionType) => {
            updateSession(activeSessionId, updater);
        },
        [activeSessionId, updateSession],
    );
    const [isBusy, setIsBusy] = useState(false);
    const [serviceError, setServiceError] = useState<string | null>(null);
    // The catalogue, on the other hand, is a property of the ACCOUNT, not of a
    // tab: what the key can run is the same answer in every tab, so the list
    // is held once per provider and shared by all of them. Read once -- a key
    // added in Settings while this window is open arrives on its next open,
    // and the window is cheap to reopen, cheaper than a subscription this
    // popup would hold all service.
    const [modelListMap, setModelListMap] = useState<
        Record<LlmProviderType, LlmModelType[]>
    >(() => {
        return {
            anthropic: getLlmModelList('anthropic'),
            openai: getLlmModelList('openai'),
        };
    });
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const availableProviders = useMemo(() => {
        return getAvailableLlmProviders();
    }, []);
    const modelList = provider === null ? [] : modelListMap[provider];
    // Both of these change THIS tab, and are also written down as what the
    // next new tab should start with. The tabs already open keep asking with
    // whatever they were asking with.
    const handleProviderChanging = useCallback(
        (newProvider: LlmProviderType) => {
            setLlmProvider(newProvider);
            const newModel = getLlmModel(newProvider);
            updateActiveSession((session) => {
                return { ...session, provider: newProvider, model: newModel };
            });
        },
        [updateActiveSession],
    );
    const handleModelChanging = useCallback(
        (newModel: string) => {
            if (provider === null) {
                return;
            }
            setLlmModel(provider, newModel);
            updateActiveSession((session) => {
                return { ...session, model: newModel };
            });
        },
        [provider, updateActiveSession],
    );
    const handleLoadingMoreModels = useCallback(async () => {
        if (provider === null || isLoadingModels) {
            return;
        }
        setIsLoadingModels(true);
        try {
            const models = await listAllLlmModels(provider);
            setModelListMap((oldMap) => {
                return { ...oldMap, [provider]: models };
            });
        } catch (error: any) {
            setServiceError(
                `The other models could not be listed — ${error.message}`,
            );
        } finally {
            setIsLoadingModels(false);
        }
    }, [provider, isLoadingModels]);
    const handleChoosingSession = useCallback((id: string) => {
        setSessionState((oldState) => {
            return { ...oldState, activeId: id };
        });
    }, []);
    const handleAddingSession = useCallback(() => {
        setSessionState((oldState) => {
            if (!checkCanAddChatSession(oldState.sessions)) {
                return oldState;
            }
            // A new tab starts where the user is looking now and on the last
            // provider and model they chose -- not on whatever the tab that
            // happened to be in front was set to.
            const defaults = genNewSessionDefaults();
            const session = genNewChatSession(
                defaults.focus,
                defaults.provider,
                defaults.model,
            );
            return {
                sessions: [...oldState.sessions, session],
                activeId: session.id,
            };
        });
    }, []);
    const handleClosingSession = useCallback((id: string) => {
        setSessionState((oldState) => {
            const index = oldState.sessions.findIndex((session) => {
                return session.id === id;
            });
            if (index === -1 || oldState.sessions[index].isLocked) {
                return oldState;
            }
            const sessions = oldState.sessions.filter((session) => {
                return session.id !== id;
            });
            if (sessions.length === 0) {
                // Closing the last tab empties this window rather than leaving
                // it with nothing to show; a browser would close the window,
                // which is not this window's to do.
                const defaults = genNewSessionDefaults();
                const session = genNewChatSession(
                    defaults.focus,
                    defaults.provider,
                    defaults.model,
                );
                return { sessions: [session], activeId: session.id };
            }
            if (oldState.activeId !== id) {
                // Closing a tab that was not in front leaves the front one
                // alone.
                return { sessions, activeId: oldState.activeId };
            }
            // The one to its right, as a browser does, and the one to its left
            // when it was the last.
            const nextSession = sessions[Math.min(index, sessions.length - 1)];
            return { sessions, activeId: nextSession.id };
        });
    }, []);
    const handleRenamingSession = useCallback((id: string, title: string) => {
        setSessionState((oldState) => {
            return {
                ...oldState,
                sessions: oldState.sessions.map((session) => {
                    return session.id === id
                        ? { ...session, title: toChatSessionTitle(title) }
                        : session;
                }),
            };
        });
    }, []);
    const handleTogglingSessionLock = useCallback(
        (id: string) => {
            updateSession(id, (session) => {
                return { ...session, isLocked: !session.isLocked };
            });
        },
        [updateSession],
    );
    // Both sweeps write to disk NOW, ahead of the usual debounced save.
    // Everywhere else a few hundred milliseconds of typing is what is at
    // stake; here it is whether the conversations someone just asked to be rid
    // of are still in the file if the machine goes down on the way out of the
    // room.
    const handleSoloingSession = useCallback((id: string) => {
        const oldState = sessionStateRef.current;
        const sessions = oldState.sessions.filter((session) => {
            return session.id === id || session.isLocked;
        });
        if (sessions.length === oldState.sessions.length) {
            return;
        }
        const state = { sessions, activeId: id };
        saveChatSessions(state);
        setSessionState(state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClearingSessions = useCallback(() => {
        const oldState = sessionStateRef.current;
        // A locked tab is the one thing this does not take.
        const keptSessions = oldState.sessions.filter((session) => {
            return session.isLocked;
        });
        // With nothing left, the window lands where closing the last tab
        // leaves it: one empty tab on the current defaults, not an empty
        // window with nothing to type into.
        const defaults = genNewSessionDefaults();
        const sessions =
            keptSessions.length > 0
                ? keptSessions
                : [
                      genNewChatSession(
                          defaults.focus,
                          defaults.provider,
                          defaults.model,
                      ),
                  ];
        const isActiveKept = sessions.some((session) => {
            return session.id === oldState.activeId;
        });
        const state = {
            sessions,
            activeId: isActiveKept ? oldState.activeId : sessions[0].id,
        };
        saveChatSessions(state);
        setSessionState(state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFocusChanging = useCallback(
        (newFocus: BotFocusType) => {
            updateActiveSession((session) => {
                return { ...session, focus: newFocus, isFocusChosen: true };
            });
        },
        [updateActiveSession],
    );
    const handleDrafting = useCallback(
        (text: string) => {
            updateActiveSession((session) => {
                return { ...session, draft: text };
            });
        },
        [updateActiveSession],
    );
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleReusing = useCallback(
        (text: string) => {
            handleDrafting(text);
            inputRef.current?.focus();
        },
        [handleDrafting],
    );
    const listRef = useRef<HTMLDivElement | null>(null);

    // Saving is debounced because a keystroke in the box is a change to a
    // session, and `setSetting` writes a file synchronously. The unload flush
    // is what keeps the last few hundred milliseconds of typing.
    const saveAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(400);
    }, []);
    useAppEffect(() => {
        saveAttemptTimeout(() => {
            saveChatSessions(sessionStateRef.current);
        });
    }, [sessionState]);
    useAppEffect(() => {
        const handleUnloading = () => {
            saveChatSessions(sessionStateRef.current);
        };
        window.addEventListener('beforeunload', handleUnloading);
        return () => {
            window.removeEventListener('beforeunload', handleUnloading);
        };
    }, []);

    useAppEffect(() => {
        const { mcpUrl } = getAiEndpoints();
        if (mcpUrl === null) {
            setServiceError(
                'The assistant is not running in this copy of the app. ' +
                    'Restart the app, then open this window again.',
            );
        }
    }, []);

    useAppEffect(() => {
        const element = listRef.current;
        if (element !== null) {
            element.scrollTop = element.scrollHeight;
        }
    }, [messages]);

    // Takes the tab it belongs to, because the answer arrives long after the
    // question and the user may be looking at another one by then.
    const addMessage = useCallback(
        (sessionId: string, message: Omit<ChatMessageType, 'id'>) => {
            updateSession(sessionId, (session) => {
                // Numbered from the last one in this tab, so the count picks up
                // where the file left off.
                const lastMessage =
                    session.messages[session.messages.length - 1];
                const id = (lastMessage?.id ?? 0) + 1;
                return {
                    ...session,
                    messages: [...session.messages, { ...message, id }],
                };
            });
        },
        [updateSession],
    );

    const handleAsking = useCallback(
        // `isForced` is for the follow-up `handleActing` fires the moment its
        // own tool call finishes: `setIsBusy(false)` has been called but React
        // has not re-rendered, so the busy flag this closure can see is still
        // true and the ask would be dropped without a word.
        async (asked: string, isForced = false) => {
            const trimmedAsked = asked.trim();
            if (trimmedAsked.length === 0 || (isBusy && !isForced)) {
                return;
            }
            // Pinned before the first await: everything this ask writes goes
            // to the tab that asked it, whichever one is in front by the time
            // the answer comes back.
            const askedSessionId = activeSessionId;
            addMessage(askedSessionId, { author: 'you', text: trimmedAsked });
            updateSession(askedSessionId, (session) => {
                return { ...session, draft: '' };
            });
            setIsBusy(true);
            let activeFocus = focus;
            if (!isFocusChosen) {
                const openerFocus = detectOpenerFocus();
                if (openerFocus !== null && openerFocus !== activeFocus) {
                    activeFocus = openerFocus;
                    updateSession(askedSessionId, (session) => {
                        return { ...session, focus: openerFocus };
                    });
                }
            }
            try {
                // A model when a key is configured; the offline lookup bot
                // otherwise -- and also when the call fails, which mid-service
                // usually means the building's internet is down.
                let answer;
                let note;
                if (provider !== null) {
                    try {
                        answer = await askLlmBot(
                            trimmedAsked,
                            activeFocus,
                            provider,
                            model,
                        );
                    } catch (error: any) {
                        const label = LLM_PROVIDER_LIST.find((item) => {
                            return item.key === provider;
                        })?.label;
                        answer = await askHelpBot(trimmedAsked, activeFocus);
                        note =
                            `${label} could not answer — ${error.message}. ` +
                            "Here is what the app's own guide says.";
                    }
                } else {
                    answer = await askHelpBot(trimmedAsked, activeFocus);
                }
                addMessage(askedSessionId, {
                    author: 'bot',
                    text: answer.text,
                    note,
                    actions: answer.actions,
                });
            } catch (error: any) {
                addMessage(askedSessionId, {
                    author: 'bot',
                    text: `I could not answer that: ${error.message}`,
                });
            } finally {
                setIsBusy(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isBusy, focus, isFocusChosen, provider, model, activeSessionId],
    );

    const handleAskingRef = useAppCurrentRef(handleAsking);

    const handleActing = useCallback(
        async (action: BotActionType) => {
            // Same reason as `handleAsking`: the button that fired this lives
            // in a tab, and a tool call is slow enough to outlive looking at it.
            const actedSessionId = activeSessionId;
            setIsBusy(true);
            let isNeedingModel = false;
            try {
                const result = await runBotAction(action);
                isNeedingModel = result.isNeedingModel;
                addMessage(actedSessionId, {
                    author: 'bot',
                    text: result.text,
                    actions: result.actions,
                });
            } catch (error: any) {
                addMessage(actedSessionId, {
                    author: 'bot',
                    text: `That did not work: ${error.message}`,
                });
            } finally {
                setIsBusy(false);
            }
            // The card the recipe could build is already up; this is the
            // second half, for the steps it could not point at. Working out
            // which control a sentence means is the one thing only the model
            // can do (see `genGuideActions`), and it costs a minute -- which
            // is why it is never what the user waits through first.
            if (isNeedingModel && action.ask !== undefined) {
                await handleAskingRef.current(action.ask, true);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSessionId],
    );

    return (
        <div id="app" data-bs-theme={theme} className="chatbot-app">
            <RenderSessionTabsComp
                sessions={sessions}
                activeId={activeSession.id}
                onChoose={handleChoosingSession}
                onClose={handleClosingSession}
                onAdd={handleAddingSession}
                onRename={handleRenamingSession}
                onTogglingLock={handleTogglingSessionLock}
                onSolo={handleSoloingSession}
                onClearAll={handleClearingSessions}
            />
            <header className="chat-head">
                <div className="chat-head-row">
                    {/*
                     * Two apps in one window: the same question has a
                     * presenter answer and a reader answer, so the user says
                     * which one they are asking about -- and until they do,
                     * it follows the window they opened this from.
                     */}
                    <div
                        className="seg"
                        role="group"
                        aria-label="Which part of the app"
                    >
                        {BOT_FOCUS_LIST.map((item) => {
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={
                                        'seg-item' +
                                        (focus === item.key ? ' is-on' : '')
                                    }
                                    onClick={() => {
                                        handleFocusChanging(item.key);
                                    }}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                    <RenderProviderSwitchComp
                        provider={provider}
                        availableProviders={availableProviders}
                        onChange={handleProviderChanging}
                    />
                    {provider === null ? (
                        // The head says WHAT is answering; the empty state
                        // says where its answers come from. Saying both in the
                        // head cost two lines of a 640px window. With no key
                        // it is also the way OUT of here, to the panel that
                        // takes one.
                        <button
                            type="button"
                            className="chat-engine chat-engine-off"
                            title={
                                'Claude and ChatGPT need an API key of your ' +
                                'own — open AI settings'
                            }
                            onClick={openAiSetting}
                        >
                            app guide · offline
                        </button>
                    ) : (
                        <RenderModelPickerComp
                            model={model}
                            modelList={modelList}
                            isLoadingModels={isLoadingModels}
                            onChange={handleModelChanging}
                            onLoadingMore={handleLoadingMoreModels}
                        />
                    )}
                </div>
            </header>
            <div className="chat-log" ref={listRef}>
                {serviceError !== null ? (
                    <p className="chat-alert">{serviceError}</p>
                ) : null}
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <p className="chat-eyebrow">Try asking</p>
                        <div className="chat-starters">
                            {STARTER_QUESTIONS[focus].map((starter) => {
                                return (
                                    <button
                                        key={starter}
                                        type="button"
                                        className="chat-starter"
                                        onClick={() => {
                                            handleAsking(starter);
                                        }}
                                    >
                                        {starter}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="chat-hint">
                            Answers come from the app&apos;s own guide and from
                            what the app is doing right now.
                        </p>
                        {provider === null ? (
                            // Not an error -- the window works without a key.
                            // But the two names in the switch above are dead
                            // until there is one, and this says so where the
                            // user is already looking, with the way there.
                            <p className="chat-hint">
                                Claude and ChatGPT answer here only with an API
                                key of your own.{' '}
                                <button
                                    type="button"
                                    className="chat-link"
                                    onClick={openAiSetting}
                                >
                                    Open AI settings
                                </button>
                            </p>
                        ) : null}
                    </div>
                ) : null}
                {messages.length === 0 ? null : (
                    // The rail hangs on this, not on the whole log: a running
                    // order that carries on past its last cue reads unfinished.
                    <div className="chat-cues">
                        {messages.map((message) => {
                            return (
                                <RenderMessageComp
                                    key={message.id}
                                    message={message}
                                    onAction={handleActing}
                                    onReuse={handleReusing}
                                />
                            );
                        })}
                    </div>
                )}
                {isBusy ? (
                    <p className="chat-status">
                        <span className="chat-status-dot" aria-hidden="true" />
                        Looking it up…
                    </p>
                ) : null}
            </div>
            <form
                className="chat-ask"
                onSubmit={(event) => {
                    event.preventDefault();
                    handleAsking(question);
                }}
            >
                <input
                    className="chat-input"
                    type="text"
                    autoFocus
                    ref={inputRef}
                    value={question}
                    placeholder="Ask how to do something in the app…"
                    aria-label="Ask how to do something in the app"
                    disabled={isBusy}
                    onChange={(event) => {
                        handleDrafting(event.target.value);
                    }}
                />
                <button className="chat-send" type="submit" disabled={isBusy}>
                    Ask
                </button>
            </form>
        </div>
    );
}
