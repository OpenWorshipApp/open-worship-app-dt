// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';

import {
    detectRecipeWindow,
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
    // jsdom has no checkVisibility; Electron 43 does, and the matcher
    // asks it whether a control is painted. Answered here the long way --
    // the ancestor walk it replaces in the browser for being 28x slower.
    Element.prototype.checkVisibility = function (options = {}) {
        let node = this;
        while (node !== null && node.nodeType === 1) {
            const style = getComputedStyle(node);
            if (style.display === 'none') {
                return false;
            }
            if (
                (options.checkVisibilityCSS && style.visibility === 'hidden') ||
                (options.opacityProperty && style.opacity === '0')
            ) {
                return false;
            }
            node = node.parentElement;
        }
        return true;
    };
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

    // Seen live the moment the chatbot started OPENING the window a
    // walkthrough needs: Settings comes up, and step 1 of 4 says to click the
    // gear that opens Settings -- a control that is not in this window, for a
    // thing already done. The rule had been written for the reader and the
    // presenter alone while the app has eight windows.
    it('drops the opening step in a window of its own too', () => {
        const steps = [
            {
                text:
                    'Click the gear (Settings) in the header - Settings ' +
                    'opens in its own window.',
                finds: ['Setting'],
            },
            { text: 'Choose the General tab.', finds: ['General'] },
        ];
        expect(dropStepsAlreadyDone(steps, '/setting.html?uuid=setting')).toEqual([
            steps[1],
        ]);
        // Asked from anywhere else, it is still the first thing to do.
        expect(dropStepsAlreadyDone(steps, '/presenter.html')).toHaveLength(2);
    });

    // W-31 step 1 (2026-09-09): "Open View on the top menu bar → Widgets. You
    // get one tick-box per panel ... e.g. on the presenter: App Presenter
    // Left ..." -- the window named in an EXAMPLE two sentences on, and the
    // whole step gone in the Presenter, so the card opened on "Click a
    // ticked one" with nothing said about what to tick.
    it('reads only the first sentence for where a step is going', () => {
        const steps = [
            {
                text:
                    'Open View on the top menu bar → Widgets. You get one ' +
                    'tick-box per panel, e.g. on the presenter: Presenter, ' +
                    'Document List.',
                finds: ['View', 'Widgets'],
            },
            { text: 'Click a ticked one.', finds: [] },
        ];
        expect(dropStepsAlreadyDone(steps, '/presenter.html')).toHaveLength(2);
        // Named up front, it is still the step already done.
        expect(
            dropStepsAlreadyDone(
                [
                    { text: 'Click the Presenter tab. Then wait.', finds: [] },
                    steps[1],
                ],
                '/presenter.html',
            ),
        ).toHaveLength(1);
    });

    it('knows the Document Editor by the words on its tab', () => {
        const steps = [
            { text: 'Open the Slide Editor.', finds: ['Slide Editor'] },
            { text: 'Click Add New Slide.', finds: ['Add New Slide'] },
        ];
        // The tab reads "Slide Editor"; the window is called the Document
        // Editor. A recipe may say either, so both have to count.
        expect(
            dropStepsAlreadyDone(steps, '/appDocumentEditor.html'),
        ).toHaveLength(1);
        expect(
            dropStepsAlreadyDone(
                [{ text: 'Open the Document Editor.', finds: [] }, steps[1]],
                '/appDocumentEditor.html',
            ),
        ).toHaveLength(1);
    });

    it('leaves a step alone in a window nothing declares', () => {
        const steps = [
            { text: 'Click the Bible Reader tab.', finds: ['Bible Reader'] },
            { text: 'Type a reference.', finds: [] },
        ];
        expect(dropStepsAlreadyDone(steps, '/nothing-like-it.html')).toEqual(
            steps,
        );
    });
});

