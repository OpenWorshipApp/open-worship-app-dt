/**
 * The app side of `owa_present_bible`: put a Bible passage on the projector
 * by its REFERENCE -- the words a volunteer says ("John 3:16", "Psalm 23",
 * "1 John 1:1-4") -- and answer with what went up.
 *
 * ## Why the tool needed the app for this
 *
 * "Put John 3:16 on the screen" is the commonest thing anybody asks of this
 * app in a service, and it was the one ask the assistant could only DESCRIBE.
 * Measured 2026-09-09 and again 2026-09-10 on Claude Sonnet 5: the answer was
 * the manual's steps (right, 3 rounds), and the **Do it for me** button under
 * them started the recipe's demo, which pressed **Bible Lookup** and then
 * stopped at step 2 -- a step with nothing to press, a `Tab` to press, and no
 * trace of the verse the user had typed. The Bible Lookup is a step-by-step
 * picker written for a person: type the first letters of the book, click the
 * book, click the chapter, click the verse, double-click the preview. Nothing
 * a card can do, and nothing `owa_click` can do either, because the labels
 * along the way are the book's own name and bare numbers. The song
 * equivalent ("put Amazing Grace on the screen") already worked end to end
 * through `selectedDocument`; the verse had no such door.
 *
 * So this resolves the reference with the app's OWN parser
 * (`BibleItem.fromTitleText`, the one the lookup box and the reader use, in
 * every locale it knows -- the version's full book name, never a short form,
 * and a whole chapter widened to all its verses here), presents it exactly as the
 * lookup's **Show bible item** does (`ScreenBibleManager.handleBibleItemSelecting`
 * to the screens the user has ticked), and reads the screen back so the tool
 * answers what is on it now rather than what was pressed.
 *
 * ## The rules it keeps
 *
 * - It reaches the tool the way `owa_list_screens` does: a dependency-free
 *   page expression fires a DOM event, `domHelpers.ts` relays it here, and
 *   the import there is LAZY -- the screen managers and the bible graph must
 *   not load in every window because somebody might ask.
 * - Nothing is written to disk. The lookup's double-click also SAVES the
 *   verse into the Bibles list; this deliberately does not, so the whole
 *   effect is on the screen and **Clear Bible** undoes it.
 * - A locked screen refuses the verse, as it refuses a click, and the answer
 *   says so instead of pretending.
 * - Whether to present at all is decided BEFORE this is called -- the model
 *   is told to do it only when the user asked for the verse to go up, and to
 *   offer it otherwise; `check` resolves the reference without touching a
 *   screen, for the offer and for "what does it say".
 */
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import BibleItem from '../bible-list/BibleItem';
import appProvider from '../server/appProvider';
import {
    type AgentScreenBibleSummaryType,
    toBibleSummary,
} from './agentScreenHelpers';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { getVersesCount } from './bible-helpers/bibleLogicHelpers2';

export type AgentBibleRequestType = {
    action?: unknown;
    reference?: unknown;
    version?: unknown;
};

export type AgentBibleScreenType = {
    screenId: number;
    isShowing: boolean;
    isLocked: boolean;
    bible: AgentScreenBibleSummaryType | null;
};

export type AgentBibleRefusalType = {
    isError: true;
    reason: string;
    // The versions installed on this machine, so a model asked for one that
    // is not can name one that is.
    versions?: string[];
};

export type AgentBibleResultType =
    | AgentBibleRefusalType
    | {
          isError?: false;
          isPresented: boolean;
          // The reference as the app itself writes it for that version.
          reference: string;
          version: string;
          // The first words of the passage, so the answer can say what went
          // up in a way the user can check against the wall.
          text: string;
          screens: AgentBibleScreenType[];
          isAnyShowing: boolean;
          note?: string;
      };

export const AGENT_BIBLE_ACTIONS = ['present', 'check'] as const;
// A reference is a few words; a paragraph is not one. Exported, with the two
// resolvers below, for `owa_bible_item`: saving a passage reads it exactly the
// way presenting one does, in every version it knows.
export const MAX_REFERENCE_LENGTH = 80;
// How much of the passage rides in the answer -- a line, not the chapter.
const TEXT_LIMIT = 200;

function toReason(reason: string, versions?: string[]): AgentBibleRefusalType {
    return versions === undefined
        ? { isError: true, reason }
        : { isError: true, reason, versions };
}

function cutText(text: string) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > TEXT_LIMIT
        ? `${flat.slice(0, TEXT_LIMIT).trimEnd()}…`
        : flat;
}

