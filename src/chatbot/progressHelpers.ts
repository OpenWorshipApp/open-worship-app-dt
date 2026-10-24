// What the window says it is DOING while an answer is on its way.
//
// The waiting line used to read "Looking it up... press Stop to give up on
// it." and nothing else, for as long as the question took -- which on a
// question that reads a web page, drafts a song and checks it is most of a
// minute. A volunteer standing in a back room minutes before a service cannot
// tell a window that is working from one that has hung, so the only thing that
// line reliably taught them was to press Stop and try again. This is the same
// wait, narrated: one line per thing the assistant actually does, in the order
// it does them, saying what it is working ON.
//
// Two rules bind every phrase in here. It is written for a volunteer -- so a
// step is "Searching the guide", never a tool name, a path or an id (the same
// rule the answers themselves are held to). And it must be TRUE: a step is
// opened by the code that is about to do the thing and closed by the code that
// finished it, so a line reading "Reading a web page" means a web page is
// being read right now, not that one is planned.
//
// The steps ride a module-level store rather than the window's own state on
// purpose. The status line sits under the conversation, and a question that
// takes twenty steps would otherwise re-render the whole message list twenty
// times on a machine that has nothing to spare. One small component subscribes
// here; nothing else re-renders at all.
//
// One list PER TAB (2026-10-09). The tabs work independently -- a question
// waiting on a slow local model in one must not stop the next tab asking its
// own -- and a single list showed whichever tab had pushed last in every tab.
// An entry exists only while its tab has steps: cleared is deleted, so the
// map holds at most one list per open tab.

import { fillWords, tran } from './chatTranHelpers';

export type BotProgressType = {
    // Order, and the handle a finishing step is matched back to its start by.
    id: number;
    text: string;
    isDone: boolean;
};

export type BotProgressCallbackType = (step: BotProgressType) => void;

/**
 * How many steps stay on screen.
 *
 * The list sits between the conversation and the ask box, so it cannot be
 * allowed to grow with the question: ten rounds of two tools each is twenty
 * lines, which would push the box off a 460px window. Older ones are counted
 * instead of shown -- what happened three steps ago is reassurance, what is
 * happening now is information.
 */
export const PROGRESS_SHOWN_MAX = 5;

export type ProgressStateType = {
    steps: BotProgressType[];
    /** How many fell off the top, so the line can say so rather than lie. */
    droppedCount: number;
};

const EMPTY_PROGRESS: ProgressStateType = { steps: [], droppedCount: 0 };

const stateMap = new Map<string, ProgressStateType>();
const listenerSet = new Set<(sessionId: string) => void>();

function publish(sessionId: string, next: ProgressStateType) {
    if (next.steps.length === 0 && next.droppedCount === 0) {
        stateMap.delete(sessionId);
    } else {
        stateMap.set(sessionId, next);
    }
    for (const listener of listenerSet) {
        listener(sessionId);
    }
}

/** What one tab is doing right now. */
export function getProgressState(sessionId: string) {
    return stateMap.get(sessionId) ?? EMPTY_PROGRESS;
}

/** Told the tab whose list changed; a listener reads only its own. */
export function subscribeProgress(listener: (sessionId: string) => void) {
    listenerSet.add(listener);
    return () => {
        listenerSet.delete(listener);
    };
}

/**
 * A step starting, or the same step finishing, in one tab.
 *
 * Matched by `id` rather than appended twice: the point of the line is that it
 * shows what is happening NOW, and a log listing "Reading the guide" and then
 * "Reading the guide" again reads as the window going round in circles.
 */
export function pushProgressStep(sessionId: string, step: BotProgressType) {
    const state = getProgressState(sessionId);
    const index = state.steps.findIndex((one) => {
        return one.id === step.id;
    });
    if (index !== -1) {
        const steps = state.steps.slice();
        steps[index] = step;
        publish(sessionId, { ...state, steps });
        return;
    }
    const steps = [...state.steps, step];
    const overflow = steps.length - PROGRESS_SHOWN_MAX;
    publish(sessionId, {
        steps: overflow > 0 ? steps.slice(overflow) : steps,
        droppedCount: state.droppedCount + Math.max(overflow, 0),
    });
}

/** The callback an ask reports through, bound to the tab that asked. */
export function genSessionProgress(sessionId: string): BotProgressCallbackType {
    return (step) => {
        pushProgressStep(sessionId, step);
    };
}

