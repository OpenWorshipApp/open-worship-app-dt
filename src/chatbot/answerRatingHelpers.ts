/**
 * A thumb up and a thumb down under every answer, and what the window does
 * when the thumb is down.
 *
 * Asked for by the user (2026-10-12) after every supported question had been
 * put to a small local model and to a cloud one: with the guide page in front
 * of it, a small model still gets about one answer in ten wrong on the dense
 * subjects, and nothing in the window said what to do about an answer that
 * was. Two asks, one feature: _each response card should have like and
 * dislike icon, when user dislike should follow up_, and _when user complain
 * about wrong answer should recommend user to try smarter model_.
 *
 * So a dislike is FOLLOWED UP, by the window and with no model: a line asking
 * what was wrong (three things to press -- each a sentence the dispute reader
 * takes, so the guide's newest copy is read before the model is asked again),
 * and the one thing most likely to help, said outright: a smarter model, with
 * a button that asks the same question of the next one up when this
 * assistant has one. A complaint that is TYPED gets the same advice under
 * the answer to it.
 *
 * Everything here is pure: the window hands in who is answering and with
 * what, so this module pulls in no SDK and can be tested with plain objects.
 */
import type { BotActionType } from './helpBotHelpers';
import type { ChatMessageType } from './chatSessionHelpers';
import { fillWords, tran } from './chatTranHelpers';

// Caught in the window's own `handleActing`, never registered on the tool
// host: nothing but a press may change who a tab is asking.
export const ASK_SMARTER_TOOL_NAME = 'owa_window_ask_smarter';

export type AnswerRatingType = 'like' | 'dislike';

/** Who is answering in the tab, as the window knows it. */
export type AnswererType = {
    // No assistant at all: the answer came from the guide alone.
    hasAssistant: boolean;
    // The tab settles who is asked in front of every question.
    isAuto: boolean;
    assistantLabel: string;
    modelId: string;
    // The model's name as the MODEL list shows it, when the window has one:
    // a model of the user's own server is in no ranked list to read it off.
    modelLabel?: string;
    // What the assistant offers, BEST FIRST -- or nothing when the list has
    // no such order (a server of the user's own lists what they loaded).
    rankedModels: readonly { id: string; label: string }[];
};

/**
 * The next model UP from the one in use, or null: the tab is on the best
 * one already, on one this build does not rank, on Auto, or on no assistant.
 * One step and not the top: the top of a family costs twenty times the
 * bottom, and a second thumb down takes the next step.
 */
export function findSmarterModel(
    answerer: AnswererType,
): { id: string; label: string } | null {
    if (!answerer.hasAssistant || answerer.isAuto) {
        return null;
    }
    const index = answerer.rankedModels.findIndex((one) => {
        return one.id === answerer.modelId;
    });
    return index > 0 ? answerer.rankedModels[index - 1] : null;
}

function toModelLabel(answerer: AnswererType) {
    const given = (answerer.modelLabel ?? '').trim();
    if (given.length > 0) {
        return given;
    }
    return (
        answerer.rankedModels.find((one) => {
            return one.id === answerer.modelId;
        })?.label ?? ''
    );
}

/**
 * The advice in a sentence or two, and the button when there is a model to
 * name. `question` is what the button asks again; with none, no button.
 */
export function genSmarterModelAdvice(
    answerer: AnswererType,
    question: string | null,
): { text: string; action: BotActionType | null } {
    if (!answerer.hasAssistant) {
        return {
            text: tran(
                'No assistant is answering in this tab — that came from ' +
                    'the guide alone. An assistant usually answers better: ' +
                    'pick one in the ASSISTANT list at the top of this window.',
            ),
            action: null,
        };
    }
    const smarter = findSmarterModel(answerer);
    const modelLabel = toModelLabel(answerer);
    const asking =
        modelLabel.length > 0
            ? `${answerer.assistantLabel} · ${modelLabel}`
            : answerer.assistantLabel;
    if (smarter === null) {
        if (answerer.isAuto) {
            return {
                text: tran(
                    'A smarter model often gets right what this one did ' +
                        'not. This tab is on Auto: pick an assistant by name ' +
                        'in the ASSISTANT list at the top of this window, ' +
                        'and the best model it has in the MODEL list beside ' +
                        'it.',
                ),
                action: null,
            };
        }
        // Already on the top of a list written best first: "try a larger
        // model" would send them looking for one that is not there.
        if (answerer.rankedModels[0]?.id === answerer.modelId) {
            return {
                text: fillWords(
                    tran(
                        'This tab is already asking the best model ' +
                            '{assistant} has ({model}), so a larger one is ' +
                            'not the way out; another assistant in the ' +
                            'ASSISTANT list at the top of this window may ' +
                            'read it differently.',
                    ),
                    { assistant: answerer.assistantLabel, model: modelLabel },
                ),
                action: null,
            };
        }
        return {
            text: fillWords(
                tran(
                    'A smarter model often gets right what this one did ' +
                        'not. This tab is asking {asking}: try a larger ' +
                        'model in the MODEL list at the top of this window, ' +
                        'or another assistant in the ASSISTANT list beside it.',
                ),
                { asking },
            ),
            action: null,
        };
    }
    const trimmed = (question ?? '').trim();
    return {
        text: fillWords(
            tran(
                'A smarter model often gets right what this one did not. ' +
                    'This tab is asking {asking}; {smarter} is the next one ' +
                    'up.',
            ),
            { asking, smarter: smarter.label },
        ),
        // Written in the window's language: a press is read by its tool and
        // args, never by these words.
        action:
            trimmed.length === 0
                ? null
                : {
                      label: fillWords(tran('Ask again with {model}'), {
                          model: smarter.label,
                      }),
                      toolName: ASK_SMARTER_TOOL_NAME,
                      args: { model: smarter.id, question: trimmed },
                  },
    };
}

