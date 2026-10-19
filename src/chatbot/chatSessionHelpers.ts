// The help window's tabs, and the file they live in.
//
// One conversation is not enough for the way this window gets used. A
// volunteer looks something up while the band is still setting up, comes back
// during the service with a different question, and the answer they want is
// the one from twenty minutes ago -- so the window carries several
// conversations at once, the way a browser carries tabs, and every one of them
// is written to disk. Closing the window is not the same as throwing the
// answers away.
//
// It is all ONE setting file, kept small on purpose: this app runs on machines
// that have nothing to spare, and `appLocalStorage.setItem` is a synchronous
// write. So the strip is capped, the history inside each tab is capped, and
// the caller saves on a debounce rather than on every keystroke.

import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    MAX_ATTACHMENT_COUNT,
    type ChatAttachmentType,
} from './attachmentHelpers';
import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';
// A VALUE import, unlike the provider union below: `botFocus.mjs` is a list of
// plain objects with no imports of its own, so it costs this startup path
// nothing -- and a hand-kept copy of eight window keys is exactly the drift
// this module already learned to avoid once.
import { toBotFocus } from '../../tools/owa-devtools-mcp/botFocus.mjs';

import type { BotActionType } from './helpBotHelpers';
import type { LlmProviderType } from './llmBotHelpers';
import {
    checkIsUsableShowControlName,
    parseAnswerFrames,
    type AttachRequestType,
    type ShowRefType,
} from './quickReplyHelpers';
// A value import, like `botFocus.mjs` above, and safe for the same reason:
// the usage module imports nothing but a type of its own and the leaf
// `chatTranHelpers`, so it costs the mount path arithmetic and a price table.
import { toValidUsage, type ChatUsageType } from './usageHelpers';
// Value imports with no imports of their own, like the two above.
import { toOpenableLinks } from './chatLinkHelpers';
import { fillWords, tran } from './chatTranHelpers';
// A leaf too: its validator and the request's own, nothing else.
import {
    toValidLookupSubject,
    type LookupSubjectType,
} from './lookupChatHelpers';
import {
    toValidLookupAsk,
    type LookupAskType,
} from '../helper/ai/lookupAskHelpers';
import {
    REPORT_NOTE,
    REPORT_SEND_TOOL_NAME,
    REPORT_START_TOOL_NAME,
    REPORT_STILL_TOOL_NAME,
} from './reportMarks';

/**
 * A type-only import of the union above, deliberately: this module is read at
 * mount, before anything asks a model, and a VALUE import of the provider list
 * would drag both SDKs and the MCP client into that path.
 *
 * This map is what keeps that cheap and still honest -- a provider added to the
 * union and not listed here is a compile error, not a tab that silently forgets
 * who it was asking. It is not cosmetic: an unrecognised name here becomes
 * `null`, and the window then rewrites the tab to its own default, so a tab
 * deliberately parked on a cheap model comes back on an expensive one with
 * nothing on screen saying it moved.
 */
const PROVIDER_KEY_MAP: Record<LlmProviderType, true> = {
    anthropic: true,
    openai: true,
    kimi: true,
    bedrock: true,
    custom: true,
    free: true,
};