// Reported with a screenshot: the Settings recipe, its card drawn in the
// Presenter, and a red ring around a Bible version button. Step 2 of that
// recipe names nine bold words; none is a control of the Presenter except
// "English" -- out of "Language: click English" -- which is an exact word of
// the button labelled "KJV English KJV". Three rows matched it equally well
// and the first was rung. No matcher could have saved that: the card was in
// the wrong window, and the recipe's own first step says which one it means.
describe('detectRecipeWindow', () => {
    it('reads the window out of the step that gets you there', () => {
        expect(
            detectRecipeWindow([
                {
                    text:
                        'Click the gear (Settings) in the header - Settings ' +
                        'opens in its own window.',
                },
                { text: 'General tab: Language, Theme, Font family.' },
            ]),
        ).toBe('setting.html');
    });

    it('knows the Document Editor by the words on its tab', () => {
        expect(
            detectRecipeWindow([
                { text: 'Open the Slide Editor.' },
                { text: 'Click Add New Slide.' },
            ]),
        ).toBe('appDocumentEditor.html');
    });

    // Silent unless it is sure, in both directions. A recipe that names
    // several windows genuinely works in several of them -- the annotation
    // overlay and this assistant open from all eight -- and one that names
    // none is the common case. Both keep the page the caller asked for.
    it('says nothing when a step names more than one window', () => {
        expect(
            detectRecipeWindow([
                {
                    text:
                        'Open the Tools menu in the Presenter, the Bible ' +
                        'Reader or Settings and choose Start Controlling.',
                },
            ]),
        ).toBeNull();
    });

    it('says nothing when no window is named', () => {
        expect(
            detectRecipeWindow([{ text: 'Select a slide and double-click.' }]),
        ).toBeNull();
    });

    // The recipe has to be TELLING you to go there. A step that merely
    // mentions a window is describing it.
    it('says nothing when the first step is not a go-there step', () => {
        expect(
            detectRecipeWindow([
                { text: 'The Settings window shows four tabs.' },
            ]),
        ).toBeNull();
    });

    it('says nothing about no steps at all', () => {
        expect(detectRecipeWindow([])).toBeNull();
        expect(detectRecipeWindow(undefined)).toBeNull();
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

// The divider between two panes (reported 2026-09-09 with a screenshot of
// its menu open beside a walkthrough of the View-menu recipe): the app now
// names every one, so a step about its right-click menu finds the divider
// itself by name and never reaches the list-region search -- and a left
// click on a divider does nothing, so the press has to be a right-click.
describe('a step whose control is a divider', () => {
    it('right-clicks the named divider and names the item it brought up', async () => {
        document.body.innerHTML =
            '<div id="left" data-widget-name="Document List"></div>' +
            '<div id="divider" role="separator"' +
            ' aria-label="Divider between Document List and Presenting Flow List"' +
            '></div>' +
            '<div id="right" data-widget-name="Presenting Flow List"></div>';
        const divider = document.getElementById('divider');
        divider.getBoundingClientRect = () => {
            return { x: 300, y: 0, width: 6, height: 600, top: 0, left: 300 };
        };
        document.elementFromPoint = () => divider;
        const seen = [];
        divider.addEventListener('click', () => {
            seen.push('click');
        });
        divider.addEventListener('contextmenu', (event) => {
            seen.push({ x: event.clientX, y: event.clientY });
            const item = document.createElement('button');
            item.id = 'item';
            item.textContent = 'Close First Widget';
            document.body.append(item);
        });

        const guide = startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Right-click the divider between Document List and' +
                        ' Presenting Flow List and choose Close First Widget.',
                    finds: [
                        'divider between Document List and Presenting Flow List',
                        'Close First Widget',
                    ],
                    action: 'rightClick',
                },
                { text: 'Click the strip.', find: 'Document List' },
            ],
        });
        expect(guide.isTargetFound).toBe(true);

        const after = await window.__owaGuide.act();
        expect(after.lastResult.did).toBe('right-clicked');
        // On the divider's own centre -- a thin thing has no "20 in from
        // the edge" that is still inside it -- and never a left click.
        expect(seen).toEqual([{ x: 303, y: 300 }]);
        expect(after.lastResult.more).toBe('Close First Widget');
        expect(after.stepNumber).toBe(1);

        const done = await window.__owaGuide.act();
        expect(done.lastResult.did).toBe('clicked');
        expect(done.lastResult.label).toBe('Close First Widget');
    });

    it('does not right-click some list when the divider is not there', async () => {
        // One panel collapsed: no divider, only its strip and a list the
        // region fallback would otherwise open a menu on.
        document.body.innerHTML =
            '<div id="strip" role="button" data-widget-name="Document List"' +
            ' title="Enable Document List">Document List</div>' +
            '<div id="list"></div>';
        const list = document.getElementById('list');
        Object.defineProperty(list, 'scrollHeight', { value: 900 });
        Object.defineProperty(list, 'clientHeight', { value: 300 });
        list.getBoundingClientRect = () => {
            return { x: 0, y: 0, width: 600, height: 300, top: 0, left: 0 };
        };
        document.elementFromPoint = () => list;
        let menus = 0;
        list.addEventListener('contextmenu', () => {
            menus += 1;
        });
        startGuide({
            mode: 'demo',
            steps: [
                {
                    text: 'Right-click the divider between Document List and' +
                        ' Presenting Flow List and choose Reset Size.',
                    finds: [
                        'divider between Document List and Presenting Flow List',
                        'Reset Size',
                    ],
                    action: 'rightClick',
                },
            ],
        });
        const after = await window.__owaGuide.act();
        expect(after.lastResult.done).toBe(false);
        expect(after.lastResult.reason).toBe('nothing on screen to act on');
        expect(menus).toBe(0);
    });
});

