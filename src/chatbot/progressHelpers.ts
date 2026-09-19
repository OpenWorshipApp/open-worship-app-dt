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

let state: ProgressStateType = EMPTY_PROGRESS;
const listenerSet = new Set<(next: ProgressStateType) => void>();

function publish(next: ProgressStateType) {
    state = next;
    for (const listener of listenerSet) {
        listener(state);
    }
}

export function getProgressState() {
    return state;
}

export function subscribeProgress(listener: (next: ProgressStateType) => void) {
    listenerSet.add(listener);
    return () => {
        listenerSet.delete(listener);
    };
}

/**
 * A step starting, or the same step finishing.
 *
 * Matched by `id` rather than appended twice: the point of the line is that it
 * shows what is happening NOW, and a log listing "Reading the guide" and then
 * "Reading the guide" again reads as the window going round in circles.
 */
export function pushProgressStep(step: BotProgressType) {
    const index = state.steps.findIndex((one) => {
        return one.id === step.id;
    });
    if (index !== -1) {
        const steps = state.steps.slice();
        steps[index] = step;
        publish({ ...state, steps });
        return;
    }
    const steps = [...state.steps, step];
    const overflow = steps.length - PROGRESS_SHOWN_MAX;
    publish({
        steps: overflow > 0 ? steps.slice(overflow) : steps,
        droppedCount: state.droppedCount + Math.max(overflow, 0),
    });
}

