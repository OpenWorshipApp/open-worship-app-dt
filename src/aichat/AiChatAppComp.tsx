import './AiChatAppComp.scss';

import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useThemeSource } from '../others/themeHelpers';
import appProvider from '../server/appProvider';
import RenderSessionTabsComp from '../chatbot/RenderSessionTabsComp';
import {
    checkCanAddChatSession,
    toChatSessionTitle,
} from '../chatbot/chatSessionHelpers';
import {
    AI_CHAT_PROVIDER_LIST,
    getAiChatProvider,
    toAiChatHostLabel,
    type AiChatProviderType,
} from './aiChatProviders';
import { clearAiChatSiteData } from './aiChatSignOutHelpers';
import {
    checkCanClearAiChatSessions,
    genAiChatSessionTitle,
    genNewAiChatSession,
    loadAiChatSessions,
    MAX_AI_CHAT_SESSION_COUNT,
    saveAiChatSessions,
    toKeptUrl,
    toLiveSessionIds,
    toPageTitle,
    type AiChatSessionStateType,
    type AiChatSessionType,
} from './aiChatSessionHelpers';

// Where a press of "Sign out of every site" has got to. `asking` is the whole
// safety of it: the sign-ins are not this window's to spend on one press.
type SignOutStateType = 'idle' | 'asking' | 'working' | 'failed';
import type {
    AiChatGuestElementType,
    AiChatGuestEventType,
} from './webviewTypes';

// The session every guest loads on. Persistent, so a sign-in survives a
// restart -- the whole point of holding the site in the app rather than in a
// browser tab. Its twin in `electron/aiChatGuestHelpers.ts` is what locks it
// down (no permissions, a plain user agent) and what REFUSES a guest on any
// other partition, so the two must stay the same string.
const AI_CHAT_PARTITION = 'persist:aichat';

// Chromium's "the navigation was cancelled" code, which every redirect and
// every second load fires on the way; not a failure anybody needs told about.
const ABORTED_ERROR_CODE = -3;

// `allowpopups` is what lets a link in the site reach the main process's
// window-open handler (and so the system browser) instead of dying in
// silence. React drops a boolean on an attribute it does not know, so the
// guest gets the attribute itself, as the empty string it is spelled with.
const GUEST_POPUP_ATTRIBUTES = { allowpopups: '' } as unknown as {
    allowpopups: boolean;
};

function RenderProviderBadgeComp({
    provider,
}: Readonly<{ provider: AiChatProviderType }>) {
    return (
        <span
            className="aichat-badge"
            aria-hidden="true"
            style={{ backgroundColor: provider.badgeColor }}
        >
            {provider.badgeLetter}
        </span>
    );
}

/**
 * The card a new tab opens on: the list of sites, and what choosing one
 * means. One press chooses -- there is no Continue under it, because a list
 * of ten buttons that then needs an eleventh is a list of ten buttons that
 * do nothing.
 */
