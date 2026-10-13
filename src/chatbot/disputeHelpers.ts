/**
 * "That is wrong" -- and what the window does about it before any model is
 * asked again.
 *
 * The guide pages on a computer are as old as its release. A control renamed
 * since, or a page that was simply wrong and has been fixed, is right first in
 * the project's own repository, and `owa_help_page` ends every manual page
 * with the address of that copy. Reading it was left to the model at first
 * (the prompt's rule for an answer the person says is wrong), and a model
 * told its answer is wrong mostly says it again in other words. So the
 * window does the reading: a message that disputes the last answer, under an
 * answer that came from a guide page, has that page's newest copy put under
 * it -- on the ask alone, never the transcript -- and the model is told to
 * compare the two before it says anything.
 *
 * The repository's copy is the newer one only when its DAY is later. An app
 * built from a branch ahead of `main` carries pages `main` does not have
 * yet, and the first time this read was run against the real address
 * (2026-10-11) it brought back a page ten days OLDER than the built-in one --
 * handed over as "the newest", it would have taken a corrected answer back
 * to the wrong one. So both copies are dated and an older one is not quoted.
 *
 * Nothing is kept: the page is read for the one ask and dropped with it.
 */
import {
    readManualPageDate,
    toManualPageBody,
} from '../../tools/owa-devtools-mcp/manualPage.mjs';
import type { ChatMessageType } from './chatSessionHelpers';
import { clipKnownPage, HELP_WINDOW_MANUAL_ID } from './questionHelpers';

// A dispute is short. A long message that happens to hold "does not work" is
// a new question with its own story in it, and is left to the model.
const DISPUTE_MAX_LENGTH = 200;

