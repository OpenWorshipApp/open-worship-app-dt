import './ChatbotAppComp.scss';

import type { ReactNode } from 'react';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { captureAppWindow } from '../helper/appCaptureHelpers';
import { openPopupWindow } from '../helper/domHelpers';
import { handleError } from '../helper/errorHelpers';
import { setSetting } from '../helper/settingHelpers';
import { findContactEmail, showFileOrDirExplorer } from '../server/appHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useThemeSource } from '../others/themeHelpers';
import appProvider from '../server/appProvider';
import {
    MAX_ATTACHMENT_COUNT,
    checkIsImageName,
    checkIsReadableTextFile,
    copyImageToClipboard,
    dropAttachmentData,
    genElementAttachment,
    genImageAttachment,
    genTextAttachment,
    getAttachmentData,
    toAskedOfModel,
    toAttachmentNote,
    toBotImages,
    type ChatAttachmentType,
} from './attachmentHelpers';
import { checkIsCancelError } from './cancelHelpers';
import {
    checkIsAssetAttachment,
    downloadAsset,
    readAssetPreview,
    toReadableSize,
    type ChatAssetPreviewType,
} from './assetPreviewHelpers';
import RenderSessionTabsComp from './RenderSessionTabsComp';
import {
    REPORT_COPY_EMAIL_TOOL_NAME,
    REPORT_COPY_IMAGE_TOOL_NAME,
    REPORT_COPY_SUBJECT_TOOL_NAME,
    REPORT_COPY_TOOL_NAME,
    REPORT_EMAIL_TOOL_NAME,
    REPORT_SEND_TOOL_NAME,
    collectReportEvidence,
    describeContactSource,
    describeHowToSend,
    genPreparedReport,
    genReportFollowUpActions,
    genReportInvestigation,
    genReportMailtoUrl,
    keepPreparedReport,
    postIssueReport,
    readReportImageDataUrl,
    readReportMarkdown,
    takePreparedReport,
    toSavedReportSubject,
} from './reportHelpers';
import {
    checkCanAddChatSession,
    checkCanClearChatSessions,
    genChatSessionTitle,
    genNewChatSession,
    loadChatSessions,
    saveChatSessions,
    toChatSessionTitle,
    type ChatMessageType,
    type ChatSessionStateType,
    type ChatSessionType,
} from './chatSessionHelpers';
import {
    loadAskHistory,
    saveAskHistory,
    toAskHistoryAdded,
    toAskHistoryIndex,
    NO_ASK_HISTORY_INDEX,
} from './askHistoryHelpers';
import {
    pickChatTip,
    stepChatTip,
    takeChatTip,
    type ChatTipType,
} from './tipHelpers';
import {
    clearProgressSteps,
    getProgressState,
    pushProgressStep,
    subscribeProgress,
    type ProgressStateType,
} from './progressHelpers';
import {
    askHelpBot,
    describeActionError,
    detectOpenerFocus,
    runBotAction,
    BOT_FOCUS_LIST,
    DEFAULT_BOT_FOCUS,
    type BotActionType,
    type BotAnswerType,
    type BotFocusType,
    type ChatTurnType,
} from './helpBotHelpers';
import {
    askLlmBot,
    checkCanSeeImages,
    checkIsFreeProvider,
    getLlmProviderWarning,
    getLlmProviderWarningLinks,
    getFirstImageCapableModel,
    genGuideRescueQuestion,
    genGuideRescueSummary,
    genLlmModelTitle,
    getAvailableLlmProviders,
    getLlmModel,
    getLlmModelList,
    getLlmProvider,
    listAllLlmModels,
    setLlmModel,
    setLlmProvider,
    toGuideRescueAnswer,
    LLM_PROVIDER_LIST,
    type GuideHelpRequestType,
    type LlmModelType,
    type LlmBotAnswerType,
    type LlmProviderType,
    toUsableLlmModel,
} from './llmBotHelpers';
import {
    callTool,
    checkIsToolHostError,
    getAiEndpoints,
    parseToolJson,
} from './mcpClient';
import {
    DRAFT_GONE_TEXT,
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    takeDraftedLyric,
} from './lyricDraftHelpers';
import {
    genMessageReplies,
    type AttachRequestType,
    type ShowRefType,
} from './quickReplyHelpers';
import {
    addRoundUsage,
    describeUsageBriefly,
    describeUsageInFull,
    type ChatUsageType,
    type LlmRoundUsageType,
} from './usageHelpers';
import {
    SPEND_ALLOW_LABEL,
    SPEND_ALLOW_TOOL_NAME,
    SPEND_LIMIT_CHOICE_LIST,
    allowMoreSpending,
    checkIsSpendLimitError,
    describeSpendGuard,
    describeSpendState,
    getLastSpendState,
    parseSpendLimitValue,
    setSpendLimitUsd,
    subscribeSpendGuard,
    takeNearLimitNotice,
    toSpendLimitLabel,
    toSpendLimitValue,
    type SpendStateType,
} from './spendGuardHelpers';
import {
    OPEN_AI_SETTING_TOOL_NAME,
    OPEN_PROVIDER_PAGE_TOOL_NAME,
    genProviderIssueActions,
    getLlmProviderPageUrl,
    readLlmIssue,
} from './providerIssueHelpers';
import {
    FALLBACK_STARTERS,
    findKnownQuestion,
    genKnownQuestionHint,
    getAllQuestions,
    getStarterQuestions,
    suggestQuestions,
    toStarterQuestion,
    type QuestionGroupType,
    type QuestionRowType,
    type StarterQuestionType,
} from './questionHelpers';
import {
    BUILTIN_TOOL_NAME,
    checkIsBuiltinCommand,
    matchBuiltinActions,
    runBuiltinCommand,
    toBuiltinCommandText,
} from './builtinActionHelpers';

/**
 * One thing this window is waiting on, and what stopping it has to reach: the
 * signal that drops the work (`cancelHelpers`), the tab the answer was going
 * to land in, and -- when the ask came from a walkthrough card rather than
 * from the box -- the card that must be told nothing is coming.
 */
type PendingAskType = {
    controller: AbortController;
    sessionId: string;
    onCancelled?: () => void;
    // Anything typed while this answer was already on its way. The loop pulls
    // from here between rounds, so it is a queue rather than an argument --
    // and it lives on the pending ask rather than inside the loop so that a
    // call which dies mid-round (a stop, a rate limit, the wifi) can hand back
    // what the user typed instead of swallowing it.
    additions: string[];
    // What the loop has taken but may not have got an answer out of yet. Kept
    // apart because the two are restored on failure and only one of them is
    // re-asked on success.
    takenAdditions: string[];
    // An ask nobody typed -- a walkthrough card stuck on a step -- must never
    // receive them: its prompt is machine instruction and its answer is one
    // line drawn on a card, so a user's aside would go somewhere they cannot
    // see it.
    canTakeAdditions: boolean;
};

// Straight to the panel that holds the keys. `openOthersSetting` in
// `src/setting/settingHelpers` does exactly this, but importing that module
// into this popup also registers its module-scope "go to setting home"
// listener here -- and then one menu press opens a second settings window out
// of the help window.
const SETTING_TABS_SETTING_NAME = 'setting-tabs';
const SETTING_OTHERS_TAB = 'o';

// Said in the window rather than sent and refused. The switch is offered
// beside it, because "this one cannot see pictures" without "here is one that
// can" is a dead end of exactly the kind this window keeps finding.
/**
 * One earlier message, as the next question should carry it.
 *
 * A picture NEVER rides the history. It would be measured by `text.length`,
 * clipped to 800 characters of base64 by `toShortenedTurn`, and re-sent on
 * every round of every later question in the tab -- a megabyte and a half of
 * nonsense for something the model already answered. What goes instead is the
 * few words saying one was there, so a follow-up like "and the other one?"
 * still makes sense.
 */
function toHistoryTurn(message: ChatMessageType): ChatTurnType {
    const note =
        message.attachments === undefined
            ? ''
            : toAttachmentNote(message.attachments);
    return {
        author: message.author,
        text: note.length > 0 ? `${message.text} ${note}` : message.text,
    };
}

// What the confirm line quotes back. One line: the complaint may be the whole
// of a three-line question, and a confirmation that pushes the box off the
// bottom of the window is one nobody can answer.
const MAX_REPORT_QUOTE_LENGTH = 70;

function toReportQuote(text: string) {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > MAX_REPORT_QUOTE_LENGTH
        ? `${line.slice(0, MAX_REPORT_QUOTE_LENGTH)}…`
        : line;
}

const BLIND_MODEL_MESSAGE =
    'This assistant cannot look at pictures. Pick one that can, or take the ' +
    'picture off and describe it instead.';

function openAiSetting() {
    setSetting(SETTING_TABS_SETTING_NAME, SETTING_OTHERS_TAB);
    openPopupWindow(
        appProvider.settingHomePage,
        `setting_${Date.now()}`,
        'setting',
        { appTopToMain: true },
    );
}

function useStarterQuestions(focus: BotFocusType) {
    const [starters, setStarters] = useState<StarterQuestionType[]>(
        FALLBACK_STARTERS[focus].map(toStarterQuestion),
    );
    const focusRef = useAppCurrentRef(focus);
    useAppEffect(() => {
        setStarters(FALLBACK_STARTERS[focus].map(toStarterQuestion));
        getStarterQuestions(focus).then((questions) => {
            // The corpus is a lazy chunk; the user may have pressed the other
            // window's tab while it was in flight.
            if (focusRef.current !== focus || questions.length === 0) {
                return;
            }
            setStarters(questions);
        });
    }, [focus]);
    return starters;
}

/**
 * Everything this window is prepared to be asked, behind the four chips.
 *
 * Loaded on MOUNT, and this only mounts once More has been pressed -- so a
 * window nobody opens it in never reads the corpus for this at all. The chunk
 * itself is the one the ask box already loads on the first keystroke, so
 * pressing More on a window that has been typed in costs nothing new.
 */