/** Cleared when a question starts and when it stops, however it stops. */
export function clearProgressSteps(sessionId: string) {
    if (!stateMap.has(sessionId)) {
        return;
    }
    publish(sessionId, EMPTY_PROGRESS);
}

/**
 * A step reporter, handing out ids nothing else will reuse.
 *
 * Returned as a function the loop calls twice -- once to open a step, once to
 * close it -- so no caller has to keep a counter or remember what it opened.
 *
 * The counter is module-level rather than per-reporter, and that is
 * load-bearing: one question makes SEVERAL reporters (the connect, then the
 * provider's own loop), and `pushProgressStep` matches a finishing step to its
 * start by id. Per-reporter counters would both start at zero, so the first
 * round of thinking would land on top of the connecting line and take its
 * place instead of following it.
 */
let nextStepId = 0;

export function genProgressReporter(onProgress?: BotProgressCallbackType) {
    return function reportStep(text: string) {
        const id = nextStepId++;
        onProgress?.({ id, text, isDone: false });
        return function finishStep() {
            onProgress?.({ id, text, isDone: true });
        };
    };
}

export type ProgressReporterType = ReturnType<typeof genProgressReporter>;

/**
 * Whatever the model put in an argument, cut down to something that fits on a
 * narrow line. Whitespace is flattened because a pasted song is a legitimate
 * argument and would otherwise take the status line down the whole window.
 */
function toStepQuote(value: unknown, max = 38) {
    const text = String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length === 0) {
        return null;
    }
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * A whole sentence with the quote in its `{words}` gap, or the plain one when
 * there is nothing to quote. Both arrive translated: a language puts the
 * quote wherever its own grammar wants it, which a prefix glued in front of
 * the quote never let it do.
 */
function toQuotedStep(sentence: string, value: unknown, plain: string) {
    const quote = toStepQuote(value);
    return quote === null ? plain : fillWords(sentence, { words: quote });
}

/**
 * The site being read, not the whole address with its query string on it.
 * Exported because the offline bot and `/song` name the site in their own
 * sentences, and two spellings of one site is the kind of thing a volunteer
 * reads as two sites.
 */
export function toSiteName(url: unknown) {
    try {
        return new URL(String(url)).hostname.replace(/^www\./, '');
    } catch (_error) {
        return null;
    }
}

// What each action on a document reads as. Whole sentences, one set per kind
// of document: a noun spliced in after a verb ("Creating a new" + "song") is
// a sentence no translation can put in its own order.
function toNamedStep(plain: string, sentence: string, name: string | null) {
    return name === null ? plain : fillWords(sentence, { name });
}

function describeSongStep(action: string, name: string | null) {
    switch (action) {
        case 'list':
            return tran('Looking through your songs');
        case 'info':
            return toNamedStep(
                tran('Reading one of your song'),
                tran('Reading one of your song: “{name}”'),
                name,
            );
        case 'create':
            return toNamedStep(
                tran('Creating a new song'),
                tran('Creating a new song: “{name}”'),
                name,
            );
        case 'update':
            return toNamedStep(
                tran('Editing a song'),
                tran('Editing a song: “{name}”'),
                name,
            );
        case 'rename':
            return toNamedStep(
                tran('Renaming a song'),
                tran('Renaming a song: “{name}”'),
                name,
            );
        case 'delete':
            return toNamedStep(
                tran('Moving a song to the trash'),
                tran('Moving your song “{name}” to the trash'),
                name,
            );
        default:
            return tran('Working on your songs');
    }
}

function describeSlideDocumentStep(action: string, name: string | null) {
    switch (action) {
        case 'list':
            return tran('Looking through your slide documents');
        case 'info':
            return toNamedStep(
                tran('Reading one of your slide document'),
                tran('Reading one of your slide document: “{name}”'),
                name,
            );
        case 'create':
            return toNamedStep(
                tran('Creating a new slide document'),
                tran('Creating a new slide document: “{name}”'),
                name,
            );
        case 'update':
            return toNamedStep(
                tran('Editing a slide document'),
                tran('Editing a slide document: “{name}”'),
                name,
            );
        case 'rename':
            return toNamedStep(
                tran('Renaming a slide document'),
                tran('Renaming a slide document: “{name}”'),
                name,
            );
        case 'delete':
            return toNamedStep(
                tran('Moving a slide document to the trash'),
                tran('Moving your slide document “{name}” to the trash'),
                name,
            );
        default:
            return tran('Working on your slide documents');
    }
}

