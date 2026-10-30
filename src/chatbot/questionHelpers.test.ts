import { describe, expect, it, test } from 'vitest';

import { BOT_FOCUS_KEYS } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';

import {
    checkIsAlreadyTyped,
    FALLBACK_STARTERS,
    getAllQuestions,
    getStarterQuestions,
    toStarterQuestion,
} from './questionHelpers';

// The corpus is the real one, loaded through the same `import.meta.glob` the
// window uses. A fixture would grade nothing that matters here: what is being
// tested is that the hand-written fallback still says what the files say.
describe('FALLBACK_STARTERS', () => {
    it('names every window the picker offers', () => {
        expect(Object.keys(FALLBACK_STARTERS).sort()).toEqual(
            [...BOT_FOCUS_KEYS].sort(),
        );
    });

    it('offers four questions for each of them', () => {
        for (const focus of BOT_FOCUS_KEYS) {
            expect(FALLBACK_STARTERS[focus], focus).toHaveLength(4);
        }
    });

    // The reason this file exists. The fallback is only ever seen when the
    // corpus fails to load, so nothing in normal use would show that it had
    // gone stale -- and it had: a lower-case "bible verse" and a shortened
    // "Is any screen showing?" that no question in the corpus was called.
    it('says exactly what the corpus says', async () => {
        for (const focus of BOT_FOCUS_KEYS as BotFocusType[]) {
            const fromCorpus = await getStarterQuestions(focus);
            expect(
                FALLBACK_STARTERS[focus].map(toStarterQuestion),
                focus,
            ).toEqual(fromCorpus);
        }
    });

    // A template chip fills the ask box instead of sending it, so the two
    // sides have to agree about WHICH chips those are. Getting it wrong in the
    // fallback would send the assistant off to read the example address --
    // only ever when the corpus had failed to load, which is exactly the
    // circumstance nobody would be watching.
    it('agrees with the corpus about which chips are templates', async () => {
        for (const focus of BOT_FOCUS_KEYS as BotFocusType[]) {
            const fromCorpus = await getStarterQuestions(focus);
            expect(
                FALLBACK_STARTERS[focus].map((one) => {
                    return toStarterQuestion(one).isTemplate;
                }),
                focus,
            ).toEqual(
                fromCorpus.map((one) => {
                    return one.isTemplate;
                }),
            );
        }
    });
});

// A row the box already holds is a row with nothing to offer: taking it would
// change nothing, or would throw away the words added after it.
describe('checkIsAlreadyTyped', () => {
    it('is true once the box holds the whole suggestion', () => {
        const suggestion = 'How do I present a Bible verse?';
        expect(checkIsAlreadyTyped(suggestion, suggestion)).toBe(true);
        expect(
            checkIsAlreadyTyped(`  ${suggestion.toLowerCase()} `, suggestion),
        ).toBe(true);
        expect(
            checkIsAlreadyTyped(`${suggestion} On screen 2`, suggestion),
        ).toBe(true);
    });

    it('is false while there is still some of it to finish', () => {
        const suggestion = 'How do I present a Bible verse?';
        expect(checkIsAlreadyTyped('How do I present', suggestion)).toBe(false);
        expect(checkIsAlreadyTyped('', suggestion)).toBe(false);
        // The words being somewhere in the box is not the box saying them.
        expect(
            checkIsAlreadyTyped(`Quick one: ${suggestion}`, suggestion),
        ).toBe(false);
        // An empty suggestion must not close the list for everything.
        expect(checkIsAlreadyTyped('anything', '  ')).toBe(false);
    });
});

// The list behind "More…" on the empty window. Graded against the real corpus
// for the same reason as everything above it: what is being asserted is that
// what a volunteer is shown matches what the assistant is actually prepared
// for, and a fixture would grade the fixture.
describe('getAllQuestions', () => {
    it('offers far more than the four chips, in every window', async () => {
        for (const focus of BOT_FOCUS_KEYS as BotFocusType[]) {
            const groups = await getAllQuestions(focus);
            const total = groups.reduce((count, group) => {
                return count + group.questions.length;
            }, 0);
            // The point of the button is that the four are not the whole of
            // it. The thinnest window (the Bible Note) still clears this.
            expect(total, focus).toBeGreaterThan(20);
            for (const group of groups) {
                expect(group.label.length, focus).toBeGreaterThan(0);
                expect(group.questions.length, focus).toBeGreaterThan(0);
            }
        }
    });

    it('shows a window only what belongs to it', async () => {
        // A page naming a window belongs to that window; a page naming none is
        // true everywhere. Showing the reader's questions in the presenter
        // would be a list of things that are not on screen.
        const readerText = new Set(
            (await getAllQuestions('reader')).flatMap((group) => {
                return group.questions.map((question) => {
                    return question.text;
                });
            }),
        );
        const presenterText = new Set(
            (await getAllQuestions('presenter')).flatMap((group) => {
                return group.questions.map((question) => {
                    return question.text;
                });
            }),
        );
        expect(readerText.size).toBeGreaterThan(0);
        expect(presenterText.size).toBeGreaterThan(readerText.size);
        // Neither is a subset of the other: each has questions the other
        // cannot answer from where it is.
        expect(
            [...readerText].some((text) => {
                return !presenterText.has(text);
            }),
        ).toBe(true);
    });

    it('carries every starter chip, so More is never a step backwards', async () => {
        for (const focus of BOT_FOCUS_KEYS as BotFocusType[]) {
            const all = new Set(
                (await getAllQuestions(focus)).flatMap((group) => {
                    return group.questions.map((question) => {
                        return question.text;
                    });
                }),
            );
            for (const starter of await getStarterQuestions(focus)) {
                expect(all.has(starter.text), `${focus}: ${starter.text}`).toBe(
                    true,
                );
            }
        }
    });

    it('keeps the template flag, or More would read example.com out loud', async () => {
        const templates = (await getAllQuestions('presenter')).flatMap(
            (group) => {
                return group.questions.filter((question) => {
                    return question.isTemplate;
                });
            },
        );
        // The corpus has at least the one; if it ever has none this assertion
        // is the thing that says the flag stopped being carried.
        expect(templates.length).toBeGreaterThan(0);
    });
});

