// One line above the box saying something this window can do.
//
// Everything in here is already built and none of it is discoverable: the
// paperclip looks like a paperclip, but that Alt+↑ brings back the last
// question, that the box takes a picture of the app, that Report writes the
// bug report for you and that an answer can walk you through the task on a
// card in the app itself are all things a volunteer only finds by being told.
// A help page nobody opens does not tell them. One short line, in the place
// their eyes are already going -- straight above the box they are about to
// type in -- does.
//
// Which one you OPEN on is random, and never the same one twice running:
// somebody who opens this window three times in a service should learn three
// things, and a rotation that always starts at the beginning teaches the first
// tip four times. Where you go from there is not random -- the arrows walk the
// list in order, both ways. Those are two different questions: "show me
// another" is answered by a random pick, "show me all of them, and let me get
// back to the one I was half way through" only by a walk.

import { getSetting, setSetting } from '../helper/settingHelpers';

const TIP_SETTING_NAME = 'chatbot-tip-shown';

export type ChatTipType = {
    id: string;
    text: string;
};

/**
 * Written for a volunteer, in the same voice as the answers: no ids, no paths,
 * no key names. Every one of these is a thing the window ACTUALLY does -- a
 * tip for a feature that is not there is worse than no tip, because the person
 * reading it is standing in front of the app trying to find it.
 */
export const CHAT_TIP_LIST: ChatTipType[] = [
    {
        id: 'history',
        text:
            'Alt+↑ brings back a question you asked before; Alt+↓ comes ' +
            'back to what you were typing.',
    },
    {
        id: 'send',
        text:
            'Ctrl+Enter asks. Plain Enter starts a new line, so a long ' +
            'question can run across several.',
    },
    {
        id: 'stop',
        text:
            'While an answer is on its way, Ask becomes Stop — and it really ' +
            'does call the question off.',
    },
    {
        id: 'add',
        text:
            'You can keep typing while an answer is coming. Press Add and it ' +
            'joins the question being worked on.',
    },
    {
        id: 'tabs',
        text:
            'The + above opens a second conversation. Each keeps its own ' +
            'assistant, model and answers.',
    },
    {
        id: 'commands',
        text:
            'Type / for commands that need no assistant: /screen-show turns ' +
            'the projector on, /screen-hide turns it off.',
    },
    {
        id: 'lock',
        text:
            'Right-click a tab to rename it, or lock it so clearing the ' +
            'chats leaves that one alone.',
    },
    {
        id: 'snapshot',
        text:
            'The camera button attaches a picture of the app as it looks now ' +
            '— often quicker than describing it.',
    },
    {
        id: 'pick',
        text:
            'The ◎ button points at a button in the app and asks what it ' +
            'does. Pointing at it does not press it.',
    },
    {
        id: 'attach',
        text:
            'You can paste or drop a picture or a file straight into this ' +
            'window and ask about it.',
    },
    {
        id: 'shows',
        text:
            'When an answer names a button, press that name and the app will ' +
            'outline the real one for you.',
    },
    {
        id: 'guide',
        text:
            'Ask to be shown step by step and the steps are drawn on a card ' +
            'in the app window itself.',
    },
    {
        id: 'report',
        text:
            'If the app itself is wrong, press Report — it looks into it and ' +
            'writes the report up for you.',
    },
    {
        id: 'focus',
        text:
            'The “Asking about” picker at the top says which window the ' +
            'answers should be about.',
    },
    {
        id: 'suggest',
        text:
            'Type a few words and a list of questions it can already answer ' +
            'drops up; the arrows walk it.',
    },
    {
        id: 'credit',
        text:
            'Every answer says what it cost; “Credit used” under the pickers ' +
            'totals this chat. Hover either for the sums.',
    },
    {
        id: 'spend-limit',
        text:
            'It cannot run up the bill: “Limit per hour” at the top pauses ' +
            'it at $1 an hour until you press Allow more.',
    },
];

/**
 * A tip that is not the one just shown.
 *
 * `random` is a parameter so the choosing can be tested; nothing in the app
 * passes it.
 */
export function genChatTip(lastId: string | null, random = Math.random) {
    const choices = CHAT_TIP_LIST.filter((tip) => {
        return tip.id !== lastId;
    });
    // Only if the list is ever cut down to one.
    const list = choices.length > 0 ? choices : CHAT_TIP_LIST;
    return list[Math.floor(random() * list.length) % list.length];
}

/**
 * The neighbour of the tip on screen: the next one along, or the one before.
 *
 * The walk is the LIST's own order, not more random picks, and that is the
 * whole point of having arrows at all. Random forever answers "show me
 * another" but never "show me all of them" -- there is no way to tell whether
 * you have seen the lot, and no way back to the one you half-read before it
 * changed. Stepping wraps, so holding → walks every feature this window has
 * and returns to where it started, and ← is the way back to the line that was
 * just replaced.
 *
 * An unknown id (a tip removed since the window opened) starts the walk at the
 * beginning rather than answering nothing.
 */
export function stepChatTip(currentId: string | null, delta: number) {
    const index = CHAT_TIP_LIST.findIndex((tip) => {
        return tip.id === currentId;
    });
    const count = CHAT_TIP_LIST.length;
    const from = index === -1 ? 0 : index;
    // `+ count` before the modulo: JavaScript's `%` keeps the sign, so a step
    // back from the first tip would index at -1 and hand back nothing.
    const tip = CHAT_TIP_LIST[(from + delta + count) % count];
    rememberChatTip(tip);
    return tip;
}

/** One tiny setting; it is written once per press, never per keystroke. */
function rememberChatTip(tip: ChatTipType) {
    setSetting(TIP_SETTING_NAME, tip.id);
    return tip;
}

/**
 * Another one at random, remembered like every other way of changing it.
 *
 * `genChatTip` is left pure so the choosing can be tested without a setting
 * store; this is the one the window presses, and forgetting to remember here
 * is what would make a window opened straight afterwards repeat the tip that
 * was on screen a moment ago.
 */
export function pickChatTip(currentId: string | null) {
    return rememberChatTip(genChatTip(currentId));
}

/**
 * The tip to show now, remembered so the next window does not open on the same
 * one.
 */
export function takeChatTip() {
    const lastId = getSetting(TIP_SETTING_NAME);
    return rememberChatTip(
        genChatTip(lastId === null || lastId === '' ? null : lastId),
    );
}