// Narrow on purpose: these only ever fire under an answer that came from a
// guide page, and a miss costs nothing -- the prompt's own rule still stands.
const DISPUTE_PATTERN_LIST = [
    // "wrong" said OF the answer, or by itself: "how do I fix the wrong font"
    // is a new question.
    /^(?:no[,.!\s]+)?(?:that['’]?s\s+)?(?:wrong|incorrect|outdated)\b/i,
    /\b(?:that|this|it|you|your|answers?)\b[^.?!]{0,40}\b(?:wrong|incorrect|inaccurate|outdated|out of date)\b/i,
    /\bnot\s+(?:correct|right|true|accurate|there|here|working)\b/i,
    /\b(?:isn['’]?t|aren['’]?t|wasn['’]?t)\s+(?:correct|right|true|there|here|working)\b/i,
    /\b(?:can['’]?t|cannot|can\s+not|could\s?n['’]?t|could\s+not|do\s?n['’]?t|do\s+not|did\s?n['’]?t|did\s+not)\s+(?:see|find|locate)\b/i,
    /\b(?:there\s+is|there['’]s|there\s+are|i\s+have|i\s+see)\s+no\b/i,
    /\bno\s+such\b/i,
    /\b(?:does\s?n['’]?t|does\s+not|did\s?n['’]?t|did\s+not|won['’]?t|will\s+not)\s+(?:work|exist|show|appear|open)\b/i,
    /\bstill\s+(?:no|not|nothing|missing|the\s+same)\b/i,
    // The same, as a Khmer or a French speaker says it.
    /ខុស|មិនត្រឹមត្រូវ|មិនត្រូវ|រកមិនឃើញ|មិនឃើញ|អត់ឃើញ|អត់មាន|គ្មាន|មិនដំណើរការ/,
    /\b(?:faux|fausse|incorrecte?|introuvable)\b/i,
    /\bne\s+(?:(?:le|la|les)\s+|l['’])?(?:marche|fonctionne|vois|trouve)\b[^.?!]*\bpas\b/i,
    /\bil\s+n['’]y\s+a\s+pas\b/i,
];

export function checkIsDisputingAnswer(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > DISPUTE_MAX_LENGTH) {
        return false;
    }
    return DISPUTE_PATTERN_LIST.some((pattern) => {
        return pattern.test(trimmed);
    });
}

export type DisputedPageType = {
    manualId: string;
    // The control the answer's walkthrough starts at, when it named one.
    find: string | null;
};

/**
 * The guide page the LAST answer came from, read off the walkthrough button
 * under it (`genGuideActions` puts the page's id there), or null when the
 * last thing said was not an answer written from a page.
 */
export function findDisputedPage(
    messages: ChatMessageType[],
): DisputedPageType | null {
    // What the window said by itself under a thumb down is not the answer
    // being disputed: "The steps did not work", pressed under it, is about
    // the answer above (`answerRatingHelpers`).
    const lastMessage = messages.findLast((message) => {
        return message.isFollowUp !== true;
    });
    if (lastMessage?.author !== 'bot') {
        return null;
    }
    for (const action of lastMessage.actions ?? []) {
        const manualId = action.args?.manualId;
        if (typeof manualId === 'string' && manualId.length > 0) {
            const find = action.args?.find;
            return {
                manualId,
                find: typeof find === 'string' && find.length > 0 ? find : null,
            };
        }
    }
    return null;
}

// A control as an answer writes it: in bold. Short -- a bolded sentence is
// not a name.
const BOLD_NAME_PATTERN = /\*\*([^*\n]{2,60})\*\*/g;

/**
 * The control a complaint is about: a name the disputed answer put in bold
 * that the complaint says again ("There is no Bible Properties button" under
 * an answer that said to press **Bible Properties**). The longest such name,
 * so "Bible Properties" is not read as "Bible". Null when the complaint
 * names none of them -- "the steps did not work" is about no one control.
 */
export function findComplainedControl(
    asked: string,
    messages: ChatMessageType[],
): string | null {
    const answer = messages.findLast((message) => {
        return message.isFollowUp !== true;
    });
    if (answer?.author !== 'bot') {
        return null;
    }
    const said = asked.toLowerCase();
    let found: string | null = null;
    for (const match of answer.text.matchAll(BOLD_NAME_PATTERN)) {
        const name = match[1].trim();
        if (
            name.length >= 2 &&
            said.includes(name.toLowerCase()) &&
            (found === null || name.length > found.length)
        ) {
            found = name;
        }
    }
    return found;
}

// Only ever the project's own repository, and only its manual pages: the
// address is taken from what `owa_help_page` printed, and anything that is
// not exactly this shape is not read.
const FRESH_PAGE_URL_PATTERN =
    /https:\/\/raw\.githubusercontent\.com\/OpenWorshipApp\/open-worship-app-dt\/main\/docs\/manual-sources\/[A-Za-z0-9._~%/-]+\.md/;

export function findFreshPageUrl(pageText: string): string | null {
    return pageText.match(FRESH_PAGE_URL_PATTERN)?.[0] ?? null;
}

// `owa_read_website` fences what it read; the words are between the fences.
const WEBSITE_TEXT_PATTERN =
    /--- BEGIN WEBSITE TEXT[^\n]*\n([\s\S]*?)\n--- END WEBSITE TEXT ---/;

export function readWebsiteText(readResult: string): string | null {
    const text = readResult.match(WEBSITE_TEXT_PATTERN)?.[1]?.trim() ?? '';
    return text.length > 0 ? text : null;
}

// A whole recipe: most are 2-6 KB, and the part that rides is clipped again
// around the control (`clipKnownPage`).
const FRESH_PAGE_READ_CHARS = 20000;

// `owa_help_page` says the day of the copy it printed, beside the address.
const BUILT_IN_DATE_PATTERN = /this copy is dated (\d{4}-\d{2}-\d{2})/;

export function findBuiltInPageDate(pageText: string): string | null {
    return pageText.match(BUILT_IN_DATE_PATTERN)?.[1] ?? null;
}

export type FreshGuidePageType = {
    // The page as a reader is shown it -- no front matter, no robot block,
    // no heading with the recipe's id -- cut around the control.
    text: string;
    // Its day is EARLIER than the built-in copy's: it is not the newest.
    // False when either day is unknown, as every release built off `main`
    // was before the pages said their day.
    isOlder: boolean;
};

/**
 * The repository's copy of that page, or null when it has none or cannot be
 * read just now (no internet in the building is the usual reason, and never
 * an error to show anybody). Two calls of the app's own tools, handed in so
 * this module needs no tool client.
 */
export async function readFreshGuidePage(
    page: DisputedPageType,
    callTool: (name: string, args: any) => Promise<string>,
): Promise<FreshGuidePageType | null> {
    try {
        const localText = await callTool('owa_help_page', {
            id: page.manualId,
        });
        const url = findFreshPageUrl(localText);
        if (url === null) {
            return null;
        }
        const readResult = await callTool('owa_read_website', {
            url,
            maxChars: FRESH_PAGE_READ_CHARS,
        });
        const freshText = readWebsiteText(readResult);
        if (freshText === null) {
            return null;
        }
        // The same cleaning the built-in copy gets, heading included.
        const body = toManualPageBody(freshText).replace(/^#\s+.*(\r?\n)+/, '');
        if (body.length === 0) {
            return null;
        }
        const builtInDate = findBuiltInPageDate(localText);
        const freshDate = readManualPageDate(freshText);
        return {
            text: clipKnownPage(body, page.find),
            isOlder:
                builtInDate !== null &&
                freshDate !== null &&
                freshDate < builtInDate,
        };
    } catch (_error) {
        return null;
    }
}

/**
 * Where the control a disputed answer starts at IS, on the window they are
 * asking about, as the app's own find tool has just said.
 */
export type DisputedControlType =
    | { state: 'shown'; find: string; where: string | null }
    | { state: 'tucked'; find: string; revealBy: string }
    | { state: 'hover'; find: string; where: string | null }
    | { state: 'missing'; find: string; nearest: string | null }
    // The answer was about the help window itself: no tool looks in it.
    | { state: 'help-window' };

function toWhere(match: any): string | null {
    const panel =
        typeof match?.inPanel === 'string' && match.inPanel.length > 0
            ? `in the ${match.inPanel} panel`
            : null;
    const place =
        typeof match?.where === 'string' && match.where.length > 0
            ? match.where
            : null;
    return (
        [panel, place]
            .filter((one) => {
                return one !== null;
            })
            .join(', ') || null
    );
}

/**
 * The window walks the ladder itself. Left to the model it was a paragraph
 * of conditions -- find the control; when the tool names another to press
 * first, say THAT; otherwise ask for a picture -- and a small local model
 * recited it as advice: "Please look for a control labeled ? in your
 * window. If you find one, press it first" (gemma-4-e4b, 2026-10-13, under
 * _The steps did not work_). What a model is not handed it cannot recite,
 * so it is handed the FACT.
 *
 * Null when there is nothing to look for, or the look could not be made
 * (that window is not open, the tool host is down): the model is then told
 * how to look, as before. The help window's own page is said to be that:
 * its controls are in THIS window, where the find tool does not look, and
 * "it is not on their window" would be false.
 */
export async function locateDisputedControl(
    page: DisputedPageType,
    lookInPage: string | null,
    callTool: (name: string, args: any) => Promise<string>,
): Promise<DisputedControlType | null> {
    const { find } = page;
    if (page.manualId === HELP_WINDOW_MANUAL_ID) {
        return { state: 'help-window' };
    }
    if (find === null || lookInPage === null) {
        return null;
    }
    try {
        const result = JSON.parse(
            await callTool('owa_find_ui', { text: find, page: lookInPage }),
        );
        if (!Array.isArray(result?.matches)) {
            return null;
        }
        // Only a control CALLED that: a looser fit is some other control,
        // and "it is there" said of it would be the wrong answer again.
        const exact = result.matches.find((one: any) => {
            return one?.tier === 0;
        });
        if (exact === undefined) {
            const nearest = [
                ...(Array.isArray(result.nearMisses) ? result.nearMisses : []),
                ...result.matches.map((one: any) => {
                    return one?.label;
                }),
            ].find((one) => {
                return typeof one === 'string' && one.length > 0;
            });
            return { state: 'missing', find, nearest: nearest ?? null };
        }
        if (typeof exact.revealBy === 'string' && exact.revealBy.length > 0) {
            return { state: 'tucked', find, revealBy: exact.revealBy };
        }
        if (exact.showsOnHover === true) {
            return { state: 'hover', find, where: toWhere(exact) };
        }
        return { state: 'shown', find, where: toWhere(exact) };
    } catch (_error) {
        return null;
    }
}

// What to do next, as one thing to say -- or, with no look made, how to look.
function genDisputeLadder(located: DisputedControlType | null): string {
    if (located === null) {
        return (
            'find the control with owa_find_ui and, when it answers with ' +
            '`revealBy`, say to press THAT first; if it is not on their window, ' +
            'ask for a picture of the window'
        );
    }
    if (located.state === 'help-window') {
        return (
            'that answer was about this help window itself, the one they ' +
            'are typing in, which no tool can look into -- so name no ' +
            'control to look for: ask which step did not do what it said, ' +
            'and what happened instead'
        );
    }
    const head =
        `the app has just looked on their window for "${located.find}", ` +
        'so do not look again: ';
    if (located.state === 'shown') {
        return (
            `${head}it IS there${located.where === null ? '' : ` (${located.where})`}. ` +
            'Say where it is, and ask what happens when they press it'
        );
    }
    if (located.state === 'tucked') {
        return (
            `${head}it is there but shut away -- "${located.revealBy}" has ` +
            'to be pressed first. Say exactly that'
        );
    }
    if (located.state === 'hover') {
        return (
            `${head}it is there${located.where === null ? '' : ` (${located.where})`} ` +
            'but only drawn while the mouse is over that part of the ' +
            'window. Say to move the mouse there first'
        );
    }
    return (
        `${head}there is NO control called that on their window right now` +
        (located.nearest === null
            ? ''
            : ` (the closest name there is "${located.nearest}")`) +
        '. Do not tell them to press it again: say it is not on their ' +
        'window as it is now, and ask what they see where it should be, ' +
        'or for a picture of the window'
    );
}

/**
 * What the MODEL is told with a dispute, on the ask only. With the page: read
 * the two side by side. Without it: the page could not be fetched, so the
 * model must not go looking for it again and falls back on the window itself.
 * With an OLDER page: the built-in guide is the newest there is, and the old
 * one is not quoted at all.
 */
export function genDisputeHint(
    fresh: FreshGuidePageType | null,
    located: DisputedControlType | null = null,
): string {
    const ladder = genDisputeLadder(located);
    // A new question in the words of a complaint ("there is no sound") is
    // still a question, and must not be answered as an argument.
    const head =
        '(They seem to be saying the last answer did not match their ' +
        'window -- if this is a new question instead, answer it as one. ';
    if (fresh === null) {
        return (
            `${head}The app tried to ` +
            'read the newest copy of the guide page it came from and could ' +
            'not reach it just now, so do not try to read it yourself. Do ' +
            `not repeat the answer: ${ladder}.)`
        );
    }
    if (fresh.isOlder) {
        return (
            `${head}The app has just read the copy of the guide page it ` +
            "came from on the project's own repository, and that copy is " +
            'OLDER than the one built into this app -- so the built-in ' +
            'guide is the newest there is and is not what is behind. Do ' +
            'not read the page yourself, and do not repeat the answer: ' +
            `${ladder}.)`
        );
    }
    return (
        `${head}The app has just read ` +
        'the NEWEST copy of the guide page it came from, off the ' +
        "project's own repository, and it is quoted below -- the person " +
        'did not write or paste it, and never sees it. The copy built ' +
        'into this app may be older. Compare it with what you said: where ' +
        'it differs, answer from this copy and say plainly that the ' +
        'built-in guide was behind. Where it says the same, the guide is ' +
        `not what is wrong, so do not repeat it: ${ladder}. Do not read ` +
        'the page again. A control written `[en:tran:Name]` is called ' +
        `Name.)\n\n${fresh.text}`
    );
}

/**
 * The whole step, for the window: null when this message is not a dispute or
 * the last answer came from no guide page; otherwise the hint to put under
 * the ask. `onReading` is told once the read is really going to happen, so
 * the waiting line only says so when it is true.
 */
export async function readDisputeHint(
    asked: string,
    messages: ChatMessageType[],
    callTool: (name: string, args: any) => Promise<string>,
    onReading?: () => (() => void) | void,
    // The window they are asking about, as the find tool takes it
    // ("presenter.html"); null looks nowhere.
    lookInPage: string | null = null,
): Promise<string | null> {
    if (!checkIsDisputingAnswer(asked)) {
        return null;
    }
    const page = findDisputedPage(messages);
    if (page === null) {
        return null;
    }
    // The control the COMPLAINT names, when the answer named it too: that is
    // the one to look for, before the one the walkthrough starts at.
    const named = findComplainedControl(asked, messages);
    const finishReading = onReading?.();
    try {
        // Both at once: one is a page off the web, the other a look at
        // the window, and neither waits on the other.
        const [fresh, located] = await Promise.all([
            readFreshGuidePage(page, callTool),
            locateDisputedControl(
                named === null ? page : { ...page, find: named },
                lookInPage,
                callTool,
            ),
        ]);
        return genDisputeHint(fresh, located);
    } finally {
        finishReading?.();
    }
}