export type ChatMessageType = {
    id: number;
    author: 'you' | 'bot';
    text: string;
    // Shown above the answer, small and quiet: why this answer came from
    // somewhere other than where the user asked it to.
    note?: string;
    actions?: BotActionType[];
    // The things the user can press instead of typing their next message.
    // Stored rather than derived on the fly because the best of them were
    // WRITTEN by the model that wrote the answer -- reopening the window
    // cannot re-derive those, and re-deriving the rest per render would spend
    // the same work on every message to show it on one.
    replies?: string[];
    // What was attached to this question -- the DESCRIPTION of it, never the
    // bytes. `attachmentHelpers` holds the picture for the life of the window
    // and this file must never learn about it: a settings blob that is read
    // whole and synchronously at startup cannot carry a screenshot.
    attachments?: ChatAttachmentType[];
    // What the assistant asked to be SHOWN, as buttons that attach it.
    attachRequests?: AttachRequestType[];
    // ...and what it offers to show the user in return.
    shows?: ShowRefType[];
    // The web addresses in the text that are drawn as links, pressed open in
    // the browser. Only ones the APP wrote (`chatLinkHelpers`): a model's
    // words stay words, whatever a page it read told it to say.
    links?: string[];
    // What this answer cost: the model rounds it took and the tokens they
    // used, with the list-price estimate worked out from them. On the answer
    // rather than derived later, because the tab's total below survives the
    // message cap and the per-answer figure has to be read off the answer.
    usage?: ChatUsageType;
    // Which assistant and model the rounds of this answer went to, in the
    // pickers' own words ("Free", "Nemotron Super"): the cost line names the
    // model and its hover both (the user's ask, 2026-10-16, with "free"
    // circled under an answer -- free said nothing of WHO). The last round's,
    // when a stand-in or Auto asked more than one.
    answeredBy?: { assistant: string; model: string };
    // A question that went to the assistant as a GENERAL one (`/btw`, or a
    // follow-up under one -- `readInheritedGeneralQuestion`), so the next
    // plain question in the tab stays general too. On the question, because
    // the transcript keeps the words as typed and a follow-up carries no
    // `/btw` of its own to read it off.
    isGeneral?: true;
    // An answer of a verse-finding conversation (`verseFindChatHelpers.ts`):
    // the Bible it searches, so the next plain line typed under it is more
    // of the same search. On the ANSWER, because the question that asked it
    // was a press of a button as often as words.
    verseFind?: string;
    // The opening card of a conversation about what a Lookup Detail panel
    // shows (`lookupChatHelpers.ts`): which person, place or passage, and
    // what `owa_lookup_record` read of it -- once, on the card, never on
    // every answer under it.
    lookup?: LookupSubjectType;
    // An answer of that conversation, so the next plain line under it is
    // asked about the same record.
    isLookupAnswer?: true;
    // An answer of a conversation about the Bible Reader's own material
    // (`bibleReaderChatHelpers.ts`), so the next plain line under it
    // ("and chapter 5?") stays in it.
    isBibleReaderAnswer?: true;
    // An answer that asked which passage to open (**Open another passage**):
    // the record it was asked from, so the line typed under it is read as
    // that passage, in its Bible.
    lookupAwaits?: LookupAskType;
    // The thumb the person pressed under this answer (`answerRatingHelpers`).
    // On the answer, so a reopened tab still shows which ones helped.
    rating?: 'like' | 'dislike';
    // This answer has had its follow-up: a thumb taken off and put down again
    // must not ask "what was wrong?" a second time.
    isFollowedUp?: true;
    // The window's own follow-up to a thumb down -- not an answer: it carries
    // no thumbs, and a complaint typed under it is about the answer above.
    isFollowUp?: true;
};

export type ChatSessionType = {
    id: string;
    // A name the user typed. Empty means "call it after the first question",
    // which is right until the day there are four tabs and three of them start
    // "how do I" -- then they name them.
    title: string;
    messages: ChatMessageType[];
    // What is typed but not yet asked. A tab that loses the half-written
    // question when the user checks the other tab is a tab they stop using.
    draft: string;
    // Everything the head of the window shows belongs to the tab, not to the
    // window: which half of the app the answers are about, who answers, and
    // which of that provider's models. Switching to last Sunday's tab brings
    // back the conversation AND what it was being held with -- one tab asking
    // Claude about the presenter while the next asks a cheap model about the
    // reader is the point of having tabs at all.
    focus: BotFocusType;
    isFocusChosen: boolean;
    provider: LlmProviderType | null;
    model: string;
    // The tab is on **Auto** (`autoAssistantHelpers`): the window settles
    // who is asked in front of every question. `provider` and `model` then
    // hold whoever was asked LAST -- a guess until the first question -- so
    // everything that reads them has something to read, and `autoPick` is
    // that assistant in words, set only once a question has been put to it.
    isAuto?: true;
    autoPick?: string;
    // "Do not throw this one away." A locked tab has no close button, and it
    // is the one thing the two sweeping actions -- close the others, clear
    // them all -- step around. It exists because those two actions exist: the
    // answer someone wants kept is exactly the one that was worth opening a
    // second tab to keep, and a strip of twelve is cleared by someone in a
    // hurry.
    isLocked: boolean;
    // What the whole conversation has cost so far, every round of every
    // question folded in as it landed -- including the rounds of a question
    // that was stopped or failed, which no message carries. Kept on the tab
    // rather than summed off its messages because the messages are capped
    // at sixty and the credit spent on the sixty-first is still spent.
    usage?: ChatUsageType;
    // The file the tab was asking about was CLOSED (its × above the box) at
    // this message: the files of a question at or before it are no longer
    // sent with the next one (`findOpenFileAttachments`). A file attached
    // after it is open again.
    fileClosedAt?: number;
    // The record the tab was asking about was put away (its × on the
    // **Still asking about** line) at this message (`findOpenLookupSubject`).
    lookupClosedAt?: number;
};

