// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';

import {
    dropStepsAlreadyDone,
    genGuideExpression,
    stripInternalIds,
    toGuideSteps,
    toKeystroke,
} from './guide.mjs';

// The runtime is a string evaluated in the app page, so it is exercised the
// way the app gets it: evaluated, then driven through its own api.
function startGuide(payload) {
    return new Function(
        `return ${genGuideExpression(`start(${JSON.stringify(payload)})`)}`,
    )();
}

beforeEach(() => {
    delete window.__owaGuide;
    document.getElementById('owa-guide-host')?.remove();
    document.body.innerHTML = '';
    // jsdom lays nothing out, so every control would read as hidden and the
    // ranking below would never be reached.
    Element.prototype.getBoundingClientRect = function () {
        return { x: 10, y: 10, width: 40, height: 20, top: 10, left: 10 };
    };
    Element.prototype.scrollIntoView = function () {};
});

describe('toGuideSteps', () => {
    it('keeps a bold control label and drops keystrokes and stressed prose', () => {
        const steps = toGuideSteps(
            [
                '1. Click the **Bible Reader** tab.',
                '',
                '2. Press **Ctrl+B**, or **Tab** to complete.',
                '',
                '3. Switch the Bible **version** from the header dropdown.',
                '',
            ].join('\n'),
        );
        expect(steps.map((step) => step.finds)).toEqual([
            ['Bible Reader'],
            [],
            [],
        ]);
    });

    // The keystroke is dropped as a thing to RING and kept as a thing to
    // press: W-06 step 4 ("close the dialog ... or Ctrl+Q") named no control
    // at all, so "Do it" could only apologise on it.
    it('scopes a control to the panel the same step names', () => {
        // W-21 step 1, verbatim. "Background" on its own is also the word on
        // the screen preview's background-transition button, which is where
        // the ring landed before the panel was part of the question.
        const steps = toGuideSteps(
            '1. Open the **Background** (ផ្ទៃខាងក្រោយ) panel and choose the ' +
                '**Videos** (វីដេអូ) tab.\n',
        );
        expect(steps[0].finds[0]).toBe('Background > Videos');
        // The panel itself is next, so a COLLAPSED panel still gets rung --
        // that is the half of the step not done yet.
        expect(steps[0].finds).toContain('Background panel');
        expect(steps[0].finds).toContain('Background');
    });

    it('leaves a step that names no panel exactly as it was', () => {
        const steps = toGuideSteps('1. Click **Save** to keep it.\n');
        expect(steps[0].finds).toEqual(['Save']);
    });

    it('keeps a keystroke a step names, even beside a control label', () => {
        const steps = toGuideSteps(
            [
                '1. Press **Ctrl+B** (or click **Bible Lookup**).',
                '',
                '2. Close the dialog with the red X button or **Ctrl+Q**.',
                '',
                '3. Switch the Bible **version** from the header dropdown.',
                '',
            ].join('\n'),
        );
        expect(
            steps.map((step) => {
                return step.keys === null ? null : step.keys.label;
            }),
        ).toEqual(['Ctrl+B', 'Ctrl+Q', null]);
        // The control still wins where there is one -- clicking a button the
        // user can see teaches more than a shortcut they cannot.
        expect(steps[0].finds).toEqual(['Bible Lookup']);
    });
});

describe('toKeystroke', () => {
    it('reads the shortcuts the manual actually writes', () => {
        expect(toKeystroke('Ctrl+Q')).toMatchObject({
            key: 'q',
            code: 'KeyQ',
            ctrlKey: true,
            label: 'Ctrl+Q',
        });
        expect(toKeystroke('F9')).toMatchObject({ key: 'F9', code: 'F9' });
        expect(toKeystroke('Escape')).toMatchObject({ key: 'Escape' });
        expect(toKeystroke('Ctrl+Escape')).toMatchObject({
            key: 'Escape',
            ctrlKey: true,
        });
        // Shift really does deliver an uppercase key, and the app compares
        // the letter's case to decide what was pressed.
        expect(toKeystroke('Ctrl+Shift+P')).toMatchObject({
            key: 'P',
            shiftKey: true,
            ctrlKey: true,
        });
    });

    it('refuses everything that is not a keystroke', () => {
        // A lone modifier ("hold Ctrl while clicking") names no key at all.
        expect(toKeystroke('Ctrl')).toBeNull();
        expect(toKeystroke('Bible Lookup')).toBeNull();
        expect(toKeystroke('Double-click')).toBeNull();
        // A bold single letter is emphasis far more often than it is a key,
        // and pressing a stray letter into whatever has focus is worse than
        // declining to act.
        expect(toKeystroke('A')).toBeNull();
        expect(toKeystroke('')).toBeNull();
    });

    it('leaves a maintainer note out of the card', () => {
        const [step] = toGuideSteps(
            ['1. Type a reference.', '   > Note: for maintainers only.', ''].join(
                '\n',
            ),
        );
        expect(step.text).toBe('Type a reference.');
    });
});