type SlideSentencesType = {
    plain: string;
    numbered: string;
    named: string;
    numberedNamed: string;
};

function toSlideStep(
    sentences: SlideSentencesType,
    name: string | null,
    slide: number | null,
) {
    const sentence =
        name === null
            ? slide === null
                ? sentences.plain
                : sentences.numbered
            : slide === null
              ? sentences.named
              : sentences.numberedNamed;
    return fillWords(sentence, { name: name ?? '', slide: slide ?? '' });
}

// The actions that name a slide, the same for both kinds of document; null
// for an action that is not one of them.
function describeSlideStep(
    action: string,
    name: string | null,
    slide: number | null,
): string | null {
    switch (action) {
        case 'slides':
            return toNamedStep(
                tran('Reading the slides'),
                tran('Reading the slides of “{name}”'),
                name,
            );
        case 'add-slide':
            return toNamedStep(
                tran('Adding a slide'),
                tran('Adding a slide to “{name}”'),
                name,
            );
        case 'update-slide':
            return toSlideStep(
                {
                    plain: tran('Changing a slide'),
                    numbered: tran('Changing slide {slide}'),
                    named: tran('Changing a slide of “{name}”'),
                    numberedNamed: tran('Changing slide {slide} of “{name}”'),
                },
                name,
                slide,
            );
        case 'delete-slide':
            return toSlideStep(
                {
                    plain: tran('Removing a slide'),
                    numbered: tran('Removing slide {slide}'),
                    named: tran('Removing a slide from “{name}”'),
                    numberedNamed: tran('Removing slide {slide} from “{name}”'),
                },
                name,
                slide,
            );
        case 'move-slide':
            return toSlideStep(
                {
                    plain: tran('Moving a slide'),
                    numbered: tran('Moving slide {slide}'),
                    named: tran('Moving a slide of “{name}”'),
                    numberedNamed: tran('Moving slide {slide} of “{name}”'),
                },
                name,
                slide,
            );
        case 'duplicate-slide':
            return toSlideStep(
                {
                    plain: tran('Copying a slide'),
                    numbered: tran('Copying slide {slide}'),
                    named: tran('Copying a slide of “{name}”'),
                    numberedNamed: tran('Copying slide {slide} of “{name}”'),
                },
                name,
                slide,
            );
        default:
            return null;
    }
}

function describeFileStep(args: any, isSong: boolean) {
    const action = String(args?.action ?? '');
    const name = toStepQuote(args?.name);
    const slide = Number.isInteger(args?.slide) ? (args.slide as number) : null;
    return (
        describeSlideStep(action, name, slide) ??
        (isSong
            ? describeSongStep(action, name)
            : describeSlideDocumentStep(action, name))
    );
}

// The saved passages and notes, and putting a change back, on the wait line.
// Functions, so each line is translated when it is said.
const DATA_STEP_MAP: Record<string, Record<string, () => string>> = {
    owa_bible_item: {
        list: () => tran('Looking through your saved Bible passages'),
        update: () => tran('Changing a saved Bible passage'),
        delete: () => tran('Removing a saved Bible passage'),
        'create-list': () => tran('Making a Bibles list'),
        'rename-list': () => tran('Renaming a Bibles list'),
        'delete-list': () => tran('Moving a Bibles list to the trash'),
    },
    owa_bible_note: {
        list: () => tran('Looking through your Bible notes'),
        read: () => tran('Reading a Bible note'),
        add: () => tran('Writing a Bible note'),
        update: () => tran('Changing a Bible note'),
        delete: () => tran('Removing a Bible note'),
        'create-file': () => tran('Making a notes file'),
        'rename-file': () => tran('Renaming a notes file'),
        'delete-file': () => tran('Moving a notes file to the trash'),
    },
    owa_undo: {
        list: () => tran('Looking through the recent changes'),
        undo: () => tran('Putting back an earlier change'),
    },
    // The model has had this tool since 2026-10-10 and its steps read
    // "Looking something up" until the day the notes were checked against
    // the code: a tool added to the server and not here says nothing.
    owa_presenting_flow: {
        list: () => tran('Looking through your run sheets'),
        info: () => tran('Reading a run sheet'),
        create: () => tran('Making a run sheet'),
        rename: () => tran('Renaming a run sheet'),
        delete: () => tran('Moving a run sheet to the trash'),
        add: () => tran('Adding a line to a run sheet'),
        remove: () => tran('Taking a line off a run sheet'),
        move: () => tran('Moving a line of a run sheet'),
        duplicate: () => tran('Copying a line of a run sheet'),
        park: () => tran('Parking a line of a run sheet'),
        unpark: () => tran('Putting a parked line back in the run'),
    },
};