export type ChatSessionStateType = {
    sessions: ChatSessionType[];
    activeId: string;
};

const SESSIONS_SETTING_NAME = 'chatbot-sessions';
// The caps, in the order they bite. A strip past a dozen tabs cannot be read
// anyway, and nobody reopens this window for the sixtieth-last answer -- but a
// JSON blob nobody trims is exactly how a settings file reaches megabytes on a
// machine that cannot spare them.
export const MAX_SESSION_COUNT = 12;
const MAX_MESSAGE_COUNT = 60;
const MAX_TITLE_LENGTH = 26;
// Three buttons on one message. Re-applied on READ as well as on write: this
// file is plain JSON on disk and a hand-edited one must not be able to draw
// forty buttons into a 460px window. The length is a guard against absurd
// data, not a layout rule -- a follow-up drawn from the question corpus is a
// whole question ("A panel has disappeared - how do I get it back?") and
// cutting one in half would be worse than showing it wrapped.
const MAX_REPLY_COUNT = 3;
const MAX_REPLY_LENGTH = 120;
// "LM Studio super-computer · Gemma 4 12B": a server's name and a model's,
// both of which are capped where they are typed. A guard, like the reply's.
const MAX_AUTO_PICK_LENGTH = 160;
// A typed name may be longer than a derived one -- the user chose it -- but
// not without end: it is stored in the same file and drawn in the same strip.
const MAX_TYPED_TITLE_LENGTH = 40;

// A window mints many ids inside one millisecond (a burst of new tabs, a
// restore), and four random base-36 characters alone collide there about one
// time in fourteen per 500 ids. The sequence makes ids from one window unique;
// the stamp and the salt keep them apart across windows and restarts.
let sessionIdSequence = 0;
export function genSessionId() {
    sessionIdSequence += 1;
    const stamp = Date.now().toString(36);
    const salt = Math.random().toString(36).slice(2, 6);
    return `s${stamp}${sessionIdSequence.toString(36)}-${salt}`;
}

export function genNewChatSession(
    focus: BotFocusType,
    provider: LlmProviderType | null,
    model: string,
    isFocusChosen = false,
    isAuto = false,
): ChatSessionType {
    return {
        id: genSessionId(),
        title: '',
        messages: [],
        draft: '',
        focus,
        isFocusChosen,
        provider,
        model,
        ...(isAuto ? { isAuto: true as const } : {}),
        isLocked: false,
    };
}

/**
 * Put the tab in front on the window that launched the assistant. A choice the
 * user makes afterwards stays with that tab until the next launch; restored
 * tabs are the important case here, because opening from the Presenter must
 * not leave the visible picker saying Bible Reader just because that was the
 * last page this conversation used. Other tabs still own their own focus.
 */
