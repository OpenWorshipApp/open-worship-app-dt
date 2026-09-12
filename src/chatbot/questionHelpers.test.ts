import { describe, expect, it, test } from 'vitest';

import { BOT_FOCUS_KEYS } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';

import {
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

    test('a row with neither recipe nor tool gives no hint', async () => {
        const { genKnownQuestionHint } = await import('./questionHelpers');
        expect(genKnownQuestionHint({ resources: {} } as any)).toBeNull();
    });
});