describe('a picked question is a known one', () => {
    test('the exact text of a corpus row is found, a paraphrase is not', async () => {
        const { findKnownQuestion, genKnownQuestionHint } =
            await import('./questionHelpers');
        const known = await findKnownQuestion(
            'is any screen showing right now',
            'presenter',
        );
        expect(known?.resources?.recipe).toBe('W-10');
        expect(genKnownQuestionHint(known!)).toContain('W-10');
        expect(genKnownQuestionHint(known!)).toContain('owa_list_screens');
        expect(
            await findKnownQuestion('anything on the projector?', 'presenter'),
        ).toBeNull();
    });

    // 2026-10-10, EC-215: "make computer stay awake" on the Free model was
    // answered with Windows power settings, nothing about the app's own cup.
    test('words of the person’s own that carry a row’s phrase are that row', async () => {
        const { findKnownQuestion, findRowByKeywordPhrase } =
            await import('./questionHelpers');
        const known = await findKnownQuestion(
            'make computer stay awake',
            'presenter',
        );
        expect(known?.resources?.find).toBe('Stay Awake');
        expect(known?.resources?.recipe).toBe('W-01');
        // Nothing of the corpus in it: nothing.
        expect(
            await findKnownQuestion('how do I bake bread', 'presenter'),
        ).toBeNull();
        // The rule on its own: one word is no phrase, and two rows that
        // answer from different pages are nobody's question.
        const rows = [
            {
                id: 'a',
                keywords: ['stay awake', 'sleep'],
                resources: { recipe: 'W-01' },
            },
            {
                id: 'b',
                keywords: ['screen saver'],
                resources: { recipe: 'W-18' },
            },
            {
                id: 'c',
                keywords: ['stay awake'],
                resources: { recipe: 'W-01' },
            },
        ] as any[];
        expect(findRowByKeywordPhrase('please stay awake', rows)?.id).toBe('a');
        expect(findRowByKeywordPhrase('i cannot sleep', rows)).toBeNull();
        expect(
            findRowByKeywordPhrase('stay awake and the screen saver', rows),
        ).toBeNull();
        expect(findRowByKeywordPhrase('stay awaken', rows)).toBeNull();
    });

    // 2026-10-12: "Add a slide to my document that says Welcome to church"
    // matched no row, so a local model with no slide tool was never told so.
    test('a fill-in row is still known once its sentence is finished', async () => {
        const {
            findKnownQuestion,
            findFilledTemplateRow,
            genKnownQuestionHint,
        } = await import('./questionHelpers');
        const known = await findKnownQuestion(
            'Add a slide to my document that says Welcome to church',
            'presenter',
        );
        expect(known?.id).toBe('common.changes.add-a-slide');
        expect(known?.resources?.tools).toEqual(['owa_slide_file']);
        // And the hint then says what an assistant without the tool must.
        const hint = genKnownQuestionHint(known!, {
            focus: 'presenter',
            missingTools: ['owa_slide_file'],
        })!;
        expect(hint).toContain('has NOT been given owa_slide_file');
        expect(hint).toContain('no page for doing this by hand');
        // The rule on its own: the gap has to be filled, the row has to be a
        // fill-in one that ends on its gap, and two that open alike are
        // nobody's.
        const rows = [
            { id: 'a', text: 'Write a Bible note about ...', isTemplate: true },
            {
                id: 'b',
                text: 'Save John 3:16 to my Bibles list',
                isTemplate: true,
            },
            {
                id: 'c',
                text: 'How do I write a Bible note about ...',
                isTemplate: false,
            },
        ] as any[];
        expect(
            findFilledTemplateRow('write a bible note about grace', rows)?.id,
        ).toBe('a');
        expect(
            findFilledTemplateRow('write a bible note about', rows),
        ).toBeNull();
        expect(
            findFilledTemplateRow(
                'save john 3 16 to my bibles list today',
                rows,
            ),
        ).toBeNull();
        expect(
            findFilledTemplateRow(
                'how do i write a bible note about grace',
                rows,
            ),
        ).toBeNull();
        expect(
            findFilledTemplateRow('write a bible note about grace', [
                ...rows,
                {
                    id: 'd',
                    text: 'Write a Bible note about…',
                    isTemplate: true,
                },
            ] as any[]),
        ).toBeNull();
    });

    test('a row with neither recipe nor tool gives no hint', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        expect(genKnownQuestionHint({ resources: {} } as any)).toBeNull();
    });

    // 2026-10-10: the Reader's "Where do I type John 3:16?" typed under the
    // Presenter matched nothing, so a local model went searching, opened the
    // Bible-XML page and invented a "Reference box" and a "Go" button.
    test('a row filed under another window is still known, and the hint says where', async () => {
        const { findKnownQuestion, genKnownQuestionHint } =
            await import('./questionHelpers');
        const known = await findKnownQuestion(
            'Where do I type John 3:16?',
            'presenter',
        );
        expect(known?.resources?.recipe).toBe('W-11');
        expect(known?.page).toBe('reader');
        const hint = genKnownQuestionHint(known!, { focus: 'presenter' })!;
        expect(hint).toContain('filed under the Bible Reader window');
        expect(hint).toContain('asking about the Presenter');
        expect(hint).toContain('open it with owa_help_page');
        // Under its own window, nothing of the sort.
        const own = await findKnownQuestion(
            'Where do I type John 3:16?',
            'reader',
        );
        expect(genKnownQuestionHint(own!, { focus: 'reader' })).not.toContain(
            'filed under',
        );
    });

    // 2026-10-12, the whole corpus asked of a local model: the row's key and
    // menu item were not passed on, and nine answers marked down never named
    // theirs -- one key is written in its row and on no page at all.
    test('the hint says the key and the menu item the row is filed with', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const row = {
            text: 'How can I learn to prepare several notices in Messages?',
            keywords: [],
            focus: 'presenter',
            pageLabel: 'Presenter',
            resources: {
                recipe: 'W-46',
                menu: 'Help → All tips',
                shortcut: 'F1',
            },
        } as any;
        const hint = genKnownQuestionHint(row, {
            focus: 'presenter',
            pageText: 'A short page.',
        })!;
        expect(hint).toContain(
            'For this, the app has the menu item Help → All tips and ' +
                'the key F1: name them in the steps',
        );
        // Nothing about a list the person never sees: a model repeats what
        // it is told ("the app files this under that key").
        expect(hint).not.toMatch(/files this|key list/);
        // In front of the page, which the person never sees.
        expect(hint.indexOf('Help → All tips')).toBeLessThan(
            hint.indexOf('The guide page, put here by the app itself'),
        );
        // And with no page read, the same.
        expect(genKnownQuestionHint(row, { focus: 'presenter' })).toContain(
            'the menu item Help → All tips',
        );
        const keyOnly = genKnownQuestionHint(
            { ...row, resources: { recipe: 'W-06', shortcut: 'F9' } },
            { focus: 'presenter', pageText: 'A short page.' },
        )!;
        expect(keyOnly).toContain(
            'the app has the key F9: name it in the steps',
        );
        // A row with neither says nothing of the kind.
        expect(
            genKnownQuestionHint(
                { ...row, resources: { recipe: 'W-06' } },
                { focus: 'presenter', pageText: 'A short page.' },
            ),
        ).not.toContain('For this, the app has');
    });

    test('the page rides with the hint when it was read, clipped past 6 000 characters', async () => {
        const { genKnownQuestionHint, readKnownQuestionPage } =
            await import('./questionHelpers');
        const row = { resources: { recipe: 'W-11' }, focus: null } as any;
        expect(
            await readKnownQuestionPage(
                row,
                async (id) => `# Page ${id}\n\n1. Click.`,
            ),
        ).toBe('# Page W-11\n\n1. Click.');
        const hint = genKnownQuestionHint(row, {
            pageText: '# Page W-11\n\n1. Click.',
        })!;
        expect(hint).toContain('is quoted in full below');
        expect(hint).not.toContain('open it with owa_help_page rather');
        expect(hint).toContain(
            'The guide page, put here by the app itself -- the person did ' +
                'not write or paste it, and never sees it:\n\n# Page W-11\n\n1. Click.',
        );
        const long = genKnownQuestionHint(row, { pageText: 'x'.repeat(7000) })!;
        expect(long).toContain('…(the page goes on');
        expect(long.length).toBeLessThan(7000);
        // A control named deep in a long page rides with its step: the
        // opening, a gap, then the step that names it, and the hint says
        // which control the question is about (the laptop's 0.6B recited
        // W-51 from step 1 and never reached step 8, Cast to a TV).
        const steps = Array.from({ length: 9 }, (_one, at) => {
            return `${at + 1}. Step ${at + 1} ${'words '.repeat(200)}`;
        });
        const page = `# Virtual displays\n\nIntro.\n\n${steps.join('\n')}`;
        page.replace('Step 8 ', 'Step 8 click **Cast to a TV** ');
        const deep = page.replace('Step 8 ', 'Step 8 click **Cast to a TV** ');
        const focused = genKnownQuestionHint(
            { resources: { recipe: 'W-51', find: 'Cast to a TV' } } as any,
            { pageText: deep },
        )!;
        expect(focused).toContain('# Virtual displays');
        expect(focused).toContain('\n…\n8. Step 8 click **Cast to a TV**');
        expect(focused).not.toContain('7. Step 7');
        expect(focused).toContain(
            'The control this question is about is "Cast to a TV"',
        );
        expect(focused.length).toBeLessThan(7000);
        // A control the page does not carry leaves the opening alone.
        const plain = genKnownQuestionHint(
            { resources: { recipe: 'W-51', find: 'Nowhere' } } as any,
            { pageText: deep },
        )!;
        expect(plain).not.toContain('\n…\n');
        expect(plain).not.toContain('The control this question is about');
        // A read that fails, or a row with no recipe, leaves the hint as it was.
        expect(
            await readKnownQuestionPage(row, async () => {
                throw new Error('down');
            }),
        ).toBeNull();
        expect(
            await readKnownQuestionPage(
                { resources: {} } as any,
                async () => 'x',
            ),
        ).toBeNull();
    });

    // The help window's own page is 57 000 characters and one read of it
    // stops at 40 000: its last seven steps reached nobody, and "Can you walk
    // me through it step by step?" -- step 14 -- was answered with how to
    // open the window it was asked in.
    test('a page that comes in parts is read whole before anything is cut from it', async () => {
        const { readKnownQuestionPage, readWholePage } =
            await import('./questionHelpers');
        const { FRESH_PAGE_NOTE_LEAD, genPagePartNote } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const foot =
            `\n\n${FRESH_PAGE_NOTE_LEAD}read its newest copy with ` +
            'owa_read_website: https://example.com/w-42.md )_';
        const calls: (number | undefined)[] = [];
        const readPage = async (_id: string, part?: number) => {
            calls.push(part);
            return part === 2
                ? '# Ask the app for help (part 2 of 2)\n\n' +
                      `14. Every answer offers **Show me step by step**.${foot}`
                : '# Ask the app for help\n\n1. Click the robot button.' +
                      `${genPagePartNote(1, 2)}${foot}`;
        };
        const row = { resources: { recipe: 'W-42' }, focus: null } as any;
        expect(await readKnownQuestionPage(row, readPage)).toBe(
            '# Ask the app for help\n\n1. Click the robot button.\n' +
                `14. Every answer offers **Show me step by step**.${foot}`,
        );
        expect(calls).toEqual([undefined, 2]);
        // A part that cannot be read leaves what came before it, still
        // saying that the page goes on.
        const broken = await readWholePage('W-42', async (_id, part) => {
            if (part === 2) {
                throw new Error('down');
            }
            return `# A page\n\n1. One.${genPagePartNote(1, 2)}`;
        });
        expect(broken).toContain('1. One.');
        expect(broken).toContain('This page goes on: this is part 1 of 2');
    });

    // 2026-10-12, a local model over the whole corpus. Half the supported
    // questions are filed under a page longer than what rides; the help
    // window's own is 41 000 characters, and its first 6 000 say nothing of
    // the commands "What commands can I type instead of asking?" is about.
    const filler = (name: string) => {
        return `${name} ${'plain words about something else entirely. '.repeat(22)}`;
    };
    const LONG_PAGE = [
        '# Ask the app for help',
        '',
        '**Goal:** get an answer without leaving the app.',
        '',
        `1. ${filler('Open the window.')}`,
        `2. ${filler('Tabs along the top.')}`,
        `3. ${filler('Rename a tab.')}`,
        `4. ${filler('Lock a tab.')}`,
        `5. ${filler('The pickers.')}`,
        `6. ${filler('Type a question.')}`,
        `7. ${filler('Attach a picture.')}`,
        '   **Some things need no assistant at all — type a slash.** A line that',
        '   starts with a slash is a command, and the list of commands appears',
        '   above the box.',
        `8. ${filler('Copy an answer.')}`,
    ].join('\n');

    test('a row that names its passage is cut around it, whatever the words and the control say', async () => {
        const { clipKnownPageParts } = await import('./questionHelpers');
        const page = [
            LONG_PAGE,
            '9. Press **Report**: **Copy report**, **Copy subject** and **Copy picture**, then paste it and save it.',
            `10. ${filler('The settings button.')}`,
            '11. Under every answer is **Copy**, which says **✓ Copied**.',
        ].join('\n');
        const row = {
            text: 'How do I copy an answer?',
            keywords: ['copy', 'clipboard', 'paste', 'save answer'],
            // The control is written first in the bug report's step.
            resources: { recipe: 'W-42', find: 'Copy' },
            focus: null,
        } as any;
        const byControl = clipKnownPageParts(page, 'Copy', row);
        expect(byControl.mode).toBe('step');
        expect(byControl.text).toContain('9. Press **Report**');
        const named = clipKnownPageParts(page, 'Copy', {
            ...row,
            resources: {
                ...row.resources,
                passage: 'Under every answer is Copy',
            },
        });
        expect(named.mode).toBe('matching');
        expect(named.text).toContain('11. Under every answer is **Copy**');
        // ...and the model is told which part that is: the parts ride in the
        // page's order, and the first that seems to fit is not always it.
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const labelled = {
            ...row,
            resources: {
                recipe: 'W-42',
                passage: 'Under every answer is Copy',
            },
        };
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'The part that answers THIS question is the one with the words ' +
                '"Under every answer is Copy"',
        );
        // On a page too long to quote whole the named part is quoted FIRST,
        // by itself: the parts ride in the page's order, its opening first,
        // and "Can you walk me through it step by step?" was answered from
        // the opening every time it was asked (2026-10-13).
        const longHint = genKnownQuestionHint(labelled, { pageText: page });
        expect(longHint).toContain(
            '"Under every answer is Copy", quoted first below:',
        );
        const firstAt = longHint?.indexOf(
            'The part that answers this question, quoted first and by itself:',
        );
        const pageAt = longHint?.indexOf('The guide page, put here by the');
        expect(firstAt).toBeGreaterThan(0);
        expect(pageAt).toBeGreaterThan(firstAt ?? 0);
        expect(longHint?.slice(firstAt, pageAt)).toContain(
            '11. Under every answer is **Copy**',
        );
        // Short pages need the same priority: an earlier step can describe
        // a different job, such as adding a version before a pane split.
        const shortHint = genKnownQuestionHint(
            {
                ...labelled,
                resources: { ...labelled.resources, recipe: 'W-11' },
            },
            {
                pageText:
                    '1. Open the window.\n2. Under every answer is **Copy**.',
                localPageText: '1. បើកវា។\n2. ក្រោមចម្លើយនីមួយៗមាន **ចម្លង**។',
            },
        );
        expect(shortHint).toContain('answer from that part in ITS OWN WORDS');
        const shortFirstAt = shortHint!.indexOf('quoted first and by itself:');
        const shortPageAt = shortHint!.indexOf(
            'The guide page, put here by the',
        );
        expect(shortFirstAt).toBeGreaterThan(0);
        expect(shortPageAt).toBeGreaterThan(shortFirstAt);
        const shortFirst = shortHint!.slice(shortFirstAt, shortPageAt);
        expect(shortFirst).toContain('ក្រោមចម្លើយនីមួយៗមាន **ចម្លង**');
        expect(shortFirst).not.toContain('បើកវា');
        expect(shortHint!.slice(shortPageAt)).toContain('បើកវា');
        // ...and to answer in the part's OWN words: a sentence copied
        // cannot change its noun (two of twenty-seven had, 2026-10-13).
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'copy the sentences you use as they stand, change no name in ' +
                'them and add no step the page does not have',
        );
        // ...and the WHOLE job (2026-10-17, EC-310): told to take "only what
        // it leaves out", answers stopped where their part did.
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'the steps after it that finish the job',
        );
        expect(genKnownQuestionHint(row, { pageText: page })).not.toContain(
            'The part that answers THIS question',
        );
    });

    test('a question about the help window does not ride with how to open the help window', async () => {
        const { dropFirstStep, genKnownQuestionHint, HELP_WINDOW_MANUAL_ID } =
            await import('./questionHelpers');
        const page =
            '# Ask the app for help\n\nIt answers how-do-I questions.\n\n' +
            '1. Click the robot button,\n   or press the shortcut.\n' +
            '2. A strip of tabs runs along the top.\n3. Type a question.';
        expect(dropFirstStep(page)).toBe(
            '# Ask the app for help\n\nIt answers how-do-I questions.\n\n' +
                '2. A strip of tabs runs along the top.\n3. Type a question.',
        );
        // A page with one step, or none, is left as it is.
        expect(dropFirstStep('# A page\n\n1. The only step.')).toBe(
            '# A page\n\n1. The only step.',
        );
        const own = genKnownQuestionHint(
            {
                resources: { recipe: HELP_WINDOW_MANUAL_ID },
                focus: null,
            } as any,
            { pageText: page },
        )!;
        expect(own).toContain('2. A strip of tabs runs along the top.');
        expect(own).not.toContain('Click the robot button');
        // A row that names a passage IN step 1 asks about the way in, and
        // keeps it -- "How do I open the help from the taskbar?" was
        // answered "Click the 🤖 button on the taskbar" without it.
        const taskbar =
            '# Ask the app for help\n\nIt answers how-do-I questions.\n\n' +
            '1. Click the robot button.\n' +
            '   **On Windows the taskbar has it too:** right-click the icon.\n' +
            '2. A strip of tabs runs along the top.';
        expect(
            dropFirstStep(taskbar, 'On Windows the taskbar has it too'),
        ).toBe(taskbar);
        expect(dropFirstStep(taskbar, 'A strip of tabs')).not.toContain(
            'right-click the icon',
        );
        const asked = genKnownQuestionHint(
            {
                resources: {
                    recipe: HELP_WINDOW_MANUAL_ID,
                    passage: 'On Windows the taskbar has it too',
                },
                focus: null,
            } as any,
            { pageText: taskbar },
        )!;
        expect(asked).toContain('right-click the icon');
        // Any other page keeps its way in: they may be in another window.
        expect(
            genKnownQuestionHint(
                { resources: { recipe: 'W-11' }, focus: null } as any,
                { pageText: page },
            ),
        ).toContain('1. Click the robot button');
        // The id is the help window's page: a renumbered manual fails here.
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(
            'docs/manual-sources/keyboard-shortcut-reference-tutorial-appendix/' +
                'w-42-ask-the-app-for-help-the-chatbot.md',
            'utf8',
        );
        expect(source).toContain(`id: ${HELP_WINDOW_MANUAL_ID}`);
        expect(source).toContain('Ask the app for help');
    });

    test('a long page rides as its opening and the passages that match the question', async () => {
        const { clipKnownPageParts, genKnownQuestionHint } =
            await import('./questionHelpers');
        const row = {
            text: 'What commands can I type instead of asking?',
            keywords: ['slash', 'quick'],
            resources: { recipe: 'W-42' },
            focus: null,
        } as any;
        const cut = clipKnownPageParts(LONG_PAGE, null, row);
        expect(cut.mode).toBe('matching');
        expect(cut.text.startsWith('# Ask the app for help')).toBe(false);
        expect(cut.text).toContain('**Goal:** get an answer');
        expect(cut.text).toContain(
            '\n…\n**Some things need no assistant at all',
        );
        expect(cut.text).toContain('…(the page goes on');
        expect(cut.text.length).toBeLessThan(6100);
        const hint = genKnownQuestionHint(row, { pageText: LONG_PAGE })!;
        expect(hint).toContain('The page is too long to quote whole');
        expect(hint).toContain('the list of commands appears above the box.');
        // A row with nothing to match by rides the page's start, as before.
        expect(clipKnownPageParts(LONG_PAGE, null, null).mode).toBe('opening');
        expect(
            clipKnownPageParts(LONG_PAGE, null, {
                text: 'How do I rename a tab?',
                keywords: [],
                resources: {},
            }).mode,
        ).toBe('head');
    });

    test('a control that is not a string is no control, not a crash', async () => {
        // Four corpus rows carried `find` as a list; on a long page the
        // window answered "trim is not a function".
        const { clipKnownPageParts, genKnownQuestionHint } =
            await import('./questionHelpers');
        const row = {
            text: 'How do I report a problem?',
            keywords: [],
            resources: { recipe: 'W-42', find: ['Report'] },
            focus: null,
        } as any;
        expect(() => {
            return clipKnownPageParts(LONG_PAGE, row.resources.find, row);
        }).not.toThrow();
        expect(genKnownQuestionHint(row, { pageText: LONG_PAGE })).toContain(
            'W-42',
        );
    });

    // A page quoted is a page READ, and the loop is told, so steps written
    // from it are not handed back as "written from a search excerpt" for the
    // model to open the same page again.
    test('what rides is the answer unless no part of a long page matched', async () => {
        const { checkIsKnownPageQuoted } = await import('./questionHelpers');
        expect(checkIsKnownPageQuoted('# Page W-11\n\n1. Click.')).toBe(true);
        expect(checkIsKnownPageQuoted('x'.repeat(6000))).toBe(true);
        expect(checkIsKnownPageQuoted(null)).toBe(false);
        // Long, and nothing to say which part: a start, not an answer.
        expect(checkIsKnownPageQuoted('x'.repeat(6001))).toBe(false);
        expect(
            checkIsKnownPageQuoted(LONG_PAGE, {
                text: 'How do I feed a zebra?',
                keywords: [],
                resources: {},
            }),
        ).toBe(false);
        // Long, cut to the passage that matches or to the control's step.
        expect(
            checkIsKnownPageQuoted(LONG_PAGE, {
                text: 'What commands can I type instead of asking?',
                keywords: [],
                resources: {},
            }),
        ).toBe(true);
        expect(
            checkIsKnownPageQuoted(LONG_PAGE, {
                text: 'How do I keep an answer?',
                keywords: [],
                resources: { find: 'Copy an answer' },
            }),
        ).toBe(true);
    });

    test('the loop is told the page, its control and that it was quoted -- not for a state question', async () => {
        const { genKnownAskExtra } = await import('./questionHelpers');
        const howto = {
            kind: 'howto',
            text: 'How do I hide a panel?',
            keywords: [],
            resources: { recipe: 'W-31', find: 'Widgets' },
        } as any;
        expect(genKnownAskExtra(howto, '# W-31\n\n1. Click.')).toEqual({
            knownRecipeId: 'W-31',
            isKnownPageQuoted: true,
            knownFind: 'Widgets',
            isKnownPartNamed: true,
        });
        // The page could not be read: the walkthrough still stands, and the
        // steps may still be handed back.
        expect(genKnownAskExtra(howto, null)).toEqual({
            knownRecipeId: 'W-31',
            isKnownPageQuoted: false,
            knownFind: 'Widgets',
            isKnownPartNamed: true,
        });
        // A list where a control should be is no control.
        expect(
            genKnownAskExtra(
                { ...howto, resources: { recipe: 'W-42', find: ['Report'] } },
                'x',
            ),
        ).toEqual({ knownRecipeId: 'W-42', isKnownPageQuoted: true });
        // A what-or-why question is checked for its answer, not its steps
        // (pass 17, 2026-10-18).
        expect(
            genKnownAskExtra({ ...howto, kind: 'what' }, '# W-31\n\n1. Click.'),
        ).toEqual({
            knownRecipeId: 'W-31',
            isKnownPageQuoted: true,
            knownFind: 'Widgets',
            isKnownPartNamed: true,
            isKnownWhatAsk: true,
        });
        // What the app is DOING is read off the app: no page to walk under
        // "Which page am I on right now?".
        expect(genKnownAskExtra({ ...howto, kind: 'state' }, 'x')).toEqual({});
        expect(
            genKnownAskExtra(
                { ...howto, resources: { tools: ['owa_undo'] } },
                null,
            ),
        ).toEqual({});
        expect(genKnownAskExtra(null, null)).toEqual({});
    });

    // The whole list asked in Khmer (EC-323): "Can you start a 5 minute
    // countdown on the screen?" was answered with a question back.
    test('a row asking to put something up is told to do it', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const row = (text: string, tools: string[]) => {
            return {
                text,
                textEn: text,
                resources: { tools },
                focus: null,
            } as any;
        };
        expect(
            genKnownQuestionHint(
                row('Can you start a 5 minute countdown on the screen?', [
                    'owa_foreground',
                ]),
            ),
        ).toContain('it asks you to DO it, now: call owa_foreground');
        // Pass 18: a screen that is off is the person's to show.
        expect(
            genKnownQuestionHint(
                row('Can you start a 5 minute countdown on the screen?', [
                    'owa_foreground',
                ]),
            ),
        ).toContain('press that screen’s show button or F5 themselves');
        // How, not do: the manual answers it.
        expect(
            genKnownQuestionHint(
                row('How do I start a countdown?', ['owa_foreground']),
            ),
        ).not.toContain('DO it');
        // And the loop is told which tool the answer must have called.
        const { genKnownAskExtra } = await import('./questionHelpers');
        expect(
            genKnownAskExtra(
                row('Can you start a 5 minute countdown on the screen?', [
                    'owa_foreground',
                ]),
                null,
            ),
        ).toEqual({ knownDoTool: 'owa_foreground' });
        // A tool that writes the person's files is never pushed this way.
        expect(
            genKnownQuestionHint(
                row('Can you put back something the assistant deleted?', [
                    'owa_undo',
                ]),
            ),
        ).not.toContain('DO it');
    });

    // 2026-10-12, gemma-4-e4b on a local server, which is sent fourteen of
    // the twenty-six tools: told "the live tool for it: owa_undo", it
    // answered with the Bible note's Undo.
    // Pass 13 (2026-10-18): two help-window answers ended "press Enter to
    // send", and in that box Enter starts a new line.
    test('a help-window question is told how its box sends', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const helpRow = {
            resources: { recipe: 'W-42' },
            focus: null,
        } as any;
        expect(genKnownQuestionHint(helpRow)).toContain(
            'sent with Ctrl+Enter or the Send button',
        );
        expect(
            genKnownQuestionHint({
                resources: { recipe: 'W-05' },
                focus: null,
            } as any),
        ).not.toContain('Ctrl+Enter');
    });

    test('a tool the assistant was not given is named as missing, not as the live tool', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const row = {
            resources: { tools: ['owa_undo', 'owa_app_state'] },
            focus: null,
        } as any;
        const hint = genKnownQuestionHint(row, { missingTools: ['owa_undo'] })!;
        expect(hint).toContain('the live tool for it: owa_app_state');
        expect(hint).toContain('has NOT been given owa_undo');
        expect(hint).toContain('that you cannot do that for them here');
        // The way without the tool may be a command (`/lyric`), not only
        // presses by hand, and it comes first (2026-10-18).
        expect(hint).toContain('lead with the way the guide gives');
        expect(hint).toContain('by hand, or a / command it names');
        // Given everything, the hint reads as it did.
        expect(genKnownQuestionHint(row)).toContain(
            'the live tools for it: owa_undo, owa_app_state',
        );
        expect(genKnownQuestionHint(row)).not.toContain('NOT been given');
        // A tool the row does not name is not reported missing.
        expect(
            genKnownQuestionHint(row, { missingTools: ['owa_slide_file'] }),
        ).not.toContain('NOT been given');
        // A row whose only tool is missing still gets a hint -- the one that
        // says so.
        expect(
            genKnownQuestionHint(
                { resources: { tools: ['owa_undo'] }, focus: null } as any,
                { missingTools: ['owa_undo'] },
            ),
        ).toContain('has NOT been given owa_undo');
    });

    // 2026-10-13, gemma-4-e4b at temperature 0: of the eight questions about
    // what the app has or is doing, "Which displays does this computer
    // have?" alone was answered with no tool called -- "the guide does not
    // provide information about your computer's physical hardware".
    test('a question about what the app is doing right now is told to call its tool', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const hint = genKnownQuestionHint({
            kind: 'state',
            resources: { recipe: 'W-18', tools: ['owa_list_screens'] },
            focus: null,
        } as any)!;
        expect(hint).toContain(
            'only the app can say -- call owa_list_screens first and ' +
                'answer from what it returns; the live tool for it: ' +
                'owa_list_screens',
        );
        // A how-to with a tool of its own is not told to call it first.
        expect(
            genKnownQuestionHint({
                kind: 'howto',
                resources: { tools: ['owa_find_ui'] },
                focus: null,
            } as any),
        ).not.toContain('only the app can say');
    });

    // 2026-10-12: told to "give the way to do it by hand when the guide has
    // one" under a row with NO page, a local model gave one anyway -- an
    // automatic undo for background colours, a Web Editor button and a link
    // box. With no page and no tool left there is nothing by hand to give.
    test('a row with no page and no tool it was given is told to make up no way by hand', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const hint = genKnownQuestionHint(
            { resources: { tools: ['owa_undo'] }, focus: null } as any,
            { missingTools: ['owa_undo'] },
        )!;
        expect(hint).toContain('the guide has no page for doing this by hand');
        expect(hint).toContain('describe no steps, buttons or menus for it');
        expect(hint).toContain('another assistant in the list at the top');
        // A page under the row is a way by hand: nothing of the kind is said.
        expect(
            genKnownQuestionHint(
                {
                    resources: { recipe: 'W-43', tools: ['owa_undo'] },
                    focus: null,
                } as any,
                { missingTools: ['owa_undo'] },
            ),
        ).not.toContain('no page for doing this by hand');
        // Nor when one of its tools was given: it can still act.
        expect(
            genKnownQuestionHint(
                {
                    resources: { tools: ['owa_undo', 'owa_app_state'] },
                    focus: null,
                } as any,
                { missingTools: ['owa_undo'] },
            ),
        ).not.toContain('no page for doing this by hand');
    });

    // 2026-10-12: nine of thirty-nine answers given from the editor windows
    // opened on the way into the window the question was typed in.
    test('a question asked from the window it is filed under is told they are in it', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const row = {
            text: 'How do I add a slide?',
            keywords: [],
            focus: 'appDocumentEditor',
            pageLabel: 'Document Editor',
            resources: { recipe: 'W-15' },
        } as any;
        const own = genKnownQuestionHint(row, {
            focus: 'appDocumentEditor',
            pageText: 'A short page.',
        })!;
        expect(own).toContain(
            'They are asking from INSIDE the Document Editor, which is ' +
                'open in front of them',
        );
        expect(own).toContain('never tell them how to open it or get to it');
        // Asked from another window, they are told where it is filed.
        const other = genKnownQuestionHint(row, {
            focus: 'presenter',
            pageText: 'A short page.',
        })!;
        expect(other).not.toContain('asking from INSIDE');
        expect(other).toContain('filed under the Document Editor window');
        // The two pages a session starts in say nothing of the kind, and a
        // row every window shares is nobody's own.
        expect(
            genKnownQuestionHint(
                { ...row, focus: 'presenter', pageLabel: 'Presenter' },
                { focus: 'presenter', pageText: 'A short page.' },
            ),
        ).not.toContain('asking from INSIDE');
        expect(
            genKnownQuestionHint(
                { ...row, focus: null },
                { focus: 'appDocumentEditor', pageText: 'A short page.' },
            ),
        ).not.toContain('asking from INSIDE');
        // Nor a row answered from the help window's own page: what it tells
        // is done in the help window, not in the window it is filed under.
        expect(
            genKnownQuestionHint(
                {
                    ...row,
                    focus: 'lyricEditor',
                    pageLabel: 'Lyric Editor',
                    resources: { recipe: 'W-42' },
                },
                { focus: 'lyricEditor', pageText: '1. Open it.\n2. Paste.' },
            ),
        ).not.toContain('asking from INSIDE');
    });

    // 2026-10-12: the note the page tool writes for a model at a page's foot
    // was measured and ranked as part of the page.
    test('a page that fits without its foot note rides whole, and is not said to go on', async () => {
        const { clipKnownPageParts } = await import('./questionHelpers');
        const { FRESH_PAGE_NOTE_LEAD } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const body =
            '# A page\n\n' +
            Array.from({ length: 48 }, (_one, index) => {
                return `${index + 1}. Step ${index + 1} of the page: ${'words '.repeat(15)}`;
            }).join('\n');
        const note =
            `\n\n${FRESH_PAGE_NOTE_LEAD}read its newest copy with ` +
            `owa_read_website: https://example.org/${'a-page-'.repeat(60)}.md )_`;
        expect(body.length).toBeLessThan(6000);
        expect((body + note).length).toBeGreaterThan(6000);
        const cut = clipKnownPageParts(body + note, 'Step 3', null);
        expect(cut.mode).toBe('whole');
        // The page rides whole and its foot note does not: the note says
        // the day of the copy, which changes with every release of the
        // manual, and a local model asked at temperature 0 answered every
        // one of 27 questions differently for that day alone (2026-10-13).
        expect(cut.text).toBe(body.trim());
        expect(cut.text).not.toContain(FRESH_PAGE_NOTE_LEAD);
        expect(cut.text).not.toContain('the page goes on');
    });

    test('on a long page the foot note is never one of the parts that ride', async () => {
        const { clipKnownPageParts } = await import('./questionHelpers');
        const { FRESH_PAGE_NOTE_LEAD } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const steps = Array.from({ length: 80 }, (_one, index) => {
            return `${index + 1}. **Lead ${index + 1}.** ${'filler words here '.repeat(8)}`;
        });
        // The answer is deep in the page, and the note's address spells the
        // very word the question is about.
        steps[70] = '71. **The gizmo is behind the last panel.** Open it.';
        const note =
            `\n\n${FRESH_PAGE_NOTE_LEAD}read its newest copy with ` +
            'owa_read_website: https://example.org/w-99-the-gizmo-page.md )_';
        const page = `# A long page\n\n${steps.join('\n')}${note}`;
        const cut = clipKnownPageParts(page, null, {
            text: 'Where is the gizmo?',
            keywords: ['gizmo'],
            resources: { recipe: 'W-99' },
        } as any);
        expect(cut.mode).toBe('matching');
        expect(cut.text).toContain('The gizmo is behind the last panel');
        expect(cut.text).not.toContain('owa_read_website');
    });
});