function RenderChooserComp({
    onChoose,
    onSignOut,
}: Readonly<{
    onChoose: (providerKey: string) => void;
    onSignOut: () => void;
}>) {
    return (
        <div
            className="aichat-chooser"
            role="region"
            aria-label="Choose an AI chat"
        >
            <div className="aichat-chooser-card">
                <p className="aichat-eyebrow">AI chat</p>
                <h1 className="aichat-title">
                    Choose an AI chat to use in this window
                </h1>
                <p className="aichat-lead">
                    Switch anytime from the list above the page. You sign in on
                    the site itself, with your own account, and your
                    conversations stay there.
                </p>
                <div className="aichat-choices">
                    {AI_CHAT_PROVIDER_LIST.map((provider) => {
                        return (
                            <button
                                key={provider.key}
                                type="button"
                                className="aichat-choice"
                                onClick={() => {
                                    onChoose(provider.key);
                                }}
                            >
                                <RenderProviderBadgeComp provider={provider} />
                                <span className="aichat-choice-name">
                                    {provider.name}
                                </span>
                                <span className="aichat-choice-host">
                                    {toAiChatHostLabel(provider.homeUrl)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="aichat-note">
                    These are other companies&rsquo; websites. What you type
                    there leaves this computer under their terms; this app keeps
                    nothing of it but the tab.
                </p>
                {/*
                 * Said here in words because this is where there is room for
                 * them; the same thing is one press away in the bar above,
                 * for when every tab is on a site and this card is not.
                 */}
                <p className="aichat-note">
                    You stay signed in on this computer until you say otherwise.{' '}
                    <button
                        type="button"
                        className="aichat-link-button"
                        onClick={onSignOut}
                    >
                        Sign out of every site
                    </button>{' '}
                    when several people use it.
                </p>
            </div>
        </div>
    );
}

type GuestFailureType = {
    description: string;
};

// `getURL` throws on a guest that has not reached `dom-ready` yet; a tab
// that was only just opened has nowhere to report.
function readGuestUrl(guest: AiChatGuestElementType | undefined) {
    try {
        return guest?.getURL() ?? '';
    } catch (_error) {
        return '';
    }
}

/**
 * One site, in one guest. Mounted only while its tab is one of the live few
 * (`toLiveSessionIds`), hidden -- never `display: none`, which detaches a
 * guest and reloads it -- while another tab is in front.
 *
 * `src` is fixed for the life of the mount: React must never rewrite it, or
 * a re-render would send the guest back to where the tab started. A tab that
 * changes site changes this component's key instead and starts a fresh
 * guest at the new site's home.
 */
function RenderGuestComp({
    session,
    provider,
    isOn,
    onRegister,
    onPageTitle,
    onNavigated,
}: Readonly<{
    session: AiChatSessionType;
    provider: AiChatProviderType;
    isOn: boolean;
    onRegister: (
        sessionId: string,
        guest: AiChatGuestElementType | null,
    ) => void;
    onPageTitle: (sessionId: string, title: string) => void;
    onNavigated: (sessionId: string, url: string) => void;
}>) {
    const guestRef = useRef<AiChatGuestElementType>(null);
    const [initialSrc] = useState(() => {
        return session.lastUrl ?? provider.homeUrl;
    });
    const [isLoading, setIsLoading] = useState(true);
    const [failure, setFailure] = useState<GuestFailureType | null>(null);
    const onPageTitleRef = useAppCurrentRef(onPageTitle);
    const onNavigatedRef = useAppCurrentRef(onNavigated);
    const onRegisterRef = useAppCurrentRef(onRegister);
    useAppEffect(() => {
        const guest = guestRef.current;
        if (guest === null) {
            return;
        }
        const sessionId = session.id;
        onRegisterRef.current(sessionId, guest);
        const handleTitle = (event: AiChatGuestEventType) => {
            if (typeof event.title === 'string') {
                onPageTitleRef.current(sessionId, event.title);
            }
        };
        const handleNavigation = (event: AiChatGuestEventType) => {
            if (event.isMainFrame === false || typeof event.url !== 'string') {
                return;
            }
            onNavigatedRef.current(sessionId, event.url);
        };
        const handleStarting = () => {
            setIsLoading(true);
            setFailure(null);
        };
        const handleStopping = () => {
            setIsLoading(false);
        };
        const handleFailing = (event: AiChatGuestEventType) => {
            if (
                event.isMainFrame === false ||
                event.errorCode === ABORTED_ERROR_CODE
            ) {
                return;
            }
            setFailure({
                description:
                    event.errorDescription || `error ${event.errorCode}`,
            });
        };
        guest.addEventListener('page-title-updated', handleTitle);
        guest.addEventListener('did-navigate', handleNavigation);
        guest.addEventListener('did-navigate-in-page', handleNavigation);
        guest.addEventListener('did-start-loading', handleStarting);
        guest.addEventListener('did-stop-loading', handleStopping);
        guest.addEventListener('did-fail-load', handleFailing);
        return () => {
            guest.removeEventListener('page-title-updated', handleTitle);
            guest.removeEventListener('did-navigate', handleNavigation);
            guest.removeEventListener('did-navigate-in-page', handleNavigation);
            guest.removeEventListener('did-start-loading', handleStarting);
            guest.removeEventListener('did-stop-loading', handleStopping);
            guest.removeEventListener('did-fail-load', handleFailing);
            onRegisterRef.current(sessionId, null);
        };
    }, []);
    return (
        <>
            {isLoading && isOn ? (
                <div
                    className="aichat-loading"
                    role="progressbar"
                    aria-label={`Loading ${provider.name}`}
                />
            ) : null}
            {failure !== null && isOn ? (
                <div className="aichat-failure" role="alert">
                    <span className="aichat-failure-text">
                        {provider.name} could not be loaded —{' '}
                        {failure.description}. Check the internet connection.
                    </span>
                    <button
                        type="button"
                        className="aichat-failure-button"
                        onClick={() => {
                            guestRef.current?.reload();
                        }}
                    >
                        Try again
                    </button>
                </div>
            ) : null}
            {/*
             * `partition` before `src`, deliberately: a guest's partition
             * cannot change once it has started to navigate.
             */}
            <webview
                ref={guestRef}
                className={'aichat-guest' + (isOn ? '' : ' is-off')}
                partition={AI_CHAT_PARTITION}
                {...GUEST_POPUP_ATTRIBUTES}
                src={initialSrc}
            />
        </>
    );
}

/**
 * The AI Chat window: a company's own chat site in a box beside the app, the
 * way a browser's AI sidebar holds one.
 *
 * Nothing in here talks to any assistant. The head chatbot (`ChatbotAppComp`)
 * answers about the app with the user's own key; this window is for the
 * other thing a volunteer reaches for a browser to do -- ask ChatGPT for a
 * prayer, or Claude to tidy a notice -- without leaving the app. The tab
 * strip is the chatbot's, so the two windows read as one family.
 */
export default function AiChatAppComp() {
    const { theme } = useThemeSource();
    const [sessionState, setSessionState] =
        useState<AiChatSessionStateType>(loadAiChatSessions);
    const sessionStateRef = useAppCurrentRef(sessionState);
    const [signOutState, setSignOutState] = useState<SignOutStateType>('idle');
    // Bumped by a sign-out, and part of every guest's key, so all of them are
    // thrown away and started again at their site's home. Window-local on
    // purpose: it is not a fact about a tab, so it never reaches the file.
    const [guestEpoch, setGuestEpoch] = useState(0);
    const { sessions, activeId } = sessionState;
    const activeSession =
        sessions.find((session) => {
            return session.id === activeId;
        }) ?? sessions[0];
    const activeProvider = getAiChatProvider(activeSession.providerKey);
    const liveIds = useMemo(() => {
        return toLiveSessionIds(sessions, activeId);
    }, [sessions, activeId]);
    // The guests that are up right now, by tab, so the head row's buttons can
    // reach the one in front. Registered by each guest as it mounts.
    const guestMapRef = useRef(new Map<string, AiChatGuestElementType>());

    // Debounced, as in the chatbot: a navigation inside the site is a change
    // to a session, and `setSetting` writes a file synchronously.
    const saveAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(400);
    }, []);
    useAppEffect(() => {
        saveAttemptTimeout(() => {
            saveAiChatSessions(sessionStateRef.current);
        });
    }, [sessionState]);
    useAppEffect(() => {
        const handleUnloading = () => {
            saveAiChatSessions(sessionStateRef.current);
        };
        window.addEventListener('beforeunload', handleUnloading);
        return () => {
            window.removeEventListener('beforeunload', handleUnloading);
        };
    }, []);

    const updateSession = useCallback(
        (
            id: string,
            updater: (session: AiChatSessionType) => AiChatSessionType,
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
    const handleChoosingSession = useCallback(
        (id: string) => {
            setSessionState((oldState) => {
                return { ...oldState, activeId: id };
            });
            updateSession(id, (session) => {
                return { ...session, lastUsedAt: Date.now() };
            });
        },
        [updateSession],
    );
    const handleAddingSession = useCallback(() => {
        setSessionState((oldState) => {
            if (
                !checkCanAddChatSession(
                    oldState.sessions,
                    MAX_AI_CHAT_SESSION_COUNT,
                )
            ) {
                return oldState;
            }
            const session = genNewAiChatSession();
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
                // Closing the last tab lands on the chooser rather than on an
                // empty window; closing the window is not this window's to do.
                const session = genNewAiChatSession();
                return { sessions: [session], activeId: session.id };
            }
            if (oldState.activeId !== id) {
                return { sessions, activeId: oldState.activeId };
            }
            const nextSession = sessions[Math.min(index, sessions.length - 1)];
            return { sessions, activeId: nextSession.id };
        });
    }, []);
    const handleRenamingSession = useCallback(
        (id: string, title: string) => {
            updateSession(id, (session) => {
                return { ...session, title: toChatSessionTitle(title) };
            });
        },
        [updateSession],
    );
    const handleTogglingSessionLock = useCallback(
        (id: string) => {
            updateSession(id, (session) => {
                return { ...session, isLocked: !session.isLocked };
            });
        },
        [updateSession],
    );
    // Both sweeps write to disk NOW, ahead of the debounced save, for the
    // reason the chatbot gives: what someone just asked to be rid of must not
    // still be in the file if the machine goes down on the way out.
    const handleSoloingSession = useCallback((id: string) => {
        const oldState = sessionStateRef.current;
        const sessions = oldState.sessions.filter((session) => {
            return session.id === id || session.isLocked;
        });
        if (sessions.length === oldState.sessions.length) {
            return;
        }
        const state = { sessions, activeId: id };
        saveAiChatSessions(state);
        setSessionState(state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClearingSessions = useCallback(() => {
        const oldState = sessionStateRef.current;
        const keptSessions = oldState.sessions.filter((session) => {
            return session.isLocked;
        });
        const sessions =
            keptSessions.length > 0 ? keptSessions : [genNewAiChatSession()];
        const isActiveKept = sessions.some((session) => {
            return session.id === oldState.activeId;
        });
        const state = {
            sessions,
            activeId: isActiveKept ? oldState.activeId : sessions[0].id,
        };
        saveAiChatSessions(state);
        setSessionState(state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Choosing a site, from the card or from the head row. Whatever the tab
    // remembered belongs to the site it was on, so it goes with it.
    const handleChoosingProvider = useCallback(
        (providerKey: string) => {
            if (getAiChatProvider(providerKey) === null) {
                return;
            }
            updateSession(sessionStateRef.current.activeId, (session) => {
                if (session.providerKey === providerKey) {
                    return session;
                }
                return {
                    ...session,
                    providerKey,
                    pageTitle: '',
                    lastUrl: null,
                    lastUsedAt: Date.now(),
                };
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [updateSession],
    );
    // Only ever reached from the second press. What goes is what came FROM
    // the sites -- their pages and the names they gave them, which is the
    // previous person's conversation titles sitting in a settings file -- and
    // what stays is the name the user typed on a tab, which is theirs. Every
    // guest is then remounted, because a page already loaded goes on showing
    // a conversation whose cookie has just been thrown away.
    const handleSigningOut = useCallback(() => {
        setSignOutState('working');
        clearAiChatSiteData().then(
            () => {
                setSessionState((oldState) => {
                    return {
                        ...oldState,
                        sessions: oldState.sessions.map((session) => {
                            return { ...session, pageTitle: '', lastUrl: null };
                        }),
                    };
                });
                setGuestEpoch((epoch) => {
                    return epoch + 1;
                });
                setSignOutState('idle');
            },
            () => {
                setSignOutState('failed');
            },
        );
    }, []);
    const handleRegistering = useCallback(
        (sessionId: string, guest: AiChatGuestElementType | null) => {
            if (guest === null) {
                guestMapRef.current.delete(sessionId);
            } else {
                guestMapRef.current.set(sessionId, guest);
            }
        },
        [],
    );
    const handlePageTitle = useCallback(
        (sessionId: string, title: string) => {
            const pageTitle = toPageTitle(title);
            updateSession(sessionId, (session) => {
                return session.pageTitle === pageTitle
                    ? session
                    : { ...session, pageTitle };
            });
        },
        [updateSession],
    );
    const handleNavigated = useCallback(
        (sessionId: string, url: string) => {
            updateSession(sessionId, (session) => {
                const lastUrl = toKeptUrl(session.providerKey, url);
                return session.lastUrl === lastUrl
                    ? session
                    : { ...session, lastUrl };
            });
        },
        [updateSession],
    );
    const handleGoingBack = useCallback(() => {
        const guest = guestMapRef.current.get(sessionStateRef.current.activeId);
        try {
            if (guest?.canGoBack()) {
                guest.goBack();
            }
        } catch (_error) {
            // Not attached yet: there is nowhere to go back to.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleReloading = useCallback(() => {
        const guest = guestMapRef.current.get(sessionStateRef.current.activeId);
        try {
            guest?.reload();
        } catch (_error) {
            // Not attached yet: it is still loading its first page.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The same page in the user's own browser -- for the one thing a guest
    // in a box cannot do, such as a sign-in that insists on a popup. A plain
    // `window.open` from this window reaches the main process's popup
    // handler, which sends any http(s) address to the system browser.
    const handleOpeningOutside = useCallback(() => {
        const { activeId, sessions } = sessionStateRef.current;
        const session = sessions.find((one) => {
            return one.id === activeId;
        });
        const provider = getAiChatProvider(session?.providerKey);
        if (session === undefined || provider === null) {
            return;
        }
        const url =
            readGuestUrl(guestMapRef.current.get(activeId)) ||
            session.lastUrl ||
            provider.homeUrl;
        window.open(url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            id="app"
            data-bs-theme={theme}
            className="aichat-app"
            data-glassy={
                appProvider.systemUtils.isGlassCapable ? '' : undefined
            }
        >
            <RenderSessionTabsComp
                sessions={sessions}
                activeId={activeSession.id}
                genTitle={genAiChatSessionTitle}
                canAdd={checkCanAddChatSession(
                    sessions,
                    MAX_AI_CHAT_SESSION_COUNT,
                )}
                canClearAll={checkCanClearAiChatSessions(sessions)}
                onChoose={handleChoosingSession}
                onClose={handleClosingSession}
                onAdd={handleAddingSession}
                onRename={handleRenamingSession}
                onTogglingLock={handleTogglingSessionLock}
                onSolo={handleSoloingSession}
                onClearAll={handleClearingSessions}
            />
            {activeProvider === null ? null : (
                <header className="aichat-head">
                    <label className="aichat-caption" htmlFor="aichat-provider">
                        Chat with
                    </label>
                    <select
                        id="aichat-provider"
                        className="aichat-pick"
                        aria-label="Which AI chat"
                        value={activeProvider.key}
                        onChange={(event) => {
                            handleChoosingProvider(event.target.value);
                        }}
                    >
                        {AI_CHAT_PROVIDER_LIST.map((provider) => {
                            return (
                                <option key={provider.key} value={provider.key}>
                                    {provider.name}
                                </option>
                            );
                        })}
                    </select>
                    <button
                        type="button"
                        className="aichat-tool"
                        title="Back"
                        aria-label="Back"
                        onClick={handleGoingBack}
                    >
                        <i className="bi bi-arrow-left" />
                    </button>
                    <button
                        type="button"
                        className="aichat-tool"
                        title="Reload"
                        aria-label="Reload"
                        onClick={handleReloading}
                    >
                        <i className="bi bi-arrow-clockwise" />
                    </button>
                    <button
                        type="button"
                        className="aichat-tool"
                        title="Open in your browser"
                        aria-label="Open in your browser"
                        onClick={handleOpeningOutside}
                    >
                        <i className="bi bi-box-arrow-up-right" />
                    </button>
                    {/*
                     * Here as well as on the chooser card because the card is
                     * behind a new tab, and a window with all eight tabs on a
                     * site cannot open one. A press only ASKS.
                     */}
                    <button
                        type="button"
                        className="aichat-tool"
                        title="Sign out of every site"
                        aria-label="Sign out of every site"
                        onClick={() => {
                            setSignOutState('asking');
                        }}
                    >
                        <i className="bi bi-box-arrow-left" />
                    </button>
                </header>
            )}
            {signOutState === 'idle' ? null : (
                // The tab strip's own idiom, on a line of its own and never
                // done on the first press: a sign-in is not this window's to
                // spend, and on a shared computer it is the one thing here
                // somebody may badly need gone.
                <div
                    className="chat-clear-confirm"
                    role="alertdialog"
                    aria-label="Sign out of every site"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setSignOutState('idle');
                        }
                    }}
                >
                    <span className="chat-clear-ask">
                        {signOutState === 'failed'
                            ? 'Signing out did not finish, so nothing was ' +
                              'changed. Try again.'
                            : 'Sign out of every site in this window? The ' +
                              'tabs stay, but the pages they were on are ' +
                              'forgotten and every site will ask you to sign ' +
                              'in again. This cannot be undone.'}
                    </span>
                    <button
                        type="button"
                        className="chat-clear-no"
                        autoFocus
                        onClick={() => {
                            setSignOutState('idle');
                        }}
                    >
                        {signOutState === 'failed'
                            ? 'Close'
                            : 'Keep me signed in'}
                    </button>
                    {signOutState === 'failed' ? null : (
                        <button
                            type="button"
                            className="chat-clear-yes"
                            disabled={signOutState === 'working'}
                            onClick={handleSigningOut}
                        >
                            {signOutState === 'working'
                                ? 'Signing out…'
                                : 'Sign out'}
                        </button>
                    )}
                </div>
            )}
            <div className="aichat-stage">
                {activeProvider === null ? (
                    <RenderChooserComp
                        onChoose={handleChoosingProvider}
                        onSignOut={() => {
                            setSignOutState('asking');
                        }}
                    />
                ) : null}
                {sessions.map((session) => {
                    const provider = getAiChatProvider(session.providerKey);
                    if (provider === null || !liveIds.has(session.id)) {
                        return null;
                    }
                    return (
                        <RenderGuestComp
                            key={`${session.id}:${provider.key}:${guestEpoch}`}
                            session={session}
                            provider={provider}
                            isOn={session.id === activeSession.id}
                            onRegister={handleRegistering}
                            onPageTitle={handlePageTitle}
                            onNavigated={handleNavigated}
                        />
                    );
                })}
            </div>
        </div>
    );
}