// A step the card cannot press used to be the end of the walkthrough. It now
// goes back to the assistant that wrote it -- which can look at the real
// window -- and draws what comes back on the card itself.
describe('a stuck step asks the assistant', () => {
    const hintOf = () => {
        return document
            .getElementById('owa-guide-host')
            .shadowRoot.querySelector('.hint').textContent;
    };
    const startStuck = () => {
        return startGuide({
            title: 'Look up and present a Bible verse',
            mode: 'demo',
            steps: [
                {
                    text: 'The verse renders in the preview panel.'
                        + ' Double-click it to present.',
                },
                { text: 'Press the clear button.', find: 'Clear' },
            ],
        });
    };

    it('fires the request with the step and what it looked for', async () => {
        const asked = [];
        document.addEventListener('owa-guide-help', (event) => {
            asked.push(event.detail);
        });
        // A control the step does NOT name, so there is a near miss to report.
        document.body.innerHTML = '<button>Preview</button>';
        startStuck();
        const after = await window.__owaGuide.act();

        expect(after.lastResult.done).toBe(false);
        expect(asked).toHaveLength(1);
        expect(asked[0].stepNumber).toBe(1);
        expect(asked[0].stepCount).toBe(2);
        expect(asked[0].stepText).toContain('Double-click');
        expect(asked[0].reason).toBe('nothing on screen to act on');
        expect(asked[0].looked).toEqual([]);
        // The card says what it is doing rather than apologising, and says so
        // in the status a tool call reads back.
        expect(hintOf()).toContain('asking the assistant');
        expect(after.help.status).toBe('asking');
    });

    it('draws the answer on the card, with ids stripped out of it', async () => {
        startStuck();
        const after = await window.__owaGuide.act();
        document.dispatchEvent(
            new CustomEvent('owa-guide-help-answer', {
                detail: {
                    token: after.help === null ? 0 : 1,
                    text: 'Double-click the verse in the preview panel on the'
                        + ' left (W-06 step 3) — I cannot double-click for you.',
                },
            }),
        );
        expect(hintOf()).toContain('Double-click the verse');
        // The rule that a volunteer is never shown an id holds whichever road
        // the sentence arrived by.
        expect(hintOf()).not.toContain('W-06');
        expect(window.__owaGuide.status().help.status).toBe('answered');
    });

    it('falls back to the plain apology when nobody can answer', async () => {
        startStuck();
        await window.__owaGuide.act();
        // What the main process sends when there is no chat window open.
        document.dispatchEvent(
            new CustomEvent('owa-guide-help-answer', {
                detail: { token: 1, text: '' },
            }),
        );
        expect(hintOf()).toContain('I could not do that one for you');
        expect(window.__owaGuide.status().help.status).toBe('unavailable');
    });

    it('ignores an answer to a question the card has moved on from', async () => {
        startStuck();
        await window.__owaGuide.act();
        document.dispatchEvent(
            new CustomEvent('owa-guide-help-answer', {
                detail: { token: 99, text: 'from some older card' },
            }),
        );
        expect(hintOf()).not.toContain('older card');
        expect(window.__owaGuide.status().help.status).toBe('asking');
    });

    it('asks once per step, not once per press', async () => {
        const asked = [];
        document.addEventListener('owa-guide-help', (event) => {
            asked.push(event.detail);
        });
        startStuck();
        await window.__owaGuide.act();
        await window.__owaGuide.act();
        expect(asked).toHaveLength(1);
    });

    it('drops the rescue when the guide is restarted', async () => {
        startStuck();
        await window.__owaGuide.act();
        expect(window.__owaGuide.status().help.status).toBe('asking');
        // The assistant's own answer to a stuck step is often a corrected
        // guide, and the card it puts up owes nothing to the one it replaced.
        const restarted = window.__owaGuide.start({
            title: 'Look up and present a Bible verse',
            mode: 'demo',
            steps: [{ text: 'Press the clear button.', find: 'Clear' }],
        });
        expect(restarted.help).toBe(null);
    });
});