// The page in the language the model is asked in (2026-10-17, the whole
// corpus asked in Khmer of gemma4:cloud): handed the English page and told
// to copy the part with the words "Open View on the top menu bar again and
// click", it wrote _បើក View on the top menu bar again and click_. The cut is
// chosen in English and quoted from the translation, block for block.
describe('a known page rides in the language it is asked in', () => {
    const ENGLISH_PAGE = [
        '# W-90 — Reset the panels',
        '',
        '**Goal:** put the layout back the way it started.',
        '',
        '1. Open **View** on the top menu bar → **Widgets**.',
        '2. Click a ticked one — it collapses.',
        '',
        '**Put everything back:**',
        '',
        '3. Open **View** on the top menu bar again and click **Reset Widgets Size**.',
        '4. Answer **Yes**.',
    ].join('\n');
    const KHMER_PAGE = [
        '# W-90 — កំណត់ផ្ទាំងឡើងវិញ',
        '',
        '**គោលដៅ:** ដាក់ប្លង់ត្រឡប់ដូចពេលដំបូងវិញ។',
        '',
        '1. បើក **View** នៅលើរបារម៉ឺនុយខាងលើ → **Widgets**។',
        '2. ចុចលើផ្ទាំងដែលបានធីកមួយ — វាបង្រួម។',
        '',
        '**ដាក់អ្វីៗទាំងអស់ត្រឡប់ដូចដើមវិញ:**',
        '',
        '3. បើក **View** នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត ហើយចុច **កំណត់ទំហំ Widgets ឡើងវិញ**។',
        '4. ឆ្លើយ **បាទ/ចាស**។',
    ].join('\n');

    test('a page splits into its steps and paragraphs, its foot left off', async () => {
        const { splitPageBlocks } = await import('./questionHelpers');
        const { FRESH_PAGE_NOTE_LEAD } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        expect(splitPageBlocks(ENGLISH_PAGE)).toHaveLength(7);
        expect(splitPageBlocks(KHMER_PAGE)).toHaveLength(7);
        expect(
            splitPageBlocks(`${KHMER_PAGE}\n\n${FRESH_PAGE_NOTE_LEAD} …`),
        ).toEqual(splitPageBlocks(KHMER_PAGE));
    });

    test('a cut of the English page is the same blocks of the translation', async () => {
        const { toLocalizedCut, findLocalizedPassageLead } =
            await import('./questionHelpers');
        const englishCut =
            ENGLISH_PAGE.slice(0, ENGLISH_PAGE.indexOf('1. Open')) +
            '\n…\n' +
            ENGLISH_PAGE.slice(ENGLISH_PAGE.indexOf('3. Open'));
        const local = toLocalizedCut(ENGLISH_PAGE, KHMER_PAGE, englishCut)!;
        expect(local).toContain('**គោលដៅ:**');
        expect(local).toContain('3. បើក **View** នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត');
        expect(local).toContain('\n\n…\n\n');
        expect(local).not.toContain('1. បើក');
        expect(local).not.toMatch(/[A-Za-z]{4,} (?:the|on|and) /);
        // A translation that does not line up is no translation of the cut.
        expect(
            toLocalizedCut(ENGLISH_PAGE, '# W-90\n\n1. មួយ។', englishCut),
        ).toBeNull();
        const lead = findLocalizedPassageLead(
            ENGLISH_PAGE,
            KHMER_PAGE,
            'Open View on the top menu bar again and click',
        )!;
        expect(lead.startsWith('បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត')).toBe(
            true,
        );
        expect(lead.length).toBeLessThanOrEqual(60);
        // Cut at a space, never inside a word.
        expect(
            'បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត ហើយចុច កំណត់ទំហំ Widgets ឡើងវិញ។',
        ).toContain(`${lead} `);
        expect(
            findLocalizedPassageLead(ENGLISH_PAGE, KHMER_PAGE, 'Feed a zebra'),
        ).toBeNull();
    });

    // Passes 9-10 (EC-333): the short answers left out a control the part
    // named; the check is handed the part's own controls by name.
    test('the part a question is filed with names its controls, in the window’s words', async () => {
        const { findKnownPartControls } = await import('./questionHelpers');
        // The English page as the window reads it: labels resolved into
        // Khmer, emphasis left in English.
        const page = [
            '1. Open the panel.',
            '- **ការតុបតែង** is a fold under Properties, on **every** component: **ចន្លោះខាងក្នុង** is the room around it.',
            '2. Close it.',
        ].join('\n');
        const local = [
            '1. បើកផ្ទាំង។',
            '- **ការតុបតែង** គឺជាផ្នែកបត់ **គ្រប់** សមាសធាតុ៖ **ចន្លោះខាងក្នុង**។',
            '2. បិទវា។',
        ].join('\n');
        const row = { resources: { passage: 'is a fold under Properties' } };
        expect(findKnownPartControls(row, page, local)).toEqual([
            'ការតុបតែង',
            'ចន្លោះខាងក្នុង',
        ]);
        // English: emphasis and labels look alike, so no list.
        expect(findKnownPartControls(row, page, null)).toEqual([]);
        expect(
            findKnownPartControls(
                { resources: { passage: 'not on the page' } },
                page,
                local,
            ),
        ).toEqual([]);
    });

    // Pass 7 (EC-328): W-09's foreground list was one block, so the Effects
    // passage was quoted in Khmer as the volume paragraph that opened it.
    test('a bullet starts a block of its own, and a bold lead is not one', async () => {
        const { splitPageBlocks, findLocalizedPassageLead } =
            await import('./questionHelpers');
        const english = [
            '**The volume of what is playing.** Tick Play With Sound.',
            '- **Sessions** are the row of buttons at the top.',
            '- **Effects** is a fold under Properties, with Padding.',
        ].join('\n');
        const khmer = [
            '**កម្រិតសំឡេង។** ធីក ចាក់ជាមួយសំលេង។',
            '- **វគ្គ** គឺជាជួរប៊ូតុងនៅខាងលើ។',
            '- **ការតុបតែង** គឺជាផ្នែកបត់នៅក្រោម លក្ខណសម្បត្តិ។',
        ].join('\n');
        expect(splitPageBlocks(english)).toHaveLength(3);
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'is a fold under Properties',
            ),
        ).toBe('ការតុបតែង គឺជាផ្នែកបត់នៅក្រោម លក្ខណសម្បត្តិ។');
    });

    // The whole corpus asked in Khmer of gemma4:cloud (2026-10-17, EC-317):
    // _How do I cast the virtual display to a TV from my phone?_ was pointed
    // at its step's first words -- the app's own cast button -- where the
    // passage is the step's later sentence about the phone's page.
    test('a passage inside its block is pointed at by its own sentence', async () => {
        const { findLocalizedPassageLead } = await import('./questionHelpers');
        const english = [
            '# Cast',
            '',
            '1. Click **Cast to a TV** on the card. It needs **Let other devices watch**',
            '   on. The browser page has the same button, with one more row:',
            '   - **Cast from this browser** uses the browser itself.',
            '2. Close it.',
        ].join('\n');
        const khmer = [
            '# បញ្ចាំង',
            '',
            '1. ចុច **បញ្ចាំងទៅទូរទស្សន៍** នៅលើកាត។ វាត្រូវការ **អនុញ្ញាតឲ្យមើល**',
            '   បើក។ ទំព័រកម្មវិធីរុករកមានប៊ូតុងដូចគ្នា ដែលមានជួរមួយបន្ថែមទៀត៖',
            '   - **បញ្ចាំងពីកម្មវិធីរុករកនេះ** ប្រើកម្មវិធីរុករកខ្លួនឯង។',
            '2. បិទវា។',
        ].join('\n');
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'The browser page has the same button',
            ),
        ).toBe('ទំព័រកម្មវិធីរុករកមានប៊ូតុងដូចគ្នា ដែលមានជួរមួយបន្ថែមទៀត៖');
        // At the block's start, the block's first words.
        expect(
            findLocalizedPassageLead(english, khmer, 'Click Cast to a TV'),
        ).toMatch(/^ចុច បញ្ចាំងទៅទូរទស្សន៍ នៅលើកាត។/);
        // Sentences that do not pair up are not guessed at, and the block's
        // first words are not the passage's either (2026-10-18).
        expect(
            findLocalizedPassageLead(
                english,
                khmer.replace('នៅលើកាត។ វាត្រូវការ', 'នៅលើកាត វាត្រូវការ'),
                'The browser page has the same button',
            ),
        ).toBeNull();
    });

    // The same run: _The two small arrows at the end of that line walk them
    // in order_, quoted by itself, does not say which line, and the question
    // was answered with the `/` command list.
    test('a part pointing back at the one before it is quoted with it', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const filler = (name: string) => {
            return `${name} ${'plain words about something else entirely. '.repeat(22)}`;
        };
        const page = [
            '# Ask the app for help',
            '',
            ...Array.from({ length: 8 }, (_, index) => {
                return `${index + 1}. ${filler(`Part ${index + 1}.`)}`;
            }),
            '9. Ask your question.',
            '   **One line above the box tells you something this window can do.** A 💡',
            '   and a short sentence.',
            '   **The two small arrows at the end of that line walk them in order.** **›**',
            '   goes to the next one.',
            `10. ${filler('Read the answer.')}`,
        ].join('\n');
        const hint = (passage: string) => {
            return genKnownQuestionHint(
                {
                    text: 'How do I see the other tips above the box?',
                    keywords: ['tips', 'arrows'],
                    focus: null,
                    resources: { recipe: 'W-42', passage },
                } as never,
                { pageText: page },
            )!;
        };
        const quoted = (text: string) => {
            const at = text.indexOf('quoted first and by itself:');
            return text.slice(at, text.indexOf('The guide page, put here', at));
        };
        const pointing = quoted(
            hint('The two small arrows at the end of that line walk them'),
        );
        expect(pointing).toContain('One line above the box');
        expect(pointing).toContain('The two small arrows');
        // A part that stands by itself is quoted by itself.
        expect(
            quoted(hint('One line above the box tells you something')),
        ).not.toContain('The two small arrows');
    });

    // The help window's page, asked _What commands can I type?_ on
    // gemma-4-12b: its sixth step holds paragraphs that open on a bold lead,
    // the commands among them, and the cut that rides is made of PASSAGES --
    // a paragraph's lines joined by spaces. Read by blank lines and the
    // block's first characters, the commands never rode, and the hint pointed
    // at the step's first paragraph instead.
    test('a cut of passages finds its blocks, a bold lead starts one, and it has a ceiling', async () => {
        const { toLocalizedCut, findLocalizedPassageLead, splitPageBlocks } =
            await import('./questionHelpers');
        const english = [
            '# Help',
            '',
            '1. Type a question and press **Ctrl+Enter**.',
            '   **The box takes as many lines as you need.** Plain Enter',
            '   starts a new line.',
            '   **Some things need no assistant at all — type `/`.** A',
            '   line that starts with `/` is a command.',
            '2. Close the window.',
        ].join('\n');
        const khmer = [
            '# ជំនួយ',
            '',
            '1. វាយសំណួរ ហើយចុច **Ctrl+Enter**។',
            '   **ប្រអប់នេះទទួលបានបន្ទាត់ច្រើន។** ការចុច Enter',
            '   ចាប់ផ្ដើមបន្ទាត់ថ្មី។',
            '   **រឿងខ្លះមិនត្រូវការជំនួយការសោះ — វាយ `/`។** បន្ទាត់',
            '   ដែលចាប់ផ្ដើមដោយ `/` គឺជាពាក្យបញ្ជា។',
            '2. បិទបង្អួច។',
        ].join('\n');
        expect(splitPageBlocks(english)).toHaveLength(5);
        // The passage as `toPassages` writes it: one line, no indent.
        const passageCut =
            '**Some things need no assistant at all — type `/`.** A line ' +
            'that starts with `/` is a command.';
        const local = toLocalizedCut(english, khmer, passageCut)!;
        expect(local).toContain('រឿងខ្លះមិនត្រូវការជំនួយការសោះ');
        expect(local).not.toContain('ប្រអប់នេះ');
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'Some things need no assistant at all',
            ),
        ).toBe('រឿងខ្លះមិនត្រូវការជំនួយការសោះ — វាយ `/`។ បន្ទាត់');
        // Over its ceiling the cut stops at a line and says the page goes on.
        const whole = toLocalizedCut(english, khmer, english, 60)!;
        expect(whole.length).toBeLessThan(140);
        expect(whole).toContain('the page goes on');
        // A translation whose blocks are of another kind is no translation.
        expect(
            toLocalizedCut(
                english,
                khmer.replace('2. បិទ', '- បិទ'),
                passageCut,
            ),
        ).toBeNull();
    });

    // W-34's step 8 ends on a line "Wordproject." and its step 6 has the same
    // words mid-sentence: a cut of step 6 carried step 8 in with it, and the
    // Khmer answer to "my new Bible reads in English" pasted both (2026-10-18).
    test('a short line deep in a block does not bring that block into a cut', async () => {
        const { toLocalizedCut } = await import('./questionHelpers');
        const english = [
            '# Bibles',
            '',
            '1. **Step 4 — book names**: the suggested list uses the most. ' +
                '**Find more lists online** adds lists from Bible.com and',
            '   Wordproject.',
            '2. Choose **Book name mapping**. Online lookup adds complete ' +
                'lists from Bible.com and Wordproject. Each option',
            '   shows its source.',
        ].join('\n');
        const khmer = [
            '# ព្រះគម្ពីរ',
            '',
            '1. **ជំហាន 4 — ឈ្មោះគម្ពីរ**៖ បញ្ជីដែលវាស្នើ។ ប៊ូតុង បន្ថែមបញ្ជីពី',
            '   Wordproject។',
            '2. ជ្រើសរើស **Book name mapping**។ ការស្វែងរកតាមអ៊ីនធឺណិត ' +
                'បន្ថែមបញ្ជីពេញលេញ។ ជម្រើសនីមួយៗ',
            '   បង្ហាញប្រភពរបស់វា។',
        ].join('\n');
        const local = toLocalizedCut(
            english,
            khmer,
            '2. Choose **Book name mapping**. Online lookup adds complete ' +
                'lists from Bible.com and Wordproject. Each option shows ' +
                'its source.',
        )!;
        expect(local).toContain('ជ្រើសរើស **Book name mapping**');
        expect(local).not.toContain('ជំហាន 4');
    });

    // The cut writes each passage on a line of its own, and read back as
    // passages two paragraphs riding side by side were one: W-34's "Later
    // changes … through the pencil" was quoted first as the import form's
    // step 6 and the note on where an import came from (2026-10-18). And a
    // part ending on a colon was quoted without what it introduces -- W-37's
    // link list without its example.
    test('the part quoted first is the page’s own passage, with what its colon introduces', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const filler = Array.from({ length: 90 }, (_, index) => {
            return (
                `Filler paragraph ${index} about nothing in particular, kept ` +
                'to make the page long enough to cut.'
            );
        });
        const page = [
            '# W-90 — Bibles',
            '',
            ...filler.flatMap((one) => [one, '']),
            'Every imported Bible keeps a note of the language chosen for it.',
            '',
            'A Bible already installed that still reads in English needs no',
            'second import. Later changes remain available through the',
            'pencil, on a right-click inside its editor:',
            '',
            '1. **Choose Locale**, and pick the language.',
            '2. **Edit Books Map**, then **Ok**.',
            '',
            'A closing paragraph on something else.',
        ].join('\n');
        const hint = genKnownQuestionHint(
            {
                text: 'My new Bible reads in English — how do I make it read in its own language?',
                keywords: [],
                resources: {
                    recipe: 'W-90',
                    passage:
                        'Later changes remain available through the pencil',
                },
                focus: null,
            } as any,
            { pageText: page },
        )!;
        const firstAt = hint.indexOf('quoted first and by itself:');
        const pageAt = hint.indexOf('The guide page, put here by the');
        expect(firstAt).toBeGreaterThan(0);
        const named = hint.slice(firstAt, pageAt);
        expect(named).toContain('Later changes remain available');
        expect(named).not.toContain('Every imported Bible keeps a note');
        expect(named).toContain('1. **Choose Locale**');
        expect(named).toContain('2. **Edit Books Map**, then **Ok**.');
        expect(named).not.toContain('A closing paragraph');
        // No example under the part: nothing said about copying one.
        expect(hint).not.toContain('copy the example into your answer');
    });

    // Cut at the character, the help window's command list ended mid-word and
    // the model copied it to the same syllable three passes running.
    test('a long part quoted first is cut at a line and says it goes on', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const filler = Array.from({ length: 90 }, (_, index) => {
            return (
                `Filler paragraph ${index} about nothing in particular, kept ` +
                'to make the page long enough to cut.'
            );
        });
        const commands = Array.from({ length: 40 }, (_, index) => {
            return `   /command${index} does one quick thing on this computer.`;
        });
        const page = [
            '# W-90 — Commands',
            '',
            ...filler.flatMap((one) => [one, '']),
            '**Some things need no assistant at all — type `/`.** A line',
            'that starts with `/` is a command:',
            ...commands,
        ].join('\n');
        const hint = genKnownQuestionHint(
            {
                text: 'What commands can I type instead of asking?',
                keywords: ['command'],
                resources: {
                    recipe: 'W-90',
                    passage: 'Some things need no assistant at all',
                },
                focus: null,
            } as any,
            { pageText: page },
        )!;
        const firstAt = hint.indexOf('quoted first and by itself:');
        const pageAt = hint.indexOf('The guide page, put here by the');
        const named = hint.slice(firstAt, pageAt).trimEnd();
        expect(named.endsWith('\n…')).toBe(true);
        expect(named).toMatch(/computer\.\n…$/);
    });

    // W-37's link list rode first with its example under it, and four passes
    // in a row the Khmer answer left the example out (2026-10-18).
    test('a part that ends on an example is answered with the example', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const filler = Array.from({ length: 90 }, (_, index) => {
            return (
                `Filler paragraph ${index} about nothing in particular, kept ` +
                'to make the page long enough to cut.'
            );
        });
        const page = [
            '# W-90 — Links',
            '',
            ...filler.flatMap((one) => [one, '']),
            'A json file can hold a list of links. Write it as a list of',
            'entries, each with a title and a url:',
            '',
            '```json',
            '[{ "title": "Notes", "url": "https://www.example.com/notes" }]',
            '```',
        ].join('\n');
        const hint = genKnownQuestionHint(
            {
                text: 'Can I keep web links for a chapter?',
                keywords: [],
                resources: {
                    recipe: 'W-90',
                    passage: 'can hold a list of links',
                },
                focus: null,
            } as any,
            { pageText: page },
        )!;
        expect(hint).toContain('quoted first and by itself');
        expect(hint).toContain('"url": "https://www.example.com/notes"');
        expect(hint).toContain(
            'copy the example into your answer as it stands, in a code block',
        );
    });

    test('the hint quotes the translation and points at it in its words', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        const row = {
            text: 'How do I put the layout back the way it started?',
            keywords: [],
            resources: {
                recipe: 'W-90',
                passage: 'Open View on the top menu bar again and click',
            },
            focus: null,
        } as any;
        const local = genKnownQuestionHint(row, {
            pageText: ENGLISH_PAGE,
            localPageText: KHMER_PAGE,
        })!;
        expect(local).toContain(KHMER_PAGE.slice(0, 20));
        expect(local).toContain(
            'the words "បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត',
        );
        expect(local).not.toContain('on the top menu bar');
        // Asked in English: the English page, pointed at by its English words.
        const english = genKnownQuestionHint(row, { pageText: ENGLISH_PAGE })!;
        expect(english).toContain(
            'the words "Open View on the top menu bar again and click"',
        );
        expect(english).not.toContain('បើក');
    });

    // What the cut rests on: every current translation of the manual is
    // written block for block -- as many blocks, each of the same kind
    // (`toLocalizedCut` of the whole page is null otherwise). Measured
    // 2026-10-17 with a bold lead starting a block: every page of both, where
    // blank lines and steps alone had left French W-42 a block short. A
    // translation that drifts out of line fails here; it then rides as the
    // English cut, so the way to make it pass is to fix the translation.
    test('every current translation lines up block for block', async () => {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const { toLocalizedCut } = await import('./questionHelpers');
        const {
            listEnglishManualPages,
            listManualLanguages,
            listManualTranslations,
            MANUAL_SOURCE_DIR,
        } = await import('../../tools/owa-devtools-mcp/manualI18n.mjs');
        const { toManualPageBody } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const englishPageMap = listEnglishManualPages();
        const outOfLine: string[] = [];
        for (const lang of listManualLanguages()) {
            for (const page of listManualTranslations(lang)) {
                const english = englishPageMap.get(page.id);
                if (page.isStale || english === undefined) {
                    continue;
                }
                // Read as the window reads it, its labels filled in: a bold
                // label ending in a full stop that a translation wraps to
                // the start of a line is a bold lead there, and a block
                // more (French W-50's "The router opened the port.",
                // 2026-10-18). The English key stands in for the word.
                const toResolved = (text: string) => {
                    return toManualPageBody(text).replace(
                        /\[en:tran:([^\]]+)\]/g,
                        '$1',
                    );
                };
                const englishBody = toResolved(
                    readFileSync(
                        path.join(MANUAL_SOURCE_DIR, english.relativePath),
                        'utf-8',
                    ),
                );
                const localBody = toResolved(page.content);
                if (
                    toLocalizedCut(
                        englishBody,
                        localBody,
                        englishBody,
                        Infinity,
                    ) === null
                ) {
                    outOfLine.push(`${lang}:${page.id}`);
                }
            }
        }
        expect(outOfLine).toEqual([]);
    });

    // Pass 11 (2026-10-18): Khmer W-42's report paragraph split one sentence
    // more than the English ("Report: " ends a sentence, "Report:," does
    // not), so four rows' passages were pointed at its opening sentence. A
    // passage inside its block needs the block's sentences to line up in
    // every current translation; the fix is to the translation.
    test('every row’s passage is pointed at in every current translation', async () => {
        const { readFileSync, readdirSync } = await import('node:fs');
        const path = await import('node:path');
        const { findLocalizedPassageLead } = await import('./questionHelpers');
        const {
            listEnglishManualPages,
            listManualLanguages,
            listManualTranslations,
            MANUAL_SOURCE_DIR,
        } = await import('../../tools/owa-devtools-mcp/manualI18n.mjs');
        const { toManualPageBody } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const toResolved = (text: string) => {
            return toManualPageBody(text).replace(
                /\[en:tran:([^\]]+)\]/g,
                '$1',
            );
        };
        const englishPageMap = listEnglishManualPages();
        const questionDir = path.join('tools', 'owa-devtools-mcp', 'questions');
        const rowList: { id: string; recipe: string; passage: string }[] = [];
        for (const name of readdirSync(questionDir)) {
            if (!name.endsWith('.json') || name === 'schema.json') {
                continue;
            }
            const page = JSON.parse(
                readFileSync(path.join(questionDir, name), 'utf-8'),
            );
            for (const section of page.sections ?? []) {
                for (const row of section.questions ?? []) {
                    const { recipe, passage } = row.resources ?? {};
                    if (recipe && passage) {
                        rowList.push({ id: row.id, recipe, passage });
                    }
                }
            }
        }
        expect(rowList.length).toBeGreaterThan(50);
        const unpointed: string[] = [];
        for (const lang of listManualLanguages()) {
            const translationMap = new Map(
                listManualTranslations(lang).map((page: any) => {
                    return [page.id, page];
                }),
            );
            for (const row of rowList) {
                const english = englishPageMap.get(row.recipe);
                const local: any = translationMap.get(row.recipe);
                if (english === undefined || !local || local.isStale) {
                    continue;
                }
                const englishBody = toResolved(
                    readFileSync(
                        path.join(MANUAL_SOURCE_DIR, english.relativePath),
                        'utf-8',
                    ),
                );
                const lead = findLocalizedPassageLead(
                    englishBody,
                    toResolved(local.content),
                    row.passage,
                );
                if (lead === null) {
                    unpointed.push(`${lang}:${row.id}`);
                }
            }
        }
        expect(unpointed).toEqual([]);
    });

    test('a passage in a quote is pointed at without its marks, and not at all out of line', async () => {
        const { findLocalizedPassageLead } = await import('./questionHelpers');
        const english = [
            '# Bibles',
            '',
            '> **Putting it back.** Press Reset. It asks first.',
            '>',
            '> **Deleted it by mistake?** Press Create.',
        ].join('\n');
        const khmer = [
            '# ព្រះគម្ពីរ',
            '',
            '> **ដាក់វាវិញ។** ចុច កំណត់ឡើងវិញ។ វាសួរជាមុន។',
            '>',
            '> **លុបវាដោយច្រឡំមែនទេ?** ចុច បង្កើត។',
        ].join('\n');
        expect(
            findLocalizedPassageLead(english, khmer, 'Deleted it by mistake?'),
        ).toBe('លុបវាដោយច្រឡំមែនទេ? ចុច បង្កើត។');
        // One sentence more in the translation: no words are named rather
        // than the block's first ones.
        expect(
            findLocalizedPassageLead(
                english,
                khmer.replace('វាសួរជាមុន។', 'វា: សួរជាមុន។'),
                'Deleted it by mistake?',
            ),
        ).toBeNull();
    });
});