export function applyChatLaunchFocus(
    state: ChatSessionStateType,
    openerFocus: BotFocusType | null,
): ChatSessionStateType {
    if (openerFocus === null) {
        return state;
    }
    const activeSession = state.sessions.find((session) => {
        return session.id === state.activeId;
    });
    if (
        activeSession === undefined ||
        (activeSession.focus === openerFocus && !activeSession.isFocusChosen)
    ) {
        return state;
    }
    return {
        ...state,
        sessions: state.sessions.map((session) => {
            return session.id === state.activeId
                ? {
                      ...session,
                      focus: openerFocus,
                      isFocusChosen: false,
                  }
                : session;
        }),
    };
}

/** Trims a typed tab name to something the strip can hold. */
export function toChatSessionTitle(text: string) {
    return text.trim().replace(/\s+/g, ' ').slice(0, MAX_TYPED_TITLE_LENGTH);
}

/**
 * The name the user gave this tab, or -- until they give it one -- the
 * question that started it, which is the only other name for it they wrote
 * themselves and the one they will recognise.
 */
export function genChatSessionTitle(session: ChatSessionType) {
    if (session.title.length > 0) {
        return session.title;
    }
    // A tab a Lookup Detail panel's 🤖 opened is called by what it is about
    // -- the person, the place, the passage -- not by the first question.
    const lookupTitle = session.messages[0]?.lookup?.title;
    if (lookupTitle !== undefined) {
        return lookupTitle.length <= MAX_TITLE_LENGTH
            ? lookupTitle
            : lookupTitle.slice(0, MAX_TITLE_LENGTH - 1) + '…';
    }
    // A tab a problem is being reported in says so before anything else
    // (2026-10-13, the user's ask with the strip circled: _I don't see title
    // start with `Report:`_): it is the one tab whose words go to the people
    // who maintain the app, and among a dozen it has to be findable.
    const reportStart = session.messages.findIndex(checkIsReportMessage);
    const isReport = reportStart !== -1;
    const firstAsked = session.messages
        .slice(isReport ? reportStart : 0)
        .find((message) => {
            return message.author === 'you';
        });
    // Drawn, never compared: a title is worked out afresh at every render,
    // so it is in the window's language. `Report: ` is `REPORT_TITLE_PREFIX`.
    if (firstAsked === undefined) {
        return isReport ? tran('Report: new') : tran('New chat');
    }
    const asked = firstAsked.text.trim().replace(/\s+/g, ' ');
    const text = isReport
        ? fillWords(tran('Report: {words}'), { words: asked })
        : asked;
    if (text.length <= MAX_TITLE_LENGTH) {
        return text;
    }
    return text.slice(0, MAX_TITLE_LENGTH - 1) + '…';
}

/**
 * Whether a message belongs to a problem report: what the person added to
 * one, the card that offers one, or the write-up waiting on Send.
 */
function checkIsReportMessage(message: ChatMessageType) {
    return (
        message.note === REPORT_NOTE ||
        message.actions?.some((action) => {
            return (
                action.toolName === REPORT_START_TOOL_NAME ||
                action.toolName === REPORT_STILL_TOOL_NAME ||
                action.toolName === REPORT_SEND_TOOL_NAME
            );
        }) === true
    );
}

/**
 * Whether the strip has room for one more. Structural, like the two below:
 * the AI Chat window runs the same strip over its own tabs and its own cap.
 */
export function checkCanAddChatSession(
    sessions: readonly unknown[],
    maxCount = MAX_SESSION_COUNT,
) {
    return sessions.length < maxCount;
}

/** The tabs a sweeping action is allowed to take. Locked ones are not. */
export function toClearableChatSessions<T extends { isLocked: boolean }>(
    sessions: T[],
) {
    return sessions.filter((session) => {
        return !session.isLocked;
    });
}

/**
 * Whether throwing the unlocked conversations away would change anything. One
 * empty, unnamed tab is exactly what clearing LEAVES BEHIND, so offering it
 * then is offering to do nothing -- and an offer to do nothing, sitting in the
 * menu, is one more line to read on a window that is already asking enough. A
 * half-typed question does not count: the item appearing while someone is
 * still typing is the same noise, one keystroke later.
 */
export function checkCanClearChatSessions(sessions: ChatSessionType[]) {
    return sessions.some((session) => {
        return (
            !session.isLocked &&
            (sessions.length > 1 ||
                session.messages.length > 0 ||
                session.title.length > 0)
        );
    });
}

