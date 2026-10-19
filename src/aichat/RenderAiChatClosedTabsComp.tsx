import { getAiChatProvider, toAiChatHostLabel } from './aiChatProviders';
import type { AiChatClosedTabType } from './aiChatSessionHelpers';
import { fillWords, tran } from '../chatbot/chatTranHelpers';

function genClosedTabTitle(closedTab: AiChatClosedTabType) {
    return (
        closedTab.title ||
        closedTab.pageTitle ||
        getAiChatProvider(closedTab.providerKey)?.name ||
        tran('Chat')
    );
}

// "3 min ago", "yesterday" -- enough to tell this morning's tab from last
// week's, which is the only question the time answers here.
function genClosedAgoText(closedAt: number, now: number) {
    const minutes = Math.floor((now - closedAt) / 60_000);
    if (closedAt <= 0) {
        return '';
    }
    if (minutes < 1) {
        return tran('just now');
    }
    if (minutes < 60) {
        return fillWords(tran('{count} min ago'), { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return fillWords(tran('{count} h ago'), { count: hours });
    }
    const days = Math.floor(hours / 24);
    return days === 1
        ? tran('yesterday')
        : fillWords(tran('{count} days ago'), { count: days });
}

/**
 * The tabs closed lately, in every AI Chat window, newest first -- pressed to
 * open one again at the conversation it was on. Drawn on the chooser card
 * and in the panel behind the head row's clock.
 */
export default function RenderAiChatClosedTabsComp({
    closedTabs,
    canReopen,
    onReopen,
    onForget,
}: Readonly<{
    closedTabs: AiChatClosedTabType[];
    canReopen: boolean;
    onReopen: (id: string) => void;
    onForget: () => void;
}>) {
    if (closedTabs.length === 0) {
        return (
            <p className="aichat-closed-empty">
                {tran(
                    'Tabs you close show up here, so you can open them again.',
                )}
            </p>
        );
    }
    const now = Date.now();
    return (
        <div className="aichat-closed">
            <ul
                className="aichat-closed-list"
                aria-label={tran('Recently closed tabs')}
            >
                {closedTabs.map((closedTab) => {
                    const provider = getAiChatProvider(closedTab.providerKey);
                    const title = genClosedTabTitle(closedTab);
                    return (
                        <li key={closedTab.id}>
                            <button
                                type="button"
                                className="aichat-closed-item"
                                disabled={!canReopen}
                                title={
                                    canReopen
                                        ? fillWords(
                                              tran('Open “{title}” again'),
                                              { title },
                                          )
                                        : tran(
                                              'Close a tab before opening another',
                                          )
                                }
                                onClick={() => {
                                    onReopen(closedTab.id);
                                }}
                            >
                                {provider === null ? null : (
                                    <span
                                        className="aichat-badge"
                                        aria-hidden="true"
                                        style={{
                                            backgroundColor:
                                                provider.badgeColor,
                                        }}
                                    >
                                        {provider.badgeLetter}
                                    </span>
                                )}
                                <span className="aichat-closed-name">
                                    {title}
                                </span>
                                <span className="aichat-closed-meta">
                                    {[
                                        provider === null
                                            ? ''
                                            : toAiChatHostLabel(
                                                  provider.homeUrl,
                                              ),
                                        genClosedAgoText(
                                            closedTab.closedAt,
                                            now,
                                        ),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <button
                type="button"
                className="aichat-link-button aichat-closed-forget"
                onClick={onForget}
            >
                {tran('Clear this list')}
            </button>
        </div>
    );
}