// Reported with a screenshot (2026-09-08): the Bible Lookup popup open over
// the presenter, the card at "pick a tab", the ring drawn THROUGH the popup
// on a line of Genesis, and Do it clicking a tab nobody could see. A control
// is reachable only when it is what the window paints at its own centre.
describe('a control behind a popup', () => {
    function mockHitTest(topId) {
        // jsdom has no hit-testing: whatever is named here is what the
        // window paints on top, everywhere.
        document.elementsFromPoint = () => {
            const top = document.getElementById(topId);
            return top === null ? [] : [top];
        };
    }

    function layoutPopupOverTab() {
        document.body.innerHTML = [
            '<div id="panel"><button id="images">Images</button></div>',
            '<div id="modal-container"><div id="lookup">',
            '<div><button class="btn btn-danger" id="close" aria-label="Close">',
            '<i class="bi bi-x-lg"></i></button></div>',
            '<p id="verse">In the beginning</p>',
            '</div></div>',
        ].join('');
        document.getElementById('close').addEventListener('click', () => {
            document.getElementById('modal-container').remove();
        });
    }

    it('rings the way out of the popup and does not count that click as the step', () => {
        layoutPopupOverTab();
        mockHitTest('verse');
        const guide = startGuide({
            mode: 'show',
            steps: [
                { text: 'Pick the Images tab.', finds: ['Images'] },
                { text: 'Done.', finds: [] },
            ],
        });
        expect(guide.isTargetFound).toBe(true);
        expect(guide.behind).toBe('the popup that is open');
        const host = document.getElementById('owa-guide-host');
        const hint = host.shadowRoot.querySelector('.hint, [class*=hint]');
        expect(hint.textContent).toContain('behind the popup that is open');
        expect(hint.textContent).toContain('ringed');
        // The user closes it: the guide stays on the same step.
        document.getElementById('close').click();
        expect(window.__owaGuide.status().stepNumber).toBe(1);
    });

    it('closes the popup on the first press and does the step on the next', async () => {
        layoutPopupOverTab();
        mockHitTest('verse');
        const clicked = [];
        document.getElementById('images').addEventListener('click', () => {
            clicked.push('images');
        });
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'Pick the Images tab.', finds: ['Images'] },
                { text: 'Done.', finds: [] },
            ],
        });
        const first = await window.__owaGuide.act();
        expect(first.lastResult).toMatchObject({ done: true, did: 'closed' });
        expect(first.stepNumber).toBe(1);
        expect(clicked).toEqual([]);
        expect(document.getElementById('modal-container')).toBeNull();
        // The popup is gone, so the tab is what the window paints there now.
        mockHitTest('images');
        const second = await window.__owaGuide.act();
        expect(second.lastResult).toMatchObject({ done: true, did: 'clicked' });
        expect(clicked).toEqual(['images']);
    });

    it('never answers a question the app is asking, and asks nobody else to', async () => {
        document.body.innerHTML = [
            '<div id="panel"><button id="images">Images</button></div>',
            '<div id="modal-container" class="modal-container--blocking">',
            '<div id="app-confirm-popup"><p id="q">Replace it?</p>',
            '<button id="ok">Ok</button></div></div>',
        ].join('');
        mockHitTest('q');
        const clicked = [];
        for (const id of ['images', 'ok']) {
            document.getElementById(id).addEventListener('click', () => {
                clicked.push(id);
            });
        }
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'Pick the Images tab.', finds: ['Images'] },
                { text: 'Done.', finds: [] },
            ],
        });
        const result = await window.__owaGuide.act();
        expect(result.lastResult.done).toBe(false);
        expect(result.lastResult.reason).toContain('a question the app is asking');
        expect(result.help).toBeNull();
        expect(clicked).toEqual([]);
    });
});

