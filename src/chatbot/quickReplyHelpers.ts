// What the user can PRESS instead of typing their next message.
//
// Every answer ends with a question or an implied next step, and until now the
// only way to take it was to type. That is one sentence of English, on a
// machine they do not own, minutes before a service -- for a volunteer who is
// often not a native speaker, it is the reason the conversation stops after one
// answer. Buttons under the answer are the whole fix.
//
// Three layers, in falling order of how well they fit the answer:
//
// 1. THE MODEL WROTE THEM. It is the only thing that knows what this particular
//    answer's next step is, so it ends its answer with an `OPTIONS:` line and
//    `parseAnswerOptions` takes it off again. It is a FRAME the code holds it
//    to, not a request -- the lesson `EC-21` and `EC-38` each paid for once:
//    told merely not to narrate, a small model narrated in three answers of
//    four; given a marker to fill and code that parses it out, five in five.
// 2. READ THE ANSWER (`genQuickReplies`). No model, no key, no network: the
//    answer's own trailing question is looked at, and a yes/no or an either-or
//    becomes its buttons. This is what the offline bot gets, and what a model
//    answer gets when the model forgot its frame.
// 3. ASK THE CORPUS (`genFollowUpQuestions`, in `questionHelpers`). Neither of
//    the above found anything, so the two nearest questions the assistant is
//    PREPARED to be asked are offered. Every one is pinned to a live-verified
//    recipe or a live tool, so an option is never a promise it cannot keep.
//
// Nothing here is cached and nothing runs per render: the caller works the
// layers once, when the answer lands, and stores the result on the message.

import type { BotFocusType } from './helpBotHelpers';
import { genFollowUpQuestions } from './questionHelpers';

// Three buttons is a row in a 460px window; two is the cap when the answer is
// already carrying walkthrough buttons of its own, because a wall of buttons
// under an answer is the same dead end as none.
export const MAX_REPLY_COUNT = 3;
export const MAX_REPLY_COUNT_WITH_ACTIONS = 2;
// ...and a ceiling on BOTH rows together. Measured live: an offline manual
// answer carries four of its own buttons, and two more under them made six
// under one paragraph -- more choices than the answer had sentences.
export const MAX_BUTTON_COUNT = 5;
// Long enough for "Yes, walk me through it", short enough that three fit.
export const MAX_REPLY_LENGTH = 40;

