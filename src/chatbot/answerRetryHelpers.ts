/**
 * **Retry** under an answer: the same question asked once more, for a
 * DIFFERENT answer.
 *
 * Asked for by the user (2026-11-10), a rotate icon drawn between the reply
 * arrow and the thumbs: _as user I'd like to ask chatbot to retry again on
 * the answer, so I can get different result_; and the goal the same hour:
 * _when user ask for retrying chatbot have to try with different approach
 * and different effort get different result for user_.
 *
 * So a retry is NOT the same ask twice. Asked twice as it stood, a server of
 * the user's own answers word for word (temperature 0, `LOCAL_TEMPERATURE`:
 * 26 of 27 re-asked answers came back the same), and a paid model handed
 * its own answer to the same words mostly says it again -- the reason the
 * thumb-down's smarter-model ask carries a hint at all. Each retry changes
 * two things:
 *
 * - the APPROACH: a hint on the ask alone (`genRetryAskHint`) saying the
 *   earlier answer was not wanted, quoting it when the model would not see
 *   it otherwise, and naming another way in for each try
 *   (`RETRY_APPROACH_LIST`, taken in turn);
 * - the EFFORT: one step up the provider's own dial for each try, read by
 *   the model loop -- reasoning effort where a model takes one
 *   (`toRetryReasoningEffort`, `toAnthropicRetryEffort`), more room to think
 *   in (`toRetryMaxTokens`), and a temperature above 0 on a local program
 *   (`toRetryTemperature`);
 * - and WHO answers, for that one question (the user, the same evening:
 *   _make the retrying pick different assistant for temparary, e.g. user
 *   didn't like result from gemma4 then try with another model (but keep the
 *   gemma4 for the next asking)_): the assistant that wrote the answer goes
 *   to the back of Auto's line (`toRetryPicks`) -- on an Auto tab, and on a
 *   tab naming one Auto could pick -- and a paid key asks another of its own
 *   models (`pickRetryModel`). The tab's own pick is never moved.
 *
 * Pure: no SDK and no store, so every rule is a test. Imported by
 * `llmBotHelpers` too, so it imports nothing but types.
 */
import type { AnswererType } from './answerRatingHelpers';
import type { ChatMessageType } from './chatSessionHelpers';

// A line the window ran by itself (`builtinActionHelpers`): asked again it
// does the same thing again -- `/clear` empties the projector a second time
// -- and no model wrote what came back. `/btw` is the one slash line a model
// answers (the thumb-down's own rule, `answerRatingHelpers`).
const COMMAND_LINE_PATTERN = /^\/(?!btw\b)/i;

/**
 * Whether a question of theirs can be asked again: asked in their own words
 * (or with something attached), and not a `/` command. Never one the window
 * asked on their behalf -- a stuck card's rescue carries a `note`, and its
 * words on screen are not what the model was asked.
 */
function checkIsRetryableQuestion(message: ChatMessageType) {
    if (message.author !== 'you' || message.note !== undefined) {
        return false;
    }
    const text = message.text.trim();
    if (text.length === 0 && (message.attachments?.length ?? 0) === 0) {
        return false;
    }
    return !COMMAND_LINE_PATTERN.test(text);
}

/**
 * The person's question an answer was given to, when it can be asked
 * again: the message right above the answer (the window's own follow-ups
 * stepped over), and one `checkIsRetryableQuestion` takes. Null for an
 * answer that follows another answer (a card a button opened).
 */
export function findRetryQuestion(
    messages: readonly ChatMessageType[],
    answerId: number,
): ChatMessageType | null {
    const at = messages.findIndex((message) => {
        return message.id === answerId;
    });
    const answer = messages[at];
    if (answer?.author !== 'bot' || answer.isFollowUp === true) {
        return null;
    }
    for (let index = at - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.author === 'bot' && message.isFollowUp === true) {
            continue;
        }
        return checkIsRetryableQuestion(message) ? message : null;
    }
    return null;
}

/**
 * Every answer in the tab that carries a **Retry** -- the ones
 * `findRetryQuestion` finds a question for -- in ONE pass, for the message
 * list to draw from (it re-renders far more often than a message lands).
 */
export function listRetryableAnswerIds(
    messages: readonly ChatMessageType[],
): Set<number> {
    const ids = new Set<number>();
    let question: ChatMessageType | null = null;
    for (const message of messages) {
        if (message.author === 'you') {
            question = message;
            continue;
        }
        if (message.isFollowUp === true) {
            continue;
        }
        if (question !== null && checkIsRetryableQuestion(question)) {
            ids.add(message.id);
        }
        question = null;
    }
    return ids;
}