describe('dropStepsAlreadyDone', () => {
    it('drops a step that only says to look at the app window', () => {
        const steps = [
            { text: 'Look at the app window.', finds: [] },
            { text: 'Click the book name.', finds: ['Genesis'] },
        ];
        expect(dropStepsAlreadyDone(steps, '/reader.html')).toEqual([
            steps[1],
        ]);
    });

    it('never drops the only step there is', () => {
        const steps = [{ text: 'Look at the app window.', finds: [] }];
        expect(dropStepsAlreadyDone(steps, '/reader.html')).toEqual(steps);
    });

    it('drops "go to the Bible Reader" when already in the reader', () => {
        const steps = [
            { text: 'Click the Bible Reader tab.', finds: ['Bible Reader'] },
            { text: 'Type a reference.', finds: [] },
        ];
        expect(dropStepsAlreadyDone(steps, '/reader.html')).toHaveLength(1);
        expect(dropStepsAlreadyDone(steps, '/presenter.html')).toHaveLength(2);
    });
});

describe('the guide runtime', () => {
    it('demoing a recipe that names no control becomes a walkthrough', () => {
        const status = startGuide({
            title: 'Read the Bible',
            mode: 'demo',
            steps: [
                { text: 'Type a reference.', finds: [] },
                { text: 'Switch the version.', finds: [] },
            ],
        });
        expect(status.isRunning).toBe(true);
        expect(status.canDemo).toBe(false);
        // ...and it does not keep offering a "Do it" that can only apologise.
        expect(status.isDemo).toBe(false);
    });

    it('demos a recipe whose steps are only keystrokes', () => {
        const status = startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Close the dialog with Ctrl+Q.',
                    finds: [],
                    keys: toKeystroke('Ctrl+Q'),
                },
            ],
        });
        expect(status.canDemo).toBe(true);
        expect(status.isDemo).toBe(true);
        // Nothing to ring, and still perfectly actionable -- the model must
        // be able to tell those two apart.
        expect(status.isTargetFound).toBe(false);
        expect(status.canActOnStep).toBe(true);
        expect(status.press).toBe('Ctrl+Q');
    });

    it('presses the keystroke a step names instead of apologising', async () => {
        const seen = [];
        document.addEventListener('keydown', (event) => {
            seen.push({
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
            });
        });
        startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Close the dialog with Ctrl+Q.',
                    finds: [],
                    keys: toKeystroke('Ctrl+Q'),
                },
                { text: 'Done.', finds: [] },
            ],
        });
        const status = await window.__owaGuide.act();
        expect(seen).toEqual([{ key: 'q', code: 'KeyQ', ctrlKey: true }]);
        expect(status.lastAction).toBe('demo-did-it');
        expect(status.lastResult).toMatchObject({
            done: true,
            did: 'pressed',
            keys: 'Ctrl+Q',
        });
    });

    it('advances when the user presses the key themselves', () => {
        startGuide({
            mode: 'show',
            steps: [
                {
                    text: 'Press F9 to clear.',
                    finds: [],
                    keys: toKeystroke('F9'),
                },
                { text: 'Done.', finds: [] },
            ],
        });
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'F9', bubbles: true }),
        );
        expect(window.__owaGuide.status().stepNumber).toBe(2);
    });

    it('does not count its own press as the user doing the step', async () => {
        startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Press F9 to clear.',
                    finds: [],
                    keys: toKeystroke('F9'),
                },
                { text: 'Then this.', finds: [] },
                { text: 'Done.', finds: [] },
            ],
        });
        await window.__owaGuide.act();
        // Exactly one step forward, once the card has shown what it did --
        // not two, which is what watching for the key and pressing it would
        // otherwise add up to.
        expect(window.__owaGuide.status().stepNumber).toBe(1);
        await new Promise((resolve) => {
            return setTimeout(resolve, 900);
        });
        expect(window.__owaGuide.status().stepNumber).toBe(2);
    });

    it('still demos a recipe where a step names a control', () => {
        document.body.innerHTML = '<button>Bible Reader</button>';
        const status = startGuide({
            mode: 'demo',
            steps: [{ text: 'Click it.', finds: ['Bible Reader'] }],
        });
        expect(status.canDemo).toBe(true);
        expect(status.isDemo).toBe(true);
    });

    it('beats the ring while it waits on the user, holds still to act', () => {
        document.body.innerHTML = '<button>Bible Reader</button>';
        const ringOf = () => {
            return document.getElementById('owa-guide-host').shadowRoot
                .querySelector('.ring').dataset.waiting;
        };
        startGuide({
            mode: 'show',
            steps: [{ text: 'Click it.', finds: ['Bible Reader'] }],
        });
        expect(ringOf()).toBe('yes');
        delete window.__owaGuide;
        document.getElementById('owa-guide-host').remove();
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'Click it.', finds: ['Bible Reader'] },
                { text: 'Done.', finds: [] },
            ],
        });
        expect(ringOf()).toBe('no');
    });

    it('refuses a match that only mentions the word in passing', () => {
        // The Resources panel listing a "khmer-study-bible-pdf" folder is
        // not the Bible Reader tab, and a row of PDF notes is not "Book".
        document.body.innerHTML = [
            '<button title="...\khmer-study-bible-pdf\data-s3">',
            'GEN.0.pdf Introduction</button>',
        ].join('');
        const status = startGuide({
            mode: 'show',
            steps: [{ text: 'Click Book at the top.', finds: ['Book'] }],
        });
        expect(status.isTargetFound).toBe(false);
        expect(status.find).toBe('Book');
    });

    it('reports the label it used and that the control was found', () => {
        document.body.innerHTML = '<button>KJV</button>';
        const status = startGuide({
            mode: 'show',
            steps: [{ text: 'Click the version.', finds: ['KJV'] }],
        });
        expect(status.isTargetFound).toBe(true);
        expect(status.find).toBe('KJV');
    });

    it('acts on the control itself, not the row that contains its text', async () => {
        // The reader header: a Bible history row whose text starts with the
        // version key, and the version button beside it.
        document.body.innerHTML = [
            '<button id="row">(KJV) Genesis 1:1-31 Double click to put back',
            '</button><button id="key">KJV</button>',
        ].join('');
        const clicked = [];
        for (const id of ['row', 'key']) {
            document.getElementById(id).addEventListener('click', () => {
                clicked.push(id);
            });
        }
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'Switch the version.', finds: ['KJV'] },
                { text: 'Done.', finds: [] },
            ],
        });
        // act() is async: a step whose control is not yet on screen asks
        // again for a moment before declaring nothing to act on.
        const result = await window.__owaGuide.act();
        expect(result.lastResult.done).toBe(true);
        expect(clicked).toEqual(['key']);
    });
});