// The frame the model is held to. Written UPPERCASE and with a colon so it
// cannot be confused with a sentence -- and required to START a word, so an
// answer that merely says "options" is untouched.
//
// Matched ANYWHERE in the closing line, not only at its start. Measured live
// on the first run of this feature: GPT-5 ended an answer with "Want me to
// keep stepping you through on screen? OPTIONS: Yes, walk me through it | ..."
// -- one sentence, marker and all. A parser anchored to the line start reads
// that as prose and prints the machinery at the volunteer, which is the one
// thing this frame exists to prevent. So the line is CUT at the marker: what
// is in front of it is the answer, what follows is the buttons.
const OPTIONS_MARKER = /(^|[\s>*_(-])OPTIONS:[ \t]*/i;
// How far back the marker may sit. The model puts it last; two lines of slack
// covers a stray blank or a closing sentence typed after it. Further back than
// that and it is something else -- a quoted example, a step in a recipe.
const OPTIONS_LOOKBACK = 2;

function toCleanReply(raw: string) {
    return raw
        .replace(/`{1,3}/g, '')
        .replace(/[*_#>[\]]/g, '')
        .replace(/^\s*\d+[.)]\s*/, '')
        .replace(/^\s*[-•]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Whether this is something a volunteer reading an English window can act on.
 *
 * The system prompt says ALWAYS answer in English, and the strong models keep
 * to it. A weaker one -- and the keyless provider is nothing but weaker models
 * -- keeps to it in the prose and then writes the options line in whatever
 * language it was thinking in. Measured live against the free tier
 * (2026-09-01): a correct English answer about the Bible Lookup button came
 * with a button under it reading `请确认显示这个按钮`.
 *
 * The rule is "no Latin letters AT ALL", not "non-Latin characters present".
 * Button names in this app are translated -- an answer may quite properly
 * offer "Show me លុបព្រះគម្ពីរ", and dropping that would be enforcing English
 * on the one thing that is deliberately not in English. A reply with no Latin
 * letter anywhere is not that; it is the model changing language on its own.
 *
 * Enforced here rather than asked for in the prompt, which is this window's
 * standing lesson: a rule the model can ignore is not a rule.
 */
function checkIsReadableReply(reply: string) {
    return /[a-z]/i.test(reply);
}

function toReplyList(raw: string) {
    const seen = new Set<string>();
    const replies: string[] = [];
    for (const part of raw.split('|')) {
        const reply = toCleanReply(part);
        const key = reply.toLowerCase();
        if (reply.length === 0 || reply.length > MAX_REPLY_LENGTH) {
            continue;
        }
        if (!checkIsReadableReply(reply)) {
            continue;
        }
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        replies.push(reply);
        if (replies.length >= MAX_REPLY_COUNT) {
            break;
        }
    }
    return replies;
}

/**
 * Cut a trailing `MARKER: ...` frame off an answer, wherever in the closing
 * lines the model chose to put it.
 *
 * Shared by both frames because the failure mode is shared: what is in front of
 * the marker is the answer, what follows it is machinery, and the machinery must
 * be impossible to see WHETHER OR NOT it parsed into anything usable.
 */
function cutTrailingFrame(text: string, marker: RegExp) {
    const lines = String(text ?? '').split('\n');
    let looked = 0;
    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (line.trim().length === 0) {
            continue;
        }
        const matched = marker.exec(line);
        if (matched !== null) {
            const head = line
                .slice(0, matched.index + matched[1].length)
                .replace(/[ \t>*_-]+$/, '')
                .trimEnd();
            const tail = line.slice(matched.index + matched[0].length);
            if (head.length > 0) {
                lines[index] = head;
            } else {
                lines.splice(index, 1);
            }
            return { text: lines.join('\n').trimEnd(), tail };
        }
        looked += 1;
        if (looked >= OPTIONS_LOOKBACK) {
            break;
        }
    }
    return { text: String(text ?? ''), tail: null };
}

/**
 * The answer as the user should see it, and the options the model attached to
 * it.
 *
 * The line is taken off the text WHETHER OR NOT it parsed into anything usable.
 * A bubble reading `OPTIONS: |` at a volunteer is the one failure this design
 * can produce, and making it impossible is the code's job -- a model that half
 * complies must not be able to leak its own machinery into the window.
 */
export function parseAnswerOptions(text: string): {
    text: string;
    options: string[];
} {
    const cut = cutTrailingFrame(text, OPTIONS_MARKER);
    return {
        text: cut.text,
        options: cut.tail === null ? [] : toReplyList(cut.tail),
    };
}

/** The three things the assistant can ask the user to hand it. */
export type AttachRequestType = 'screenshot' | 'element' | 'file';

/**
 * Something the ANSWER offers to show, as a chip the user can press.
 *
 * The mirror of an attachment: those go up with a question, these come back
 * with an answer. `control` is a name the window resolves when it is pressed,
 * `selector` is one the model read off a tool result and can be rung exactly,
 * and `file` is a path on the user's own machine.
 */
export type ShowRefKindType = 'control' | 'selector' | 'file';

export type ShowRefType = {
    kind: ShowRefKindType;
    // What is acted on: a label, a CSS selector, a path.
    value: string;
    // What the CHIP says. Never the selector -- a volunteer reading
    // `button[aria-label="Setting"]` is the internals leak this window is
    // written to prevent, and the whole point of a chip is that it says the
    // name of the thing.
    name: string;
};

const SHOWS_MARKER = /(^|[\s>*_(-])SHOWS:[ \t]*/i;
// Long enough for a real path, short enough that a model cannot paste an
// answer into one.
const MAX_SHOW_LENGTH = 300;
const MAX_SHOW_COUNT = 3;

function toFileName(value: string) {
    const parts = value.split(/[\\/]/);
    return parts[parts.length - 1] || value;
}

/**
 * What the answer offers to show, taken off it.
 *
 * Stripped unconditionally like the other two frames. A malformed entry is
 * dropped rather than drawn: a chip that cannot do anything is worse than no
 * chip, because pressing it is the only way to find that out.
 */
export function parseAnswerShows(text: string): {
    text: string;
    shows: ShowRefType[];
} {
    const cut = cutTrailingFrame(text, SHOWS_MARKER);
    if (cut.tail === null) {
        return { text: cut.text, shows: [] };
    }
    const shows: ShowRefType[] = [];
    const seen = new Set<string>();
    for (const part of cut.tail.split('|')) {
        const raw = part.trim().replace(/^[`'"]|[`'"]$/g, '');
        if (raw.length === 0 || raw.length > MAX_SHOW_LENGTH) {
            continue;
        }
        const matched = /^(selector|file|control)\s*:\s*(.+)$/i.exec(raw);
        const kind = (
            matched === null ? 'control' : matched[1].toLowerCase()
        ) as ShowRefKindType;
        const value = (matched === null ? raw : matched[2]).trim();
        if (value.length === 0 || seen.has(value.toLowerCase())) {
            continue;
        }
        seen.add(value.toLowerCase());
        shows.push({
            kind,
            value,
            name:
                kind === 'file'
                    ? toFileName(value)
                    : kind === 'selector'
                      ? // A selector is never shown. Until the ring lands there
                        // is nothing better to call it than what it is FOR.
                        'the control I mean'
                      : toCleanReply(value),
        });
        if (shows.length >= MAX_SHOW_COUNT) {
            break;
        }
    }
    return { text: cut.text, shows };
}

// The second frame, and the reason it exists: a model that cannot see what the
// user is looking at has, until now, had only two moves -- guess, or give up.
// The window can now put a picture in front of it, so the model needs a way to
// ASK for one, and a sentence saying "please send a screenshot" is a sentence a
// volunteer has to work out how to act on. A marker turns it into a button.
//
// Same shape as `OPTIONS:` for the same reason: a frame the code holds it to,
// not a request. `EC-21`, `EC-38` and `EC-43` each paid for that lesson once.
const NEEDS_MARKER = /(^|[\s>*_(-])NEEDS:[ \t]*/i;

const ATTACH_REQUEST_MAP: Record<string, AttachRequestType> = {
    screenshot: 'screenshot',
    screen: 'screenshot',
    picture: 'screenshot',
    photo: 'screenshot',
    element: 'element',
    control: 'element',
    button: 'element',
    file: 'file',
};

/**
 * What the assistant says it needs to see, taken off the answer.
 *
 * Stripped unconditionally, exactly like the options frame -- a half-written
 * `NEEDS:` reaching a volunteer is the one failure this can produce.
 */
export function parseAttachRequests(text: string): {
    text: string;
    requests: AttachRequestType[];
} {
    const cut = cutTrailingFrame(text, NEEDS_MARKER);
    if (cut.tail === null) {
        return { text: cut.text, requests: [] };
    }
    const requests: AttachRequestType[] = [];
    for (const part of cut.tail.split(/[|,]/)) {
        const key = toCleanReply(part).toLowerCase();
        const request = ATTACH_REQUEST_MAP[key];
        if (request !== undefined && !requests.includes(request)) {
            requests.push(request);
        }
    }
    return { text: cut.text, requests };
}

// A question a press can answer is short, and it is the LAST thing said. These
// two numbers are what "last thing said" means: a question with a paragraph
// after it is not what a bare "Yes" would be replying to, and a 140-character
// question is not a yes/no.
const MAX_QUESTION_LENGTH = 140;
const MAX_TRAILING_LENGTH = 90;

// The openings that make a question answerable with yes or no. Deliberately a
// list of LEAD-INS rather than "does it end in a question mark": "What would
// you like to do?" is a question and "Yes" is not an answer to it.
const YES_NO_LEAD =
    /^(?:would\s+you(?:\s+(?:like|prefer|want))?|do\s+you\s+want|shall\s+(?:i|we)|should\s+i|can\s+i|may\s+i|want\s+me\s+to|is\s+that|are\s+those|was\s+that|did\s+that|did\s+it|does\s+that|ready\s+to)\b/i;

// Both of these are understood by the OFFLINE bot's own follow-up patterns
// (`FOLLOW_UP_YES_PATTERN` / `FOLLOW_UP_NO_PATTERN` in `helpBotHelpers`), which
// is why the words are these words: a press has to work with no key and with
// the building's internet down, not only with a model behind it.
const YES_REPLY = 'Yes';
const NO_REPLY = 'No thanks';

// Words that are grammar rather than the name of a choice.
const LEADING_FILLER = /^(?:the|a|an|in|on|to|from|of|your|my|its)$/i;
// An either-or's left half runs back into the sentence that asked it, so the
// slice can pick up the verb. If it did, this is not a choice we can name.
const CHOICE_STOP_VERB =
    /^(?:are|is|do|does|did|would|should|shall|can|could|will|want|like|prefer|use|have|has|need|pick|choose|say|mean)$/i;
const MAX_CHOICE_WORDS = 4;
const MAX_CHOICE_LENGTH = 28;

function toWords(text: string) {
    return text.split(/\s+/).filter((word) => {
        return word.length > 0;
    });
}

function toChoiceLabel(words: string[]) {
    const kept = [...words];
    while (kept.length > 0 && LEADING_FILLER.test(kept[0])) {
        kept.shift();
    }
    if (kept.length === 0 || kept.length > MAX_CHOICE_WORDS) {
        return null;
    }
    if (CHOICE_STOP_VERB.test(kept[0])) {
        return null;
    }
    const label = toCleanReply(kept.join(' ')).replace(/[.,;:!?]+$/, '');
    return label.length > 0 && label.length <= MAX_CHOICE_LENGTH ? label : null;
}

/**
 * "Are you in the Presenter or the Bible Reader?" -> `['Presenter',
 * 'Bible Reader']`.
 *
 * The right-hand option is easy -- it runs to the question mark. The left-hand
 * one has no boundary at all, so it is taken as the LAST K words before the
 * "or", where K is however many words the right-hand option used. Mirroring the
 * shape is what makes both `screen 1 or screen 2` and `in the Presenter or the
 * Bible Reader` come out right, where counting from the verb gets one of them
 * wrong every time.
 */
function toChoiceReplies(question: string) {
    const parts = question.split(/\s+\bor\b\s+/i);
    if (parts.length !== 2) {
        return [];
    }
    const rightWords = toWords(parts[1].replace(/\?+\s*$/, ''));
    if (rightWords.length === 0 || rightWords.length > MAX_CHOICE_WORDS + 1) {
        return [];
    }
    const leftWords = toWords(parts[0]).slice(-rightWords.length);
    const right = toChoiceLabel(rightWords);
    const left = toChoiceLabel(leftWords);
    if (left === null || right === null) {
        return [];
    }
    if (left.toLowerCase() === right.toLowerCase()) {
        return [];
    }
    return [left, right];
}

/**
 * The buttons an answer's own last question deserves, read off the text. No
 * model, no network, no key -- so this is what the offline bot gets, and the
 * safety net under a model that did not write its own.
 */
export function genQuickReplies(text: string): string[] {
    const trimmed = String(text ?? '').trimEnd();
    const askIndex = trimmed.lastIndexOf('?');
    if (askIndex === -1) {
        return [];
    }
    const trailing = trimmed.slice(askIndex + 1);
    // One closing sentence after the question is normal ("I can walk you
    // through it."); a paragraph means the question is not what the next
    // message is answering.
    if (
        trailing.length > MAX_TRAILING_LENGTH ||
        (trailing.match(/[.!?]/g) ?? []).length > 1
    ) {
        return [];
    }
    const head = trimmed.slice(0, askIndex);
    const startIndex = Math.max(
        head.lastIndexOf('.'),
        head.lastIndexOf('!'),
        head.lastIndexOf('?'),
        head.lastIndexOf('\n'),
    );
    const question = toCleanReply(head.slice(startIndex + 1));
    if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
        return [];
    }
    // A choice first: naming the two things beats a yes/no that answers
    // neither of them.
    const choices = toChoiceReplies(question);
    if (choices.length > 0) {
        return choices;
    }
    return YES_NO_LEAD.test(question) ? [YES_REPLY, NO_REPLY] : [];
}

function toMatchKey(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// A model-written option that says what **Show me step by step** or **Do it
// for me** already says, in other words. Measured 2026-09-08 on Claude: 7 of
// 7 answers that carried the walkthrough buttons also carried one of these --
// "Yes, walk me through it", "Yes, show me how", "Show me the demo instead"
// -- because the answer ends by OFFERING the walkthrough and the model then
// writes the natural "yes" to its own offer. The same press twice, in two
// shapes, is the wall of buttons the ceiling exists to stop. Only ever
// applied beside those buttons: with no walkthrough on offer, "Show me the
// button" is a real reply and keeps its place.
const WALKTHROUGH_ECHO_PATTERN =
    /^(?:(?:yes|yeah|ok|okay|sure|please)[,!. ]*)?(?:please )?(?:walk me through|step by step|show me how|show me the (?:steps|demo)|show me$|guide me|do it for me|do (?:it|that) for me|run the demo|(?:show|start) (?:me )?the (?:demo|walkthrough|guide)|demo (?:it|instead))|^(?:yes|yeah|ok|okay|sure)[,!. ]*(?:please)?[!. ]*$/i;
const WALKTHROUGH_ACTION_PATTERN = /step by step|do it for me/i;

export function checkIsWalkthroughEcho(reply: string) {
    return WALKTHROUGH_ECHO_PATTERN.test(String(reply ?? '').trim());
}

// The same mistake under a drafted song. Measured 2026-09-08 on Kimi K2.6, on
// both starter chips that end in a draft: beside **Create "Amazing Grace"**
// and **Copy song text** the model wrote "Create the file" and "Copy the text"
// (a page: "Copy to clipboard") -- and those pills are drawn BRIGHTER than
// the real buttons, so they are the ones a volunteer presses. Pressed, the
// words go to the model as a question, which then retypes the notation by
// hand (refused twice by the validator), hits the name already in use, and
// offers to "Overwrite the old one" -- a thing no tool here will ever do.
// 4 rounds and 32 seconds to fail at what the real button did in 1.5 seconds
// with no model at all. Only ever applied beside those two buttons: with no
// draft on offer, "Create a new song" is a real request.
const DRAFT_ECHO_PATTERN =
    /^(?:(?:yes|yeah|ok|okay|sure|please)[,!. ]*)?(?:please )?(?:(?:create|save|make|add|write|keep) (?:the |this |that |it as a |a |it )?(?:song |lyric |lyrics )?(?:file|song|it|now)?|create it|save it|copy (?:the |this |that |it )?(?:song |lyric |lyrics )?(?:text|notation|words|it)?(?: (?:to|for) (?:the )?clipboard)?|copy to (?:the )?clipboard|copy it)$/i;
const DRAFT_ACTION_PATTERN = /^create "|^copy song text$/i;

export function checkIsDraftEcho(reply: string) {
    return DRAFT_ECHO_PATTERN.test(String(reply ?? '').trim());
}

function dropDuplicates(replies: string[], actionLabels: string[]) {
    const taken = new Set(actionLabels.map(toMatchKey));
    const hasWalkthrough = actionLabels.some((label) => {
        return WALKTHROUGH_ACTION_PATTERN.test(label);
    });
    const hasDraft = actionLabels.some((label) => {
        return DRAFT_ACTION_PATTERN.test(label);
    });
    return replies.filter((reply) => {
        const key = toMatchKey(reply);
        if (key.length === 0 || taken.has(key)) {
            return false;
        }
        if (hasWalkthrough && checkIsWalkthroughEcho(reply)) {
            return false;
        }
        if (hasDraft && checkIsDraftEcho(reply)) {
            return false;
        }
        taken.add(key);
        return true;
    });
}

/**
 * The options to show under one answer. Worked ONCE, when the answer lands,
 * and stored on the message -- not per render, and never per keystroke.
 */
export async function genMessageReplies({
    modelOptions = [],
    answerText,
    askedText,
    actionLabels = [],
    focus,
}: {
    modelOptions?: string[];
    answerText: string;
    askedText: string;
    actionLabels?: string[];
    focus: BotFocusType;
}): Promise<string[]> {
    const hasActions = actionLabels.length > 0;
    const limit = Math.max(
        0,
        Math.min(
            hasActions ? MAX_REPLY_COUNT_WITH_ACTIONS : MAX_REPLY_COUNT,
            MAX_BUTTON_COUNT - actionLabels.length,
        ),
    );
    const fromModel = dropDuplicates(modelOptions, actionLabels);
    if (fromModel.length > 0) {
        return fromModel.slice(0, limit);
    }
    const detected = genQuickReplies(answerText);
    // A bare "Yes" beside **Show me step by step** and **Do it for me** is a
    // third, vaguer way to say what those two already say -- and the one the
    // user cannot tell apart. A named CHOICE is a different question and keeps
    // its buttons.
    const isGenericYesNo = detected[0] === YES_REPLY;
    if (detected.length > 0 && !(hasActions && isGenericYesNo)) {
        return detected.slice(0, limit);
    }
    // Under a drafted song the "question" was the words of the song, and the
    // nearest corpus questions to a hymn are noise ("How do I change where my
    // documents are stored?" under Amazing Grace, measured). The two buttons
    // are the whole of what comes next.
    if (actionLabels.some((label) => DRAFT_ACTION_PATTERN.test(label))) {
        return [];
    }
    const followUps = await genFollowUpQuestions(askedText, focus);
    return dropDuplicates(followUps, actionLabels).slice(
        0,
        Math.min(limit, MAX_REPLY_COUNT_WITH_ACTIONS),
    );
}