/**
 * Which try this will be: how many times these words have been asked in
 * the tab already. The first retry is 1. Read off the transcript, so a
 * reopened tab goes on counting and nothing new is stored.
 */
export function countRetryAttempt(
    messages: readonly ChatMessageType[],
    questionText: string,
): number {
    const wanted = questionText.trim();
    return Math.max(
        1,
        messages.filter((message) => {
            return message.author === 'you' && message.text.trim() === wanted;
        }).length,
    );
}

// Another way in for each try, in turn. Worded for any ask -- an app
// question, a note, a song, a passage -- because a retry can be pressed
// under any of them. The first asks for another ROUTE: measured live
// (2026-11-10), "check it again" first gave the same three Font Size steps
// in new words, where a different reading gave a different route.
export const RETRY_APPROACH_LIST = [
    'Give another way to get it done than the earlier answer took -- a ' +
        'different control, key, menu item, panel or setting -- found in ' +
        'the guide or the app first, never made up. When there truly is ' +
        'only that one way, say so in one short line, then give it with what ' +
        'each step is for and what to do when a step does not work.',
    'Take the question another way: if it can mean more than one thing, ' +
        'answer the meaning the earlier answer did not take, and say in one ' +
        'short line which meaning you took.',
    'Start again from what they are trying to get done, not from the ' +
        'earlier answer: look it up afresh with other search words, check ' +
        'each step against what you read before you write it, put the most ' +
        'useful part first, and say what to do if it still does not work.',
] as const;

// Enough of the earlier answer to know what not to say again; it rides
// every round of the ask.
const MAX_QUOTED_ANSWER_CHARS = 600;

function toQuotedAnswer(text: string) {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length <= MAX_QUOTED_ANSWER_CHARS) {
        return flat;
    }
    const cut = flat.slice(0, MAX_QUOTED_ANSWER_CHARS);
    const space = cut.lastIndexOf(' ');
    return `${space > 0 ? cut.slice(0, space) : cut}…`;
}

/**
 * What the model is told with the question asked again, on the ask alone.
 * `isAnswerInHistory`: the answer is the tab's newest, so it is already in
 * the turns the model is shown -- quoted again it is only paid for twice.
 */
export function genRetryAskHint(
    previousAnswer: string,
    attempt: number,
    isAnswerInHistory: boolean,
): string {
    const approach =
        RETRY_APPROACH_LIST[
            (Math.max(1, attempt) - 1) % RETRY_APPROACH_LIST.length
        ];
    const quoted = toQuotedAnswer(previousAnswer);
    return [
        '(The person pressed Retry on your earlier answer to this ' +
            'question: they want a DIFFERENT answer. Do not give the earlier ' +
            'one again, in the same words or in other words: change what ' +
            'it says, not only how it says it -- the same steps reworded ' +
            'are the same answer.',
        approach,
        'A different answer is never a wrong one: if the earlier one was ' +
            'right, keep its facts and say them another way, adding what it ' +
            'left out.',
        // A supported question rides a hint that says to copy the guide
        // page's sentences as they stand (`genKnownQuestionHint`, earned on
        // a small model that changed nouns) -- and asked again under it,
        // gemma4:cloud gave back the same three steps but for one word
        // (2026-11-10, seen live). The facts stay; the words may not.
        "For this retry, a line above that says to copy a page's " +
            'sentences as they stand does not hold: keep every fact and ' +
            'every button, menu and key name exactly as the page gives ' +
            'them, and put them in new words.',
        'If the earlier answer changed something in the app, that change ' +
            'is still made -- look at how things are now before changing ' +
            'anything again.)',
        ...(isAnswerInHistory || quoted.length === 0
            ? []
            : [`Your earlier answer was: «${quoted}»`]),
    ].join(' ');
}

// The reasoning-effort dial the OpenAI-shaped providers take, low to high.
const REASONING_EFFORT_LIST = ['low', 'medium', 'high'] as const;
export type ReasoningEffortType = (typeof REASONING_EFFORT_LIST)[number];

/**
 * One step up from `base` for each try, never past `high`: a help answer
 * is not a proof, and every step costs the user thinking tokens.
 */
export function toRetryReasoningEffort(
    base: ReasoningEffortType,
    attempt = 0,
): ReasoningEffortType {
    const index = REASONING_EFFORT_LIST.indexOf(base);
    return REASONING_EFFORT_LIST[
        Math.min(REASONING_EFFORT_LIST.length - 1, index + Math.max(0, attempt))
    ];
}