/** Cleared when a question starts and when it stops, however it stops. */
export function clearProgressSteps() {
    if (state.steps.length === 0 && state.droppedCount === 0) {
        return;
    }
    publish(EMPTY_PROGRESS);
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

function toQuotedStep(prefix: string, value: unknown, plain: string) {
    const quote = toStepQuote(value);
    return quote === null ? plain : `${prefix} “${quote}”`;
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

// What each action on a document reads as. Shared by songs and slide
// documents, which differ only in the noun.
const FILE_ACTION_MAP: Record<string, string> = {
    list: 'Looking through your',
    info: 'Reading one of your',
    create: 'Creating a new',
    update: 'Editing a',
    rename: 'Renaming a',
};

// The actions that name a slide or send a file somewhere, which read better
// as whole sentences than as a verb in front of a noun.
const FILE_SENTENCE_MAP: Record<
    string,
    (noun: string, name: string | null, slide: string) => string
> = {
    delete: (noun, name) => {
        return name === null
            ? `Moving a ${noun} to the trash`
            : `Moving your ${noun} “${name}” to the trash`;
    },
    slides: (_noun, name) => {
        return name === null
            ? 'Reading the slides'
            : `Reading the slides of “${name}”`;
    },
    'add-slide': (_noun, name) => {
        return name === null ? 'Adding a slide' : `Adding a slide to “${name}”`;
    },
    'update-slide': (_noun, name, slide) => {
        return name === null
            ? `Changing ${slide}`
            : `Changing ${slide} of “${name}”`;
    },
    'delete-slide': (_noun, name, slide) => {
        return name === null
            ? `Removing ${slide}`
            : `Removing ${slide} from “${name}”`;
    },
    'move-slide': (_noun, name, slide) => {
        return name === null
            ? `Moving ${slide}`
            : `Moving ${slide} of “${name}”`;
    },
    'duplicate-slide': (_noun, name, slide) => {
        return name === null
            ? `Copying ${slide}`
            : `Copying ${slide} of “${name}”`;
    },
};

function describeFileStep(args: any, noun: string, plural: string) {
    const action = String(args?.action ?? '');
    const sentence = FILE_SENTENCE_MAP[action];
    if (sentence !== undefined) {
        const slide = Number.isInteger(args?.slide)
            ? `slide ${args.slide}`
            : 'a slide';
        return sentence(noun, toStepQuote(args?.name), slide);
    }
    const verb = FILE_ACTION_MAP[action];
    if (verb === undefined) {
        return `Working on your ${plural}`;
    }
    if (action === 'list') {
        return `${verb} ${plural}`;
    }
    const name = toStepQuote(args?.name);
    if (name === null) {
        return `${verb} ${noun}`;
    }
    return `${verb} ${noun}: “${name}”`;
}

// The saved passages and notes, and putting a change back, on the wait line.
const DATA_STEP_MAP: Record<string, Record<string, string>> = {
    owa_bible_item: {
        list: 'Looking through your saved Bible passages',
        update: 'Changing a saved Bible passage',
        delete: 'Removing a saved Bible passage',
        'create-list': 'Making a Bibles list',
        'rename-list': 'Renaming a Bibles list',
        'delete-list': 'Moving a Bibles list to the trash',
    },
    owa_bible_note: {
        list: 'Looking through your Bible notes',
        read: 'Reading a Bible note',
        add: 'Writing a Bible note',
        update: 'Changing a Bible note',
        delete: 'Removing a Bible note',
        'create-file': 'Making a notes file',
        'rename-file': 'Renaming a notes file',
        'delete-file': 'Moving a notes file to the trash',
    },
    owa_undo: {
        list: 'Looking through the recent changes',
        undo: 'Putting back an earlier change',
    },
};

const DATA_STEP_FALLBACK_MAP: Record<string, string> = {
    owa_bible_item: 'Working on your saved Bible passages',
    owa_bible_note: 'Working on your Bible notes',
    owa_undo: 'Looking through the recent changes',
};

function describeDataStep(name: string, args: any) {
    if (name === 'owa_bible_item' && args?.action === 'add') {
        return toQuotedStep(
            'Saving to your Bibles list:',
            args?.reference,
            'Saving a passage to your Bibles list',
        );
    }
    return (
        DATA_STEP_MAP[name]?.[String(args?.action ?? '')] ??
        DATA_STEP_FALLBACK_MAP[name]
    );
}

// What each foreground extra is called on the wait line.
const FOREGROUND_NOUN_MAP: Record<string, string> = {
    countdown: 'the countdown',
    stopwatch: 'the stopwatch',
    clock: 'the clock',
    'marquee-top': 'the scrolling message',
    'marquee-bottom': 'the scrolling message',
    'quick-text': 'the line of text',
    all: 'the extras',
};

function describeForegroundStep(args: any) {
    const widget = String(args?.widget ?? '');
    const noun = FOREGROUND_NOUN_MAP[widget] ?? 'an extra';
    if (args?.action === 'check') {
        return 'Checking the extras on the screen';
    }
    if (args?.action === 'stop') {
        return `Taking ${noun} off the screen`;
    }
    switch (widget) {
        case 'countdown':
            if (typeof args?.minutes === 'number') {
                return `Starting a ${args.minutes} minute countdown on the screen`;
            }
            return toQuotedStep(
                'Starting a countdown to',
                args?.at,
                'Starting a countdown on the screen',
            );
        case 'stopwatch':
            return 'Starting a stopwatch on the screen';
        case 'clock':
            return 'Putting a clock on the screen';
        case 'marquee-top':
        case 'marquee-bottom':
            return 'Putting a scrolling message on the screen';
        case 'quick-text':
            return 'Putting a line of text on the screen';
        default:
            return 'Putting an extra on the screen';
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
                'Searching the guide for',
                args?.query,
                'Searching the guide',
            );
        case 'owa_help_page':
            return 'Reading the guide';
        case 'owa_list_questions':
            return 'Looking through what it can answer';
        case 'owa_app_state':
            return 'Checking what the app is showing';
        case 'owa_list_ui':
            return 'Looking over the buttons on screen';
        case 'owa_find_ui':
            return toQuotedStep(
                'Looking for',
                args?.label,
                'Looking for a button',
            );
        case 'owa_click':
            return toQuotedStep('Pressing', args?.label, 'Pressing a button');
        case 'owa_type':
            return toQuotedStep('Typing into', args?.label, 'Typing something');
        case 'owa_goto_page':
            return 'Switching the app window over';
        case 'owa_list_screens':
            return 'Checking the projector screens';
        case 'owa_hide_screens':
            return 'Clearing the projector screens';
        case 'owa_present_bible':
            return toQuotedStep(
                args?.action === 'check'
                    ? 'Reading the passage'
                    : 'Putting a Bible passage on the screen:',
                args?.reference,
                args?.action === 'check'
                    ? 'Reading a Bible passage'
                    : 'Putting a Bible passage on the screen',
            );
        case 'owa_foreground':
            return describeForegroundStep(args);
        case 'owa_tran':
            return 'Checking what that button is called here';
        case 'owa_read_website': {
            const site = toSiteName(args?.url);
            return site === null ? 'Reading a web page' : `Reading ${site}`;
        }
        case 'owa_lyric_validate': {
            // Handed a page address, the drafter reads the page itself, and
            // that is the slow half: say which site, as a read would.
            const site = toSiteName(args?.url);
            if (site !== null) {
                return `Reading ${site} and writing the song out`;
            }
            return args?.mode === 'draft'
                ? 'Writing the song out'
                : 'Checking the song over';
        }
        case 'owa_lyric_file':
            return describeFileStep(args, 'song', 'songs');
        case 'owa_slide_file':
            return describeFileStep(args, 'slide document', 'slide documents');
        case 'owa_bible_item':
        case 'owa_bible_note':
        case 'owa_undo':
            return describeDataStep(name, args);
        case 'owa_guide_start':
            return 'Setting up a walkthrough';
        case 'owa_guide_step':
            return 'Moving the walkthrough on';
        case 'owa_guide_status':
            return 'Checking on the walkthrough';
        case 'take_snapshot':
            return 'Looking over the window';
        case 'list_pages':
            return 'Checking which windows are open';
        case 'select_page':
            return 'Switching to another window';
        case 'press_key':
            return 'Pressing a key';
        case 'wait_for':
            return 'Waiting for the app to catch up';
        case 'list_console_messages':
        case 'get_console_message':
            return "Reading the app's own log";
        case 'list_network_requests':
        case 'get_network_request':
            return 'Checking what the app has downloaded';
        case 'handle_dialog':
            return 'Answering a message the app put up';
        default:
            return 'Looking something up';
    }
}