// What the smarter model is told with the question asked again, on the ask
// only: the tab's history rides with it (the question may lean on what was
// said before), and a model handed its own family's wrong answer to the same
// words mostly says it again.
export const SMARTER_ASK_HINT =
    '(The person said the last answer to this was wrong or did not help, ' +
    'and is asking it again of a different model. Do not repeat that ' +
    'answer: work it out again from the guide and from the window as it ' +
    'is now.)';

/**
 * The press of *Ask again with …*, read against who is answering NOW: the
 * button stays in the transcript, and a tab moved to another assistant since
 * (or to Auto) has no such model to ask. Null then, and for a button a
 * hand-edited file gave no question.
 */
export function readSmarterAsk(
    args: unknown,
    answerer: AnswererType,
): { model: string; label: string; question: string } | null {
    if (!answerer.hasAssistant || answerer.isAuto) {
        return null;
    }
    const given = (args ?? {}) as { model?: unknown; question?: unknown };
    const question =
        typeof given.question === 'string' ? given.question.trim() : '';
    const target = answerer.rankedModels.find((one) => {
        return one.id === given.model;
    });
    if (target === undefined || question.length === 0) {
        return null;
    }
    return { model: target.id, label: target.label, question };
}

// Each is a sentence the dispute reader takes (`checkIsDisputingAnswer`), so
// pressing one has the guide page's newest copy read before the model is
// asked again. A test holds the two together. Stored English for that
// reason, and translated where the reply is drawn (`chatTranLabels.test.ts`
// holds each to its Khmer and French).
export const DISLIKE_REPLY_LIST = [
    'A button it names is not there',
    'The steps did not work',
    'That is wrong for the window I am in',
] as const;

function checkIsDislikeReply(text: string) {
    return (DISLIKE_REPLY_LIST as readonly string[]).includes(text);
}

// The nearest thing the person said above `from` that is a QUESTION: one of
// the three sentences above is about the answer over it, and asked again by
// itself it is about nothing. The nearest thing said at all when everything
// above is one of those.
function findQuestionAbove(
    messages: readonly ChatMessageType[],
    from: number,
    checkIsSkipped: (text: string) => boolean,
): string | null {
    let nearest: string | null = null;
    for (let index = from - 1; index >= 0; index--) {
        if (messages[index].author !== 'you') {
            continue;
        }
        const text = messages[index].text.trim();
        if (text.length === 0) {
            continue;
        }
        if (!checkIsSkipped(text)) {
            return text;
        }
        nearest ??= text;
    }
    return nearest;
}

/**
 * The question an answer was given to: the nearest thing the person said
 * above it. Null for an answer with nothing above it (a greeting, a tip).
 */
export function findAnsweredQuestion(
    messages: readonly ChatMessageType[],
    answerId: number,
): string | null {
    const at = messages.findIndex((message) => {
        return message.id === answerId;
    });
    return at < 0 ? null : findQuestionAbove(messages, at, checkIsDislikeReply);
}

/**
 * The question a typed complaint is ABOUT: the one above the last real
 * answer -- not anything the window said on its own, and not an earlier
 * complaint either (`checkIsComplaint`: "still not there" under "that is
 * wrong" is about the question above both).
 */
export function findComplainedQuestion(
    messages: readonly ChatMessageType[],
    checkIsComplaint?: (text: string) => boolean,
): string | null {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.author === 'bot' && message.isFollowUp !== true) {
            return findQuestionAbove(messages, index, (text) => {
                return (
                    checkIsDislikeReply(text) ||
                    checkIsComplaint?.(text) === true
                );
            });
        }
    }
    return null;
}

