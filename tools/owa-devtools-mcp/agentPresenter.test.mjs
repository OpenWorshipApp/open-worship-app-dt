import { describe, expect, it } from 'vitest';

import {
    describeRunSheet,
    describeSelectedDocument,
    foldPresenterState,
    genPresenterStateExpression,
} from './agentPresenter.mjs';

describe('genPresenterStateExpression', () => {
    const expression = genPresenterStateExpression();

    it('asks the app through the relay and answers on its second event', () => {
        expect(expression).toContain("'owa-agent-presenter'");
        expect(expression).toContain("'owa-agent-presenter-answer'");
    });

    it('is one self-contained expression with no import in it', () => {
        expect(expression).not.toMatch(/\bimport\(/);
        expect(expression).not.toMatch(/\brequire\(/);
        expect(expression.trim().startsWith('(() => {')).toBe(true);
        expect(expression.trim().endsWith('})()')).toBe(true);
    });

    it('answers a reason rather than nothing when the window stays silent', () => {
        expect(expression).toContain('did not answer in time');
    });
});

const SELECTED = {
    name: 'Amazing Grace',
    kind: 'song',
    slideCount: 7,
    slides: [],
    onScreen: {
        n: 4,
        name: '(1)-Verse 1',
        find: 'Slide 4: (1)-Verse 1',
        text: 'Amazing grace how sweet the sound',
        onScreens: [0],
    },
    next: {
        n: 5,
        name: '(2)-Verse 2',
        find: 'Slide 5: (2)-Verse 2',
        text: "'Twas grace that taught my heart to fear and grace my fears relieved",
    },
    previous: { n: 3, name: 'None', find: 'Slide 3: None', text: null },
};

describe('foldPresenterState', () => {
    it('folds the selected document into the window state', () => {
        const folded = foldPresenterState(
            { page: 'presenter.html' },
            { isAuthoritative: true, selectedDocument: SELECTED },
        );
        expect(folded.selectedDocument).toBe(SELECTED);
        expect(folded.note).toBeUndefined();
        expect(folded.page).toBe('presenter.html');
    });

    it('says nothing is selected as null, never as a missing key', () => {
        const folded = foldPresenterState(
            { page: 'presenter.html' },
            { isAuthoritative: true, selectedDocument: null },
        );
        expect('selectedDocument' in folded).toBe(true);
        expect(folded.selectedDocument).toBeNull();
    });

    it('is a note off the presenter page, and a note with the reason on a failure', () => {
        expect(
            foldPresenterState({ page: 'reader.html' }, { isAuthoritative: false })
                .note,
        ).toContain('Presenter page');
        const failed = foldPresenterState(
            { page: 'presenter.html' },
            { isError: true, reason: 'the window did not answer in time' },
        );
        expect(failed.note).toContain('did not answer in time');
        expect(failed.selectedDocument).toBeUndefined();
        expect(foldPresenterState({}, null).note).toContain('could not be read');
    });
});

describe('describeSelectedDocument', () => {
    it('says the song, the slide up and the one after it, with their first words', () => {
        const said = describeSelectedDocument(SELECTED);
        expect(said).toContain('The song "Amazing Grace" is selected (7 slides).');
        expect(said).toContain('Its slide 4 "(1)-Verse 1" -- "Amazing grace how sweet the sound" is on screen 0.');
        expect(said).toContain('Next is slide 5 "(2)-Verse 2" -- "\'Twas grace that taught my heart to fear and grace…".');
    });

    it('says when none of it is up yet', () => {
        const said = describeSelectedDocument({
            ...SELECTED,
            kind: 'PDF',
            slideCount: 1,
            onScreen: null,
            next: { n: 1, name: '', find: 'Slide 1', text: null },
        });
        expect(said).toContain('The PDF "Amazing Grace" is selected (1 slide).');
        expect(said).toContain('None of its slides is on a screen yet.');
        expect(said).toContain('Next is slide 1.');
    });

    it('says when nothing is selected', () => {
        expect(describeSelectedDocument(null)).toBe(
            'Nothing is selected in the Documents list.',
        );
    });
});

// The run sheet (EC-132): what the offline bot and `/run` say, and that the
// field rides the fold beside the selection rather than going missing.
describe('describeRunSheet', () => {
    const SHEET = {
        name: 'Sunday',
        lineCount: 5,
        lines: [],
        cursor: {
            n: 2,
            title: 'Amazing Grace',
            kind: 'song',
            slide: { n: 3, name: 'Verse 3', isLast: true },
        },
        next: { n: 3, title: 'John 3:16', kind: 'Bible passage' },
    };

    it('says which sheet is open, where the run is and what comes next', () => {
        const said = describeRunSheet({ openSheets: [SHEET] });
        expect(said).toContain('The run sheet "Sunday" is open (5 lines).');
        expect(said).toContain(
            'The run is on line 2 "Amazing Grace" (song), slide 3 "Verse 3" -- its last slide.',
        );
        expect(said).toContain('Next is line 3 "John 3:16" (Bible passage).');
    });

    it('says when nothing has been pressed yet, and when the sheet has ended', () => {
        expect(
            describeRunSheet({ openSheets: [{ ...SHEET, cursor: null }] }),
        ).toContain('Nothing in it has been put up yet.');
        expect(
            describeRunSheet({
                openSheets: [{ ...SHEET, next: null, isAtEnd: true }],
            }),
        ).toContain('That is the end of the sheet.');
    });

    it('with no player open it names the sheets there are to open', () => {
        const said = describeRunSheet({
            openSheets: [],
            availableSheets: ['Sunday', 'Youth night'],
        });
        expect(said).toContain('No run sheet is open in its run player');
        expect(said).toContain('"Sunday", "Youth night"');
        expect(describeRunSheet({ openSheets: [], availableSheets: [] })).toContain(
            'lists none',
        );
        expect(describeRunSheet(null)).toContain('could not be read');
    });

    it('rides the fold beside the selection, null rather than absent', () => {
        const folded = foldPresenterState(
            { page: 'presenter.html' },
            { isAuthoritative: true, selectedDocument: null, runSheet: { openSheets: [SHEET] } },
        );
        expect(folded.runSheet.openSheets[0].name).toBe('Sunday');
        const bare = foldPresenterState(
            { page: 'presenter.html' },
            { isAuthoritative: true, selectedDocument: null },
        );
        expect(bare).toHaveProperty('runSheet', null);
    });
});