function RenderAllQuestionsComp({
    focus,
    onPick,
}: Readonly<{
    focus: BotFocusType;
    onPick: (starter: StarterQuestionType) => void;
}>) {
    const [groups, setGroups] = useState<QuestionGroupType[] | null>(null);
    const focusRef = useAppCurrentRef(focus);
    useAppEffect(() => {
        setGroups(null);
        getAllQuestions(focus).then((loaded) => {
            // The window's focus can be switched while the chunk is in
            // flight; the other window's questions would be a list of things
            // that are not on screen.
            if (focusRef.current !== focus) {
                return;
            }
            setGroups(loaded);
        });
    }, [focus]);
    if (groups === null) {
        return <p className="chat-hint">Fetching the list…</p>;
    }
    if (groups.length === 0) {
        // The corpus failed to load. Said plainly rather than drawn as an
        // empty list, which would read as an assistant that can do nothing.
        return (
            <p className="chat-hint">
                The full list is not available right now — the four above still
                work, and so does anything you type.
            </p>
        );
    }
    const total = groups.reduce((count, group) => {
        return count + group.questions.length;
    }, 0);
    return (
        <div className="chat-all">
            <p className="chat-hint chat-all-count">
                {total} questions it is ready for here. Type a few words in the
                box to narrow them down.
            </p>
            {groups.map((group) => {
                return (
                    <div className="chat-all-group" key={group.label}>
                        <p className="chat-eyebrow">{group.label}</p>
                        <div className="chat-starters">
                            {group.questions.map((question) => {
                                return (
                                    <button
                                        key={question.text}
                                        type="button"
                                        className="chat-starter"
                                        onClick={() => {
                                            onPick(question);
                                        }}
                                    >
                                        {question.text}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Two characters, not one: on one letter the list is the corpus in alphabetical
// order, which reads as noise under a box the user has barely started typing
// in.
const MIN_SUGGEST_LENGTH = 2;

function useQuestionSuggestions(query: string, focus: BotFocusType) {
    const [suggestions, setSuggestions] = useState<QuestionRowType[]>([]);
    const queryRef = useAppCurrentRef(query);
    const focusRef = useAppCurrentRef(focus);
    useAppEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_SUGGEST_LENGTH) {
            setSuggestions([]);
            return;
        }
        suggestQuestions(trimmed, focus).then((rows) => {
            // Ranking is local and instant, but the first call also loads the
            // corpus -- by the time that lands the user has typed on.
            if (
                queryRef.current.trim() !== trimmed ||
                focusRef.current !== focus
            ) {
                return;
            }
            setSuggestions(rows);
        });
    }, [query, focus]);
    return suggestions;
}

/**
 * One row of the list under the box: a question from the corpus, or -- once
 * the box starts with `/` -- a built-in command. The two are one shape here
 * because the arrows, Enter and the mouse walk one list, and a second list
 * with its own keys is a second thing to get wrong.
 */
type SuggestRowType = {
    id: string;
    text: string;
    where: string;
    /** What choosing it puts in the box. */
    fill: string;
    /** Whether choosing it ASKS on the spot -- a command with no words to add. */
    isImmediate: boolean;
};

function toQuestionSuggestRow(row: QuestionRowType): SuggestRowType {
    return {
        id: row.id,
        text: row.text,
        where: row.sectionLabel,
        fill: row.text,
        isImmediate: false,
    };
}

function RenderSuggestionsComp({
    suggestions,
    activeIndex,
    onChoose,
}: Readonly<{
    suggestions: SuggestRowType[];
    activeIndex: number;
    onChoose: (row: SuggestRowType) => void;
}>) {
    if (suggestions.length === 0) {
        return null;
    }
    return (
        <ul className="chat-suggests" role="listbox">
            {suggestions.map((row, index) => {
                return (
                    <li key={row.id}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={index === activeIndex}
                            className={
                                'chat-suggest' +
                                (index === activeIndex ? ' is-on' : '')
                            }
                            // Mouse down, not click: the input loses focus
                            // first otherwise, the list closes, and the press
                            // lands on nothing.
                            onMouseDown={(event) => {
                                event.preventDefault();
                                onChoose(row);
                            }}
                        >
                            <span className="chat-suggest-text">
                                {row.text}
                            </span>
                            <span className="chat-suggest-where">
                                {row.where}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

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
        // Underscore emphasis only where markdown itself means it: at a
        // word's edge. Inside a word an underscore is part of a NAME -- the
        // starter chip's own address read `amazing_grace_how_sweet_the_sound`
        // and was drawn as *amazing* grace *how* sweet *the* sound in the
        // user's own message (EC-39).
        const parts = content.split(
            /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w/.-])_[^_\s][^_]*_(?![\w/.-]))/g,
        );
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

// A dropdown reading "Presenter" says what it is SET to, never what it is
// FOR, and three of them side by side read as one unexplained sentence -- the
// hover text that named them is not a thing a volunteer thinks to go looking
// for. So each wears its own caption, beside it, so the pair reads as a line:
// "Asking about: Presenter". Only where the window is too narrow to hold
// three of those does the caption move over its control instead. A real
// `<label>`, so it is also a second, bigger target for that control.
function RenderPickFieldComp({
    caption,
    isEngine = false,
    children,
}: Readonly<{
    caption: string;
    isEngine?: boolean;
    children: ReactNode;
}>) {
    return (
        <label
            className={
                'chat-pick-field' + (isEngine ? ' chat-pick-field-engine' : '')
            }
        >
            <span className="chat-pick-caption">{caption}</span>
            {children}
        </label>
    );
}

/**
 * What this tab has cost so far, under the choices that decide what the
 * next question will cost. A line of the head rather than of the log
 * because it belongs to the TAB, like everything else in the head: the
 * answers below are what the money bought, and this is the running bill.
 * Drawn only once there is a bill -- an empty tab has nothing to say, and a
 * "$0.00" over the starter chips would be a promise about the free tier --
 * and so the whole ROW is only drawn then: it held the spend guard too
 * until 2026-09-11, which cost every tab a second head line whether or not
 * anything had been spent, and the guard sits in the picker row now.
 * The hover carries the sums and the caveat; the line carries the figure a
 * treasurer would ask for.
 */
function RenderCreditLineComp({
    usage,
}: Readonly<{ usage: ChatUsageType | undefined }>) {
    const brief = describeUsageBriefly(usage);
    if (brief.length === 0) {
        return null;
    }
    return (
        <div className="chat-head-row chat-credit">
            <span
                className="chat-credit-field"
                title={describeUsageInFull(usage)}
            >
                <span className="chat-pick-caption">Credit used</span>
                <span className="chat-credit-value">{brief}</span>
            </span>
        </div>
    );
}

/**
 * The spend guard's own corner of the head: the cap the user set, what the
 * hour has cost against it, and -- while the assistant is paused -- the
 * button that lifts the pause. Drawn whether or not anything has been spent
 * yet, unlike the credit line under it: a protection nobody can see is a
 * protection nobody trusts, and the picker is how they set it. It sits in
 * the PICKER row, after the model (2026-09-11, asked for with a picture: a
 * row of its own under three pickers was a head line spent on one small
 * select), and wraps under them only where the window is too narrow to hold
 * four. Subscribed to
 * the guard's own store rather than lifted into the window's state, for the
 * same reason the progress line is: every model round would otherwise
 * re-render the whole message list. See `spendGuardHelpers`.
 */
function RenderSpendGuardComp() {
    const [state, setState] = useState<SpendStateType>(() => {
        return getLastSpendState();
    });
    useAppEffect(() => {
        // Read once more on subscribe: rounds land between the first render
        // and the effect, and an hour passing changes the figure with no
        // publish at all.
        setState(getLastSpendState());
        return subscribeSpendGuard(setState);
    }, []);
    const figure = describeSpendState(state);
    const hover = describeSpendGuard(state);
    // `/limit 0.05` sets a cap the picker does not list, and a select whose
    // value matches no option quietly shows its first one -- $0.25 over a
    // five-cent cap. The cap in force is always an option, wherever it came
    // from.
    const choices = SPEND_LIMIT_CHOICE_LIST.includes(state.limitUsd)
        ? SPEND_LIMIT_CHOICE_LIST
        : [
              ...SPEND_LIMIT_CHOICE_LIST.filter((choice) => {
                  return choice !== null;
              }),
              state.limitUsd,
          ]
              .sort((a, b) => {
                  return (a ?? 0) - (b ?? 0);
              })
              .concat([null]);
    return (
        <span
            className={
                'chat-spend' +
                (state.isTripped
                    ? ' is-paused'
                    : state.isNearLimit
                      ? ' is-near'
                      : '')
            }
            title={hover}
        >
            <label className="chat-pick-field">
                <span className="chat-pick-caption">Limit per hour</span>
                <select
                    className="chat-pick chat-spend-pick"
                    aria-label="Spending limit per hour"
                    value={toSpendLimitValue(state.limitUsd)}
                    onChange={(event) => {
                        const picked = parseSpendLimitValue(event.target.value);
                        if (picked !== undefined) {
                            setSpendLimitUsd(picked);
                        }
                    }}
                >
                    {choices.map((choice) => {
                        return (
                            <option
                                key={toSpendLimitValue(choice)}
                                value={toSpendLimitValue(choice)}
                            >
                                {toSpendLimitLabel(choice)}
                            </option>
                        );
                    })}
                </select>
            </label>
            {figure.length > 0 ? (
                <span className="chat-credit-value chat-spend-value">
                    {figure}
                </span>
            ) : null}
            {state.isTripped ? (
                <button
                    type="button"
                    className="chat-spend-allow"
                    title={
                        'Lift the pause and start the hour again: the whole ' +
                        'limit is available once more from now.'
                    }
                    onClick={() => {
                        allowMoreSpending();
                    }}
                >
                    {SPEND_ALLOW_LABEL}
                </button>
            ) : null}
        </span>
    );
}

// One app, many windows: the same question has a presenter answer, a reader
// answer and often none at all in the Lyric Editor, so the user says which one
// they are asking about -- and until they do, it follows the window they opened
// this from. The list is `botFocus.mjs`'s, which is also what the MCP tools'
// schemas are built from, so the picker can never offer a window the tools
// would refuse.
function RenderFocusSwitchComp({
    focus,
    onChange,
}: Readonly<{
    focus: BotFocusType;
    onChange: (focus: BotFocusType) => void;
}>) {
    return (
        <select
            className="chat-pick"
            aria-label="Which part of the app"
            title={
                'Which window of the app you are asking about. It follows ' +
                'the window you opened this from until you pick one yourself.'
            }
            value={focus}
            onChange={(event) => {
                onChange(event.target.value as BotFocusType);
            }}
        >
            {BOT_FOCUS_LIST.map((item) => {
                return (
                    <option key={item.key} value={item.key}>
                        {item.label}
                    </option>
                );
            })}
        </select>
    );
}

// Both keys can be set at once, and the two do not answer alike -- nor fail
// alike: a rate limit, an expired card or a blocked domain hits one of them and
// not the other. The switch lives in this window rather than in Settings so it
// can be flipped between two questions, without leaving the answer on screen.
//
// A provider with no key is LISTED and disabled, never dropped: the pair is
// what tells the user the other one exists. Its reason goes in the option's
// own text rather than in a `title`, because this list is drawn by the OS and
// Windows shows no tooltip over a row of it.
const NO_PROVIDER_VALUE = '';

/**
 * What a row of the assistant list reads as. Three cases, and the third is the
 * reason this is a function: a provider with no key is unusable and says so,
 * one with a key is just its name, and the KEYLESS one is usable by everybody
 * and still needs a word of warning on it -- it is the only row whose cost is
 * paid in something other than money, and the list is the last place a user
 * sees it before choosing.
 */
function genProviderOptionText(
    provider: LlmProviderType,
    label: string,
    isAvailable: boolean,
) {
    if (checkIsFreeProvider(provider)) {
        return {
            text: `${label}`,
            title: ' — no key needed, shared public service',
        };
    }
    return isAvailable
        ? { text: label }
        : { text: `${label} — needs an API key` };
}

/**
 * The provider names, as a sentence: "Claude, ChatGPT and Kimi". Written
 * out rather than hardcoded because these lines are what a user with no key
 * reads, and a provider missing from them is one they never learn they
 * could have used.
 */
function genProviderNames() {
    const labels = LLM_PROVIDER_LIST.filter((item) => {
        // The keyless one is deliberately not in this sentence. The sentence
        // exists to tell a user which providers a key would buy them; naming
        // the one that needs none inside "... need an API key of your own"
        // makes it say the opposite of the truth about itself.
        return !checkIsFreeProvider(item.key);
    }).map((item) => {
        return item.label;
    });
    if (labels.length < 2) {
        return labels.join('');
    }
    return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

function RenderProviderSwitchComp({
    provider,
    availableProviders,
    onChange,
}: Readonly<{
    provider: LlmProviderType | null;
    availableProviders: LlmProviderType[];
    onChange: (provider: LlmProviderType) => void;
}>) {
    const chosenLabel = LLM_PROVIDER_LIST.find((item) => {
        return item.key === provider;
    })?.label;
    return (
        <select
            className="chat-pick"
            aria-label="Which assistant answers"
            title={
                chosenLabel === undefined
                    ? `${genProviderNames()} need an API key of your own` +
                      ' — add one in Settings → Others'
                    : `${chosenLabel} answers your questions here`
            }
            // With no key at all there is no provider to be on, and a select
            // whose value matches no option renders blank.
            value={provider ?? NO_PROVIDER_VALUE}
            onChange={(event) => {
                onChange(event.target.value as LlmProviderType);
            }}
        >
            {provider === null ? (
                <option value={NO_PROVIDER_VALUE} disabled>
                    No AI key
                </option>
            ) : null}
            {LLM_PROVIDER_LIST.map((item) => {
                const isAvailable = availableProviders.includes(item.key);
                const { text, title } = genProviderOptionText(
                    item.key,
                    item.label,
                    isAvailable,
                );
                return (
                    <option
                        key={item.key}
                        value={item.key}
                        disabled={!isAvailable}
                        title={title}
                    >
                        {text}
                    </option>
                );
            })}
        </select>
    );
}

// Long enough to read three lines without hurrying, short enough that it is
// out of the way before the first answer lands.
const WARNING_COLLAPSE_MILLISECONDS = 9000;

/**
 * The standing warning above a keyless conversation.
 *
 * It is NOT dismissible and it is NOT shown once. A volunteer opens this window
 * in a hurry, minutes before a service, and whatever they type goes to a public
 * service run by somebody neither they nor this app has an agreement with --
 * that fact is true of the next question as much as the first, so it stays on
 * screen for as long as it is true.
 *
 * What it no longer does is spend three lines saying so for ever. It opens in
 * full, and folds itself back to ONE line a few seconds later -- still pinned,
 * still saying who answers, one press away from the whole text again. The
 * distinction that matters is between dismissing and collapsing: a dismissed
 * notice has stopped warning anybody, a collapsed one is still on screen every
 * time the user looks up. A 460px window over a service is mostly conversation,
 * and the three lines were being paid for on question ten as well as question
 * one.
 *
 * Folding is on a timer rather than on the first question because the window is
 * often opened and read before anything is typed at all -- and it is never
 * folded automatically a second time: once the user has opened it by hand, they
 * asked for it, and it stays until they fold it back.
 *
 * It sits inside the log rather than in the head row on purpose: the head row
 * belongs to the tab, is already three controls wide in a 460px window, and a
 * warning wrapped onto two lines there would push the conversation off screen.
 *
 * Nothing is shown at all for a provider the user is paying for themselves --
 * they made that arrangement and do not need reminding of it.
 */
function RenderProviderWarningComp({
    provider,
}: Readonly<{ provider: LlmProviderType | null }>) {
    const warning = getLlmProviderWarning(provider);
    const links = getLlmProviderWarningLinks(provider);
    const [isFolded, setIsFolded] = useState(false);
    const [isFoldedByHand, setIsFoldedByHand] = useState(false);
    useAppEffect(() => {
        // A provider the user switched to mid-conversation is a new warning
        // about a new service, so it opens again and re-runs its own timer.
        setIsFolded(false);
        setIsFoldedByHand(false);
    }, [provider]);
    useAppEffect(() => {
        if (isFoldedByHand) {
            return undefined;
        }
        const timeoutId = setTimeout(() => {
            setIsFolded(true);
        }, WARNING_COLLAPSE_MILLISECONDS);
        return () => {
            clearTimeout(timeoutId);
        };
    }, [isFoldedByHand, provider]);
    if (warning === null) {
        return null;
    }
    // The first sentence carries the whole point of the warning; the rest is
    // what to do about it. So the folded line is not a summary somebody has to
    // keep in step with the warning -- it is the warning's own opening words.
    const foldedText = `${warning.split('. ')[0]}.`;
    return (
        <p className={`chat-warn${isFolded ? ' is-folded' : ''}`} role="note">
            <span className="chat-warn-mark" aria-hidden="true">
                {'⚠'}
            </span>
            <button
                type="button"
                className="chat-warn-fold"
                aria-expanded={!isFolded}
                title={isFolded ? 'Read the whole notice' : 'Fold this notice'}
                onClick={() => {
                    setIsFolded(!isFolded);
                    // Only a fold by hand sticks. Opening it by hand starts no
                    // timer either -- see the note above.
                    setIsFoldedByHand(true);
                }}
            >
                {isFolded ? foldedText : 'Fold'}
            </button>
            <span className="chat-warn-body">
                {warning}{' '}
                <button
                    type="button"
                    className="chat-warn-link"
                    onClick={openAiSetting}
                >
                    Open AI settings
                </button>
                {links.length > 0 ? (
                    <span className="chat-warn-links">
                        {'Who answers: '}
                        {links.map((link, index) => {
                            return (
                                <Fragment key={link.url}>
                                    {index > 0 ? ' · ' : null}
                                    <button
                                        type="button"
                                        className="chat-warn-link"
                                        title={`Open ${link.url}`}
                                        onClick={() => {
                                            appProvider.browserUtils.openExternalURL(
                                                link.url,
                                            );
                                        }}
                                    >
                                        {link.label}
                                    </button>
                                </Fragment>
                            );
                        })}
                    </span>
                ) : null}
            </span>
        </p>
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
    hasMoreModels,
    onChange,
    onLoadingMore,
}: Readonly<{
    model: string;
    modelList: LlmModelType[];
    isLoadingModels: boolean;
    hasMoreModels: boolean;
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
            className="chat-pick chat-engine"
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
                opening. Absent entirely for the keyless provider: its two
                hosts DO answer with a catalogue, but almost none of it is
                free and only some of it can call a tool at all, so the row
                would be a control that either changes nothing or picks a
                model that cannot do the job. A control that does nothing is
                worse than no control. */}
            {hasMoreModels ? (
                <option value={MORE_MODELS_VALUE}>
                    {isLoadingModels ? 'Loading…' : 'More models…'}
                </option>
            ) : null}
        </select>
    );
}

// An answer is written to be taken away -- read out, pasted into a message to
// whoever asked, kept for next Sunday. The alternative in this window is a
// mouse drag across a paragraph while a service is starting.
// What a volunteer sees clipped to their question, whether it is still in the
// box or already asked.
//
// A picture is shown as a thumbnail because that is the only way to tell two
// screenshots apart; everything else is its name and an icon. In the transcript
// the thumbnail may be GONE -- the bytes live only while the window is open --
// and the chip says so rather than drawing a broken image. That is the visible
// half of the deliberate decision not to write pictures into a settings file.
/**
 * A thing the ANSWER offers to show, as the same chip a question's attachment
 * draws. One chip in this window and one way to press it -- the alternative was
 * a second component that looked identical and drifted.
 *
 * The `id` is derived from what it points at rather than generated, so a
 * re-render does not make a new one every time.
 */
function toShownAttachment(show: ShowRefType): ChatAttachmentType {
    return {
        id: `show:${show.kind}:${show.value}`,
        kind: show.kind === 'file' ? 'text' : 'element',
        name: show.name,
        mimeType: 'application/x-owa-show',
        byteSize: 0,
        ...(show.kind === 'file'
            ? { filePath: show.value }
            : show.kind === 'selector'
              ? { selector: show.value }
              : { summary: show.value }),
    };
}

function RenderAttachmentChipsComp({
    attachments,
    onRemove,
    onShow,
}: Readonly<{
    attachments: ChatAttachmentType[];
    onRemove?: (id: string) => void;
    // Pressing a POINTED-AT control's chip rings it again in the app window.
    // "Which one was that?" is the question a chip reading `Copy` raises the
    // moment there are two of them, and the selector to answer it exactly is
    // already on the attachment.
    onShow?: (attachment: ChatAttachmentType) => void;
}>) {
    if (attachments.length === 0) {
        return null;
    }
    return (
        <div className="chat-clips">
            {attachments.map((attachment) => {
                const dataUrl =
                    attachment.kind === 'image'
                        ? getAttachmentData(attachment.id)
                        : null;
                const isGone = attachment.kind === 'image' && dataUrl === null;
                // Every chip has something to show: a control is rung, a
                // picture opens, a file opens its folder. A picture whose
                // bytes have gone and which never came from disk is the one
                // that has nothing left, and it says so rather than going
                // quiet.
                // Pressable when there is something LEFT to show, which is not
                // the same as "the picture is still here": a screenshot whose
                // bytes went with the window can still open the folder it came
                // from, and that is the only thing left worth offering.
                const canShow =
                    onShow !== undefined &&
                    (attachment.selector !== undefined ||
                        attachment.filePath !== undefined ||
                        !isGone);
                return (
                    <span
                        key={attachment.id}
                        className={
                            'chat-clip' +
                            (isGone ? ' chat-clip-gone' : '') +
                            (canShow ? ' chat-clip-showable' : '')
                        }
                        role={canShow ? 'button' : undefined}
                        tabIndex={canShow ? 0 : undefined}
                        onClick={
                            canShow
                                ? () => {
                                      onShow(attachment);
                                  }
                                : undefined
                        }
                        onKeyDown={
                            canShow
                                ? (event) => {
                                      if (event.key === 'Enter') {
                                          onShow(attachment);
                                      }
                                  }
                                : undefined
                        }
                        title={
                            isGone
                                ? `${attachment.name} — not attached any more`
                                : canShow
                                  ? `${attachment.name} — ${
                                        attachment.selector !== undefined
                                            ? 'press to ring it in the app'
                                            : attachment.kind === 'image'
                                              ? 'press to see it bigger'
                                              : // A control the ANSWER named,
                                                // looked up when pressed. It
                                                // has no selector and no file,
                                                // so it used to fall through
                                                // to the folder line and every
                                                // SHOWS chip promised the
                                                // wrong thing.
                                                attachment.mimeType ===
                                                      'application/x-owa-show' &&
                                                  attachment.filePath ===
                                                      undefined &&
                                                  attachment.summary !==
                                                      undefined
                                                ? 'press to ring it in the app'
                                                : // Every asset opens now, and
                                                  // the folder is one press
                                                  // further on, beside
                                                  // Download.
                                                  'press to open it'
                                    }`
                                  : attachment.name
                        }
                    >
                        {dataUrl === null ? (
                            <i
                                className={
                                    'bi ' +
                                    (attachment.kind === 'element'
                                        ? 'bi-bullseye'
                                        : attachment.kind === 'image' ||
                                            checkIsImageName(attachment.name)
                                          ? // A saved picture arrives as a
                                            // file, and reads as one on its
                                            // chip unless the NAME is asked.
                                            'bi-image'
                                          : 'bi-file-earmark-text')
                                }
                            />
                        ) : (
                            <img src={dataUrl} alt="" />
                        )}
                        <span className="chat-clip-name">
                            {attachment.name}
                        </span>
                        {attachment.kind === 'image' && dataUrl !== null ? (
                            <RenderCopyPictureIconComp
                                id={attachment.id}
                                name={attachment.name}
                            />
                        ) : null}
                        {onRemove === undefined ? null : (
                            <button
                                type="button"
                                className="chat-clip-x"
                                aria-label={`Remove ${attachment.name}`}
                                onClick={(event) => {
                                    // Removing is not showing: the × sits
                                    // inside a chip that is itself a button.
                                    event.stopPropagation();
                                    onRemove(attachment.id);
                                }}
                            >
                                ×
                            </button>
                        )}
                    </span>
                );
            })}
        </div>
    );
}

/**
 * What an opened asset LOOKS like: the picture, the words, or -- for the
 * things this window cannot draw -- a card naming it and saying so.
 *
 * The card is not a refusal: the buttons under it are the same ones that work
 * for everything else, which is the whole point of opening every asset the
 * same way.
 */
function RenderAssetPreviewBodyComp({
    preview,
}: Readonly<{ preview: ChatAssetPreviewType }>) {
    if (preview.imageDataUrl !== null) {
        return <img src={preview.imageDataUrl} alt={preview.name} />;
    }
    if (preview.text !== null) {
        return (
            <pre
                className="chat-preview-text"
                // A scrolling box is a tab stop whether or not it asks to be,
                // and one with no name was announced by the WHOLE file it holds.
                // Named by the file instead; the words are still read inside it.
                role="document"
                tabIndex={0}
                aria-label={preview.name}
                onClick={(event) => {
                    // The backdrop closes the preview; selecting a line of
                    // the file must not.
                    event.stopPropagation();
                }}
            >
                {preview.text}
            </pre>
        );
    }
    return (
        <div className="chat-preview-card">
            <i className="bi bi-file-earmark" />
            <p className="chat-preview-card-name">{preview.name}</p>
            {preview.byteSize === null ? null : (
                <p className="chat-preview-card-size">
                    {toReadableSize(preview.byteSize)}
                </p>
            )}
            <p className="chat-preview-card-note">
                {preview.note ??
                    'This window cannot show this kind of file. Download it ' +
                        'or open its folder to look at it.'}
            </p>
        </div>
    );
}

// The three things the assistant can ask to be SHOWN, as buttons that go and
// get them. A sentence asking for a screenshot is a sentence a volunteer has to
// work out how to act on; this is one press.
const ATTACH_REQUEST_LABEL_MAP: Record<
    AttachRequestType,
    { label: string; icon: string }
> = {
    screenshot: { label: 'Send a picture of my screen', icon: 'bi-camera' },
    element: { label: 'Point at the control', icon: 'bi-bullseye' },
    file: { label: 'Attach a file', icon: 'bi-paperclip' },
};

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

/**
 * The one icon every picture in this window carries: press it and the
 * picture is on the clipboard, without opening it first. It sits inside a
 * chip that is itself a button, so the press must not also open the preview
 * or ring a control -- both the click and the key are stopped here. The
 * bytes come from the same in-memory map as the picture itself, so a chip
 * whose picture has gone with the window draws no icon at all.
 */
function RenderCopyPictureIconComp({
    id,
    name,
}: Readonly<{ id: string; name: string }>) {
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
    const handleCopying = async (event: React.MouseEvent) => {
        event.stopPropagation();
        const dataUrl = getAttachmentData(id);
        let nextState: 'done' | 'failed' = 'failed';
        if (dataUrl !== null) {
            try {
                await copyImageToClipboard(dataUrl);
                nextState = 'done';
            } catch (_error) {
                // Shown as a failure on the icon rather than swallowed: a
                // press that looks as though it worked and did not is the
                // worse one.
                nextState = 'failed';
            }
        }
        setCopyState(nextState);
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
            className={
                'chat-clip-copy' +
                (copyState === 'idle' ? '' : ` chat-clip-copy-${copyState}`)
            }
            aria-label={`Copy ${name} to the clipboard`}
            title={
                copyState === 'done'
                    ? 'Copied'
                    : copyState === 'failed'
                      ? 'Could not copy the picture'
                      : 'Copy the picture to the clipboard'
            }
            onClick={handleCopying}
            onKeyDown={(event) => {
                // Enter on the icon must not also be Enter on the chip.
                event.stopPropagation();
            }}
        >
            <i
                className={
                    'bi ' +
                    (copyState === 'done'
                        ? 'bi-check2'
                        : copyState === 'failed'
                          ? 'bi-x-lg'
                          : 'bi-clipboard')
                }
            />
        </button>
    );
}

/**
 * The song the buttons under it would make, shown as it will be written.
 *
 * The notation is deliberately kept OUT of the answer -- the model is told not
 * to paste it, because a wall of fences is not an answer to a volunteer and it
 * costs the whole song in tokens a second time. But keeping it out of the
 * answer had also kept it out of sight altogether, so the one thing the user
 * is being asked to approve was the one thing they could not look at. It goes
 * here instead: read-only, off the SAME in-memory document the Create button
 * uses, so nothing new is persisted and a window reopened since shows nothing
 * rather than an empty song.
 */
function RenderLyricPreviewComp({
    actions,
}: Readonly<{ actions: BotActionType[] }>) {
    const action = actions.find((one) => {
        return one.toolName === LYRIC_CREATE_TOOL_NAME;
    });
    const drafted = takeDraftedLyric(action?.args?.reference ?? '');
    if (drafted === null) {
        return null;
    }
    const lineCount = drafted.content.split('\n').length;
    return (
        <details className="cue-lyric" open>
            <summary>The song text, as it will be saved</summary>
            <textarea
                className="cue-lyric-text"
                readOnly={true}
                spellCheck={false}
                value={drafted.content}
                rows={Math.min(20, Math.max(6, lineCount))}
                aria-label="The song text that would be saved"
            />
        </details>
    );
}

function RenderMessageComp({
    message,
    canReply,
    onAction,
    onReply,
    onReuse,
    onAttachRequest,
    onShowAttachment,
}: Readonly<{
    message: ChatMessageType;
    // Only the message at the BOTTOM offers its options, and not while an
    // answer is on its way. A one-press "Yes" still sitting under an offer
    // three turns back would be answering the wrong question -- the same
    // mistake the offline bot's bare-yes handling had to be taught not to
    // make.
    canReply: boolean;
    onAction: (action: BotActionType) => void;
    onReply: (text: string) => void;
    onReuse: (text: string) => void;
    onAttachRequest: (request: AttachRequestType) => void;
    onShowAttachment: (attachment: ChatAttachmentType) => void;
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
                {message.attachments === undefined ? null : (
                    <RenderAttachmentChipsComp
                        attachments={message.attachments}
                        onShow={onShowAttachment}
                    />
                )}
                {message.shows === undefined ? null : (
                    <RenderAttachmentChipsComp
                        attachments={message.shows.map(toShownAttachment)}
                        onShow={onShowAttachment}
                    />
                )}
                {canReply && message.attachRequests?.length ? (
                    <div className="cue-actions">
                        {message.attachRequests.map((request) => {
                            const shown = ATTACH_REQUEST_LABEL_MAP[request];
                            return (
                                <button
                                    key={request}
                                    type="button"
                                    className="cue-act cue-act-attach"
                                    onClick={() => {
                                        onAttachRequest(request);
                                    }}
                                >
                                    <i className={`bi ${shown.icon}`} />{' '}
                                    {shown.label}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
                {message.actions?.length ? (
                    <RenderLyricPreviewComp actions={message.actions} />
                ) : null}
                {message.actions?.length ? (
                    <div className="cue-actions">
                        {message.actions.map((action) => {
                            // The two walkthroughs are the answers that DO
                            // something, and the demo is the boldest of them;
                            // reading matter stays quiet beside them.
                            const isGuide =
                                action.toolName === 'owa_guide_start';
                            const isDemo = action.args?.mode === 'demo';
                            // A button that leaves the app says where to
                            // before it is pressed, and wears the arrow.
                            const pageUrl =
                                action.toolName === OPEN_PROVIDER_PAGE_TOOL_NAME
                                    ? getLlmProviderPageUrl(
                                          action.args?.provider,
                                          action.args?.page,
                                      )
                                    : null;
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
                                              : pageUrl !== null
                                                ? ' cue-act-page'
                                                : '')
                                    }
                                    title={
                                        pageUrl === null
                                            ? undefined
                                            : `Opens ${pageUrl} in your browser`
                                    }
                                    onClick={() => {
                                        onAction(action);
                                    }}
                                >
                                    {action.label}
                                    {pageUrl === null ? null : (
                                        <i
                                            className="bi bi-box-arrow-up-right"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
                {canReply && message.replies?.length ? (
                    <div className="cue-replies">
                        {message.replies.map((reply) => {
                            // Pressed, not typed: it goes STRAIGHT back as
                            // the user's own words. Deliberately unlike the
                            // suggestion list, which fills the box instead --
                            // a suggestion is a starting point somebody still
                            // edits, and this is the answer itself.
                            return (
                                <button
                                    key={reply}
                                    type="button"
                                    className="cue-reply"
                                    onClick={() => {
                                        onReply(reply);
                                    }}
                                >
                                    {reply}
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
                    {message.usage === undefined ? null : (
                        // What this one answer cost, in the same quiet voice
                        // as the button beside it: a fact about the answer,
                        // not one of the answers. The hover has the sums.
                        <span
                            className="cue-cost"
                            title={describeUsageInFull(message.usage)}
                        >
                            {describeUsageBriefly(message.usage)}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}

/**
 * One line above the box saying something this window can do.
 *
 * Every feature it names is already there and none of them announces itself:
 * the box is a box, the paperclip is a paperclip. A volunteer who never finds
 * out that Alt+↑ brings the last question back, that the camera hands over a
 * picture of the app, or that Report writes the bug report for them, is using
 * a quarter of this window. So one short line sits in the last place their eye
 * passes on the way to the box, it is a different one each time the window
 * opens, and pressing it gives another.
 *
 * Its own component so a new tip re-renders this line and nothing else -- the
 * conversation above it can be long, and a tip is not worth a render of it.
 */
/**
 * What the assistant is doing right now, while it is doing it.
 *
 * Its own component subscribing to its own store, for the same reason the tip
 * line is one: this sits under the conversation, and a question that takes
 * twenty steps must not re-render twenty messages twenty times on a machine
 * that has nothing to spare.
 *
 * The finished steps stay on screen above the running one. A single line that
 * replaced itself would be cheaper to build and would answer a different
 * question -- "is it still alive?" -- where the one actually being asked, by
 * somebody deciding whether to press Stop, is "is it getting anywhere?". Only
 * the last few are kept; older ones are counted, never dropped in silence.
 */
function RenderChatProgressComp() {
    const [progress, setProgress] =
        useState<ProgressStateType>(getProgressState);
    useAppEffect(() => {
        // Read once more on subscribe: the first steps of an ask are pushed
        // between this component mounting and the effect running.
        setProgress(getProgressState());
        return subscribeProgress(setProgress);
    }, []);
    if (progress.steps.length === 0) {
        return (
            <p className="chat-status">
                <span className="chat-status-dot" aria-hidden="true" />
                Looking it up… press Stop to give up on it.
            </p>
        );
    }
    return (
        <div className="chat-progress" aria-live="polite">
            {progress.droppedCount > 0 ? (
                <p className="chat-progress-more">
                    {progress.droppedCount} earlier{' '}
                    {progress.droppedCount === 1 ? 'step' : 'steps'}
                </p>
            ) : null}
            {progress.steps.map((step) => {
                return (
                    <p
                        key={step.id}
                        className={`chat-status${step.isDone ? ' is-done' : ''}`}
                    >
                        <span className="chat-status-dot" aria-hidden="true" />
                        {step.text}
                        {step.isDone ? '' : '…'}
                    </p>
                );
            })}
            <p className="chat-progress-stop">press Stop to give up on it.</p>
        </div>
    );
}

function RenderChatTipComp({ onPressed }: Readonly<{ onPressed: () => void }>) {
    const [tip, setTip] = useState<ChatTipType>(takeChatTip);
    // Straight back to the box after any of the three. Reading another tip is
    // not leaving the question -- and a half-typed one whose caret has gone to
    // a button is a question that has to be clicked back into before it can be
    // finished.
    const walk = (delta: number) => {
        setTip(stepChatTip(tip.id, delta));
        onPressed();
    };
    return (
        <div className="chat-tip-row">
            <button
                type="button"
                className="chat-tip"
                title="Show me another thing this window can do"
                aria-label={`Tip: ${tip.text} Press for another tip.`}
                onClick={() => {
                    // The line itself still gives a RANDOM one. Somebody who
                    // presses the sentence is asking to be shown something
                    // else, not to be walked through a list they have not been
                    // told exists; the arrows beside it are what says there is
                    // an order to come back along.
                    setTip(pickChatTip(tip.id));
                    onPressed();
                }}
            >
                <i className="bi bi-lightbulb" aria-hidden="true" />
                <span>{tip.text}</span>
            </button>
            <span className="chat-tip-walk">
                <button
                    type="button"
                    className="chat-tip-step"
                    title="The tip before this one"
                    aria-label="Previous tip"
                    onClick={() => {
                        walk(-1);
                    }}
                >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="chat-tip-step"
                    title="The next tip"
                    aria-label="Next tip"
                    onClick={() => {
                        walk(1);
                    }}
                >
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
            </span>
        </div>
    );
}

function genNewSessionDefaults() {
    const focus = detectOpenerFocus() ?? DEFAULT_BOT_FOCUS;
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
                // A model the keyless list has dropped is put back on its
                // first choice too (`toUsableLlmModel`), or the head row
                // shows one name while a withdrawn one is asked.
                const usableModel =
                    session.model.length > 0
                        ? toUsableLlmModel(session.provider, session.model)
                        : getLlmModel(session.provider);
                return usableModel === session.model
                    ? session
                    : { ...session, model: usableModel };
            }
            return { ...session, provider, model };
        }),
    };
}

/**
 * The first half of a "could not answer" line: what failed, and why.
 *
 * The app's OWN tool host is not the provider, and it is said in its own
 * sentence (`ToolHostError`) -- naming the provider over it blamed "Free" for
 * the app's own server on the day Free was also broken for a reason of its
 * own. A trailing full stop comes off the provider's sentence first, or
 * "is currently unavailable." grows a second one.
 */
function describeAskFailure(label: string, error: any) {
    if (checkIsToolHostError(error)) {
        return error.message;
    }
    const reason = String(error?.message ?? '').replace(/\.+$/, '');
    return `${label} could not answer — ${reason}.`;
}

/**
 * The half of a stand-in note that says what the offline answer IS. A song
 * the offline bot wrote out itself -- a paste, or a page read for its
 * address -- is not "what the guide says", and a note claiming so over a
 * drafted song reads as the guide having a page about the user's own words.
 * One sentence for the provider-failure note and the spend-guard pause both,
 * because the pause note said "the app's own guide" over a drafted song the
 * day the song link learned to draft offline (2026-09-10).
 */
function describeOfflineStandIn(answer: BotAnswerType) {
    const isDrafted = (answer.actions ?? []).some((action) => {
        return action.toolName === LYRIC_CREATE_TOOL_NAME;
    });
    return isDrafted
        ? 'I wrote the song out myself instead.'
        : "Here is what the app's own guide says.";
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
    // What is attached to the question NOT YET asked, per tab.
    //
    // Component state rather than a field on the session, because it is the
    // one part of a half-written question that must not be written to disk:
    // the descriptions could be, but they would then outlive the pictures they
    // describe and a reopened window would show chips for bytes that are gone.
    // Keyed by tab all the same -- attaching a screenshot, checking the other
    // tab and coming back must not lose it.
    const [draftAttachmentMap, setDraftAttachmentMap] = useState<
        Record<string, ChatAttachmentType[]>
    >({});
    const [attachError, setAttachError] = useState<string | null>(null);
    // The picture being looked at, big. Held by id rather than by data URL
    // so it cannot outlive the store that owns the bytes.
    // The asset being looked at, and everything the overlay needs to draw and
    // download it. State rather than a lookup by id: a file's content is READ
    // when it is opened, and held only while it is open.
    const [preview, setPreview] = useState<ChatAssetPreviewType | null>(null);
    const previewElementRef = useRef<HTMLDivElement | null>(null);
    // What had the keyboard when the preview opened -- the chip that was
    // pressed -- so closing it hands the keyboard back there instead of to the
    // page, from where the next Tab starts over at the top of the window.
    const previewOpenerRef = useRef<HTMLElement | null>(null);
    // The overlay takes the keyboard the moment it opens. Nothing focused it
    // before, so focus stayed in the ask box UNDERNEATH a full-window overlay:
    // its own Enter/Escape handler never fired, and its Copy / Download /
    // Open folder buttons could only be reached by tabbing blindly through the
    // conversation behind it.
    useAppEffect(() => {
        if (preview !== null) {
            previewElementRef.current?.focus();
            return;
        }
        const opener = previewOpenerRef.current;
        previewOpenerRef.current = null;
        if (opener?.isConnected) {
            opener.focus();
        }
    }, [preview]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const draftAttachmentMapRef = useAppCurrentRef(draftAttachmentMap);
    // The catalogue, on the other hand, is a property of the ACCOUNT, not of a
    // tab: what the key can run is the same answer in every tab, so the list
    // is held once per provider and shared by all of them. Read once -- a key
    // added in Settings while this window is open arrives on its next open,
    // and the window is cheap to reopen, cheaper than a subscription this
    // popup would hold all service.
    const [modelListMap, setModelListMap] = useState<
        Record<LlmProviderType, LlmModelType[]>
    >(() => {
        // Built FROM the provider list rather than written out here: a
        // provider added to the union and forgotten in this literal used to be
        // a compile error, which was the good outcome, but the fix was always
        // to type the same line again. Derived, there is no line to forget.
        return Object.fromEntries(
            LLM_PROVIDER_LIST.map((provider) => {
                return [provider.key, getLlmModelList(provider.key)];
            }),
        ) as Record<LlmProviderType, LlmModelType[]>;
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
    // WHAT HAS BEEN ASKED HERE BEFORE, newest first, and where the walk back
    // through it currently stands.
    //
    // One list for the whole window rather than one per tab (see
    // `askHistoryHelpers`), and seeded from the saved conversations the first
    // time, so Alt+↑ has something in it for everyone who was already using
    // this window before it could do this.
    const [askHistory, setAskHistory] = useState<string[]>(() => {
        return loadAskHistory(sessionState.sessions);
    });
    // -1 means the box holds the user's own words. 0 is the newest question.
    const [historyIndex, setHistoryIndex] = useState(NO_ASK_HISTORY_INDEX);
    // ...and those own words, held aside for as long as the walk is away from
    // them.
    const [stashedDraft, setStashedDraft] = useState('');
    // A walk belongs to the box it was started in. Switching tabs puts a
    // different half-written question in that box, and an Alt+↓ there would
    // otherwise hand it the other tab's words. React bails out of the render
    // when it is already at rest, so this costs a comparison per tab change.
    useAppEffect(() => {
        setHistoryIndex(NO_ASK_HISTORY_INDEX);
    }, [activeSessionId]);
    // Set by a recall, read once by the effect below. A question brought back
    // is a question about to be corrected or added to, and a caret left at
    // character zero makes every recall start with a press of End.
    const isCaretToEndRef = useRef(false);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    // The box grows with what is in it. A pasted verse, a log line and a
    // sentence a volunteer rewrote twice were all one scrolling line before,
    // with the beginning of the question out of sight while it was being
    // finished. Driven off `question` rather than off the change handler
    // because the draft is also written from outside the box -- a suggestion
    // taken, a question reused, a Stop giving the typed words back -- and each
    // of those has to leave the box the right height too.
    //
    // Height is reset to `auto` first so SHRINKING is measurable: `scrollHeight`
    // of an element already tall enough never goes back down on its own. The
    // ceiling is CSS's (`max-height` on `.chat-input`), which clamps this
    // inline height without any measuring here -- the window is 460px wide and
    // a composer that eats the conversation is worse than one that scrolls.
    useAppEffect(() => {
        const element = inputRef.current;
        if (element === null) {
            return;
        }
        element.style.height = 'auto';
        // `scrollHeight` counts the padding and not the border, while
        // Bootstrap's `border-box` makes the height it is written back into
        // count both -- so the box would settle two pixels short and scroll
        // for good. `offsetHeight - clientHeight` IS those borders, measured
        // rather than repeated from the stylesheet.
        const borders = element.offsetHeight - element.clientHeight;
        element.style.height = `${(element.scrollHeight + borders).toString()}px`;
        // Folded in here rather than given an effect of its own: it needs the
        // same one thing to have happened -- the new text is in the box -- and
        // this window runs on machines where a second subscription to the same
        // change is a second subscription too many. The flag is what keeps it
        // from firing on ordinary typing, where moving the caret to the end
        // would throw the user out of the word they are fixing.
        if (isCaretToEndRef.current) {
            isCaretToEndRef.current = false;
            const end = element.value.length;
            element.setSelectionRange(end, end);
        }
    }, [question]);
    const handleTipPressed = useCallback(() => {
        inputRef.current?.focus();
    }, []);
    const handleReusing = useCallback(
        (text: string) => {
            handleDrafting(text);
            inputRef.current?.focus();
        },
        [handleDrafting],
    );
    // Whether the empty window is showing its four chips or the whole list of
    // what it can be asked. Window state, not per-tab: it is a way of reading
    // the window rather than anything to do with a conversation, and a new tab
    // opened to look something up should not have to be opened again.
    const [isShowingAllQuestions, setIsShowingAllQuestions] = useState(false);
    // The suggestion list is dismissed per DRAFT, not per window: pressing
    // Escape must not silence it for the rest of the conversation, so typing
    // again brings it back.
    const [isSuggestDismissed, setIsSuggestDismissed] = useState(false);
    // What Report is waiting to be told to go ahead with -- the complaint it
    // quoted back, or null when nothing is being asked. See
    // `handleReportPressed`.
    const [reportAsk, setReportAsk] = useState<string | null>(null);
    const [suggestIndex, setSuggestIndex] = useState(-1);
    const starters = useStarterQuestions(focus);
    const matchedQuestions = useQuestionSuggestions(question, focus);
    // A box starting with `/` lists COMMANDS (`builtinActionHelpers`) and
    // nothing else: a question row under "/scr" would be offering to spend a
    // model call on something the person is about to do without one.
    const suggestions = useMemo((): SuggestRowType[] => {
        if (isSuggestDismissed || isBusy) {
            return [];
        }
        if (checkIsBuiltinCommand(question)) {
            // All of them: the list scrolls, and a command nobody can see
            // is a command nobody has.
            return matchBuiltinActions(question, 20).map((action) => {
                return {
                    id: `command.${action.name}`,
                    text: `/${action.name}`,
                    where: action.hint,
                    fill: toBuiltinCommandText(action),
                    isImmediate: !action.takesArgument,
                };
            });
        }
        return matchedQuestions.map(toQuestionSuggestRow);
    }, [isSuggestDismissed, isBusy, question, matchedQuestions]);
    /**
     * A question this window was asked, put where the next one is walked back
     * from. Only what came out of the BOX reaches here -- not a starter chip,
     * not one of the buttons under an answer -- because the walk exists to
     * save retyping, and a history filled with "Yes" is a walk past three
     * presses to reach the sentence that was worth keeping.
     */
    const rememberAsking = useCallback(
        (asked: string) => {
            const history = toAskHistoryAdded(askHistory, asked);
            setHistoryIndex(NO_ASK_HISTORY_INDEX);
            if (history === askHistory) {
                return;
            }
            setAskHistory(history);
            // Written on the spot rather than on the sessions' debounce: this
            // is one small write per question asked, and the thing it protects
            // against is the window being closed on the answer.
            saveAskHistory(history);
        },
        [askHistory],
    );
    /**
     * Alt+↑ (`step` 1, older) and Alt+↓ (`step` -1, newer).
     *
     * Alt rather than the bare arrows, which already belong to the caret --
     * the box holds several lines now -- and to the suggestion list. Nothing
     * is lost by walking: what was half-written when the first arrow was
     * pressed is put aside and handed back at the bottom of the walk.
     */
    const handleRecalling = useCallback(
        (step: number) => {
            const nextIndex = toAskHistoryIndex(
                askHistory.length,
                historyIndex,
                step,
            );
            if (nextIndex === historyIndex) {
                return;
            }
            if (historyIndex === NO_ASK_HISTORY_INDEX) {
                setStashedDraft(question);
            }
            setHistoryIndex(nextIndex);
            const text =
                nextIndex === NO_ASK_HISTORY_INDEX
                    ? stashedDraft
                    : askHistory[nextIndex];
            if (text !== question) {
                handleDrafting(text);
                isCaretToEndRef.current = true;
            }
            // A recalled question is one they have already asked, so the
            // type-ahead has nothing to offer it -- and it would open over the
            // conversation on every press of the arrow.
            setIsSuggestDismissed(true);
            setSuggestIndex(-1);
        },
        [askHistory, historyIndex, question, stashedDraft, handleDrafting],
    );
    const handleTypingQuestion = useCallback(
        (text: string) => {
            handleDrafting(text);
            setIsSuggestDismissed(false);
            setSuggestIndex(-1);
            // The box is theirs again the moment they type in it, so the next
            // Alt+↑ starts from the newest question rather than from wherever
            // the last walk stopped. What they have just typed is what the
            // walk hands back at the bottom.
            setHistoryIndex(NO_ASK_HISTORY_INDEX);
            // A question waiting to be confirmed quoted the box as it was.
            // Another word typed makes that quote a lie, so it goes.
            setReportAsk(null);
        },
        [handleDrafting],
    );
    // Set once `handleAsking` exists (it is declared further down and needs
    // most of this component): the one path by which choosing a suggestion
    // ASKS rather than fills -- a command with nothing to add to it.
    const askFromSuggestionRef = useRef<(text: string) => void>(() => {});
    const handleChoosingSuggestion = useCallback(
        (row: SuggestRowType) => {
            setIsSuggestDismissed(true);
            setSuggestIndex(-1);
            // A command with no words after it is complete as it stands, and
            // it costs nothing -- no model, no key -- so it runs on the press.
            if (row.isImmediate) {
                askFromSuggestionRef.current(row.fill);
                return;
            }
            // Filling the box rather than asking outright: the suggestion is a
            // starting point a volunteer often wants to add a word to, and an
            // answer they did not ask for costs them a call on their own key.
            handleDrafting(row.fill);
            inputRef.current?.focus();
        },
        [handleDrafting],
    );
    // ATTACHING. Five ways in -- the paperclip, a paste, a drop, the snapshot
    // button and the picker -- and every one of them ends here, so there is one
    // place that caps the count, one place that says why something was refused,
    // and one shape the ask reads.
    const draftAttachments = draftAttachmentMap[activeSessionId] ?? [];
    const addAttachments = useCallback(
        (added: ChatAttachmentType[], failure?: string) => {
            if (failure !== undefined) {
                setAttachError(failure);
            }
            if (added.length === 0) {
                return;
            }
            setAttachError(failure ?? null);
            setDraftAttachmentMap((previous) => {
                const existing = previous[activeSessionId] ?? [];
                const merged = [...existing, ...added];
                // Over the cap, the OLDEST go: the one just attached is the
                // one they are looking at, and dropping that would look like
                // the button had failed.
                const dropped = merged.slice(0, -MAX_ATTACHMENT_COUNT);
                for (const one of dropped) {
                    dropAttachmentData(one.id);
                }
                return {
                    ...previous,
                    [activeSessionId]: merged.slice(-MAX_ATTACHMENT_COUNT),
                };
            });
        },
        [activeSessionId],
    );
    const handleRemovingAttachment = useCallback(
        (id: string) => {
            dropAttachmentData(id);
            setAttachError(null);
            setDraftAttachmentMap((previous) => {
                return {
                    ...previous,
                    [activeSessionId]: (previous[activeSessionId] ?? []).filter(
                        (one) => {
                            return one.id !== id;
                        },
                    ),
                };
            });
        },
        [activeSessionId],
    );
    // A file the user chose, dropped or pasted. An image becomes a picture; a
    // text file becomes text; anything else is refused BY NAME, because "that
    // did not work" on a file they can see is worse than being told the app
    // cannot read a .docx.
    const addFiles = useCallback(
        async (files: File[]) => {
            const added: ChatAttachmentType[] = [];
            const refused: string[] = [];
            for (const file of files.slice(0, MAX_ATTACHMENT_COUNT)) {
                // Where it came from, when it came from anywhere: the electron
                // preload puts a getter on `File.prototype`, so this is the
                // real path for a drop and for the paperclip alike, and
                // undefined for a pasted picture that never had one.
                const filePath = (file as any).appFilePath || undefined;
                if (file.type.startsWith('image/')) {
                    const attachment = await genImageAttachment(
                        file,
                        file.name || 'picture',
                        filePath,
                    );
                    if (attachment === null) {
                        refused.push(file.name);
                    } else {
                        added.push(attachment);
                    }
                    continue;
                }
                if (checkIsReadableTextFile(file)) {
                    added.push(
                        genTextAttachment(
                            file.name,
                            await file.text(),
                            filePath,
                        ),
                    );
                    continue;
                }
                refused.push(file.name);
            }
            addAttachments(
                added,
                refused.length === 0
                    ? undefined
                    : `I cannot read ${refused.join(', ')} — ` +
                          'try a picture of it instead.',
            );
        },
        [addAttachments],
    );
    const handlePasting = useCallback(
        (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const files = [...(event.clipboardData?.items ?? [])]
                .filter((item) => {
                    return item.kind === 'file';
                })
                .map((item) => {
                    return item.getAsFile();
                })
                .filter((file): file is File => {
                    return file !== null;
                });
            if (files.length === 0) {
                // Ordinary text: let the box paste it as it always has.
                return;
            }
            event.preventDefault();
            addFiles(files);
        },
        [addFiles],
    );
    const handleDropping = useCallback(
        (event: React.DragEvent) => {
            const files = [...(event.dataTransfer?.files ?? [])];
            if (files.length === 0) {
                return;
            }
            event.preventDefault();
            addFiles(files);
        },
        [addFiles],
    );
    // A picture of the app as it is right now. Deliberately of the APP window,
    // not this one: the question is always about what is behind this window.
    const handleSnapping = useCallback(async () => {
        try {
            const dataUrl = await captureAppWindow();
            const attachment = await genImageAttachment(dataUrl, 'my screen');
            addAttachments(
                attachment === null ? [] : [attachment],
                attachment === null
                    ? 'I could not take a picture of the app.'
                    : undefined,
            );
        } catch (error: any) {
            setAttachError(`I could not take a picture: ${error.message}`);
        }
    }, [addAttachments]);
    // "This one." The window goes away while they point -- it is sitting on
    // top of the very control they are being asked to click.
    const handlePicking = useCallback(async () => {
        // Said BEFORE the call, not after it: starting the picker is an MCP
        // round trip and a script injection, which on a cold session is a
        // second or two of the button having visibly done nothing. The app is
        // still live in that gap, so a user who presses this and then clicks
        // the thing they meant really does press it -- the line is what stops
        // them.
        setAttachError('Point at the control you mean in the app window…');
        try {
            const raw = await callTool('owa_pick_element', {});
            const result = parseToolJson(raw);
            if (result?.picked !== true) {
                setAttachError(
                    result?.reason ?? 'Nothing was picked in the app window.',
                );
                return;
            }
            setAttachError(null);
            addAttachments([genElementAttachment(result.element)]);
        } catch (error: any) {
            setAttachError(`I could not do that: ${error.message}`);
        }
    }, [addAttachments]);
    // "Where is it?" -- the question a chip reading a control's name raises
    // the moment the user has looked away from the app. Rung by its SELECTOR
    // rather than by its words: the whole point of having pointed at it is
    // that the one they meant is the one that lights up, and half the labels
    // in this app are on more than one control.
    // Pressing a chip shows you the thing it stands for, and what "show" means
    // depends on what it is: a control is RUNG where it lives, a picture opens
    // big enough to read, and a file opens the folder it came from. Three
    // answers to one question -- "which one was that?" -- and every one of them
    // is the answer that thing can actually give.
    const handleShowingAttachment = useCallback(
        async (attachment: ChatAttachmentType) => {
            setAttachError(null);
            if (attachment.selector !== undefined) {
                try {
                    const result = parseToolJson(
                        await callTool('owa_highlight_selector', {
                            selector: attachment.selector,
                        }),
                    );
                    if (result?.found !== true) {
                        setAttachError(
                            result?.reason ??
                                'I could not point at that one any more.',
                        );
                    }
                } catch (error: any) {
                    setAttachError(
                        `I could not point at that: ${error.message}`,
                    );
                }
                return;
            }
            if (
                attachment.mimeType === 'application/x-owa-show' &&
                attachment.summary !== undefined &&
                attachment.filePath === undefined
            ) {
                // Named rather than resolved: the model wrote a control's
                // words, so the words are looked up NOW, against the window as
                // it is now, rather than against whatever it was when the
                // answer was written.
                try {
                    const result = parseToolJson(
                        await callTool('owa_find_ui', {
                            text: attachment.summary,
                            highlight: true,
                        }),
                    );
                    if (!result?.shownCount) {
                        setAttachError(
                            `I could not find "${attachment.name}" on screen.`,
                        );
                    }
                } catch (error: any) {
                    setAttachError(
                        `I could not point at that: ${error.message}`,
                    );
                }
                return;
            }
            if (checkIsAssetAttachment(attachment)) {
                // Every asset opens the same way now: the picture, the file
                // the user dropped in, the report just written, the song just
                // created. The overlay is where Download lives, so a chip
                // that used to open a folder BEHIND this window now opens
                // the thing itself, with the folder one press further on.
                // Remembered BEFORE the read, which can take a moment: when the
                // preview closes, the keyboard goes back to this chip.
                previewOpenerRef.current =
                    document.activeElement instanceof HTMLElement
                        ? document.activeElement
                        : null;
                setPreview(await readAssetPreview(attachment));
                return;
            }
            if (attachment.kind === 'element' && attachment.name.length > 0) {
                // A control whose selector could not be built is still a
                // control with WORDS on it, so it is looked up by those --
                // the same second chance an answer's own SHOWS: chip gets.
                // This is the last rung of a ladder, not a competitor to the
                // selector above it: pointing was how the user said WHICH one
                // they meant, and a name can land on its twin. It is offered
                // anyway because the alternative was a chip that answered
                // "there is nothing left to show for that one" -- which was
                // true of the code and not of the window, where the control
                // was sitting in plain sight the whole time.
                try {
                    const result = parseToolJson(
                        await callTool('owa_find_ui', {
                            text: attachment.name,
                            highlight: true,
                        }),
                    );
                    if (result?.shownCount) {
                        return;
                    }
                } catch (_error) {
                    // Fall through to the plain line below: a lookup that
                    // failed is not worth a second error on top of the first.
                }
                setAttachError(
                    `I could not find "${attachment.name}" on screen any` +
                        ' more.',
                );
                return;
            }
            setAttachError(
                attachment.kind === 'image'
                    ? 'That picture is not attached any more — send a new one.'
                    : 'There is nothing left to show for that one.',
            );
        },
        [],
    );
    // An asset in this window is one the user may want to keep -- their own
    // screenshot, the report just written, the song just created. Copy puts
    // it on the clipboard; Download writes a copy into Downloads and opens
    // the folder, which is the app's own existing way of handing a file over.
    const handleCopyingAsset = useCallback(
        async (preview: ChatAssetPreviewType) => {
            try {
                if (preview.imageDataUrl !== null) {
                    await copyImageToClipboard(preview.imageDataUrl);
                } else if (preview.text !== null) {
                    await navigator.clipboard.writeText(preview.text);
                } else {
                    return;
                }
                setAttachError('Copied.');
            } catch (error: any) {
                setAttachError(`I could not copy it: ${error.message}`);
            }
        },
        [],
    );
    const handleDownloadingAsset = useCallback(
        async (preview: ChatAssetPreviewType) => {
            // Closed first: the save opens a file-manager window, and leaving
            // a full-window preview over the app afterwards hides what it
            // opened.
            setPreview(null);
            try {
                setAttachError((await downloadAsset(preview)).message);
            } catch (error: any) {
                setAttachError(`I could not download it: ${error.message}`);
            }
        },
        [],
    );
    // Pressing what the assistant asked for. The same three handlers the
    // paperclip row uses -- an answer that asks for a picture and a button that
    // takes one have to be the same button, or the two will drift apart.
    const handleAttachRequest = useCallback(
        (request: AttachRequestType) => {
            if (request === 'screenshot') {
                handleSnapping();
                return;
            }
            if (request === 'element') {
                handlePicking();
                return;
            }
            fileInputRef.current?.click();
        },
        [handleSnapping, handlePicking],
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

    // No auto-hide here, on purpose (2026-09-10/11): the head and the ask
    // form were made to tuck away while the conversation scrolled, the box
    // came back the same afternoon and the head the next morning -- the user
    // wants every control of this window where it always is. The rows are
    // touched once a session, and a control that has to be found again is a
    // control in the way.
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

    // What one ask spends, folded into its tab round by round. Two totals
    // out of one stream of rounds: the ask's own, stamped on the answer when
    // it lands, and the tab's, written as each round comes back -- so a
    // question stopped after three rounds, or one that fails on its fourth,
    // still counts the three it paid for in the tab's line, which is the one
    // that says what the conversation has cost. Addressed by id like every
    // other write, for the same reason as `addMessage`.
    const genUsageTally = useCallback(
        (sessionId: string) => {
            let askUsage: ChatUsageType | undefined = undefined;
            return {
                onUsage: (round: LlmRoundUsageType) => {
                    askUsage = addRoundUsage(askUsage, round);
                    updateSession(sessionId, (session) => {
                        return {
                            ...session,
                            usage: addRoundUsage(session.usage, round),
                        };
                    });
                },
                // Spread into a message: nothing when no round came back.
                toField: () => {
                    return askUsage === undefined ? {} : { usage: askUsage };
                },
            };
        },
        [updateSession],
    );

    // Everything this window is currently waiting on, so the user can stop
    // waiting. One entry per ask -- there can be two, because a stuck
    // walkthrough card asks while the user's own question is still running --
    // and each one remembers the tab it belongs to, so the "stopped" line
    // lands in the conversation that asked rather than in whichever tab
    // happens to be in front when the button is pressed.
    const pendingAskListRef = useRef<PendingAskType[]>([]);
    const genPendingAsk = useCallback(
        (
            sessionId: string,
            onCancelled?: () => void,
            canTakeAdditions = true,
        ) => {
            const pending: PendingAskType = {
                controller: new AbortController(),
                sessionId,
                onCancelled,
                additions: [],
                takenAdditions: [],
                canTakeAdditions,
            };
            pendingAskListRef.current = [...pendingAskListRef.current, pending];
            return pending;
        },
        [],
    );
    const endPendingAsk = useCallback((pending: PendingAskType) => {
        pendingAskListRef.current = pendingAskListRef.current.filter((item) => {
            return item !== pending;
        });
    }, []);
    // Stop. Said in the transcript and cleared off the screen HERE, at the
    // press, rather than left to the abandoned call to get round to it: the
    // offline bot and the tool host both finish what they were doing whatever
    // this window thinks, and a Stop button that leaves "Looking it up…"
    // spinning for another two seconds is a Stop button nobody trusts. What
    // is stopped is the WAITING -- see `cancelHelpers`.
    const handleCancelling = useCallback(() => {
        const pendingList = pendingAskListRef.current;
        if (pendingList.length === 0) {
            return;
        }
        pendingAskListRef.current = [];
        setIsBusy(false);
        clearProgressSteps();
        for (const pending of pendingList) {
            pending.controller.abort();
            // Nothing the user typed is thrown away by a Stop. Anything they
            // added while this was running -- taken by the loop or not, since
            // a taken one never got an answer either -- goes back in the box
            // where they can see it and press Ask again.
            const unanswered = [
                ...pending.takenAdditions,
                ...pending.additions,
            ];
            if (unanswered.length > 0) {
                updateSession(pending.sessionId, (session) => {
                    return {
                        ...session,
                        draft: [session.draft, ...unanswered]
                            .filter((part) => {
                                return part.trim().length > 0;
                            })
                            .join('\n'),
                    };
                });
            }
            addMessage(pending.sessionId, {
                author: 'bot',
                text:
                    'Stopped. I did not finish looking that up — press the ' +
                    'question above to ask it again.',
            });
            // A card in the app window waiting on this one is told now, so it
            // falls back to its own written instruction instead of sitting on
            // "asking the assistant" until its timeout.
            pending.onCancelled?.();
        }
    }, [addMessage, updateSession]);
    const handleCancellingRef = useAppCurrentRef(handleCancelling);
    const previewRef = useAppCurrentRef(preview);
    // Escape is what a hurried person presses, and the box that already
    // handles it is disabled while an answer is on its way. Ignored while the
    // caret is in a field -- renaming a tab is also Escape, and that one
    // belongs to the rename.
    useAppEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }
            // A picture open over the conversation is what Escape closes
            // first. Stopping the answer underneath it as well would be two
            // things on one press, and only one of them was meant.
            //
            // Asked BEFORE the caret guard below, deliberately: the preview
            // covers the whole window, and it opens from a chip pressed while
            // the caret is still sitting in the ask box -- so the guard, which
            // is right for "stop the answer" and for a tab being renamed, was
            // swallowing the one press that dismisses an overlay over
            // everything. Escape did nothing at all until the user first
            // clicked the overlay.
            if (previewRef.current !== null) {
                setPreview(null);
                return;
            }
            const tagName = (
                document.activeElement?.tagName ?? ''
            ).toLowerCase();
            if (tagName === 'input' || tagName === 'textarea') {
                return;
            }
            handleCancellingRef.current();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleAsking = useCallback(
        // `isForced` is for the follow-up `handleActing` fires the moment its
        // own tool call finishes: `setIsBusy(false)` has been called but React
        // has not re-rendered, so the busy flag this closure can see is still
        // true and the ask would be dropped without a word.
        //
        // `options` is for the one ask nobody typed: a walkthrough card stuck
        // on a step, asking on the user's behalf. Such an ask needs three
        // things this one did not. A `note`, because a transcript showing the
        // user asking something they never asked is worse than no transcript.
        // `shownText`, because what the MODEL has to be told -- the step, the
        // failure, the shape the reply has to take -- is machine instruction,
        // and printing it at a volunteer is exactly the internals leak the
        // rest of this window works to avoid. And `onAnswered`, because the
        // answer is drawn on the card in the other window, not only read here.
        async (
            asked: string,
            isForced = false,
            options?: {
                note?: string;
                shownText?: string;
                // Applied to the answer BEFORE it is shown or handed on, so
                // the transcript and the card say the same words. Without it
                // the card got the tidied sentence and this window printed
                // the model's raw frame ("DO: ...") at the user.
                formatAnswer?: (text: string) => string;
                // Ask with NOTHING behind it. A rescue is a fresh
                // diagnosis of the window as it is right now, and the
                // tab it lands in fills up with earlier rescues -- so
                // the model is handed its own previous answer to a
                // nearly identical question and repeats it instead of
                // looking. Measured live: with the history in, the same
                // wrong answer came back 10 times out of 10 in 2
                // seconds, no tool called -- and the good runs before
                // it were simply a tab whose history happened to be
                // right. One bad rescue would otherwise poison every
                // rescue in that tab for good.
                withoutHistory?: boolean;
                // ...and do not hand the question to the offline
                // manual bot when the model call fails. See the catch
                // below: it answers a machine-written prompt as though
                // it were a volunteer's question.
                withoutOfflineFallback?: boolean;
                // Ask without echoing the question into the transcript, and
                // say on the ANSWER why it is there. One caller: an addition
                // that arrived too late to be folded in, which the user has
                // already seen themselves press Add on -- showing it a second
                // time would read as the window asking twice.
                withoutEcho?: boolean;
                answerNote?: string;
                onAnswered?: (text: string | null) => void;
            },
        ) => {
            const trimmedAsked = asked.trim();
            // An attachment IS a question -- "what is this?" with a picture of
            // the screen is the whole ask -- so an empty box with something
            // clipped to it is allowed through, where an empty box alone is
            // still nothing.
            const asking = draftAttachmentMapRef.current[activeSessionId] ?? [];
            const attachments = options?.shownText === undefined ? asking : [];
            if (
                (trimmedAsked.length === 0 && attachments.length === 0) ||
                (isBusy && !isForced)
            ) {
                return;
            }
            // A COMMAND runs here, on the spot, with no model and no key --
            // see `builtinActionHelpers`. Nothing typed after the slash goes
            // to a provider, no history goes with it, and nothing attached
            // goes either: a command has nowhere to put a picture, so the
            // attachments stay in the box for the next real question.
            if (
                options?.shownText === undefined &&
                checkIsBuiltinCommand(trimmedAsked)
            ) {
                const commandSessionId = activeSessionId;
                const commandFocus = isFocusChosen
                    ? focus
                    : (detectOpenerFocus() ?? focus);
                addMessage(commandSessionId, {
                    author: 'you',
                    text: trimmedAsked,
                });
                updateSession(commandSessionId, (session) => {
                    return { ...session, draft: '' };
                });
                const pending = genPendingAsk(
                    commandSessionId,
                    undefined,
                    false,
                );
                clearProgressSteps();
                setIsBusy(true);
                try {
                    const answer = await runBuiltinCommand(
                        trimmedAsked,
                        commandFocus,
                        pushProgressStep,
                        // The one fact a command answers that lives in this
                        // window and nowhere a tool can read: what the tab
                        // has spent. Read through the ref, for the tab that
                        // TYPED it.
                        sessionStateRef.current.sessions.find((session) => {
                            return session.id === commandSessionId;
                        })?.usage,
                    );
                    if (pending.controller.signal.aborted) {
                        return;
                    }
                    addMessage(commandSessionId, {
                        author: 'bot',
                        text: answer.text,
                        actions: answer.actions,
                    });
                } finally {
                    endPendingAsk(pending);
                    setIsBusy(pendingAskListRef.current.length > 0);
                    if (pendingAskListRef.current.length === 0) {
                        clearProgressSteps();
                    }
                }
                return;
            }
            const images = toBotImages(attachments);
            // Refused BEFORE a call is made rather than after one fails: a
            // model with no eyes answers a picture with a 400, which
            // `describeLlmError` reads as an unreachable service and would
            // tell a volunteer their internet is down.
            if (images.length > 0 && !checkCanSeeImages(provider, model)) {
                setAttachError(BLIND_MODEL_MESSAGE);
                return;
            }
            // Pinned before the first await: everything this ask writes goes
            // to the tab that asked it, whichever one is in front by the time
            // the answer comes back.
            const askedSessionId = activeSessionId;
            // Everything already said in THIS tab, read through the ref and
            // read BEFORE the new question is appended: this callback is not
            // rebuilt when a message lands, so the session it closed over is
            // whatever the tab held when it was made. Without it every
            // question was asked on its own and "yes" meant nothing.
            const priorTurns = options?.withoutHistory
                ? []
                : (
                      sessionStateRef.current.sessions.find((session) => {
                          return session.id === askedSessionId;
                      })?.messages ?? []
                  ).map(toHistoryTurn);
            if (options?.withoutEcho !== true) {
                addMessage(askedSessionId, {
                    author: 'you',
                    text: options?.shownText ?? trimmedAsked,
                    note: options?.note,
                    ...(attachments.length > 0 ? { attachments } : {}),
                });
            }
            updateSession(askedSessionId, (session) => {
                return { ...session, draft: '' };
            });
            if (attachments.length > 0) {
                // Off the box the moment they are asked with. They stay
                // readable in the transcript above, which is where a sent
                // attachment belongs.
                setDraftAttachmentMap((previous) => {
                    return { ...previous, [askedSessionId]: [] };
                });
                setAttachError(null);
            }
            // Registered before the first await, so a Stop pressed a moment
            // later has something to abort.
            const pending = genPendingAsk(
                askedSessionId,
                () => {
                    options?.onAnswered?.(null);
                },
                options?.shownText === undefined,
            );
            const { signal } = pending.controller;
            const usageTally = genUsageTally(askedSessionId);
            // Last question's steps off the line before this one's go up.
            // They are cleared when an ask ENDS too; this is the one that
            // matters, because the window between the line appearing and the
            // first step arriving is exactly where a stale list would be read
            // as what is happening now.
            clearProgressSteps();
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
                let answer: LlmBotAnswerType;
                let note = options?.answerNote;
                // What the MODEL is asked is the question plus whatever the
                // attachments say in words -- and, for a bare picture, the
                // question a bare picture is. The TRANSCRIPT keeps the
                // user's own sentence instead: a bubble reading back a
                // control's selector, or words they never typed, is exactly
                // what this window exists to avoid.
                const askedOfModel = toAskedOfModel(trimmedAsked, attachments);
                // A question picked off the app's own list -- a chip, the
                // suggestion list, More… -- is one the corpus has already
                // filed under a page. The model is told which, on the ask
                // alone (see `genKnownQuestionHint`); the transcript keeps
                // the user's own words. Not for a rescue, whose ask is
                // machine-written and never a corpus row.
                const knownQuestion =
                    options?.shownText === undefined
                        ? await findKnownQuestion(trimmedAsked, activeFocus)
                        : null;
                const knownHint =
                    knownQuestion === null
                        ? null
                        : genKnownQuestionHint(knownQuestion);
                const askedWithHint =
                    knownHint === null
                        ? askedOfModel
                        : `${askedOfModel}\n\n${knownHint}`;
                // The offline bot searches the manual, which cannot answer a
                // picture: it has no eyes, and the stand-in question above is
                // not something to search for either -- handed it, it answers
                // some unrelated recipe with total confidence. So when the
                // picture WAS the question, the honest line is that it cannot
                // see it, and asking for words is the way out of that.
                const askOffline = async (): Promise<BotAnswerType> => {
                    if (trimmedAsked.length === 0 && images.length > 0) {
                        return {
                            text:
                                'I cannot look at pictures while I am ' +
                                'offline. Tell me in a few words what you ' +
                                'can see and what you were trying to do, ' +
                                'and I will look it up in the guide.',
                        };
                    }
                    return await askHelpBot(
                        trimmedAsked,
                        activeFocus,
                        priorTurns,
                    );
                };
                if (provider !== null) {
                    try {
                        answer = await askLlmBot(
                            askedWithHint,
                            activeFocus,
                            provider,
                            model,
                            priorTurns,
                            signal,
                            {
                                images,
                                // Pulled by the loop between rounds. The
                                // splice is the handover: what comes out of
                                // the queue is what was folded in, so nothing
                                // else has to be told which happened.
                                takeAdditions: pending.canTakeAdditions
                                    ? () => {
                                          const taken =
                                              pending.additions.splice(0);
                                          pending.takenAdditions.push(...taken);
                                          return taken;
                                      }
                                    : undefined,
                                // Straight into the store the waiting line
                                // reads. Nothing is filtered on the way: a
                                // step the loop opened is a step that is
                                // happening, and deciding here which ones
                                // are worth showing is how a line ends up
                                // saying something the app is not doing.
                                onProgress: pushProgressStep,
                                onUsage: usageTally.onUsage,
                            },
                        );
                        // Another key of the user's own answered because the
                        // tab's provider could not (see `askLlmBot`). Said
                        // on the answer, and the TAB moves to the one that
                        // answered -- the head row must show who is being
                        // asked, and a tab left on a dead key would pay
                        // the failed call again on every question. The
                        // stored default for NEW tabs is left alone: it is
                        // the user's choice, and a key topped up tomorrow
                        // must be back without anybody having to know a
                        // setting was changed behind them.
                        if (answer.standIn !== undefined) {
                            const { standIn } = answer;
                            const toLabel = (key: LlmProviderType) => {
                                return (
                                    LLM_PROVIDER_LIST.find((item) => {
                                        return item.key === key;
                                    })?.label ?? key
                                );
                            };
                            const failedLabel = toLabel(standIn.failedProvider);
                            note =
                                `${failedLabel} could not answer — ` +
                                `${standIn.reason}. ` +
                                `${toLabel(standIn.provider)} answered ` +
                                'instead and this chat now uses it; pick ' +
                                `${failedLabel} in the row above to ` +
                                'switch back.';
                            // The door to what went wrong, under the note:
                            // the billing page for an empty account, the
                            // keys page for a refused one. Named for the
                            // provider that FAILED, not the one answering --
                            // a user with two keys must not top up the
                            // wrong one.
                            answer.actions = [
                                ...genProviderIssueActions(
                                    standIn.failedProvider,
                                    standIn.issue,
                                    failedLabel,
                                ),
                                ...(answer.actions ?? []),
                            ];
                            updateSession(askedSessionId, (session) => {
                                return {
                                    ...session,
                                    provider: standIn.provider,
                                    model: standIn.model,
                                };
                            });
                        }
                    } catch (error: any) {
                        // Stopping is not a provider that could not answer:
                        // it must not print an apology in this tab and it
                        // must not send the question on to the offline bot,
                        // which would answer it a second later as though
                        // nobody had pressed anything.
                        if (checkIsCancelError(error, signal)) {
                            throw error;
                        }
                        // The spend guard said no (see `spendGuardHelpers`).
                        // Not a provider that could not answer: the
                        // provider was never asked, the sentence is the
                        // guard's own, and it comes with the one button
                        // that lifts it. The offline guide still answers
                        // underneath, because it costs nothing -- except
                        // for a rescue, whose machine-written ask the guide
                        // would answer with total confidence about the
                        // wrong thing.
                        if (checkIsSpendLimitError(error)) {
                            const allowAction: BotActionType = {
                                label: SPEND_ALLOW_LABEL,
                                toolName: SPEND_ALLOW_TOOL_NAME,
                                // The question is carried so the press can
                                // ask it again -- a typed one only; a
                                // rescue's words are nobody's question.
                                args:
                                    options?.shownText === undefined
                                        ? { question: trimmedAsked }
                                        : {},
                            };
                            if (options?.withoutOfflineFallback) {
                                addMessage(askedSessionId, {
                                    author: 'bot',
                                    text: error.message,
                                    actions: [allowAction],
                                });
                                options.onAnswered?.(null);
                                return;
                            }
                            answer = await askOffline();
                            answer.actions = [
                                allowAction,
                                ...(answer.actions ?? []),
                            ];
                            note =
                                `${error.message} ` +
                                describeOfflineStandIn(answer);
                        } else {
                            const label = LLM_PROVIDER_LIST.find((item) => {
                                return item.key === provider;
                            })?.label;
                            // The door to what went wrong, under the note.
                            // The thrown line carries the SDK's error as its
                            // `cause`, and what KIND of failure that was
                            // decides the buttons (`genProviderIssueActions`)
                            // -- the billing page for an empty account, the
                            // keys page for a refused one. An error with no
                            // cause (the tool host, a bug) gets none.
                            const issueActions =
                                error?.cause === undefined
                                    ? []
                                    : genProviderIssueActions(
                                          provider,
                                          readLlmIssue(error.cause).kind,
                                          label ?? provider,
                                      );
                            if (options?.withoutOfflineFallback) {
                                // A rescue asked about THIS window and this
                                // step. The offline bot searches the manual,
                                // so handed a machine-written rescue prompt
                                // it answers a different question with total
                                // confidence: measured live, an out-of-credit
                                // key turned every rescue into "No
                                // presentation screen is showing right now",
                                // 10 times out of 10, drawn on the card as
                                // though it were the answer. The card's own
                                // plain instruction is the honest offline
                                // answer, so say nothing and let it fall
                                // back to that.
                                addMessage(askedSessionId, {
                                    author: 'bot',
                                    text: describeAskFailure(
                                        label ?? provider,
                                        error,
                                    ),
                                    ...(issueActions.length > 0
                                        ? { actions: issueActions }
                                        : {}),
                                });
                                options.onAnswered?.(null);
                                return;
                            }
                            answer = await askOffline();
                            answer.actions = [
                                ...issueActions,
                                ...(answer.actions ?? []),
                            ];
                            note =
                                `${describeAskFailure(label ?? provider, error)} ` +
                                describeOfflineStandIn(answer);
                        }
                    }
                    // The amber line, said once on the answer that crossed
                    // it -- a figure in the head row is easy to miss, and
                    // the pause it warns of is a surprise otherwise.
                    const nearLimitNotice = takeNearLimitNotice();
                    if (nearLimitNotice !== null) {
                        note =
                            note === undefined
                                ? nearLimitNotice
                                : `${note} ${nearLimitNotice}`;
                    }
                } else {
                    answer = await askOffline();
                }
                // The offline bot and the reply layers below it are local and
                // fast, but they are not instant, and an answer that lands
                // after the user gave up is the window answering a question
                // nobody is still asking. The transcript already says so --
                // `handleCancelling` wrote that line at the press.
                if (signal.aborted) {
                    return;
                }
                const shownAnswer =
                    options?.formatAnswer?.(answer.text) ?? answer.text;
                // What they can press instead of typing the next message.
                // Worked out ONCE, here, and carried on the message: the
                // best of them were written by the model that wrote this
                // answer, and reopening the window cannot re-derive those.
                // Skipped for an ask nobody typed -- that answer is one line
                // drawn on a card in another window, and buttons under it in
                // this transcript would belong to nobody.
                const replies =
                    options?.shownText === undefined
                        ? await genMessageReplies({
                              modelOptions: answer.replies,
                              answerText: shownAnswer,
                              askedText: trimmedAsked,
                              actionLabels: (answer.actions ?? []).map(
                                  (action) => {
                                      return action.label;
                                  },
                              ),
                              focus: activeFocus,
                          })
                        : [];
                if (signal.aborted) {
                    return;
                }
                addMessage(askedSessionId, {
                    author: 'bot',
                    text: shownAnswer,
                    note,
                    actions: answer.actions,
                    ...usageTally.toField(),
                    ...(replies.length > 0 ? { replies } : {}),
                    ...(answer.attachRequests !== undefined &&
                    options?.shownText === undefined
                        ? { attachRequests: answer.attachRequests }
                        : {}),
                    ...(answer.shows !== undefined &&
                    options?.shownText === undefined
                        ? { shows: answer.shows }
                        : {}),
                });
                options?.onAnswered?.(shownAnswer);
            } catch (error: any) {
                // Already said, and already answered to the card, by
                // `handleCancelling`.
                if (checkIsCancelError(error, signal)) {
                    return;
                }
                addMessage(askedSessionId, {
                    author: 'bot',
                    // The app's own tool host failing is said in a sentence
                    // of its own, with what to do about it -- prefixed, it
                    // read "I could not answer that: The assistant service
                    // answered 500", a status code and nothing to press.
                    text: checkIsToolHostError(error)
                        ? error.message
                        : `I could not answer that: ${error.message}`,
                    // The rounds a failed question paid for before it failed.
                    ...usageTally.toField(),
                });
                // Told either way: a card left waiting on an answer that is
                // never coming sits on "asking the assistant" until its own
                // timeout, when the user could have had the plain instruction
                // back at once.
                options?.onAnswered?.(null);
            } finally {
                endPendingAsk(pending);
                // Busy for as long as ANYTHING is still on its way. Written
                // off the list rather than as a flat `false`, because two asks
                // can overlap -- a stuck walkthrough card asks while the
                // user's own question is still running -- and the first one
                // home used to take the other one's spinner down with it.
                setIsBusy(pendingAskListRef.current.length > 0);
                if (pendingAskListRef.current.length === 0) {
                    clearProgressSteps();
                }
                // Anything they added too late to be folded in. The model had
                // already stopped looking things up, so there was no round
                // left to carry it -- it becomes its own question, and the
                // note says so, because this is the one answer in the window
                // that spends a call nobody pressed Ask for.
                const leftover = pending.additions.splice(0);
                if (leftover.length > 0 && !signal.aborted) {
                    handleAskingRef.current(leftover.join('\n'), true, {
                        withoutEcho: true,
                        answerNote:
                            'You added that after I had finished looking, so ' +
                            'there was no round left to fold it into — I ' +
                            'asked it on its own.',
                    });
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isBusy, focus, isFocusChosen, provider, model, activeSessionId],
    );

    const handleAskingRef = useAppCurrentRef(handleAsking);
    askFromSuggestionRef.current = (text: string) => {
        // It came out of the box, so Alt+↑ can bring it back like anything
        // else typed there.
        rememberAsking(text);
        handleAsking(text);
    };

    /**
     * A question picked off a list rather than typed -- one of the four chips,
     * or any row of the full list behind More.
     *
     * One handler for both, because the rule they share is easy to lose on the
     * second copy: a TEMPLATE has a blank in it, so it goes in the box to be
     * finished rather than being asked as it stands. Asked as it stands, the
     * assistant obediently goes off and reads `example.com`.
     */
    const handlePickingQuestion = useCallback(
        (starter: StarterQuestionType) => {
            if (starter.isTemplate) {
                handleReusing(starter.text);
                return;
            }
            handleAsking(starter.text);
        },
        [handleReusing, handleAsking],
    );

    /**
     * More information, typed while the answer is already being written.
     *
     * The box used to be disabled for exactly this stretch, so a question
     * asked with a detail missing had to be STOPPED and asked again -- paying
     * twice, and throwing away every round already bought. Now it goes to the
     * ask that is running: the loop picks it up before it buys its next round,
     * and the answer accounts for it.
     *
     * Routed off the pending LIST rather than off `isBusy`, which in this
     * closure is the stale value `isForced` exists for -- and never to a
     * walkthrough rescue, whose answer is one line drawn on a card in another
     * window where the user would never see their own aside.
     */
    const handleAdding = useCallback(() => {
        const text = question.trim();
        if (text.length === 0) {
            return;
        }
        // Typed in the same box and sent by the same press, so it is walked
        // back to the same way -- whether it was folded into the answer or
        // asked on its own.
        rememberAsking(text);
        const pending = pendingAskListRef.current.find((one) => {
            return one.sessionId === activeSessionId && one.canTakeAdditions;
        });
        if (pending === undefined) {
            // Only a rescue is running here, or nothing is: this is an
            // ordinary question of their own.
            handleAsking(text, true);
            return;
        }
        pending.additions.push(text);
        addMessage(activeSessionId, {
            author: 'you',
            text,
            note: 'Added while it was working.',
        });
        updateActiveSession((session) => {
            return { ...session, draft: '' };
        });
    }, [
        question,
        activeSessionId,
        addMessage,
        handleAsking,
        rememberAsking,
        updateActiveSession,
    ]);
    // The model to offer when the chosen one cannot see a picture.
    const seeingModel = useMemo(() => {
        return getFirstImageCapableModel(provider);
    }, [provider]);

    // A walkthrough card in the app window, stuck on a step it cannot do for
    // the user. It asks here instead of apologising, and the answer goes back
    // to the card rather than only into this transcript: this window has been
    // minimised for the length of the walkthrough, the user is looking at the
    // app, and bringing the help window back over the control they are about
    // to press would undo the fix while delivering it.
    //
    // Registered once and driven through the ref, because the callback it
    // needs is rebuilt on every keystroke in the box.
    useAppEffect(() => {
        const handleGuideHelp = (
            _event: any,
            request: GuideHelpRequestType,
        ) => {
            const answerCard = (text: string | null) => {
                appProvider.messageUtils.sendData('all:app:guide-help-answer', {
                    token: request?.token,
                    text: text ?? '',
                });
            };
            // Forced: the card is waiting on this, and whatever this window
            // happens to be busy with is not what the user is looking at.
            handleAskingRef.current(
                genGuideRescueQuestion(request ?? {}),
                true,
                {
                    note: 'Asked by the walkthrough card, not by you.',
                    shownText: genGuideRescueSummary(request ?? {}),
                    formatAnswer: toGuideRescueAnswer,
                    withoutHistory: true,
                    withoutOfflineFallback: true,
                    onAnswered: answerCard,
                },
            );
        };
        appProvider.messageUtils.listenForData(
            'main:app:guide-help',
            handleGuideHelp,
        );
        return () => {
            appProvider.messageUtils.removeListener(
                'main:app:guide-help',
                handleGuideHelp,
            );
        };
    }, []);

    // A picture sent over from the app's Presenting Control.
    //
    // Two ways in, because the same press that takes the snapshot also opens
    // this window: one is pushed when the window was already up, and one is
    // COLLECTED on mount for the case where it was not -- a renderer that is
    // still loading has nobody listening yet, and "the camera did nothing" is
    // a worse bug than a picture landing a beat late.
    const addSnapshotRef = useAppCurrentRef(async (payload: any) => {
        const dataUrl = payload?.dataUrl;
        if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
            return;
        }
        const attachment = await genImageAttachment(dataUrl, 'my screen');
        if (attachment !== null) {
            addAttachments([attachment]);
            inputRef.current?.focus();
        }
    });
    useAppEffect(() => {
        const handleAttaching = (_event: any, data: any) => {
            addSnapshotRef.current(data ?? {});
        };
        appProvider.messageUtils.listenForData(
            'main:app:chat-attach',
            handleAttaching,
        );
        addSnapshotRef.current(
            appProvider.messageUtils.sendDataSync(
                'main:app:take-chat-attachment',
            ) ?? {},
        );
        return () => {
            appProvider.messageUtils.removeListener(
                'main:app:chat-attach',
                handleAttaching,
            );
        };
    }, []);

    /**
     * REPORT. The one button in this window that is not a question.
     *
     * What the user has is not "how do I", it is "this is wrong" -- and the
     * report that would actually help someone fix it is the part they cannot
     * write while a service is running. So the window writes it: it takes
     * their sentence, photographs the app as it stands, reads the build, the
     * window, the screens and the console for itself, and only THEN asks the
     * model to go and look. Nothing is sent by this button; the report is
     * prepared, shown, and waits for a second press. See `reportHelpers`.
     *
     * The complaint is handed in rather than read here, because by the time
     * this runs the user has confirmed it on a line that quoted it back to
     * them -- see `handleReportPressed`.
     */
    const handleReporting = useCallback(
        async (complaint: string) => {
            const reportedSessionId = activeSessionId;
            const session = sessionStateRef.current.sessions.find((one) => {
                return one.id === reportedSessionId;
            });
            addMessage(reportedSessionId, {
                author: 'you',
                text: complaint,
                note: 'Reporting a problem.',
            });
            updateSession(reportedSessionId, (one) => {
                return { ...one, draft: '' };
            });
            // Stoppable like an ask, and registered before the first await for
            // the same reason. Additions are refused: this is not a question the
            // user can add a sentence to halfway through.
            const pending = genPendingAsk(reportedSessionId, undefined, false);
            const { signal } = pending.controller;
            // A report's investigation is a model ask like any other, and it
            // is charged to the tab like any other.
            const usageTally = genUsageTally(reportedSessionId);
            // Where the report should go, looked up NOW so the live help
            // page is read while the investigation runs rather than after
            // it -- the page can take seconds, and so does the model.
            const contactPromise = findContactEmail();
            setIsBusy(true);
            try {
                // The picture FIRST, before the investigation starts clicking
                // about the window: the evidence is the app as it was when the
                // problem was reported, not as the assistant left it.
                let shot: ChatAttachmentType | null = null;
                try {
                    shot = await genImageAttachment(
                        await captureAppWindow(),
                        'app screen',
                    );
                } catch (_error) {
                    // A report with no picture is still a report.
                }
                if (signal.aborted) {
                    return;
                }
                const turns = (session?.messages ?? []).map(toHistoryTurn);
                const evidence = await collectReportEvidence(turns, signal);
                if (signal.aborted) {
                    return;
                }
                let answerText = '';
                let note: string | undefined = undefined;
                // The door to a provider that could not investigate, beside
                // Send report -- the same one an ordinary answer gets.
                let issueActions: BotActionType[] = [];
                if (provider === null) {
                    note =
                        'No assistant is set up here, so this is what the window ' +
                        'could see for itself.';
                } else {
                    try {
                        // Asked directly rather than through `handleAsking`: an
                        // ordinary answer comes back with walkthrough buttons on
                        // it, and "show me step by step" under a bug report is
                        // the window offering to demonstrate the fault.
                        const answer = await askLlmBot(
                            genReportInvestigation(complaint, evidence),
                            focus,
                            provider,
                            model,
                            turns,
                            signal,
                            { onUsage: usageTally.onUsage },
                        );
                        answerText = answer.text;
                    } catch (error: any) {
                        if (checkIsCancelError(error, signal)) {
                            throw error;
                        }
                        // The evidence is already collected and it is the half a
                        // maintainer cannot get any other way, so a model that
                        // could not answer costs the report its diagnosis, not
                        // the report itself.
                        note =
                            `I could not look into it — ${error.message}. The ` +
                            'report still carries what the window could see for ' +
                            'itself.';
                        if (error?.cause !== undefined) {
                            issueActions = genProviderIssueActions(
                                provider,
                                readLlmIssue(error.cause).kind,
                                LLM_PROVIDER_LIST.find((item) => {
                                    return item.key === provider;
                                })?.label ?? provider,
                            );
                        }
                    }
                }
                const report = genPreparedReport({
                    complaint,
                    answerText,
                    evidence,
                    imageDataUrl:
                        shot === null
                            ? null
                            : (getAttachmentData(shot.id) ?? null),
                    // Named in the document so a maintainer can weigh the
                    // diagnosis by who wrote it; nobody when no model did.
                    investigatedBy:
                        provider === null || answerText.length === 0
                            ? null
                            : `${
                                  LLM_PROVIDER_LIST.find((item) => {
                                      return item.key === provider;
                                  })?.label ?? provider
                              } (${model})`,
                    contact: await contactPromise.catch(() => {
                        return null;
                    }),
                });
                keepPreparedReport(report);
                addMessage(reportedSessionId, {
                    author: 'bot',
                    ...usageTally.toField(),
                    text:
                        (report.summary.length > 0
                            ? `${report.summary}\n\n`
                            : '') +
                        `I have written this up as "${report.title}". Press Send ` +
                        'report when you want it filed — nothing goes anywhere ' +
                        'until you do.',
                    note,
                    actions: [
                        {
                            label: 'Send report',
                            toolName: REPORT_SEND_TOOL_NAME,
                            args: { reference: report.reference },
                        },
                        ...issueActions,
                    ],
                    ...(shot === null ? {} : { attachments: [shot] }),
                });
            } catch (error: any) {
                if (checkIsCancelError(error, signal)) {
                    return;
                }
                addMessage(reportedSessionId, {
                    author: 'bot',
                    text: `I could not put a report together: ${error.message}`,
                });
            } finally {
                endPendingAsk(pending);
                setIsBusy(pendingAskListRef.current.length > 0);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSessionId, focus, provider, model],
    );

    /**
     * The FIRST press on Report, which does nothing but ask.
     *
     * Report sits directly under Ask, which is where a hurried hand lands,
     * and what it starts is not free: a model call, a picture of the app, a
     * minute of the user's attention and two files on their disk. So the
     * press only puts the question up -- with what is about to be reported
     * quoted back, because the box is often empty and the complaint is then
     * the last thing they asked, which is not what a hurried presser expects.
     *
     * The one press that skips the question is the one with nothing to
     * report: there is no point confirming a no-op.
     */
    const handleReportPressed = useCallback(() => {
        const session = sessionStateRef.current.sessions.find((one) => {
            return one.id === activeSessionId;
        });
        const typed = question.trim();
        // With an empty box the complaint is the last thing they asked --
        // after a wrong answer that is exactly the problem they mean.
        const lastAsked =
            [...(session?.messages ?? [])].reverse().find((message) => {
                return message.author === 'you';
            })?.text ?? '';
        const complaint = typed.length > 0 ? typed : lastAsked;
        if (complaint.length === 0) {
            addMessage(activeSessionId, {
                author: 'bot',
                text:
                    'Tell me what went wrong first — one line in your own ' +
                    'words in the box, then press Report. I will look at the ' +
                    'app myself and write the rest of it.',
            });
            inputRef.current?.focus();
            return;
        }
        setReportAsk(complaint);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSessionId, question, addMessage]);

    /**
     * The second press, and the only one that writes anything. What it does
     * NOT do is claim the report went somewhere: there is no issue tracker
     * for this app yet, so it says so and hands back the file instead. The
     * day an endpoint exists, `postIssueReport` sends and this line changes.
     */
    const handleSendingReport = useCallback(
        async (reference: string, sessionId: string) => {
            const report = takePreparedReport(reference);
            if (report === null) {
                addMessage(sessionId, {
                    author: 'bot',
                    text:
                        'That report is not prepared any more — this window ' +
                        'has been reopened since. Press Report again and I ' +
                        'will put a new one together.',
                });
                return;
            }
            const posted = await postIssueReport(report);
            const shows: ShowRefType[] = [];
            if (posted.filePath !== null) {
                shows.push({
                    kind: 'file',
                    value: posted.filePath,
                    name: `${posted.reference}.md`,
                });
            }
            if (posted.imageFilePath !== null) {
                shows.push({
                    kind: 'file',
                    value: posted.imageFilePath,
                    name: `${posted.reference}.png`,
                });
            }
            const imageFileName =
                posted.imageFilePath === null
                    ? null
                    : `${posted.reference}.png`;
            const text =
                posted.failure !== null
                    ? `${posted.failure} The report is called ` +
                      `${posted.reference}.`
                    : posted.isSent
                      ? `Sent. The report is ${posted.reference} — I kept a ` +
                        'copy on this machine too.'
                      : `Report ${posted.reference} is ready. There is no ` +
                        'issue tracker connected to this app yet, so nothing ' +
                        'was sent — I saved the whole thing into your ' +
                        'Downloads folder.\n\n' +
                        describeHowToSend(report, imageFileName);
            addMessage(sessionId, {
                author: 'bot',
                text,
                // Offered whatever the saving did: with the file gone wrong,
                // the clipboard is the only way the report leaves this
                // window at all.
                actions: genReportFollowUpActions(report),
                ...(shows.length > 0 ? { shows } : {}),
            });
        },
        [addMessage],
    );

    /**
     * The three buttons under a saved report: the report onto the clipboard,
     * the maintainers' address onto the clipboard, or the user's own mail app
     * opened with both filled in. Caught before any tool call exactly as Send
     * is -- pseudo tools the server never registers -- and the address is
     * read off the package at the press, never off the button: a session
     * file is hand-editable, and a button that carried an address would
     * carry whichever one somebody wrote into it.
     */
    const handleReportExtra = useCallback(
        async (action: BotActionType, sessionId: string) => {
            const reference = String(action.args?.reference ?? '');
            // The address the document itself names, while the window still
            // holds the report; found again (the help page first) when not,
            // so a reopened window offers today's address too.
            const kept = takePreparedReport(reference);
            const contact =
                kept !== null && kept.contactEmail !== null
                    ? { email: kept.contactEmail, source: kept.contactSource }
                    : await findContactEmail();
            const contactEmail = contact?.email ?? null;
            const contactSource = describeContactSource(
                contact?.source ?? null,
            );
            const copyText = async (text: string) => {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (_error) {
                    // Said out loud rather than swallowed, like every Copy
                    // in this window: one that looks like it worked and did
                    // not is worse than one that admits it.
                    return false;
                }
            };
            const noAddressText =
                'This build carries no contact address — pass the saved ' +
                'report on to whoever maintains the app for you.';
            if (action.toolName === REPORT_COPY_EMAIL_TOOL_NAME) {
                if (contactEmail === null) {
                    addMessage(sessionId, {
                        author: 'bot',
                        text: noAddressText,
                    });
                    return;
                }
                const isCopied = await copyText(contactEmail);
                addMessage(sessionId, {
                    author: 'bot',
                    text: isCopied
                        ? `Copied \`${contactEmail}\`${contactSource}. ` +
                          'Paste it into the To line of your email.'
                        : 'I could not reach the clipboard. The address is ' +
                          `\`${contactEmail}\` — you can select and copy it ` +
                          'from here.',
                });
                return;
            }
            if (action.toolName === REPORT_COPY_IMAGE_TOOL_NAME) {
                const dataUrl = readReportImageDataUrl(reference);
                if (dataUrl === null) {
                    addMessage(sessionId, {
                        author: 'bot',
                        text:
                            'I no longer have that picture — it is not in ' +
                            'this window and not in your Downloads folder. ' +
                            'Press Report again and I will take a new one.',
                    });
                    return;
                }
                try {
                    await copyImageToClipboard(dataUrl);
                } catch (_error) {
                    addMessage(sessionId, {
                        author: 'bot',
                        text:
                            'I could not put the picture on the clipboard. ' +
                            'Press its chip above to open the folder and ' +
                            'attach the file from there.',
                    });
                    return;
                }
                addMessage(sessionId, {
                    author: 'bot',
                    text:
                        'Copied the picture. Paste it into the email' +
                        (contactEmail === null
                            ? ''
                            : ` to \`${contactEmail}\``) +
                        ' — most mail apps take a pasted picture as an ' +
                        'attachment.',
                });
                return;
            }
            const markdown = await readReportMarkdown(reference);
            if (markdown === null) {
                addMessage(sessionId, {
                    author: 'bot',
                    text:
                        'I no longer have that report — it is not in this ' +
                        'window and not in your Downloads folder. Press ' +
                        'Report again and I will put a new one together.',
                });
                return;
            }
            const hasImage =
                kept === null
                    ? markdown.includes(`${reference}.png`)
                    : kept.imageDataUrl !== null;
            const attachNote = hasImage
                ? `, and attach \`${reference}.png\` from your Downloads folder`
                : '';
            // The same subject line the document names, before and after a
            // reopen alike.
            const subject = toSavedReportSubject(kept, markdown, reference);
            if (action.toolName === REPORT_COPY_SUBJECT_TOOL_NAME) {
                const isSubjectCopied = await copyText(subject);
                addMessage(sessionId, {
                    author: 'bot',
                    text: isSubjectCopied
                        ? `Copied the subject line \`${subject}\`. Paste it ` +
                          'into the Subject line of your email.'
                        : 'I could not reach the clipboard. The subject line ' +
                          `is \`${subject}\` — you can select and copy it ` +
                          'from here.',
                });
                return;
            }
            const isCopied = await copyText(markdown);
            if (action.toolName === REPORT_COPY_TOOL_NAME) {
                addMessage(sessionId, {
                    author: 'bot',
                    text: isCopied
                        ? 'Copied the whole report. Paste it into ' +
                          (contactEmail === null
                              ? 'your message'
                              : `an email to \`${contactEmail}\``) +
                          `${attachNote}.`
                        : 'I could not reach the clipboard. Open the report ' +
                          'file from the chip above — it is a plain text ' +
                          'document you can select and copy from.',
                });
                return;
            }
            if (contactEmail === null) {
                addMessage(sessionId, { author: 'bot', text: noAddressText });
                return;
            }
            // Email it, under the same subject line.
            const url = genReportMailtoUrl({
                contactEmail,
                subject,
                reference,
                hasImage,
            });
            appProvider.browserUtils.openExternalURL(url);
            addMessage(sessionId, {
                author: 'bot',
                text:
                    `Opening your email app with \`${contactEmail}\` and the ` +
                    'subject filled in. ' +
                    (isCopied
                        ? 'The report is on your clipboard — paste it into ' +
                          'the message'
                        : 'I could not reach the clipboard, so press ' +
                          '**Copy report** and paste it into the message') +
                    `${attachNote}. If nothing opened, this machine has no ` +
                    'email app set up — use the two Copy buttons instead.',
            });
        },
        [addMessage],
    );
    const handleReportExtraRef = useAppCurrentRef(handleReportExtra);

    /**
     * The two buttons under a song the assistant drafted.
     *
     * Both are caught before any tool call for the same reason the Send button
     * on a report is: a name the model could see is a name it would try, and
     * nothing outside this window may write a file in the user's Documents
     * folder off its own bat. The user pressed it; that is the whole
     * authorisation.
     */
    const handleDraftedLyric = useCallback(
        async (action: BotActionType, sessionId: string) => {
            const drafted = takeDraftedLyric(action.args?.reference ?? '');
            if (drafted === null) {
                addMessage(sessionId, { author: 'bot', text: DRAFT_GONE_TEXT });
                return;
            }
            if (action.toolName === LYRIC_COPY_TOOL_NAME) {
                try {
                    await navigator.clipboard.writeText(drafted.content);
                } catch (_error) {
                    // Said out loud rather than swallowed, exactly like the
                    // Copy button on an answer: one that looks like it worked
                    // and did not is worse than one that admits it.
                    addMessage(sessionId, {
                        author: 'bot',
                        text:
                            'I could not reach the clipboard. The song is in ' +
                            'my answer above — you can select and copy it ' +
                            'from there.',
                    });
                    return;
                }
                addMessage(sessionId, {
                    author: 'bot',
                    text:
                        'Copied. Paste it into the Lyric Editor and it will ' +
                        'open as a song.',
                });
                return;
            }
            // `create` refuses a name already in use rather than overwriting,
            // so a free one is found HERE. Pressing twice makes a second song
            // beside the first; it never replaces one.
            const listed = parseToolJson(
                await callTool('owa_lyric_file', { action: 'list' }),
            );
            const taken = new Set<string>(
                (listed?.names ?? []).map((one: string) => {
                    return String(one).toLowerCase();
                }),
            );
            let name = drafted.name;
            for (let index = 1; taken.has(name.toLowerCase()); index += 1) {
                name = `${drafted.name} (${index})`;
            }
            // `created` comes back as the file's NAME, not as `true` -- the
            // first version of this tested it for `true`, so a song that had
            // been written perfectly well was reported to the user as a
            // failure. Caught by pressing the button, never by a type.
            let created: any = null;
            try {
                created = parseToolJson(
                    await callTool('owa_lyric_file', {
                        action: 'create',
                        name,
                        content: drafted.content,
                    }),
                );
            } catch (error) {
                // A tool's own words are written for whoever drives the app.
                // The reason goes to the log; the user gets a sentence.
                handleError(error);
            }
            if (typeof created?.filePath !== 'string') {
                addMessage(sessionId, {
                    author: 'bot',
                    text:
                        'That song could not be saved. Check there is room ' +
                        'in your documents folder, then press the button ' +
                        'again.',
                });
                return;
            }
            addMessage(sessionId, {
                author: 'bot',
                text:
                    `Saved as "${name}". It is in your documents list now, ` +
                    'ready to put on the screen — open it in the Lyric ' +
                    'Editor to change the words or mark the chords.',
                shows: [
                    // Where it went, in the app rather than on the disk. The
                    // row is looked up at PRESS time and rung in the window
                    // behind this one, so a list scrolled since still lands on
                    // the right row. Scoped to the panel because a song can
                    // easily be named after something else on screen.
                    {
                        kind: 'control' as const,
                        value: `Document List > ${name}`,
                        name: 'Show it in the list',
                    },
                    { kind: 'file' as const, value: created.filePath, name },
                ],
            });
        },
        [addMessage],
    );
    const handleDraftedLyricRef = useAppCurrentRef(handleDraftedLyric);

    const handleActing = useCallback(
        async (action: BotActionType) => {
            // Same reason as `handleAsking`: the button that fired this lives
            // in a tab, and a tool call is slow enough to outlive looking at it.
            const actedSessionId = activeSessionId;
            // Not a tool at all -- the Send button on a prepared report. It is
            // caught here rather than given a name in the tool host because
            // nothing outside this window may file a report on the user's
            // behalf, and a model that could see the name would try.
            if (action.toolName === REPORT_SEND_TOOL_NAME) {
                await handleSendingReport(
                    action.args?.reference ?? '',
                    actedSessionId,
                );
                return;
            }
            // The three under a saved report -- the same seam, for the same
            // reason: the clipboard and the mail app are the user's, and
            // nothing a model says may reach either.
            if (
                action.toolName === REPORT_COPY_TOOL_NAME ||
                action.toolName === REPORT_COPY_SUBJECT_TOOL_NAME ||
                action.toolName === REPORT_COPY_IMAGE_TOOL_NAME ||
                action.toolName === REPORT_COPY_EMAIL_TOOL_NAME ||
                action.toolName === REPORT_EMAIL_TOOL_NAME
            ) {
                await handleReportExtraRef.current(action, actedSessionId);
                return;
            }
            // A button that runs a built-in command. Asked as though typed,
            // so the transcript shows the command the press stood for and a
            // volunteer learns the word for next time.
            if (action.toolName === BUILTIN_TOOL_NAME) {
                const command = String(action.args?.command ?? '').trim();
                if (checkIsBuiltinCommand(command)) {
                    handleAskingRef.current(command, true);
                }
                return;
            }
            // The button that lifts the spend guard's pause -- a person
            // pressed it, which is the one thing a runaway cannot do. The
            // question it was pressed under is asked again, without a
            // second echo of it in the transcript.
            if (action.toolName === SPEND_ALLOW_TOOL_NAME) {
                const state = allowMoreSpending();
                const question = String(action.args?.question ?? '').trim();
                addMessage(actedSessionId, {
                    author: 'bot',
                    text:
                        'Carrying on: the hour starts again from now' +
                        (state.limitUsd === null
                            ? ''
                            : `, with ${toSpendLimitLabel(state.limitUsd)} ` +
                              'available before I pause again') +
                        '.' +
                        (question.length > 0
                            ? ' Asking your question again.'
                            : ''),
                });
                if (question.length > 0) {
                    handleAskingRef.current(question, true, {
                        withoutEcho: true,
                    });
                }
                return;
            }
            // The doors under a "could not answer" note: the app's own AI
            // settings, or the provider's console page for what went wrong.
            // Neither is a tool -- the page is resolved from a NAME here, at
            // the press, so nothing a model says and nothing a saved file
            // carries can be an address.
            if (action.toolName === OPEN_AI_SETTING_TOOL_NAME) {
                openAiSetting();
                return;
            }
            if (action.toolName === OPEN_PROVIDER_PAGE_TOOL_NAME) {
                const url = getLlmProviderPageUrl(
                    action.args?.provider,
                    action.args?.page,
                );
                if (url === null) {
                    return;
                }
                appProvider.browserUtils.openExternalURL(url);
                // Said, because the browser can open BEHIND this window and
                // a press that shows nothing gets pressed again.
                addMessage(actedSessionId, {
                    author: 'bot',
                    text: `Opening ${url} in your browser.`,
                });
                return;
            }
            // The same seam, for the song the assistant just wrote out.
            if (
                action.toolName === LYRIC_CREATE_TOOL_NAME ||
                action.toolName === LYRIC_COPY_TOOL_NAME
            ) {
                setIsBusy(true);
                try {
                    await handleDraftedLyricRef.current(action, actedSessionId);
                } finally {
                    setIsBusy(pendingAskListRef.current.length > 0);
                }
                return;
            }
            // Stoppable like an ask is, and for the same reason: this is the
            // button that starts a walkthrough, and the wait in front of it is
            // long enough to change your mind in. What Stop ends here is the
            // WAITING -- a tool that has already pressed something in the app
            // window has pressed it, and this window will not pretend
            // otherwise.
            const pending = genPendingAsk(actedSessionId);
            const { signal } = pending.controller;
            setIsBusy(true);
            let isNeedingModel = false;
            try {
                const result = await runBotAction(action);
                if (signal.aborted) {
                    return;
                }
                isNeedingModel = result.isNeedingModel;
                // Not when the model is about to be asked anyway: that
                // message is a "give me a moment", and the answer landing
                // behind it takes the row over a second later.
                const session = sessionStateRef.current.sessions.find(
                    (item) => {
                        return item.id === actedSessionId;
                    },
                );
                const replies = isNeedingModel
                    ? []
                    : await genMessageReplies({
                          answerText: result.text,
                          askedText:
                              [...(session?.messages ?? [])]
                                  .reverse()
                                  .find((message) => {
                                      return message.author === 'you';
                                  })?.text ?? '',
                          actionLabels: (result.actions ?? []).map((item) => {
                              return item.label;
                          }),
                          focus: session?.focus ?? 'presenter',
                      });
                addMessage(actedSessionId, {
                    author: 'bot',
                    text: result.text,
                    actions: result.actions,
                    ...(replies.length > 0 ? { replies } : {}),
                });
            } catch (error: any) {
                if (checkIsCancelError(error, signal)) {
                    return;
                }
                addMessage(actedSessionId, {
                    author: 'bot',
                    // NOT the error. It is a tool's own words, written for
                    // whoever drives the app, and this window's whole promise
                    // is that a volunteer never reads one.
                    text: describeActionError(error, action),
                });
            } finally {
                endPendingAsk(pending);
                setIsBusy(pendingAskListRef.current.length > 0);
            }
            // The card the recipe could build is already up; this is the
            // second half, for the steps it could not point at. Working out
            // which control a sentence means is the one thing only the model
            // can do (see `genGuideActions`), and it costs a minute -- which
            // is why it is never what the user waits through first.
            if (isNeedingModel && action.ask !== undefined && !signal.aborted) {
                await handleAskingRef.current(action.ask, true);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSessionId],
    );

    return (
        <div
            id="app"
            data-bs-theme={theme}
            className="chatbot-app"
            // Only where the OS actually put a backdrop behind this window
            // (`appGlassy` in `openChatbotPage`). Anywhere else the sheet's
            // opaque tints stand, because a translucent panel over nothing is
            // just an unreadable one.
            data-glassy={
                appProvider.systemUtils.isGlassCapable ? '' : undefined
            }
        >
            <RenderSessionTabsComp
                sessions={sessions}
                activeId={activeSession.id}
                genTitle={genChatSessionTitle}
                canAdd={checkCanAddChatSession(sessions)}
                canClearAll={checkCanClearChatSessions(sessions)}
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
                    <RenderPickFieldComp caption="Asking about">
                        <RenderFocusSwitchComp
                            focus={focus}
                            onChange={handleFocusChanging}
                        />
                    </RenderPickFieldComp>
                    <RenderPickFieldComp caption="Assistant">
                        <RenderProviderSwitchComp
                            provider={provider}
                            availableProviders={availableProviders}
                            onChange={handleProviderChanging}
                        />
                    </RenderPickFieldComp>
                    {provider === null ? (
                        // The head says WHAT is answering; the empty state
                        // says where its answers come from. Saying both in the
                        // head cost two lines of a 640px window. With no key
                        // it is also the way OUT of here, to the panel that
                        // takes one -- so its caption names the way out, not a
                        // model there is none of.
                        <RenderPickFieldComp caption="Answers from" isEngine>
                            <button
                                type="button"
                                className="chat-pick chat-engine chat-engine-off"
                                title={
                                    `${genProviderNames()} need an API key of` +
                                    ' your own — open AI settings'
                                }
                                onClick={openAiSetting}
                            >
                                app guide · offline
                            </button>
                        </RenderPickFieldComp>
                    ) : (
                        <RenderPickFieldComp caption="Model" isEngine>
                            <RenderModelPickerComp
                                model={model}
                                modelList={modelList}
                                isLoadingModels={isLoadingModels}
                                hasMoreModels={!checkIsFreeProvider(provider)}
                                onChange={handleModelChanging}
                                onLoadingMore={handleLoadingMoreModels}
                            />
                        </RenderPickFieldComp>
                    )}
                    <RenderSpendGuardComp />
                </div>
                <RenderCreditLineComp usage={activeSession.usage} />
            </header>
            <div className="chat-log" ref={listRef}>
                <RenderProviderWarningComp provider={provider} />
                {serviceError !== null ? (
                    <p className="chat-alert">{serviceError}</p>
                ) : null}
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <p className="chat-eyebrow">Try asking</p>
                        <div className="chat-starters">
                            {starters.map((starter) => {
                                return (
                                    <button
                                        key={starter.text}
                                        type="button"
                                        className="chat-starter"
                                        title={
                                            starter.isTemplate
                                                ? 'Press to put this in the box, then replace the address with yours'
                                                : undefined
                                        }
                                        onClick={() => {
                                            handlePickingQuestion(starter);
                                        }}
                                    >
                                        {starter.text}
                                    </button>
                                );
                            })}
                        </div>
                        {/*
                         * The four above say what to type first. This says
                         * what the window is FOR -- and a help window whose
                         * scope has to be guessed at gets used for the one
                         * thing somebody once saw it do.
                         */}
                        <button
                            type="button"
                            className="chat-more"
                            aria-expanded={isShowingAllQuestions}
                            title={
                                isShowingAllQuestions
                                    ? 'Back to the four suggestions'
                                    : 'Show everything it is ready to be asked here'
                            }
                            onClick={() => {
                                setIsShowingAllQuestions(
                                    !isShowingAllQuestions,
                                );
                            }}
                        >
                            {isShowingAllQuestions
                                ? 'Fewer'
                                : 'More… — everything it can answer'}
                        </button>
                        {isShowingAllQuestions ? (
                            <RenderAllQuestionsComp
                                focus={focus}
                                onPick={handlePickingQuestion}
                            />
                        ) : null}
                        <p className="chat-hint">
                            Answers come from the app&apos;s own guide and from
                            what the app is doing right now.
                        </p>
                        {/*
                         * The caution every answer in this window deserves,
                         * said ONCE where it is actually read: before the
                         * first question, while the user is still deciding
                         * what this window is for. It is not the keyless
                         * provider's privacy notice above -- that one is
                         * about where the words GO, is true of one provider,
                         * and rides the whole conversation. This one is about
                         * whether the answer is RIGHT, is true of every
                         * provider including a paid one, and is a thing to
                         * understand rather than a thing to keep glancing at.
                         *
                         * It names what going wrong looks like HERE rather
                         * than warning about AI in the abstract: a volunteer
                         * who has been told "it can make mistakes" still has
                         * no idea that the confident paragraph in front of
                         * them may be describing a button that does not
                         * exist, or that a press it offers reaches a live
                         * projector. Generic boilerplate is read once and
                         * never believed; a specific one is what makes
                         * somebody check.
                         *
                         * Deliberately NOT dismissible and NOT auto-hidden
                         * (see the note on auto-hide in this window): it
                         * costs nothing during a conversation, because the
                         * empty state it lives in is gone by then.
                         */}
                        <p className="chat-caution" role="note">
                            <span
                                className="chat-caution-mark"
                                aria-hidden="true"
                            >
                                {'⚠'}
                            </span>
                            <span>
                                <strong>Be careful with AI answers.</strong>{' '}
                                This assistant can be confidently wrong — it can
                                misread the app, describe a button that is not
                                there, or quote a verse inaccurately — and what
                                it offers to do can reach a live projector.
                                Check anything that matters before a service,
                                and read a step yourself before you press it. It
                                is here to help you use the app, not to replace
                                knowing it.
                            </span>
                        </p>
                        {provider === null ? (
                            // Not an error -- the window works without a key.
                            // But the two names in the switch above are dead
                            // until there is one, and this says so where the
                            // user is already looking, with the way there.
                            <p className="chat-hint">
                                {genProviderNames()} answer here only with an
                                API key of your own.{' '}
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
                        {messages.map((message, index) => {
                            return (
                                <RenderMessageComp
                                    key={message.id}
                                    message={message}
                                    canReply={
                                        index === messages.length - 1 && !isBusy
                                    }
                                    onAction={handleActing}
                                    onReply={handleAsking}
                                    onReuse={handleReusing}
                                    onAttachRequest={handleAttachRequest}
                                    onShowAttachment={handleShowingAttachment}
                                />
                            );
                        })}
                    </div>
                )}
                {isBusy ? (
                    // What it is doing, and -- said where the waiting is shown
                    // -- the way out of it. A volunteer who has changed their
                    // mind three minutes before a service should not have to
                    // work out that the Ask button has become the way to stop.
                    <RenderChatProgressComp />
                ) : null}
            </div>
            <form
                className="chat-ask"
                onDragOver={(event) => {
                    event.preventDefault();
                }}
                onDrop={handleDropping}
                onSubmit={(event) => {
                    event.preventDefault();
                    // Enter on a highlighted suggestion takes it; Enter with
                    // nothing highlighted asks what they actually typed. The
                    // list must never rewrite a question under them.
                    const picked = suggestions[suggestIndex];
                    if (picked !== undefined) {
                        handleChoosingSuggestion(picked);
                        return;
                    }
                    setIsSuggestDismissed(true);
                    // Enter while an answer is on its way ADDS to it rather
                    // than starting a second question -- see `handleAdding`.
                    if (isBusy) {
                        handleAdding();
                        return;
                    }
                    rememberAsking(question);
                    handleAsking(question);
                }}
            >
                <RenderSuggestionsComp
                    suggestions={suggestions}
                    activeIndex={suggestIndex}
                    onChoose={handleChoosingSuggestion}
                />
                <RenderAttachmentChipsComp
                    attachments={draftAttachments}
                    onRemove={handleRemovingAttachment}
                    onShow={handleShowingAttachment}
                />
                {attachError === null ? null : (
                    <p className="chat-attach-error">
                        {attachError}
                        {attachError === BLIND_MODEL_MESSAGE &&
                        seeingModel !== null ? (
                            <button
                                type="button"
                                className="chat-attach-fix"
                                onClick={() => {
                                    handleModelChanging(seeingModel.id);
                                    setAttachError(null);
                                }}
                            >
                                Use {seeingModel.label}
                            </button>
                        ) : null}
                    </p>
                )}
                {reportAsk === null ? null : (
                    // The question Report asks before it does anything. On a
                    // line of its own above the box, quoting what is about to
                    // be reported: the box is often empty when this is
                    // pressed, and the complaint is then the last thing they
                    // asked -- which nobody would guess from the button.
                    <div
                        className="chat-report-confirm"
                        role="alertdialog"
                        aria-label="Report a problem"
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setReportAsk(null);
                            }
                        }}
                    >
                        <span className="chat-report-ask">
                            Report “{toReportQuote(reportAsk)}”? I will look
                            into it in the app, collect what is on this machine
                            and write it up — nothing is sent until you say so.
                        </span>
                        <button
                            type="button"
                            className="chat-report-no"
                            autoFocus
                            onClick={() => {
                                setReportAsk(null);
                            }}
                        >
                            Not now
                        </button>
                        <button
                            type="button"
                            className="chat-report-yes"
                            onClick={() => {
                                setReportAsk(null);
                                handleReporting(reportAsk);
                            }}
                        >
                            Report it
                        </button>
                    </div>
                )}
                <RenderChatTipComp onPressed={handleTipPressed} />
                <div className="chat-attach-row">
                    <button
                        type="button"
                        className="chat-attach"
                        aria-label="Attach a file"
                        title="Attach a picture or a file"
                        onClick={() => {
                            fileInputRef.current?.click();
                        }}
                    >
                        <i className="bi bi-paperclip" />
                    </button>
                    <button
                        type="button"
                        className="chat-attach"
                        aria-label="Attach a picture of the app"
                        title="Attach a picture of the app as it looks now"
                        onClick={handleSnapping}
                    >
                        <i className="bi bi-camera" />
                    </button>
                    <button
                        type="button"
                        className="chat-attach"
                        aria-label="Point at a control in the app"
                        title="Point at a control in the app window"
                        onClick={handlePicking}
                    >
                        <i className="bi bi-bullseye" />
                    </button>
                    <input
                        ref={fileInputRef}
                        className="chat-file-input"
                        type="file"
                        multiple
                        accept="image/*,text/*,.md,.json,.csv,.log,.xml"
                        onChange={(event) => {
                            addFiles([...(event.target.files ?? [])]);
                            // Cleared so choosing the SAME file twice still
                            // fires a change event.
                            event.target.value = '';
                        }}
                    />
                </div>
                {/*
                 * A textarea, not a one-line input: questions here run long
                 * -- a pasted error line, a verse reference and what went
                 * wrong with it, two sentences a volunteer rewrote -- and a
                 * box that scrolls sideways hides the start of the sentence
                 * being finished. It grows with the text (see the effect on
                 * `question`) up to the CSS ceiling, and Enter still ASKS:
                 * Shift+Enter is the new line, because the press that sends
                 * has to stay the press it has always been.
                 */}
                <textarea
                    className="chat-input"
                    rows={1}
                    autoFocus
                    ref={inputRef}
                    value={question}
                    placeholder={
                        isBusy
                            ? 'Add anything else while it works…'
                            : 'Ask how to do something, or type / for a command…'
                    }
                    aria-label="Ask how to do something in the app"
                    title={
                        'Ctrl+Enter asks · Enter starts a new line · ' +
                        'Alt+↑ and Alt+↓ bring back an earlier question · ' +
                        '/ lists the commands that need no assistant'
                    }
                    onPaste={handlePasting}
                    onChange={(event) => {
                        handleTypingQuestion(event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            // An IME still composing owns its own Enter: in
                            // Khmer that press is choosing the syllable, and
                            // taking it would ask half a word.
                            if (event.nativeEvent.isComposing) {
                                return;
                            }
                            // **Ctrl+Enter asks; Enter is a new line.** The
                            // box holds several lines now, and a question
                            // being written across two of them must not be
                            // sent by the press that starts the second. The
                            // one exception is a suggestion the user has
                            // walked to with the arrows -- Enter takes that,
                            // the way every list of the kind behaves -- and
                            // it is the FORM that decides which, so a
                            // highlighted suggestion, a busy Add and a plain
                            // ask stay decided in one place.
                            const isSending =
                                event.ctrlKey ||
                                event.metaKey ||
                                suggestIndex >= 0;
                            if (!isSending) {
                                return;
                            }
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                            return;
                        }
                        // The walk back through what has been asked here
                        // before. Held ABOVE the suggestion list's own arrow
                        // handling, which returns early when there is nothing
                        // to suggest -- the two lists are unrelated, and a
                        // recall must work in an empty box, which is exactly
                        // where the list has nothing in it.
                        if (
                            event.altKey &&
                            (event.key === 'ArrowUp' ||
                                event.key === 'ArrowDown')
                        ) {
                            event.preventDefault();
                            handleRecalling(event.key === 'ArrowUp' ? 1 : -1);
                            return;
                        }
                        if (suggestions.length === 0) {
                            return;
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setIsSuggestDismissed(true);
                            setSuggestIndex(-1);
                            return;
                        }
                        if (
                            event.key !== 'ArrowDown' &&
                            event.key !== 'ArrowUp'
                        ) {
                            return;
                        }
                        // In a box that now holds more than one line, the
                        // arrows belong to the caret first: a suggestion list
                        // that steals them leaves a volunteer unable to get
                        // back up to the line they are fixing. It only walks
                        // the list while what they have typed is still one
                        // line -- which is every question the list matches.
                        if (question.includes('\n')) {
                            return;
                        }
                        event.preventDefault();
                        // -1 is "nothing chosen, Enter asks what I typed", and
                        // the walk goes back to it rather than wrapping round,
                        // so their own words are always one press away.
                        const step = event.key === 'ArrowDown' ? 1 : -1;
                        const next = suggestIndex + step;
                        setSuggestIndex(
                            next < -1
                                ? suggestions.length - 1
                                : next >= suggestions.length
                                  ? -1
                                  : next,
                        );
                    }}
                />
                {/*
                 * Two things can be done with what is in the box, so they
                 * are stacked rather than set side by side: asking is the
                 * one the window is for, and Report is under it, quieter and
                 * the same width, for the day the app is the problem rather
                 * than the question.
                 */}
                <div className="chat-ask-buttons">
                    {isBusy ? (
                        // The same place, the same size, one word: while an
                        // answer is on its way the button that asked for it is
                        // the button that calls it off. Not a second control
                        // beside Ask -- in a 460px window that is one more
                        // thing to read at the worst moment, and it would be
                        // disabled for all but a few seconds of the window's
                        // life.
                        //
                        // ...unless they have started typing. The box stays
                        // live while an answer comes, so there has to be a way
                        // to send what is in it, and Stop with words in the
                        // box would be the only button offering to throw them
                        // away. **Add** appears only then, and goes again the
                        // moment the box is empty.
                        <>
                            {question.trim().length > 0 ? (
                                <button
                                    className="chat-send chat-add"
                                    type="submit"
                                    title={
                                        'Add this to the answer being ' +
                                        'written — Ctrl+Enter'
                                    }
                                >
                                    Add
                                </button>
                            ) : null}
                            <button
                                className="chat-send chat-stop"
                                type="button"
                                aria-label="Stop looking it up"
                                onClick={handleCancelling}
                            >
                                Stop
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="chat-send"
                                type="submit"
                                title="Ask — Ctrl+Enter"
                            >
                                Ask
                            </button>
                            <button
                                className="chat-send chat-report"
                                type="button"
                                aria-label="Report a problem with the app"
                                title={
                                    'Report a problem: I will look into it, ' +
                                    'collect what is on this machine and ' +
                                    'write it up for you'
                                }
                                onClick={handleReportPressed}
                            >
                                Report
                            </button>
                        </>
                    )}
                </div>
            </form>
            {preview === null ? null : (
                // The asset, big enough to read, whatever kind it is. Not a
                // new window: this one is already a popup, and a popup of a
                // popup is a thing the user has to find and close before they
                // can carry on asking.
                <div
                    ref={previewElementRef}
                    className="chat-preview"
                    // A dialog, not a button: it HOLDS buttons, and whatever a
                    // button contains is presentational -- Copy, Download and
                    // Open folder were hidden from a screen reader until one of
                    // them happened to have the keyboard.
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Preview of ${preview.name}`}
                    tabIndex={-1}
                    onClick={() => {
                        setPreview(null);
                    }}
                    onKeyDown={(event) => {
                        // Escape closes it from anywhere inside. Enter only when
                        // the overlay ITSELF has the keyboard: a button on it
                        // sends its Enter up here as well, and closing on that
                        // keydown unmounted the preview before the button's own
                        // click arrived -- Enter on Copy closed the preview and
                        // copied nothing.
                        if (
                            event.key === 'Escape' ||
                            (event.key === 'Enter' &&
                                event.target === event.currentTarget)
                        ) {
                            setPreview(null);
                        }
                    }}
                >
                    <RenderAssetPreviewBodyComp preview={preview} />
                    <div
                        className="chat-preview-tools"
                        role="presentation"
                        onClick={(event) => {
                            // The backdrop closes the preview; the buttons
                            // sitting on it must not.
                            event.stopPropagation();
                        }}
                    >
                        {preview.imageDataUrl === null &&
                        preview.text === null ? null : (
                            <button
                                type="button"
                                className="chat-preview-tool"
                                onClick={() => {
                                    handleCopyingAsset(preview);
                                }}
                            >
                                <i className="bi bi-clipboard" /> Copy
                            </button>
                        )}
                        <button
                            type="button"
                            className="chat-preview-tool chat-preview-tool-main"
                            title={`Download ${preview.name} into your Downloads folder`}
                            onClick={() => {
                                handleDownloadingAsset(preview);
                            }}
                        >
                            <i className="bi bi-download" /> Download
                        </button>
                        {preview.filePath === null ? null : (
                            <button
                                type="button"
                                className="chat-preview-tool"
                                onClick={() => {
                                    // Closed first, exactly as Download is:
                                    // this opens a window behind the app.
                                    const { filePath } = preview;
                                    setPreview(null);
                                    showFileOrDirExplorer(filePath as string);
                                }}
                            >
                                <i className="bi bi-folder2-open" /> Open folder
                            </button>
                        )}
                        {/*
                            Said in words for the keyboard and a screen reader:
                            "press anywhere" is a mouse instruction, and Escape
                            is a key nobody is told about.
                        */}
                        <button
                            type="button"
                            className="chat-preview-tool"
                            onClick={() => {
                                setPreview(null);
                            }}
                        >
                            <i className="bi bi-x-lg" /> Close
                        </button>
                    </div>
                    <p className="chat-preview-hint">Press anywhere to close</p>
                </div>
            )}
        </div>
    );
}
