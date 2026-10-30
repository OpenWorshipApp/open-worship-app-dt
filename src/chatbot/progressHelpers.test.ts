import { beforeEach, describe, expect, test } from 'vitest';

import {
    PROGRESS_SHOWN_MAX,
    clearProgressSteps,
    describeToolStep,
    genProgressReporter,
    genSessionProgress,
    getProgressState,
    subscribeProgress,
    type BotProgressType,
} from './progressHelpers';

// Every store test works in one tab; the per-tab test below uses two.
const TAB = 'tab-1';

beforeEach(() => {
    clearProgressSteps(TAB);
    clearProgressSteps('tab-2');
});

describe('describeToolStep', () => {
    test('a run sheet change says what it is doing to the sheet', () => {
        expect(describeToolStep('owa_presenting_flow', { action: 'add' })).toBe(
            'Adding a line to a run sheet',
        );
        expect(
            describeToolStep('owa_presenting_flow', { action: 'delete' }),
        ).toBe('Moving a run sheet to the trash');
        // An action added to the tool later still says which thing it is on.
        expect(describeToolStep('owa_presenting_flow', {})).toBe(
            'Working on a run sheet',
        );
    });

    test('never lets a tool name reach the line', () => {
        // The one rule this window has. A step reading `owa_list_ui` tells a
        // volunteer nothing and is the app's insides on their screen.
        const names = [
            'owa_help_search',
            'owa_help_page',
            'owa_app_state',
            'owa_click',
            'owa_read_website',
            'owa_lyric_file',
            'take_snapshot',
            'list_pages',
            // ...and one that does not exist, which is the case that matters:
            // a tool added to the server and not to the map must still not
            // print its own name.
            'some_tool_added_later',
        ];
        for (const name of names) {
            const text = describeToolStep(name, {});
            expect(text).not.toContain('_');
            expect(text.length).toBeGreaterThan(4);
        }
    });

    test('says what it is working on, not only what it is doing', () => {
        expect(
            describeToolStep('owa_help_search', {
                query: 'background',
            }).toLowerCase(),
        ).toContain('background');
        expect(
            describeToolStep('owa_click', { label: 'Clear Long Text' }),
        ).toBe('Pressing “Clear Long Text”');
        expect(
            describeToolStep('owa_lyric_file', {
                action: 'create',
                name: 'Amazing Grace',
            }),
        ).toBe('Creating a new song: “Amazing Grace”');
        expect(describeToolStep('owa_lyric_file', { action: 'list' })).toBe(
            'Looking through your songs',
        );
    });

    test('a web page is named by its site, not by its whole address', () => {
        expect(
            describeToolStep('owa_read_website', {
                url: 'https://www.example.com/chords/523776?x=1',
            }),
        ).toBe('Reading example.com');
        // Something that is not an address at all must not take the line down.
        expect(describeToolStep('owa_read_website', { url: 'nonsense' })).toBe(
            'Reading a web page',
        );
    });

    test('a pasted song does not take the status line down the window', () => {
        const step = describeToolStep('owa_help_search', {
            query: `${'verse\n'.repeat(80)}`,
        });
        expect(step).not.toContain('\n');
        expect(step.length).toBeLessThan(70);
    });

    test('drafting and checking a song are told apart', () => {
        expect(describeToolStep('owa_lyric_validate', { mode: 'draft' })).toBe(
            'Writing the song out',
        );
        expect(describeToolStep('owa_lyric_validate', {})).toBe(
            'Checking the song over',
        );
        // Off a page, the read is the slow half, and the site is named the
        // way a read names it -- never the address, which is where a payload
        // would sit.
        expect(
            describeToolStep('owa_lyric_validate', {
                url: 'https://example.com/chords/1?x=secret',
            }),
        ).toBe('Reading example.com and writing the song out');
    });
});