// The two other layers a run of every recipe left in front of a control: a
// right-click menu (closes on a click of its own backdrop) and a floating
// panel (closes with its own toolbar button). Neither is a question, so the
// card may close them on the first press.
describe('a control behind a menu or a floating panel', () => {
    function mockHitTest(topId) {
        document.elementsFromPoint = () => {
            const top = document.getElementById(topId);
            return top === null ? [] : [top];
        };
    }

    it('closes a right-click menu by its backdrop and stays on the step', async () => {
        document.body.innerHTML = [
            '<button id="export">Export</button>',
            '<div id="app-context-menu-container">',
            '<div class="app-context-menu"><div id="item">Copy Title</div></div>',
            '</div>',
        ].join('');
        document
            .getElementById('app-context-menu-container')
            .addEventListener('click', (event) => {
                event.currentTarget.remove();
            });
        mockHitTest('item');
        const guide = startGuide({
            mode: 'demo',
            steps: [{ text: 'Press Export.', finds: ['Export'] }, { text: 'Done.' }],
        });
        expect(guide.behind).toBe('the menu that is open');
        const first = await window.__owaGuide.act();
        expect(first.lastResult).toMatchObject({ done: true, did: 'closed', closed: 'the menu' });
        expect(first.stepNumber).toBe(1);
        expect(document.getElementById('app-context-menu-container')).toBeNull();
    });

    it('closes a floating panel with its own button', async () => {
        document.body.innerHTML = [
            '<button id="export">Export</button>',
            '<div class="floating-widget" id="widget"><div class="floating-widget__toolbar">',
            '<button class="floating-widget__button" id="wclose" aria-label="Close floating widget">',
            '<i class="bi bi-x-lg"></i></button></div><p id="body">Names</p></div>',
        ].join('');
        document.getElementById('wclose').addEventListener('click', () => {
            document.getElementById('widget').remove();
        });
        mockHitTest('body');
        const guide = startGuide({
            mode: 'show',
            steps: [{ text: 'Press Export.', finds: ['Export'] }, { text: 'Done.' }],
        });
        expect(guide.behind).toBe('the floating panel that is open');
        const host = document.getElementById('owa-guide-host');
        expect(host.shadowRoot.querySelector('[class*=hint]').textContent).toContain(
            'ringed ✕',
        );
        document.getElementById('wclose').click();
        expect(window.__owaGuide.status().stepNumber).toBe(1);
        expect(window.__owaGuide.status().behind).toBeNull();
    });
});

// Four recipes are tours written as bold-led bullets, with no numbered step
// anywhere -- and the walkthrough buttons under their answers, the panic
// question's among them, answered "Nothing to guide".
describe('a page written as bold-led bullets', () => {
    it('reads each top-level bullet as a step, sub-bullets folded in', () => {
        const steps = toGuideSteps(
            [
                '**Goal:** manage the live output.',
                '',
                '- The **mini screen** always mirrors the audience view.',
                '- **Lock** (header, the padlock): when locked, the screen refuses',
                '  slide changes.',
                '  - click again to unlock.',
                '- **Display** (footer): click to pick **which physical display**.',
                '',
            ].join('\n'),
        );
        expect(steps.map((one) => one.finds[0])).toEqual(['Lock', 'Display']);
        expect(steps[0].text).toContain('click again to unlock');
    });

    it('never mixes the two shapes: numbered steps win outright', () => {
        const steps = toGuideSteps(
            ['1. Click **Lock**.', '', '- **Display**: pick one.', ''].join('\n'),
        );
        expect(steps.map((one) => one.finds[0])).toEqual(['Lock']);
    });
});