// Claude's `output_config.effort`, low to max. A retry never reaches
// `max`: that is for when correctness matters more than cost, and this is
// the user's own credit spent on a help answer.
const ANTHROPIC_EFFORT_LIST = ['low', 'medium', 'high', 'xhigh'] as const;
export type AnthropicEffortType = (typeof ANTHROPIC_EFFORT_LIST)[number];
// The Claude 5 family takes the setting (Haiku 4.5 and Sonnet 4.5 refuse
// it); with or without a Bedrock prefix.
const ANTHROPIC_EFFORT_MODEL_PATTERN =
    /claude-(?:opus|sonnet|haiku|fable|mythos)-5/;
// ...and these two default to `medium`, the rest of it to `high`.
const ANTHROPIC_MEDIUM_DEFAULT_PATTERN = /claude-(?:opus|haiku)-5-5/;

/**
 * The effort a Claude model is asked at on a retry, or null: not a retry,
 * or a model that takes no such setting. The loop sends nothing otherwise,
 * deliberately -- the default is what the corpus was graded at (see
 * `ANTHROPIC_MAX_TOKENS`).
 */
export function toAnthropicRetryEffort(
    model: string,
    attempt = 0,
): AnthropicEffortType | null {
    if (attempt <= 0 || !ANTHROPIC_EFFORT_MODEL_PATTERN.test(model)) {
        return null;
    }
    const base = ANTHROPIC_MEDIUM_DEFAULT_PATTERN.test(model)
        ? ANTHROPIC_EFFORT_LIST.indexOf('medium')
        : ANTHROPIC_EFFORT_LIST.indexOf('high');
    return ANTHROPIC_EFFORT_LIST[
        Math.min(ANTHROPIC_EFFORT_LIST.length - 1, base + attempt)
    ];
}

/**
 * The output budget on a retry: twice the usual, because the extra effort
 * is thinking spent out of the same cap -- an answer that thought its
 * budget away comes back empty (`ANTHROPIC_MAX_TOKENS`). A cap, not a
 * spend.
 */
export function toRetryMaxTokens(base: number, attempt = 0) {
    return attempt > 0 ? base * 2 : base;
}

/**
 * The temperature a local program samples a retry at, or null for an
 * ordinary ask (which keeps `LOCAL_TEMPERATURE`, 0). At 0 a retry would be
 * the same answer word for word whatever else changed in the ask's tail.
 */
export function toRetryTemperature(attempt = 0): number | null {
    if (attempt <= 0) {
        return null;
    }
    return attempt === 1 ? 0.7 : 1;
}

/**
 * Who answered the retried answer, as the answer keeps it
 * (`ChatMessageType.answeredBy`: the two pickers' own words).
 */
export type RetryAnsweredByType = { assistant: string; model: string };

/**
 * A retry's line of assistants: everyone who did NOT write the answer being
 * retried, in the order Auto ranked them, then whoever did -- kept, last,
 * for the question still to be answered when nobody else can.
 */
export function toRetryPicks<T>(
    picks: readonly T[],
    checkIsAnswered: (pick: T) => boolean,
): T[] {
    const others = picks.filter((pick) => {
        return !checkIsAnswered(pick);
    });
    return [
        ...others,
        ...picks.filter((pick) => {
            return checkIsAnswered(pick);
        }),
    ];
}

/**
 * Another model of the same paid key for a retry, or null: the next one UP
 * in a list written best first, else the nearest one down -- never another
 * company's key, which is spent only by a pick a person made. Null on Auto,
 * with no assistant, on a list in no order (a server of the user's own,
 * Bedrock), and when no other model can take the question (`checkCanUse`:
 * one that cannot see a picture the question carries).
 */
export function pickRetryModel(
    answerer: AnswererType,
    checkCanUse: (modelId: string) => boolean = () => true,
): { id: string; label: string } | null {
    if (!answerer.hasAssistant || answerer.isAuto) {
        return null;
    }
    const ranked = answerer.rankedModels;
    const at = ranked.findIndex((one) => {
        return one.id === answerer.modelId;
    });
    if (at < 0) {
        return null;
    }
    const nearestFirst = [
        ...ranked.slice(0, at).reverse(),
        ...ranked.slice(at + 1),
    ];
    return (
        nearestFirst.find((one) => {
            return checkCanUse(one.id);
        }) ?? null
    );
}