/**
 * The version the lookup box is on -- what a double-click in it would present
 * -- read the way the lookup reads it. Imported here rather than at the top
 * so a `check` never pays for the reader's controller in a window that has
 * no lookup.
 */
async function getLookupVersion(): Promise<string | null> {
    try {
        const { default: LookupBibleItemController } =
            await import('../bible-reader/LookupBibleItemController');
        return new LookupBibleItemController().selectedBibleItem.bibleKey;
    } catch {
        return null;
    }
}

/**
 * The version to read the reference in, in order: the one asked for (which
 * must be installed), the one the lookup is on, then every other installed
 * one -- because "John 3:16" does not parse under a Khmer version's book
 * names, and a volunteer who typed it in English wants the verse, not a
 * refusal. The answer names the version it settled on.
 */
export async function resolveVersionOrder(
    version: string | null,
): Promise<{ order: string[]; installed: string[] } | AgentBibleRefusalType> {
    const installed = ((await getAllLocalBibleInfoList()) ?? []).map((info) => {
        return info.key;
    });
    if (installed.length === 0) {
        return toReason(
            'No Bible version is installed on this machine, so there is ' +
                'nothing to present. Bibles are added in Settings, under ' +
                'the Bible tab.',
        );
    }
    if (version !== null) {
        const wanted = installed.find((key) => {
            return key.toLowerCase() === version.toLowerCase();
        });
        if (wanted === undefined) {
            return toReason(
                `No Bible version called "${version}" is installed. Use one ` +
                    'of the installed ones, named under versions, or leave ' +
                    'version out to use the one the Bible Lookup is on.',
                installed,
            );
        }
        return { order: [wanted], installed };
    }
    const lookupVersion = await getLookupVersion();
    const order = [
        ...(lookupVersion !== null && installed.includes(lookupVersion)
            ? [lookupVersion]
            : []),
        ...installed,
    ];
    return { order: Array.from(new Set(order)), installed };
}

// A whole chapter -- "Psalm 23", the commonest way a reading is asked for
// -- which the app's parser only reads with a verse on it.
const CHAPTER_ONLY_PATTERN = /^(.+?\S)\s+(\d+)$/;

/**
 * The app's own parser, which wants the version's full book name AND a
 * verse ("Psalm 23" is refused, "Psalm 23:1" read). A chapter on its own is
 * how a reading is usually asked for, so it is read as its first verse to
 * find the book and chapter, then widened to every verse the chapter has.
 */
async function parseReference(bibleKey: string, reference: string) {
    const bibleItem = await BibleItem.fromTitleText(bibleKey, reference);
    if (bibleItem !== null) {
        return bibleItem;
    }
    const chapterOnly = CHAPTER_ONLY_PATTERN.exec(reference);
    if (chapterOnly === null) {
        return null;
    }
    const first = await BibleItem.fromTitleText(
        bibleKey,
        `${chapterOnly[1]} ${chapterOnly[2]}:1`,
    );
    if (first === null) {
        return null;
    }
    const { bookKey, chapter } = first.target;
    const verseCount = await getVersesCount(bibleKey, bookKey, chapter);
    if (verseCount === null || verseCount <= 1) {
        return first;
    }
    return (
        (await BibleItem.fromTitleText(
            bibleKey,
            `${chapterOnly[1]} ${chapterOnly[2]}:1-${verseCount}`,
        )) ?? first
    );
}

export async function resolveBibleItem(
    reference: string,
    order: string[],
): Promise<BibleItem | null> {
    for (const bibleKey of order) {
        try {
            const bibleItem = await parseReference(bibleKey, reference);
            if (bibleItem !== null) {
                return bibleItem;
            }
        } catch {
            // One version's data failing to read is not a reason to refuse
            // the reference under the next.
        }
    }
    return null;
}

function toScreenState(screenId: number): AgentBibleScreenType | null {
    const screenManager = getAllScreenManagers().find((one) => {
        return one.screenId === screenId;
    });
    if (screenManager === undefined) {
        return null;
    }
    return {
        screenId,
        isShowing: screenManager.isShowing,
        isLocked: screenManager.isLocked,
        bible: toBibleSummary(
            ScreenBibleManager.getInstance(screenId)?.screenViewData ?? null,
        ),
    };
}