// The follow-ups offered under an answer, and the lookups an English window
// answers before reading anything.
describe('genFollowUpQuestions', () => {
    const ASKED = 'How do I show a song on the screen?';

    it('never offers the question back, and spreads the rest over sections', async () => {
        const { genFollowUpQuestions, suggestQuestions } =
            await import('./questionHelpers');
        const rows = await suggestQuestions(ASKED, 'presenter', 8);
        const sectionMap = new Map(
            rows.map((row) => {
                return [row.text, row.section];
            }),
        );
        const followUps = await genFollowUpQuestions(ASKED, 'presenter');
        expect(followUps).toHaveLength(2);
        expect(followUps).not.toContain(ASKED);
        // Each is a question the corpus ranked for these words...
        for (const one of followUps) {
            expect(sectionMap.has(one), one).toBe(true);
        }
        // ...and two from one section are one option offered twice.
        expect(
            new Set(
                followUps.map((one) => {
                    return sectionMap.get(one);
                }),
            ).size,
        ).toBe(2);
    });

    it('fills up from the same sections once every section has one', async () => {
        const { genFollowUpQuestions, suggestQuestions } =
            await import('./questionHelpers');
        // Nearly every question about "screen" is filed in one section.
        const rows = await suggestQuestions('screen', 'presenter', 10);
        const sectionMap = new Map(
            rows.map((row) => {
                return [row.text, row.section];
            }),
        );
        const followUps = await genFollowUpQuestions('screen', 'presenter', 4);
        expect(followUps).toHaveLength(4);
        expect(new Set(followUps).size).toBe(4);
        const sectionList = followUps.map((one) => {
            return sectionMap.get(one);
        });
        // The first ones are one per section; the last comes back to one.
        const firstSections = sectionList.slice(0, -1);
        expect(new Set(firstSections).size).toBe(firstSections.length);
        expect(firstSections).toContain(sectionList.at(-1));
    });

    it('an English window has no fill-in to put into English, and no words is no row', async () => {
        const { findTemplateAsk, findKnownQuestion } =
            await import('./questionHelpers');
        expect(
            await findTemplateAsk('Where is the button for Clear All'),
        ).toBeNull();
        expect(await findKnownQuestion('?!', 'presenter')).toBeNull();
    });
});