/**
 * Whether "close the other chats" has anything to close. A strip of locked
 * tabs and this one is already soloed, whatever the count says.
 */
export function checkCanSoloChatSession<
    T extends { id: string; isLocked: boolean },
>(sessions: T[], sessionId: string) {
    return sessions.some((session) => {
        return session.id !== sessionId && !session.isLocked;
    });
}

function toValidReplies(raw: any) {
    if (!Array.isArray(raw)) {
        return {};
    }
    const replies = raw
        .filter((reply: any) => {
            return typeof reply === 'string' && reply.trim().length > 0;
        })
        .slice(0, MAX_REPLY_COUNT)
        .map((reply: string) => {
            return reply.trim().slice(0, MAX_REPLY_LENGTH);
        });
    return replies.length > 0 ? { replies } : {};
}

// The fields an attachment is ALLOWED to have on the way back off disk, listed
// rather than spread. That is the whole guard: this file is plain JSON a user
// can edit, and copying `...raw` would let a hand-written `dataUrl` back into
// the store that the rest of this design exists to keep pictures out of. An
// unknown field is dropped in silence -- there is nothing to tell anyone.
function toValidAttachments(raw: any) {
    if (!Array.isArray(raw)) {
        return {};
    }
    const attachments = raw
        .filter((one: any) => {
            return (
                typeof one?.id === 'string' &&
                typeof one?.name === 'string' &&
                (one.kind === 'image' ||
                    one.kind === 'text' ||
                    one.kind === 'element' ||
                    one.kind === 'file')
            );
        })
        .slice(0, MAX_ATTACHMENT_COUNT)
        .map((one: any): ChatAttachmentType => {
            return {
                id: one.id,
                kind: one.kind,
                name: String(one.name).slice(0, MAX_TITLE_LENGTH * 4),
                mimeType:
                    typeof one.mimeType === 'string'
                        ? one.mimeType
                        : 'text/plain',
                byteSize: typeof one.byteSize === 'number' ? one.byteSize : 0,
                ...(typeof one.selector === 'string'
                    ? { selector: one.selector }
                    : {}),
                ...(typeof one.filePath === 'string'
                    ? { filePath: one.filePath }
                    : {}),
                ...(typeof one.summary === 'string'
                    ? { summary: one.summary }
                    : {}),
                // The number on its chip, which the words beside it may
                // name: kept, or "in 2" stops meaning anything on reopening.
                ...(Number.isInteger(one.number) &&
                one.number > 0 &&
                one.number < 100000
                    ? { number: one.number }
                    : {}),
                ...toValidAttachmentWindow(one.window),
                // A PDF's page count, which says how many of its pages the
                // model was NOT shown.
                ...(one.kind === 'file' &&
                Number.isInteger(one.pageCount) &&
                one.pageCount > 0 &&
                one.pageCount < 1000000
                    ? { pageCount: one.pageCount }
                    : {}),
            };
        });
    return attachments.length > 0 ? { attachments } : {};
}

// Which window a picture or a pointed-at control came from
// (`AttachmentWindowType`): four short fields, listed like the rest.
function toValidAttachmentWindow(raw: any) {
    if (
        typeof raw?.id !== 'string' ||
        typeof raw.page !== 'string' ||
        typeof raw.label !== 'string' ||
        typeof raw.isMain !== 'boolean'
    ) {
        return {};
    }
    return {
        window: {
            id: raw.id.slice(0, 64),
            page: raw.page.slice(0, 200),
            label: raw.label.slice(0, 80),
            isMain: raw.isMain,
        },
    };
}

// The one guard on a stored total, shared by the answer and the tab: every
// field a finite number or the total is dropped, and an empty one is not
// written back either.
function toValidUsageField(raw: unknown) {
    const usage = toValidUsage(raw);
    return usage === null ? {} : { usage };
}