describe('the progress store', () => {
    test('a finishing step replaces its own start rather than following it', () => {
        const report = genProgressReporter(genSessionProgress(TAB));
        const finish = report('Reading the guide');
        expect(getProgressState(TAB).steps).toHaveLength(1);
        expect(getProgressState(TAB).steps[0].isDone).toBe(false);
        finish();
        expect(getProgressState(TAB).steps).toHaveLength(1);
        expect(getProgressState(TAB).steps[0].isDone).toBe(true);
    });

    test('two reporters in one question do not land on top of each other', () => {
        // The connect step and the provider loop's first round each come from
        // their own reporter. Per-reporter counters would both start at zero
        // and the second would overwrite the first.
        const first = genProgressReporter(genSessionProgress(TAB));
        const second = genProgressReporter(genSessionProgress(TAB));
        first('Connecting to the app');
        second('Thinking about it');
        const texts = getProgressState(TAB).steps.map((step) => {
            return step.text;
        });
        expect(texts).toEqual(['Connecting to the app', 'Thinking about it']);
    });

    test('older steps are counted, not dropped in silence', () => {
        const report = genProgressReporter(genSessionProgress(TAB));
        const extra = 3;
        for (let index = 0; index < PROGRESS_SHOWN_MAX + extra; index++) {
            report(`Step ${index}`)();
        }
        const state = getProgressState(TAB);
        expect(state.steps).toHaveLength(PROGRESS_SHOWN_MAX);
        expect(state.droppedCount).toBe(extra);
        // The ones kept are the LAST ones: what is happening now is the point.
        expect(state.steps[state.steps.length - 1].text).toBe(
            `Step ${PROGRESS_SHOWN_MAX + extra - 1}`,
        );
    });

    test('subscribers are told, and stop being told once they leave', () => {
        const seen: BotProgressType[][] = [];
        const unsubscribe = subscribeProgress((sessionId) => {
            seen.push(getProgressState(sessionId).steps);
        });
        const report = genProgressReporter(genSessionProgress(TAB));
        report('Thinking about it');
        expect(seen).toHaveLength(1);
        unsubscribe();
        report('Reading the guide');
        expect(seen).toHaveLength(1);
    });

    test('clearing an already-empty store tells nobody', () => {
        let count = 0;
        const unsubscribe = subscribeProgress(() => {
            count += 1;
        });
        clearProgressSteps(TAB);
        expect(count).toBe(0);
        unsubscribe();
    });

    // The tabs work independently: one tab's question must not show in
    // another, and clearing one must leave the other's lines up.
    test('each tab has its own lines', () => {
        genProgressReporter(genSessionProgress(TAB))('Reading the guide');
        genProgressReporter(genSessionProgress('tab-2'))('Thinking about it');
        expect(
            getProgressState(TAB).steps.map((step) => {
                return step.text;
            }),
        ).toEqual(['Reading the guide']);
        clearProgressSteps(TAB);
        expect(getProgressState(TAB).steps).toHaveLength(0);
        expect(
            getProgressState('tab-2').steps.map((step) => {
                return step.text;
            }),
        ).toEqual(['Thinking about it']);
    });

    test('a reporter with no callback is a no-op, not a crash', () => {
        // `onProgress` is optional: the guide rescue asks without one.
        const report = genProgressReporter(undefined);
        expect(() => {
            report('Thinking about it')();
        }).not.toThrow();
        expect(getProgressState(TAB).steps).toHaveLength(0);
    });
});

describe('a passage on its way to the screen', () => {
    test('names the passage, and says a check is only a read', () => {
        expect(
            describeToolStep('owa_present_bible', { reference: 'John 3:16' }),
        ).toBe('Putting a Bible passage on the screen: “John 3:16”');
        expect(
            describeToolStep('owa_present_bible', {
                reference: 'John 3:16',
                action: 'check',
            }),
        ).toBe('Reading the passage “John 3:16”');
        expect(describeToolStep('owa_present_bible', {})).toBe(
            'Putting a Bible passage on the screen',
        );
    });
});

describe('a foreground extra on its way to the screen', () => {
    test('names the extra, its length, and what is coming off', () => {
        expect(
            describeToolStep('owa_foreground', {
                widget: 'countdown',
                minutes: 5,
            }),
        ).toBe('Starting a 5 minute countdown on the screen');
        expect(
            describeToolStep('owa_foreground', {
                widget: 'countdown',
                at: '10:30',
            }),
        ).toBe('Starting a countdown to “10:30”');
        expect(
            describeToolStep('owa_foreground', {
                widget: 'marquee-bottom',
                text: 'Welcome',
            }),
        ).toBe('Putting a scrolling message on the screen');
        expect(
            describeToolStep('owa_foreground', {
                action: 'stop',
                widget: 'clock',
            }),
        ).toBe('Taking the clock off the screen');
        expect(describeToolStep('owa_foreground', { action: 'check' })).toBe(
            'Checking the extras on the screen',
        );
        expect(describeToolStep('owa_foreground', {})).toBe(
            'Putting an extra on the screen',
        );
    });
});