const DATA_STEP_FALLBACK_MAP: Record<string, () => string> = {
    owa_bible_item: () => tran('Working on your saved Bible passages'),
    owa_bible_note: () => tran('Working on your Bible notes'),
    owa_undo: () => tran('Looking through the recent changes'),
    owa_presenting_flow: () => tran('Working on a run sheet'),
};

function describeDataStep(name: string, args: any) {
    if (name === 'owa_bible_item' && args?.action === 'add') {
        return toQuotedStep(
            tran('Saving to your Bibles list: “{words}”'),
            args?.reference,
            tran('Saving a passage to your Bibles list'),
        );
    }
    const actionMap = DATA_STEP_MAP[name] ?? {};
    const action = String(args?.action ?? '');
    const step = Object.hasOwn(actionMap, action)
        ? actionMap[action]
        : DATA_STEP_FALLBACK_MAP[name];
    return step?.() ?? tran('Looking something up');
}

// A Bible download and install each take long enough to look stuck, so the
// line says which one it is waiting on.
function describeBibleXmlStep(args: any) {
    switch (args?.action) {
        case 'check':
            return tran('Downloading the Bible file and reading it');
        case 'names':
            return tran('Finding Bible book names for your language');
        case 'import':
            return tran('Installing the Bible');
        case 'update':
            return tran('Changing the Bible');
        case 'delete':
            return tran('Moving the Bible to the trash');
        default:
            return tran('Looking at your Bibles');
    }
}

// Taking one foreground extra off the screen, by what the wait line calls it.
function describeForegroundStopStep(widget: string) {
    switch (widget) {
        case 'countdown':
            return tran('Taking the countdown off the screen');
        case 'stopwatch':
            return tran('Taking the stopwatch off the screen');
        case 'clock':
            return tran('Taking the clock off the screen');
        case 'marquee-top':
        case 'marquee-bottom':
            return tran('Taking the scrolling message off the screen');
        case 'quick-text':
            return tran('Taking the line of text off the screen');
        case 'all':
            return tran('Taking the extras off the screen');
        default:
            return tran('Taking an extra off the screen');
    }
}

function describeForegroundStep(args: any) {
    const widget = String(args?.widget ?? '');
    if (args?.action === 'check') {
        return tran('Checking the extras on the screen');
    }
    if (args?.action === 'stop') {
        return describeForegroundStopStep(widget);
    }
    switch (widget) {
        case 'countdown':
            if (typeof args?.minutes === 'number') {
                return fillWords(
                    tran('Starting a {minutes} minute countdown on the screen'),
                    { minutes: args.minutes },
                );
            }
            return toQuotedStep(
                tran('Starting a countdown to “{words}”'),
                args?.at,
                tran('Starting a countdown on the screen'),
            );
        case 'stopwatch':
            return tran('Starting a stopwatch on the screen');
        case 'clock':
            return tran('Putting a clock on the screen');
        case 'marquee-top':
        case 'marquee-bottom':
            return tran('Putting a scrolling message on the screen');
        case 'quick-text':
            return tran('Putting a line of text on the screen');
        default:
            return tran('Putting an extra on the screen');
    }
}

/**
 * One line saying what this tool is about to do, for a reader who has never
 * heard of any of them.
 *
 * Every tool the model is allowed to call is named here. The fallback is
 * deliberately vague rather than a tool name: a step reading `owa_list_ui`
 * tells a volunteer nothing and breaks the one rule this window has, which is
 * that the app's insides never reach the person using it.
 */