// A stored link opens a page at a press, so only web addresses, only on an
// answer, and only a few: a hand-edited file must not make anything else one.
function toValidLinksField(raw: any) {
    const links = raw.author === 'bot' ? toOpenableLinks(raw.links) : [];
    return links.length > 0 ? { links } : {};
}

// Old conversations are data, not trusted UI. Earlier model answers could
// persist their private OPTIONS / NEEDS / SHOWS frames before the parser grew
// strict enough to remove every malformed variant. Clean bot text again while
// loading so fixing the assistant also fixes the dead chips and raw machinery
// already visible in a senior user's saved conversation.
function toCleanStoredBotText(text: string) {
    return parseAnswerFrames(text).text;
}

// The record a conversation is about goes back into a tool call and into a
// model's ask, so only on an answer and only its listed fields, each checked.
function toValidLookupField(raw: any) {
    if (raw.author !== 'bot' || raw.lookup === undefined) {
        return {};
    }
    const lookup = toValidLookupSubject(raw.lookup);
    return lookup === null ? {} : { lookup };
}

function toValidLookupAwaitsField(raw: any) {
    if (raw.author !== 'bot' || raw.lookupAwaits === undefined) {
        return {};
    }
    const lookupAwaits = toValidLookupAsk(raw.lookupAwaits);
    return lookupAwaits === null ? {} : { lookupAwaits };
}