/**
 * The advice owed with the answer to a TYPED complaint, or null: nothing
 * real was answered just above it, or the window has only just said the same
 * thing there (a thumb down, then one of its three sentences pressed).
 */
export function genComplaintAdvice(
    answerer: AnswererType,
    priorMessages: readonly ChatMessageType[],
    checkIsComplaint: (text: string) => boolean,
): { text: string; action: BotActionType | null } | null {
    const last = priorMessages[priorMessages.length - 1];
    if (last?.author !== 'bot' || last.isFollowUp === true) {
        return null;
    }
    return genSmarterModelAdvice(
        answerer,
        findComplainedQuestion(priorMessages, checkIsComplaint),
    );
}

// A line the window ran by itself (`builtinActionHelpers`): no model wrote
// what came back, so no smarter one would have written it better. `/btw` is
// the one slash line a model does answer.
const COMMAND_LINE_PATTERN = /^\/(?!btw\b)/i;

// One line of the question, for the follow-up to an answer further up.
const MAX_QUESTION_QUOTE_LENGTH = 70;

function toQuestionQuote(question: string) {
    const line = question.replace(/\s+/g, ' ').trim();
    return line.length > MAX_QUESTION_QUOTE_LENGTH
        ? `${line.slice(0, MAX_QUESTION_QUOTE_LENGTH)}…`
        : line;
}

/**
 * What the window says under an answer that got the thumb down.
 *
 * `isLastAnswer` is whether it is the answer at the bottom of the tab. Only
 * then are the three sentences offered: pressed, each is read as being about
 * the LAST answer (`findDisputedPage`), so under a thumb down further up they
 * would dispute the wrong one -- that follow-up names its question instead.
 */
export function genDislikeFollowUp(
    answerer: AnswererType,
    question: string | null,
    isLastAnswer = true,
): Omit<ChatMessageType, 'id'> {
    if (question !== null && COMMAND_LINE_PATTERN.test(question.trim())) {
        return {
            author: 'bot',
            isFollowUp: true,
            text: tran(
                'Sorry — that did not help. Tell me in your own words what ' +
                    'you were trying to do, or what went wrong, and I will ' +
                    'look into it.',
            ),
        };
    }
    const advice = genSmarterModelAdvice(answerer, question);
    let opening: string;
    if (isLastAnswer) {
        opening = tran(
            'Sorry — that answer did not help. Tell me what was wrong and I ' +
                'will look again: press one of these, or say it in your own ' +
                'words.',
        );
    } else if (question === null) {
        opening = tran(
            'Sorry — that answer did not help. Tell me what was wrong and I ' +
                'will look again.',
        );
    } else {
        opening = fillWords(
            tran(
                'Sorry — the answer to “{question}” did not help. Ask it ' +
                    'again in other words, or tell me what was wrong, and I ' +
                    'will look again.',
            ),
            { question: toQuestionQuote(question) },
        );
    }
    return {
        author: 'bot',
        isFollowUp: true,
        text: `${opening}\n\n${advice.text}`,
        ...(isLastAnswer ? { replies: [...DISLIKE_REPLY_LIST] } : {}),
        ...(advice.action === null ? {} : { actions: [advice.action] }),
    };
}

/** Whether `answerId` is the answer at the bottom of the tab. */
export function checkIsLastAnswer(
    messages: readonly ChatMessageType[],
    answerId: number,
): boolean {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.author === 'bot' && message.isFollowUp !== true) {
            return message.id === answerId;
        }
    }
    return false;
}

/**
 * The thumb pressed on one answer. Pressing the one already down or up takes
 * it off again. `isNewDislike` says the follow-up is owed: the first time an
 * answer is disliked, and never twice for the same answer however often the
 * thumb is toggled.
 */
export function applyAnswerRating(
    messages: readonly ChatMessageType[],
    answerId: number,
    rating: AnswerRatingType,
): { messages: ChatMessageType[]; isNewDislike: boolean } {
    let isNewDislike = false;
    const next = messages.map((message) => {
        if (
            message.id !== answerId ||
            message.author !== 'bot' ||
            message.isFollowUp === true
        ) {
            return message;
        }
        const { rating: oldRating, ...rest } = message;
        if (oldRating === rating) {
            return rest;
        }
        if (rating === 'dislike' && message.isFollowedUp !== true) {
            isNewDislike = true;
            return { ...rest, rating, isFollowedUp: true as const };
        }
        return { ...rest, rating };
    });
    return { messages: next, isNewDislike };
}