describe('the data tools on the wait line', () => {
    test('says a file is going to the trash, and which', () => {
        expect(
            describeToolStep('owa_lyric_file', {
                action: 'delete',
                name: 'Amazing Grace',
            }),
        ).toBe('Moving your song “Amazing Grace” to the trash');
        expect(
            describeToolStep('owa_slide_file', {
                action: 'update-slide',
                name: 'Sunday',
                slide: 3,
            }),
        ).toBe('Changing slide 3 of “Sunday”');
        expect(describeToolStep('owa_slide_file', { action: 'slides' })).toBe(
            'Reading the slides',
        );
    });

    test('names the passage being saved', () => {
        expect(
            describeToolStep('owa_bible_item', {
                action: 'add',
                reference: 'John 3:16',
            }),
        ).toBe('Saving to your Bibles list: “John 3:16”');
        expect(describeToolStep('owa_bible_note', { action: 'delete' })).toBe(
            'Removing a Bible note',
        );
        expect(describeToolStep('owa_undo', { action: 'undo' })).toBe(
            'Putting back an earlier change',
        );
        expect(describeToolStep('owa_undo', {})).toBe(
            'Looking through the recent changes',
        );
    });

    test('never lets a data tool or an action name reach the line', () => {
        for (const name of [
            'owa_bible_item',
            'owa_bible_note',
            'owa_undo',
            'owa_slide_file',
            'owa_lyric_file',
        ]) {
            for (const action of [
                'list',
                'add',
                'delete-slide',
                'nonsense',
                undefined,
            ]) {
                const text = describeToolStep(name, { action });
                expect(text, `${name} ${action}`).not.toContain('_');
                expect(text.length).toBeGreaterThan(4);
            }
        }
    });
});