function toValidMessage(raw: any): ChatMessageType | null {
    if (
        typeof raw?.text !== 'string' ||
        (raw.author !== 'you' && raw.author !== 'bot')
    ) {
        return null;
    }
    return {
        id: typeof raw.id === 'number' ? raw.id : 0,
        author: raw.author,
        text: raw.author === 'bot' ? toCleanStoredBotText(raw.text) : raw.text,
        ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
        ...(raw.author === 'you' && raw.isGeneral === true
            ? { isGeneral: true as const }
            : {}),
        ...(raw.author === 'bot' &&
        typeof raw.answeredBy?.assistant === 'string' &&
        typeof raw.answeredBy?.model === 'string'
            ? {
                  answeredBy: {
                      assistant: raw.answeredBy.assistant.slice(0, 80),
                      model: raw.answeredBy.model.slice(0, 80),
                  },
              }
            : {}),
        // A Bible's short name, nothing longer: it goes back into a tool
        // call as the Bible to search.
        ...(raw.author === 'bot' &&
        typeof raw.verseFind === 'string' &&
        /^[^\s"“”]{1,24}$/u.test(raw.verseFind)
            ? { verseFind: raw.verseFind }
            : {}),
        ...toValidLookupField(raw),
        ...(raw.author === 'bot' && raw.isLookupAnswer === true
            ? { isLookupAnswer: true as const }
            : {}),
        ...(raw.author === 'bot' && raw.isBibleReaderAnswer === true
            ? { isBibleReaderAnswer: true as const }
            : {}),
        ...toValidLookupAwaitsField(raw),
        ...(raw.author === 'bot' &&
        (raw.rating === 'like' || raw.rating === 'dislike')
            ? { rating: raw.rating as 'like' | 'dislike' }
            : {}),
        ...(raw.author === 'bot' && raw.isFollowedUp === true
            ? { isFollowedUp: true as const }
            : {}),
        ...(raw.author === 'bot' && raw.isFollowUp === true
            ? { isFollowUp: true as const }
            : {}),
        ...(Array.isArray(raw.actions) ? { actions: raw.actions } : {}),
        ...toValidReplies(raw.replies),
        ...toValidAttachments(raw.attachments),
        ...toValidUsageField(raw.usage),
        ...toValidLinksField(raw),
        ...(Array.isArray(raw.shows)
            ? {
                  shows: raw.shows
                      .filter((one: any) => {
                          return (
                              typeof one?.value === 'string' &&
                              typeof one?.name === 'string' &&
                              (one.kind === 'control' ||
                                  one.kind === 'selector' ||
                                  one.kind === 'file') &&
                              (one.kind !== 'control' ||
                                  (checkIsUsableShowControlName(one.value) &&
                                      checkIsUsableShowControlName(one.name)))
                          );
                      })
                      .slice(0, MAX_ATTACHMENT_COUNT)
                      .map((one: any): ShowRefType => {
                          return {
                              kind: one.kind,
                              value: one.value,
                              name: one.name,
                          };
                      }),
              }
            : {}),
        ...(Array.isArray(raw.attachRequests)
            ? {
                  attachRequests: raw.attachRequests.filter((one: any) => {
                      return (
                          one === 'screenshot' ||
                          one === 'element' ||
                          one === 'file'
                      );
                  }),
              }
            : {}),
    };
}

function toValidSession(raw: any): ChatSessionType | null {
    if (typeof raw?.id !== 'string' || !Array.isArray(raw.messages)) {
        return null;
    }
    return {
        id: raw.id,
        title:
            typeof raw.title === 'string' ? toChatSessionTitle(raw.title) : '',
        messages: raw.messages
            .map(toValidMessage)
            .filter((message: ChatMessageType | null) => {
                return message !== null;
            })
            .slice(-MAX_MESSAGE_COUNT),
        draft: typeof raw.draft === 'string' ? raw.draft : '',
        focus: toBotFocus(raw.focus),
        isFocusChosen: raw.isFocusChosen === true,
        // Checked against the keys that are actually set by the caller, which
        // is the only place that knows: a key removed in Settings must not
        // leave a tab pointing at a provider that can only fail.
        provider:
            typeof raw.provider === 'string' &&
            Object.hasOwn(PROVIDER_KEY_MAP, raw.provider)
                ? raw.provider
                : null,
        model: typeof raw.model === 'string' ? raw.model : '',
        // The words of the last pick only beside the flag they belong to:
        // a tab taken off Auto must not come back naming an assistant it
        // is not asking.
        ...(raw.isAuto === true
            ? {
                  isAuto: true as const,
                  ...(typeof raw.autoPick === 'string' &&
                  raw.autoPick.trim().length > 0
                      ? {
                            autoPick: raw.autoPick
                                .trim()
                                .slice(0, MAX_AUTO_PICK_LENGTH),
                        }
                      : {}),
              }
            : {}),
        isLocked: raw.isLocked === true,
        ...toValidUsageField(raw.usage),
        ...(Number.isInteger(raw.fileClosedAt)
            ? { fileClosedAt: raw.fileClosedAt }
            : {}),
        ...(Number.isInteger(raw.lookupClosedAt)
            ? { lookupClosedAt: raw.lookupClosedAt }
            : {}),
    };
}

/**
 * What was on screen last time, or one empty tab. Read once, at mount: the
 * file is only ever written by this window.
 */
export function loadChatSessions(
    focus: BotFocusType,
    provider: LlmProviderType | null,
    model: string,
    isAuto = false,
): ChatSessionStateType {
    const stored = getSetting(SESSIONS_SETTING_NAME);
    let sessions: ChatSessionType[] = [];
    let activeId = '';
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            sessions = (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
                .map(toValidSession)
                .filter((session: ChatSessionType | null) => {
                    return session !== null;
                })
                .slice(-MAX_SESSION_COUNT);
            activeId =
                typeof parsed?.activeId === 'string' ? parsed.activeId : '';
        } catch (_error) {
            // A half-written or hand-edited file is not worth a message to
            // someone about to start a service: they get a fresh, empty tab.
            sessions = [];
        }
    }
    if (sessions.length === 0) {
        sessions = [genNewChatSession(focus, provider, model, false, isAuto)];
    }
    const isActiveIdKnown = sessions.some((session) => {
        return session.id === activeId;
    });
    return {
        sessions,
        activeId: isActiveIdKnown ? activeId : sessions[0].id,
    };
}

export function saveChatSessions(state: ChatSessionStateType) {
    const sessions = state.sessions.slice(-MAX_SESSION_COUNT).map((session) => {
        return {
            ...session,
            messages: session.messages.slice(-MAX_MESSAGE_COUNT),
        };
    });
    setSetting(
        SESSIONS_SETTING_NAME,
        JSON.stringify({ sessions, activeId: state.activeId }),
    );
}