// The card runs inside a presenter driving a projector on old hardware, so
// what it costs while nothing is happening matters as much as what it does.
describe('what the guide costs while it sits there', () => {
    function countTimers(run) {
        const realSetInterval = globalThis.setInterval;
        const realClearInterval = globalThis.clearInterval;
        let live = 0;
        globalThis.setInterval = (...args) => {
            live += 1;
            return realSetInterval(...args);
        };
        globalThis.clearInterval = (...args) => {
            live -= 1;
            return realClearInterval(...args);
        };
        try {
            run();
        } finally {
            globalThis.setInterval = realSetInterval;
            globalThis.clearInterval = realClearInterval;
        }
        return live;
    }

    // Merely ASKING where a guide is used to install a 700ms timer for the
    // life of the page -- and it was never cleared, so a window that had once
    // been asked anything kept waking up for the rest of the service.
    it('installs no timer just for being asked a question', () => {
        const live = countTimers(() => {
            new Function(
                `return ${genGuideExpression('status()')}`,
            )();
        });

        expect(live).toBe(0);
    });

    it('runs one timer while a guide is up, and none once it stops', () => {
        document.body.innerHTML = '<button>Bible Reader</button>';
        let live = 0;

        live = countTimers(() => {
            startGuide({
                mode: 'show',
                steps: [{ text: 'Click it.', finds: ['Bible Reader'] }],
            });
        });
        expect(live).toBe(1);

        live += countTimers(() => {
            window.__owaGuide.stop('closed-by-user');
        });
        expect(live).toBe(0);
    });

    // The ring is kept on its control by a repeating render. Scrolling from
    // there fights the user for the scrollbar: look away from the ringed
    // control and it drags the panel straight back under you.
    it('scrolls to a control once per step, not on every redraw', () => {
        document.body.innerHTML = '<button>Bible Reader</button>';
        let scrollCount = 0;
        Element.prototype.scrollIntoView = function () {
            scrollCount += 1;
        };

        startGuide({
            mode: 'show',
            steps: [
                { text: 'Click it.', finds: ['Bible Reader'] },
                { text: 'And again.', finds: ['Bible Reader'] },
            ],
        });
        expect(scrollCount).toBe(1);

        // A redraw of the SAME step -- what the ring-keeping tick does.
        window.__owaGuide.status();
        window.dispatchEvent(new Event('resize'));
        expect(scrollCount).toBe(1);

        // Moving on is a new step, and that one does scroll.
        window.__owaGuide.next();
        expect(scrollCount).toBe(2);
    });
});