// Measured over every recipe step Do it was pressed on (2026-09-08): 40 of
// the 124 refusals were steps that describe what the user will SEE. A step
// like that gets a Next button and an honest line, not a failed press.
describe('a step that is something to notice', () => {
    it('is marked as a look-step only when it names nothing to press', () => {
        const steps = toGuideSteps(
            [
                "1. The live background's tab shows a `*` prefix (e.g. `*Videos`).",
                '',
                '2. When it finishes, the file appears in the folder you were in.',
                '',
                '3. The **Lock** button (header): click it to lock the screen.',
                '',
                '4. Click the yellow dot.',
                '',
                '5. Press **F7** to clear it.',
                '',
                '6. The bar under the box says how many matched — **74 verses found**.',
                '',
            ].join('\n'),
        );
        expect(steps.map((one) => one.kind ?? 'act')).toEqual([
            'look',
            'look',
            'act',
            'act',
            'act',
            'look',
        ]);
    });

    it('draws Next instead of Do it, and a "do" just moves on', async () => {
        document.body.innerHTML = '<button id="lock">Lock</button>';
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'The tab shows a star.', finds: [], kind: 'look' },
                { text: 'Click Lock.', finds: ['Lock'] },
                { text: 'Done.', finds: [] },
            ],
        });
        const host = document.getElementById('owa-guide-host');
        const next = [...host.shadowRoot.querySelectorAll('button')].find((one) => {
            return one.textContent === 'Next';
        });
        expect(next).toBeDefined();
        expect(host.shadowRoot.querySelector('[class*=hint]').textContent).toContain(
            'something to notice',
        );
        const status = window.__owaGuide.status();
        expect(status.kind).toBe('look');
        expect(status.canActOnStep).toBe(false);
        const after = await window.__owaGuide.act();
        expect(after.lastResult).toEqual({ done: true, did: 'looked' });
        expect(after.help).toBeNull();
    });
});

// Measured 2026-09-08 over every recipe step: the demo pressed the
// projector's "Clear All [F6]" for a step about the drawing panel's Clear,
// and "Break lines following model formatting" for "Follow". Close enough
// to point at is not close enough to press.
describe('a control that only resembles the step', () => {
    it('is not pressed, and the label it found goes to the rescue', async () => {
        document.body.innerHTML = [
            '<button id="all" title="Clear All [F6]">Clear All</button>',
        ].join('');
        const clicked = [];
        document.getElementById('all').addEventListener('click', () => {
            clicked.push('all');
        });
        const guide = startGuide({
            mode: 'demo',
            steps: [
                { text: 'Press Clear in the title bar.', finds: ['Clear'] },
                { text: 'Done.', finds: [] },
            ],
        });
        expect(guide.isTargetFound).toBe(false);
        expect(guide.nearest).toBe('Clear All');
        const result = await window.__owaGuide.act();
        expect(result.lastResult.done).toBe(false);
        expect(result.lastResult.reason).toContain('"Clear All"');
        expect(clicked).toEqual([]);
    });

    it('still presses a control named exactly, shortcut and all', async () => {
        document.body.innerHTML =
            '<button id="toggle" title="Toggle showing screen [F5]"></button>';
        const clicked = [];
        document.getElementById('toggle').addEventListener('click', () => {
            clicked.push('toggle');
        });
        startGuide({
            mode: 'demo',
            steps: [
                { text: 'Press Toggle showing screen.', finds: ['Toggle showing screen'] },
                { text: 'Done.', finds: [] },
            ],
        });
        const result = await window.__owaGuide.act();
        expect(result.lastResult.done).toBe(true);
        expect(clicked).toEqual(['toggle']);
    });
});

describe('a control inside a floating panel', () => {
    it('is not "behind" the panel it lives in', async () => {
        // The Foreground widgets are floating panels; a header bar over a
        // label inside one read as a cover and the card closed the panel.
        document.body.innerHTML = [
            '<div class="floating-widget" id="widget">',
            '<div class="floating-widget__toolbar"><div id="bar">Marquee Top</div>',
            '<button class="floating-widget__button" id="wclose"><i class="bi bi-x-lg"></i></button></div>',
            '<button id="show">Show</button></div>',
        ].join('');
        document.elementsFromPoint = () => [document.getElementById('bar')];
        const clicked = [];
        document.getElementById('show').addEventListener('click', () => {
            clicked.push('show');
        });
        document.getElementById('wclose').addEventListener('click', () => {
            clicked.push('closed');
        });
        const guide = startGuide({
            mode: 'demo',
            steps: [{ text: 'Click Show.', finds: ['Show'] }, { text: 'Done.' }],
        });
        expect(guide.behind).toBeNull();
        const result = await window.__owaGuide.act();
        expect(result.lastResult).toMatchObject({ done: true, did: 'clicked' });
        expect(clicked).toEqual(['show']);
    });
});
