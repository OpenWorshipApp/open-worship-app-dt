import { beforeEach, describe, expect, test } from 'vitest';

import {
    PROGRESS_SHOWN_MAX,
    clearProgressSteps,
    describeToolStep,
    genProgressReporter,
    getProgressState,
    pushProgressStep,
    subscribeProgress,
    type BotProgressType,
} from './progressHelpers';

beforeEach(() => {
    clearProgressSteps();
});

describe('describeToolStep', () => {
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
        expect(describeToolStep('owa_click', { label: 'Clear Bible' })).toBe(
            'Pressing “Clear Bible”',
        );
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
    });
});

describe('the progress store', () => {
    test('a finishing step replaces its own start rather than following it', () => {
        const report = genProgressReporter(pushProgressStep);
        const finish = report('Reading the guide');
        expect(getProgressState().steps).toHaveLength(1);
        expect(getProgressState().steps[0].isDone).toBe(false);
        finish();
        expect(getProgressState().steps).toHaveLength(1);
        expect(getProgressState().steps[0].isDone).toBe(true);
    });

    test('two reporters in one question do not land on top of each other', () => {
        // The connect step and the provider loop's first round each come from
        // their own reporter. Per-reporter counters would both start at zero
        // and the second would overwrite the first.
        const first = genProgressReporter(pushProgressStep);
        const second = genProgressReporter(pushProgressStep);
        first('Connecting to the app');
        second('Thinking about it');
        const texts = getProgressState().steps.map((step) => {
            return step.text;
        });
        expect(texts).toEqual(['Connecting to the app', 'Thinking about it']);
    });

    test('older steps are counted, not dropped in silence', () => {
        const report = genProgressReporter(pushProgressStep);
        const extra = 3;
        for (let index = 0; index < PROGRESS_SHOWN_MAX + extra; index++) {
            report(`Step ${index}`)();
        }
        const state = getProgressState();
        expect(state.steps).toHaveLength(PROGRESS_SHOWN_MAX);
        expect(state.droppedCount).toBe(extra);
        // The ones kept are the LAST ones: what is happening now is the point.
        expect(state.steps[state.steps.length - 1].text).toBe(
            `Step ${PROGRESS_SHOWN_MAX + extra - 1}`,
        );
    });

    test('subscribers are told, and stop being told once they leave', () => {
        const seen: BotProgressType[][] = [];
        const unsubscribe = subscribeProgress((next) => {
            seen.push(next.steps);
        });
        const report = genProgressReporter(pushProgressStep);
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
        clearProgressSteps();
        expect(count).toBe(0);
        unsubscribe();
    });

    test('a reporter with no callback is a no-op, not a crash', () => {
        // `onProgress` is optional: the guide rescue asks without one.
        const report = genProgressReporter(undefined);
        expect(() => {
            report('Thinking about it')();
        }).not.toThrow();
        expect(getProgressState().steps).toHaveLength(0);
    });
});