export async function handleAgentBibleRequest(
    request: AgentBibleRequestType,
): Promise<AgentBibleResultType> {
    const action =
        typeof request.action === 'string' && request.action.length > 0
            ? request.action
            : 'present';
    if (!(AGENT_BIBLE_ACTIONS as readonly string[]).includes(action)) {
        return toReason(`Unknown action "${action}". Use present or check.`);
    }
    if (!appProvider.isPagePresenter) {
        // Written for a person as much as for a model: the `/verse` command
        // and the offline bot print this sentence, so no tool name in it.
        return toReason(
            'A Bible passage is presented from the Presenter page, and the ' +
                'main window is not on it. Switch it to the Presenter first, ' +
                'then ask again.',
        );
    }
    const reference =
        typeof request.reference === 'string'
            ? request.reference.replace(/\s+/g, ' ').trim()
            : '';
    if (reference.length === 0) {
        return toReason(
            'Say which passage: a reference such as "John 3:16" or ' +
                '"Psalm 23:1-6".',
        );
    }
    if (reference.length > MAX_REFERENCE_LENGTH) {
        return toReason(
            'That is longer than a reference. Give the book, chapter and ' +
                'verse only, such as "John 3:16".',
        );
    }
    const version =
        typeof request.version === 'string' && request.version.trim() !== ''
            ? request.version.trim()
            : null;
    const resolved = await resolveVersionOrder(version);
    if (!('order' in resolved)) {
        return resolved;
    }
    const bibleItem = await resolveBibleItem(reference, resolved.order);
    if (bibleItem === null) {
        return toReason(
            `"${reference}" could not be read as a passage in ` +
                `${resolved.order.length === 1 ? resolved.order[0] : 'any installed version'}. ` +
                "Write it as the version's full book name, chapter and verse " +
                '-- "John 3:16", "Psalm 23:1-6", "1 John 1:1-4" -- or a ' +
                'whole chapter as "Psalm 23"; short forms like "Jn" or ' +
                '"Ps" are not read.',
            resolved.installed,
        );
    }
    const title = await bibleItem.toTitle();
    const text = cutText(await bibleItem.toText());
    const targetScreens = getAllScreenManagers().filter((screenManager) => {
        return !screenManager.isDeleted && screenManager.isSelected;
    });
    const before = targetScreens
        .map((screenManager) => toScreenState(screenManager.screenId))
        .filter((one): one is AgentBibleScreenType => one !== null);
    const isAnyShowing = getAllScreenManagers().some((screenManager) => {
        return screenManager.isShowing;
    });
    if (action === 'check') {
        return {
            isPresented: false,
            reference: title,
            version: bibleItem.bibleKey,
            text,
            screens: before,
            isAnyShowing,
            note:
                'Nothing was put on a screen: this only read the passage. ' +
                'Call again with action "present" to put it up.',
        };
    }
    if (targetScreens.length === 0) {
        return toReason(
            'No screen is chosen to present to. In the Mini Screen panel, ' +
                'tick the screen the verse should go to, then ask again.',
        );
    }
    const unlocked = targetScreens.filter((screenManager) => {
        return !screenManager.isLocked;
    });
    if (unlocked.length === 0) {
        return toReason(
            `Screen ${targetScreens
                .map((one) => one.screenId)
                .join(' and ')} is locked, so it refuses a new verse. The ` +
                'lock button is on its Mini Screen card; unlock it, then ask ' +
                'again.',
        );
    }
    // The same path as the lookup's own "Show bible item": no mouse event, so
    // the screens are the ticked ones, which is what a double-click in the
    // lookup would use too. The manager itself steps over a locked screen
    // with a toast, so only the unlocked ones change.
    await ScreenBibleManager.handleBibleItemSelecting(null, bibleItem);
    const after = targetScreens
        .map((screenManager) => toScreenState(screenManager.screenId))
        .filter((one): one is AgentBibleScreenType => one !== null);
    const presentedOn = after.filter((screen) => {
        return !screen.isLocked && screen.bible !== null;
    });
    const isAnyShowingNow = getAllScreenManagers().some((screenManager) => {
        return screenManager.isShowing;
    });
    const notes: string[] = [];
    const lockedIds = after
        .filter((screen) => screen.isLocked)
        .map((screen) => screen.screenId);
    if (lockedIds.length > 0) {
        notes.push(
            `Screen ${lockedIds.join(' and ')} is locked and was left as it ` +
                'was.',
        );
    }
    const offIds = presentedOn
        .filter((screen) => !screen.isShowing)
        .map((screen) => screen.screenId);
    if (offIds.length > 0) {
        notes.push(
            `Screen ${offIds.join(' and ')} holds the passage but is OFF, so ` +
                'the projector shows nothing until its show button is ' +
                'pressed (owa_list_screens names it under controls.showHide) ' +
                '-- offer that, do not press it unasked.',
        );
    }
    return {
        isPresented: presentedOn.length > 0,
        reference: title,
        version: bibleItem.bibleKey,
        text,
        screens: after,
        isAnyShowing: isAnyShowingNow,
        ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    };
}
