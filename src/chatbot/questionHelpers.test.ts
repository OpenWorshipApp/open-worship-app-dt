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
});