describe('stripping internal ids out of what the card shows', () => {
    it('takes out the aside a manual id was cited in', () => {
        // Verbatim from a card a volunteer was shown.
        expect(
            stripInternalIds(
                'Open the Background panel (W-08 step 1) and choose the ' +
                    'Videos tab.',
            ),
        ).toBe('Open the Background panel and choose the Videos tab.');
    });

    it('takes out a recipe citing a sibling recipe', () => {
        expect(
            stripInternalIds('Click Add URL (opens the Web Editor, W-15).'),
        ).toBe('Click Add URL.');
    });

    it('leaves an aside that carries no id alone', () => {
        const text = 'Press Ctrl+Q to close it (or click the red X).';
        expect(stripInternalIds(text)).toBe(text);
    });

    it('leaves the words on real controls alone', () => {
        const text = 'Set the ratio to 16:9, then press F7.';
        expect(stripInternalIds(text)).toBe(text);
    });
});

describe('what a step offers as a control to ring', () => {
    it('splits a row of tabs written as one bold, keeping the whole first', () => {
        // W-08 step 2, verbatim. Before this the only candidates were the
        // slash-joined phrase and "Ok"/"Cancel" -- and "Ok" was found inside
        // "lo-ok-up", so the step rang the Bible Lookup button.
        const [step] = toGuideSteps(
            '1. Pick a tab: **Colors / Images / Videos / Cameras / Web**.\n',
        );
        expect(step.finds[0]).toBe('Colors / Images / Videos / Cameras / Web');
        expect(step.finds).toContain('Colors');
        expect(step.finds).toContain('Web');
    });

    it('drops the punctuation the sentence needed but the button lacks', () => {
        const [step] = toGuideSteps('1. Choose **Colors:** then a swatch.\n');
        expect(step.finds).toContain('Colors');
    });

    it('offers each candidate once', () => {
        const [step] = toGuideSteps(
            '1. Press **Videos** on the **Videos** tab.\n',
        );
        expect(step.finds).toEqual(['Videos']);
    });
});

describe('a step whose control lives in a right-click menu', () => {
    it('is a right-click step only when the sentence STARTS with one', () => {
        const steps = toGuideSteps(
            [
                '1. **Right-click an empty part of the list** and choose',
                '   **Download From URL**.',
                '',
                '2. Pick a tab: **Colors** (or right-click the empty list to',
                '   use **Add URL**).',
                '',
            ].join('\n'),
        );
        // W-21 step 2: the right-click IS the action.
        expect(steps[0].action).toBe('rightClick');
        expect(steps[0].finds).toEqual(['Download From URL']);
        // W-08 step 2: the right-click is an aside; the action is a click on
        // a tab that is already on screen.
        expect(steps[1].action).toBeUndefined();
        expect(steps[1].finds).toContain('Colors');
    });

    it('offers the demo even though it rings nothing yet', () => {
        // The reported failure: "I could not do that one for you (nothing on
        // screen to act on)" on a step whose item is one right-click away.
        const guide = startGuide({
            title: 'Add a background video from a link',
            mode: 'demo',
            steps: [
                {
                    text: 'Right-click an empty part of the list and choose'
                        + ' Download From URL.',
                    find: 'Download From URL',
                    action: 'rightClick',
                },
            ],
        });
        expect(guide.canDemo).toBe(true);
        expect(guide.isTargetFound).toBe(false);
        expect(guide.canActOnStep).toBe(true);
    });

    it('opens the menu on the first press and does not move on', async () => {
        // A list with something behind a right-click, the way the app does
        // it: the menu item does not exist until the contextmenu fires.
        document.body.innerHTML = '<div id="list"></div>';
        const list = document.getElementById('list');
        Object.defineProperty(list, 'scrollHeight', { value: 900 });
        Object.defineProperty(list, 'clientHeight', { value: 300 });
        list.getBoundingClientRect = () => {
            return { x: 0, y: 0, width: 600, height: 300, top: 0, left: 0 };
        };
        document.elementFromPoint = () => list;
        list.addEventListener('contextmenu', () => {
            const item = document.createElement('button');
            item.id = 'item';
            item.textContent = 'Download From URL';
            document.body.append(item);
        });

        const guide = startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Right-click the list and choose Download From URL.',
                    find: 'Download From URL',
                    action: 'rightClick',
                },
                { text: 'Paste the link.', find: 'Video URL' },
            ],
        });
        expect(guide.stepNumber).toBe(1);

        const after = await window.__owaGuide.act();
        expect(after.lastResult.did).toBe('right-clicked');
        // The item it brought up is named back, and the card STAYS on the
        // step: the second press is what chooses it.
        expect(after.lastResult.more).toBe('Download From URL');
        expect(after.stepNumber).toBe(1);
        expect(document.getElementById('item')).not.toBe(null);

        const done = await window.__owaGuide.act();
        expect(done.lastResult.did).toBe('clicked');
        expect(done.lastResult.more).toBeUndefined();
    });
});