// Every sentence the wait line can say, pinned to the call that says it: a
// tool or an action that falls through to the vague line, or to the wrong
// kind of document, reads as the window doing something else.
describe('describeToolStep, sentence by sentence', () => {
    const NAME = 'Amazing Grace';
    const STEP_CASES: [string, Record<string, unknown>, string][] = [
        // Songs.
        ['owa_lyric_file', { action: 'list' }, 'Looking through your songs'],
        ['owa_lyric_file', { action: 'info' }, 'Reading one of your song'],
        [
            'owa_lyric_file',
            { action: 'info', name: NAME },
            'Reading one of your song: “Amazing Grace”',
        ],
        ['owa_lyric_file', { action: 'create' }, 'Creating a new song'],
        ['owa_lyric_file', { action: 'update' }, 'Editing a song'],
        [
            'owa_lyric_file',
            { action: 'update', name: NAME },
            'Editing a song: “Amazing Grace”',
        ],
        ['owa_lyric_file', { action: 'rename' }, 'Renaming a song'],
        [
            'owa_lyric_file',
            { action: 'rename', name: NAME },
            'Renaming a song: “Amazing Grace”',
        ],
        ['owa_lyric_file', { action: 'delete' }, 'Moving a song to the trash'],
        [
            'owa_lyric_file',
            { action: 'delete', name: NAME },
            'Moving your song “Amazing Grace” to the trash',
        ],
        ['owa_lyric_file', { action: 'revert' }, 'Working on your songs'],
        // Slide documents.
        [
            'owa_slide_file',
            { action: 'list' },
            'Looking through your slide documents',
        ],
        [
            'owa_slide_file',
            { action: 'info' },
            'Reading one of your slide document',
        ],
        [
            'owa_slide_file',
            { action: 'info', name: 'Notices' },
            'Reading one of your slide document: “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'create' },
            'Creating a new slide document',
        ],
        [
            'owa_slide_file',
            { action: 'create', name: 'Notices' },
            'Creating a new slide document: “Notices”',
        ],
        ['owa_slide_file', { action: 'update' }, 'Editing a slide document'],
        [
            'owa_slide_file',
            { action: 'update', name: 'Notices' },
            'Editing a slide document: “Notices”',
        ],
        ['owa_slide_file', { action: 'rename' }, 'Renaming a slide document'],
        [
            'owa_slide_file',
            { action: 'rename', name: 'Notices' },
            'Renaming a slide document: “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'delete' },
            'Moving a slide document to the trash',
        ],
        [
            'owa_slide_file',
            { action: 'delete', name: 'Notices' },
            'Moving your slide document “Notices” to the trash',
        ],
        [
            'owa_slide_file',
            { action: 'revert' },
            'Working on your slide documents',
        ],
        // A slide of either kind of document.
        ['owa_slide_file', { action: 'slides' }, 'Reading the slides'],
        [
            'owa_lyric_file',
            { action: 'slides', name: NAME },
            'Reading the slides of “Amazing Grace”',
        ],
        ['owa_slide_file', { action: 'add-slide' }, 'Adding a slide'],
        [
            'owa_slide_file',
            { action: 'add-slide', name: 'Notices' },
            'Adding a slide to “Notices”',
        ],
        ['owa_slide_file', { action: 'update-slide' }, 'Changing a slide'],
        [
            'owa_slide_file',
            { action: 'update-slide', slide: 3 },
            'Changing slide 3',
        ],
        [
            'owa_slide_file',
            { action: 'update-slide', name: 'Notices' },
            'Changing a slide of “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'update-slide', name: 'Notices', slide: 3 },
            'Changing slide 3 of “Notices”',
        ],
        ['owa_slide_file', { action: 'delete-slide' }, 'Removing a slide'],
        [
            'owa_slide_file',
            { action: 'delete-slide', slide: 2 },
            'Removing slide 2',
        ],
        [
            'owa_slide_file',
            { action: 'delete-slide', name: 'Notices' },
            'Removing a slide from “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'delete-slide', name: 'Notices', slide: 2 },
            'Removing slide 2 from “Notices”',
        ],
        ['owa_slide_file', { action: 'move-slide' }, 'Moving a slide'],
        [
            'owa_slide_file',
            { action: 'move-slide', slide: 4 },
            'Moving slide 4',
        ],
        [
            'owa_slide_file',
            { action: 'move-slide', name: 'Notices' },
            'Moving a slide of “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'move-slide', name: 'Notices', slide: 4 },
            'Moving slide 4 of “Notices”',
        ],
        ['owa_slide_file', { action: 'duplicate-slide' }, 'Copying a slide'],
        [
            'owa_slide_file',
            // Not a whole number: no slide is named.
            { action: 'duplicate-slide', slide: 1.5 },
            'Copying a slide',
        ],
        [
            'owa_slide_file',
            { action: 'duplicate-slide', slide: 1 },
            'Copying slide 1',
        ],
        [
            'owa_slide_file',
            { action: 'duplicate-slide', name: 'Notices' },
            'Copying a slide of “Notices”',
        ],
        [
            'owa_slide_file',
            { action: 'duplicate-slide', name: 'Notices', slide: 1 },
            'Copying slide 1 of “Notices”',
        ],
        // Saved passages, notes and undo.
        [
            'owa_bible_item',
            { action: 'add', reference: 'John 3:16' },
            'Saving to your Bibles list: “John 3:16”',
        ],
        [
            'owa_bible_item',
            { action: 'add' },
            'Saving a passage to your Bibles list',
        ],
        [
            'owa_bible_item',
            { action: 'list' },
            'Looking through your saved Bible passages',
        ],
        [
            'owa_bible_item',
            { action: 'update' },
            'Changing a saved Bible passage',
        ],
        [
            'owa_bible_item',
            { action: 'delete' },
            'Removing a saved Bible passage',
        ],
        ['owa_bible_item', { action: 'create-list' }, 'Making a Bibles list'],
        ['owa_bible_item', { action: 'rename-list' }, 'Renaming a Bibles list'],
        [
            'owa_bible_item',
            { action: 'delete-list' },
            'Moving a Bibles list to the trash',
        ],
        [
            'owa_bible_item',
            { action: 'sort' },
            'Working on your saved Bible passages',
        ],
        [
            'owa_bible_note',
            { action: 'list' },
            'Looking through your Bible notes',
        ],
        ['owa_bible_note', { action: 'read' }, 'Reading a Bible note'],
        ['owa_bible_note', { action: 'add' }, 'Writing a Bible note'],
        ['owa_bible_note', { action: 'update' }, 'Changing a Bible note'],
        ['owa_bible_note', { action: 'delete' }, 'Removing a Bible note'],
        ['owa_bible_note', { action: 'create-file' }, 'Making a notes file'],
        ['owa_bible_note', { action: 'rename-file' }, 'Renaming a notes file'],
        [
            'owa_bible_note',
            { action: 'delete-file' },
            'Moving a notes file to the trash',
        ],
        ['owa_bible_note', { action: 'sort' }, 'Working on your Bible notes'],
        ['owa_undo', { action: 'list' }, 'Looking through the recent changes'],
        ['owa_undo', { action: 'undo' }, 'Putting back an earlier change'],
        ['owa_undo', {}, 'Looking through the recent changes'],
        [
            'owa_presenting_flow',
            { action: 'list' },
            'Looking through your run sheets',
        ],
        ['owa_presenting_flow', { action: 'info' }, 'Reading a run sheet'],
        ['owa_presenting_flow', { action: 'create' }, 'Making a run sheet'],
        ['owa_presenting_flow', { action: 'rename' }, 'Renaming a run sheet'],
        [
            'owa_presenting_flow',
            { action: 'remove' },
            'Taking a line off a run sheet',
        ],
        [
            'owa_presenting_flow',
            { action: 'move' },
            'Moving a line of a run sheet',
        ],
        [
            'owa_presenting_flow',
            { action: 'duplicate' },
            'Copying a line of a run sheet',
        ],
        [
            'owa_presenting_flow',
            { action: 'park' },
            'Parking a line of a run sheet',
        ],
        [
            'owa_presenting_flow',
            { action: 'unpark' },
            'Putting a parked line back in the run',
        ],
        // Whole Bibles.
        [
            'owa_bible_xml',
            { action: 'check' },
            'Downloading the Bible file and reading it',
        ],
        [
            'owa_bible_xml',
            { action: 'names' },
            'Finding Bible book names for your language',
        ],
        ['owa_bible_xml', { action: 'import' }, 'Installing the Bible'],
        ['owa_bible_xml', { action: 'update' }, 'Changing the Bible'],
        [
            'owa_bible_xml',
            { action: 'delete' },
            'Moving the Bible to the trash',
        ],
        ['owa_bible_xml', { action: 'info' }, 'Looking at your Bibles'],
        // The foreground extras.
        [
            'owa_foreground',
            { action: 'check' },
            'Checking the extras on the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'countdown' },
            'Taking the countdown off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'stopwatch' },
            'Taking the stopwatch off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'clock' },
            'Taking the clock off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'marquee-top' },
            'Taking the scrolling message off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'marquee-bottom' },
            'Taking the scrolling message off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'quick-text' },
            'Taking the line of text off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'all' },
            'Taking the extras off the screen',
        ],
        [
            'owa_foreground',
            { action: 'stop', widget: 'camera' },
            'Taking an extra off the screen',
        ],
        [
            'owa_foreground',
            { widget: 'countdown', minutes: 5 },
            'Starting a 5 minute countdown on the screen',
        ],
        [
            'owa_foreground',
            { widget: 'countdown', at: '10:30' },
            'Starting a countdown to “10:30”',
        ],
        [
            'owa_foreground',
            { widget: 'countdown' },
            'Starting a countdown on the screen',
        ],
        [
            'owa_foreground',
            { widget: 'stopwatch' },
            'Starting a stopwatch on the screen',
        ],
        [
            'owa_foreground',
            { widget: 'clock' },
            'Putting a clock on the screen',
        ],
        [
            'owa_foreground',
            { widget: 'marquee-bottom', text: 'Welcome' },
            'Putting a scrolling message on the screen',
        ],
        [
            'owa_foreground',
            { widget: 'quick-text', text: 'Welcome' },
            'Putting a line of text on the screen',
        ],
        ['owa_foreground', {}, 'Putting an extra on the screen'],
        // The app's own window.
        ['owa_help_page', { id: 'W-01' }, 'Reading the guide'],
        ['owa_list_questions', {}, 'Looking through what it can answer'],
        ['owa_app_state', {}, 'Checking what the app is showing'],
        ['owa_list_ui', {}, 'Looking over the buttons on screen'],
        ['owa_find_ui', { label: 'Clear All' }, 'Looking for “Clear All”'],
        ['owa_find_ui', {}, 'Looking for a button'],
        ['owa_click', { label: 'Clear All' }, 'Pressing “Clear All”'],
        ['owa_click', {}, 'Pressing a button'],
        ['owa_type', { label: 'Search' }, 'Typing into “Search”'],
        ['owa_type', {}, 'Typing something'],
        ['owa_goto_page', {}, 'Switching the app window over'],
        ['owa_list_screens', {}, 'Checking the projector screens'],
        ['owa_hide_screens', {}, 'Clearing the projector screens'],
        [
            'owa_present_bible',
            { action: 'check', reference: 'John 3:16' },
            'Reading the passage “John 3:16”',
        ],
        ['owa_present_bible', { action: 'check' }, 'Reading a Bible passage'],
        [
            'owa_present_bible',
            { reference: 'John 3:16' },
            'Putting a Bible passage on the screen: “John 3:16”',
        ],
        ['owa_present_bible', {}, 'Putting a Bible passage on the screen'],
        // The Bible readers.
        [
            'owa_find_verse',
            { open: 'MAT 5:44' },
            'Opening in the Bible Lookup: “MAT 5:44”',
        ],
        ['owa_find_verse', { open: '' }, 'Opening a verse in the Bible Lookup'],
        ['owa_find_verse', { refs: 'JHN 3:16' }, 'Reading “JHN 3:16”'],
        ['owa_find_verse', { refs: ' ' }, 'Reading Bible verses'],
        [
            'owa_find_verse',
            { words: 'love your enemies' },
            'Searching the Bible for “love your enemies”',
        ],
        ['owa_find_verse', {}, 'Looking at the Bibles installed'],
        [
            'owa_resource_file',
            { action: 'read', file: 'pdf/LUK.6.pdf' },
            'Reading “pdf/LUK.6.pdf” from Resources',
        ],
        ['owa_resource_file', { action: 'read' }, 'Looking through Resources'],
        [
            'owa_resource_file',
            { action: 'list', book: 'LUK' },
            'Looking through Resources',
        ],
        [
            'owa_lookup_record',
            { kind: 'verse', ref: 'GEN 8' },
            'Reading “GEN 8”',
        ],
        ['owa_lookup_record', { kind: 'verse' }, 'Reading Bible verses'],
        [
            'owa_lookup_record',
            { kind: 'name', name: 'Noah' },
            'Reading what the names lookup has on “Noah”',
        ],
        ['owa_lookup_record', { kind: 'location' }, 'Reading the names lookup'],
        ['owa_tran', {}, 'Checking what that button is called here'],
        // Pages and songs off the web.
        [
            'owa_read_website',
            { url: 'https://www.example.com/a?b=c' },
            'Reading example.com',
        ],
        ['owa_read_website', { url: 'not a link' }, 'Reading a web page'],
        [
            'owa_lyric_validate',
            { url: 'https://hymnary.example/text/x' },
            'Reading hymnary.example and writing the song out',
        ],
        [
            'owa_lyric_validate',
            { mode: 'find', title: NAME },
            'Looking up the song “Amazing Grace”',
        ],
        ['owa_lyric_validate', { mode: 'find' }, 'Looking up the song'],
        ['owa_lyric_validate', { mode: 'draft' }, 'Writing the song out'],
        ['owa_lyric_validate', {}, 'Checking the song over'],
        // The walkthrough card and the developer's tools.
        ['owa_guide_start', {}, 'Setting up a walkthrough'],
        ['owa_guide_step', {}, 'Moving the walkthrough on'],
        ['owa_guide_status', {}, 'Checking on the walkthrough'],
        ['take_snapshot', {}, 'Looking over the window'],
        ['list_pages', {}, 'Checking which windows are open'],
        ['select_page', {}, 'Switching to another window'],
        ['press_key', {}, 'Pressing a key'],
        ['wait_for', {}, 'Waiting for the app to catch up'],
        ['list_console_messages', {}, "Reading the app's own log"],
        ['get_console_message', {}, "Reading the app's own log"],
        ['list_network_requests', {}, 'Checking what the app has downloaded'],
        ['get_network_request', {}, 'Checking what the app has downloaded'],
        ['handle_dialog', {}, 'Answering a message the app put up'],
    ];

    test.each(STEP_CASES)('%s %j', (name, args, expected) => {
        expect(describeToolStep(name, args)).toBe(expected);
    });

    test('a long name is cut on one line, its whitespace flattened', () => {
        expect(
            describeToolStep('owa_lyric_file', {
                action: 'create',
                name: 'Line one\n\nof a song pasted in as its name, far too long',
            }),
            // 38 at most: 37 characters and the ellipsis.
        ).toBe('Creating a new song: “Line one of a song pasted in as its n…”');
    });
});