describe('a page cut for a known question, the smaller rules', () => {
    const LONG_FILLER = 'Plain words about something else entirely. '.repeat(
        160,
    );

    it('a page that fits rides whole, through the short form too', async () => {
        const { clipKnownPage } = await import('./questionHelpers');
        expect(clipKnownPage('# A page\n\n1. Press **Go**.')).toBe(
            '# A page\n\n1. Press **Go**.',
        );
    });

    it('a control the first 6 000 characters name rides with them', async () => {
        const { clipKnownPageParts } = await import('./questionHelpers');
        const page = `# A page\n\n1. Press **Clear All**.\n\n${LONG_FILLER}`;
        expect(page.length).toBeGreaterThan(6000);
        const cut = clipKnownPageParts(page, 'Clear All');
        expect(cut.mode).toBe('head');
        expect(cut.text.startsWith(page.slice(0, 5900))).toBe(true);
        expect(cut.text).toContain('Press **Clear All**');
        expect(cut.text.length).toBeLessThan(page.length);
    });

    it('a part that comes back empty leaves the page saying it goes on', async () => {
        const { readWholePage } = await import('./questionHelpers');
        const { genPagePartNote } =
            await import('../../tools/owa-devtools-mcp/manualPage.mjs');
        const page = await readWholePage('W-42', async (_id, part) => {
            return part === 2
                ? '   '
                : `# A page\n\n1. One.${genPagePartNote(1, 2)}`;
        });
        expect(page).toContain('1. One.');
        expect(page).toContain('This page goes on: this is part 1 of 2');
    });

    it('a passage with no words to look for is found nowhere', async () => {
        const { findLocalizedPassageLead } = await import('./questionHelpers');
        expect(
            findLocalizedPassageLead('1. Press Go.', '1. ចុច ទៅ។', '  '),
        ).toBeNull();
    });

    it('a part names its controls ten at most', async () => {
        const { findKnownPartControls } = await import('./questionHelpers');
        const names = 'កខគឃងចឆជឈញដឋ'.split('');
        const page =
            '# A page\n\n1. Press **Go**, then ' +
            names
                .map((name) => {
                    return `**${name}**`;
                })
                .join(', ') +
            '.';
        const controls = findKnownPartControls(
            { resources: { find: 'Go' } } as any,
            page,
            page,
        );
        expect(controls).toEqual(names.slice(0, 10));
    });
});