export function describeToolStep(name: string, args: any): string {
    switch (name) {
        case 'owa_help_search':
            return toQuotedStep(
                tran('Searching the guide for “{words}”'),
                args?.query,
                tran('Searching the guide'),
            );
        case 'owa_help_page':
            return tran('Reading the guide');
        case 'owa_list_questions':
            return tran('Looking through what it can answer');
        case 'owa_app_state':
            return tran('Checking what the app is showing');
        case 'owa_list_ui':
            return tran('Looking over the buttons on screen');
        case 'owa_find_ui':
            return toQuotedStep(
                tran('Looking for “{words}”'),
                args?.label,
                tran('Looking for a button'),
            );
        case 'owa_click':
            return toQuotedStep(
                tran('Pressing “{words}”'),
                args?.label,
                tran('Pressing a button'),
            );
        case 'owa_type':
            return toQuotedStep(
                tran('Typing into “{words}”'),
                args?.label,
                tran('Typing something'),
            );
        case 'owa_goto_page':
            return tran('Switching the app window over');
        case 'owa_list_screens':
            return tran('Checking the projector screens');
        case 'owa_hide_screens':
            return tran('Clearing the projector screens');
        case 'owa_present_bible':
            return args?.action === 'check'
                ? toQuotedStep(
                      tran('Reading the passage “{words}”'),
                      args?.reference,
                      tran('Reading a Bible passage'),
                  )
                : toQuotedStep(
                      tran('Putting a Bible passage on the screen: “{words}”'),
                      args?.reference,
                      tran('Putting a Bible passage on the screen'),
                  );
        case 'owa_foreground':
            return describeForegroundStep(args);
        case 'owa_find_verse':
            if (typeof args?.open === 'string') {
                return toQuotedStep(
                    tran('Opening in the Bible Lookup: “{words}”'),
                    args.open,
                    tran('Opening a verse in the Bible Lookup'),
                );
            }
            if (typeof args?.refs === 'string') {
                return toQuotedStep(
                    tran('Reading “{words}”'),
                    args.refs,
                    tran('Reading Bible verses'),
                );
            }
            return toQuotedStep(
                tran('Searching the Bible for “{words}”'),
                args?.words,
                tran('Looking at the Bibles installed'),
            );
        case 'owa_resource_file':
            return args?.action === 'read'
                ? toQuotedStep(
                      tran('Reading “{words}” from Resources'),
                      args?.file,
                      tran('Looking through Resources'),
                  )
                : tran('Looking through Resources');
        case 'owa_lookup_record':
            return args?.kind === 'verse'
                ? toQuotedStep(
                      tran('Reading “{words}”'),
                      args?.ref,
                      tran('Reading Bible verses'),
                  )
                : toQuotedStep(
                      tran('Reading what the names lookup has on “{words}”'),
                      args?.name,
                      tran('Reading the names lookup'),
                  );
        case 'owa_tran':
            return tran('Checking what that button is called here');
        case 'owa_bible_xml':
            return describeBibleXmlStep(args);
        case 'owa_read_website': {
            const site = toSiteName(args?.url);
            return site === null
                ? tran('Reading a web page')
                : fillWords(tran('Reading {site}'), { site });
        }
        case 'owa_lyric_validate': {
            // Handed a page address, the drafter reads the page itself, and
            // that is the slow half: say which site, as a read would.
            const site = toSiteName(args?.url);
            if (site !== null) {
                return fillWords(
                    tran('Reading {site} and writing the song out'),
                    {
                        site,
                    },
                );
            }
            if (args?.mode === 'find') {
                return toQuotedStep(
                    tran('Looking up the song “{words}”'),
                    args?.title,
                    tran('Looking up the song'),
                );
            }
            return args?.mode === 'draft'
                ? tran('Writing the song out')
                : tran('Checking the song over');
        }
        case 'owa_lyric_file':
            return describeFileStep(args, true);
        case 'owa_slide_file':
            return describeFileStep(args, false);
        case 'owa_bible_item':
        case 'owa_bible_note':
        case 'owa_undo':
        case 'owa_presenting_flow':
            return describeDataStep(name, args);
        case 'owa_guide_start':
            return tran('Setting up a walkthrough');
        case 'owa_guide_step':
            return tran('Moving the walkthrough on');
        case 'owa_guide_status':
            return tran('Checking on the walkthrough');
        case 'take_snapshot':
            return tran('Looking over the window');
        case 'list_pages':
            return tran('Checking which windows are open');
        case 'select_page':
            return tran('Switching to another window');
        case 'press_key':
            return tran('Pressing a key');
        case 'wait_for':
            return tran('Waiting for the app to catch up');
        case 'list_console_messages':
        case 'get_console_message':
            return tran("Reading the app's own log");
        case 'list_network_requests':
        case 'get_network_request':
            return tran('Checking what the app has downloaded');
        case 'handle_dialog':
            return tran('Answering a message the app put up');
        default:
            return tran('Looking something up');
    }
}
