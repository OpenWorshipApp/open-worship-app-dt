// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
    DOM_MATCH_RUNTIME,
    genClickExpression,
    genFindUiExpression,
    genListUiExpression,
    genTypeExpression,
} from './domMatch.mjs';

// The runtime is a string evaluated in the app page, so it is exercised the
// way the app gets it: evaluated, then driven through its own api. The
// wrapping parenthesis matters: the string starts with a newline, and a bare
// `return` before it would come back empty-handed (ASI).
function install() {
    return new Function(`return (${DOM_MATCH_RUNTIME})`)();
}

function run(expression) {
    return new Function(`return (${expression})`)();
}

beforeEach(() => {
    delete window.__owaDomMatch;
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

describe('the shared DOM matcher', () => {
    it('prefers the named panel over a button that shares its word', () => {
        // The real shape of the bug: an open Background panel draws its name
        // nowhere, so "Background" had only the screen preview's background
        // TRANSITION button to land on.
        document.body.innerHTML = [
            '<div id="panel" data-widget-name="Background">',
            '<button id="videos">Videos</button></div>',
            '<button id="transition" title="Background transition">',
            'Background:</button>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Background'])?.element?.id).toBe('panel');
        expect(dm.findBest(['Background panel'])?.element?.id).toBe('panel');
    });

    it('scopes a control to the panel the step named', () => {
        document.body.innerHTML = [
            '<div data-widget-name="Background">',
            '<button id="right">Videos</button></div>',
            '<div data-widget-name="Bible">',
            '<button id="wrong">Videos</button></div>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Background > Videos'])?.element?.id).toBe(
            'right',
        );
        expect(dm.findBest(['Bible > Videos'])?.element?.id).toBe('wrong');
    });

    it('refuses a scope that is not on screen rather than guessing', () => {
        document.body.innerHTML = [
            '<div data-widget-name="Bible">',
            '<button id="videos">Videos</button></div>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Background > Videos'])).toBe(null);
    });

    it('lets the panel supply words the control label does not have', () => {
        document.body.innerHTML = [
            '<div data-widget-name="Background">',
            '<button id="videos">Videos</button></div>',
        ].join('');
        const dm = install();
        const found = dm.findBest(['Background Videos']);
        expect(found?.element?.id).toBe('videos');
        expect(found?.tier).toBe(4);
    });

    it('does not let a panel name every control inside it', () => {
        // "Background" must not answer with the first button in the
        // Background panel: at least one word has to be on the control.
        document.body.innerHTML = [
            '<div id="panel" data-widget-name="Background">',
            '<button id="colors">Colors</button></div>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Background'])?.element?.id).toBe('panel');
        expect(dm.findBest(['Background Sunset'])).toBe(null);
    });

    it('names the panel a match sits in', () => {
        document.body.innerHTML = [
            '<div data-widget-name="Background">',
            '<button id="videos">Videos</button></div>',
        ].join('');
        const dm = install();
        expect(dm.describe(document.getElementById('videos')).inPanel).toBe(
            'Background',
        );
    });

    it('does not read a whole panel as its own label', () => {
        document.body.innerHTML = [
            '<div id="panel" data-widget-name="Background">',
            '<button>Videos</button><button>Images</button></div>',
        ].join('');
        const dm = install();
        expect(dm.labelOf(document.getElementById('panel'))).toBe(
            'Background',
        );
    });

    it('finds a box by its placeholder, not only buttons by their text', () => {
        document.body.innerHTML =
            '<input id="ref" placeholder="Bible Reference">';
        const dm = install();
        const found = dm.findBest(['Bible Reference']);
        expect(found?.element?.id).toBe('ref');
    });

    it('matches words in any order when no tighter fit exists', () => {
        document.body.innerHTML = '<button id="lookup">Lookup Bible</button>';
        const dm = install();
        const found = dm.findBest(['Bible Lookup']);
        expect(found?.element?.id).toBe('lookup');
        expect(found?.tier).toBe(3);
    });

    it('prefers the control over the row that contains its text', () => {
        document.body.innerHTML = [
            '<button id="row">(KJV) Genesis 1:1-31 Double click to put back',
            '</button><button id="key">KJV</button>',
        ].join('');
        const dm = install();
        const found = dm.findBest(['KJV']);
        expect(found?.element?.id).toBe('key');
        expect(found?.tier).toBe(0);
    });

    it('prefers the control NAMED the words over one containing them', () => {
        // The real window, reduced: a collapsed panel bar whose whole text is
        // "Background", and the background-transition button beside the
        // screen preview, which is shorter but only mentions the word. The
        // walkthrough step meant the panel and opened the transition menu.
        document.body.innerHTML = [
            '<div id="panel" role="button" title="Enable Background">',
            'Background</div>',
            '<button id="transition" title="Background transition">',
            'Background:</button>',
            '<button id="clear" title="Clear Background [F7]">BG</button>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Background'])?.element?.id).toBe('panel');
    });

    it('still puts the control ahead of the container naming it', () => {
        // The other half of the same rule: exactness must not outrank being
        // a control, or a wrapper gets pressed instead of its button.
        document.body.innerHTML = [
            '<div id="wrap" title="Bible Lookup">',
            '<button id="btn">Bible Lookup now</button></div>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Bible Lookup'])?.element?.id).toBe('btn');
    });

    it('reads each way an element is named apart from the others', () => {
        document.body.innerHTML =
            '<div id="bar" title="Enable Background">Background</div>';
        const dm = install();
        const element = document.getElementById('bar');
        expect(dm.labelPartsOf(element)).toEqual([
            'Background',
            'Enable Background',
        ]);
        // The joined form is unchanged -- it is what the caller is shown.
        expect(dm.labelOf(element)).toBe('Background Enable Background');
        expect(dm.checkIsNamedExactly(element, 'background')).toBe(true);
        expect(dm.checkIsNamedExactly(element, 'enable')).toBe(false);
    });

    it('refuses a label that only mentions the word inside another', () => {
        document.body.innerHTML =
            '<button title="...\\khmer-study-bible-pdf">GEN.0.pdf</button>';
        const dm = install();
        expect(dm.findBest(['bible-pdf-data'])).toBe(null);
    });

    it('refuses a short label hiding inside a longer word', () => {
        // W-08 step 2 offers "Ok" as a control to ring; the only thing on
        // screen containing it was "lo-ok-up", and demo mode would have
        // pressed the Bible Lookup button in front of a volunteer.
        document.body.innerHTML = [
            '<button id="lookup" title="Open bible lookup popup [Ctrl+B]">',
            'Bible Lookup</button>',
        ].join('');
        const dm = install();
        expect(dm.findBest(['Ok'])).toBe(null);
    });

    it('still matches a label the manual writes without its plural', () => {
        // The other side of the same rule: "Web" must still reach the
        // "Webs" tab, which begins with it.
        document.body.innerHTML = '<button id="webs">Webs</button>';
        const dm = install();
        const found = dm.findBest(['Web']);
        expect(found?.element?.id).toBe('webs');
        expect(found?.tier).toBe(2);
    });

    it('names the closest labels it did see when nothing matches', () => {
        document.body.innerHTML =
            '<input placeholder="Bible Reference"><button>KJV</button>';
        const dm = install();
        // "reference box" is not written anywhere, but the real box shares
        // the word "reference" -- the retry is written in on-screen words.
        expect(dm.nearMisses(['reference box'])).toContain('Bible Reference');
    });

    it('waits for a panel that is still rendering', async () => {
        const dm = install();
        setTimeout(() => {
            document.body.innerHTML = '<button id="late">Genesis</button>';
        }, 200);
        const found = await dm.waitForBest(['Genesis'], 1500);
        expect(found?.element?.id).toBe('late');
    });

    it('gives up with near misses after the wait', async () => {
        document.body.innerHTML = '<button>Exodus</button>';
        const dm = install();
        const found = await dm.waitForBest(['Genesis'], 300);
        expect(found.element).toBe(null);
        expect(found.nearMisses).toEqual([]);
    });

    it('lists what is on screen once, deduped and compact', () => {
        document.body.innerHTML = [
            '<button>Bible Reader</button>',
            '<label>Bible Reader</label>',
            '<input placeholder="Bible Reference">',
        ].join('');
        const dm = install();
        const rows = dm.listControls('', 100);
        const labels = rows.map((row) => row.label);
        // Same words at the same spot are one row, not two.
        expect(
            labels.filter((label) => label === 'Bible Reader'),
        ).toHaveLength(1);
        expect(labels).toContain('Bible Reference');
    });
});

describe('the packaged expressions', () => {
    it('lists controls with a filter', () => {
        document.body.innerHTML =
            '<button>Bible Reader</button><button>Settings</button>';
        const result = run(genListUiExpression({ filter: 'reader' }));
        expect(result.count).toBe(1);
        expect(result.controls[0].label).toBe('Bible Reader');
    });

    it('finds UI with tiered matching and near misses on a zero answer', () => {
        document.body.innerHTML = '<input placeholder="Bible Reference">';
        const found = run(genFindUiExpression('bible reference', false));
        expect(found.count).toBe(1);
        // "reference box" is what a recipe calls it and "Bible Reference" is
        // what is written on it. The kind noun is not part of any label, so
        // it is dropped rather than spent on a near miss and a second round.
        const qualified = run(genFindUiExpression('reference box', false));
        expect(qualified.count).toBe(1);
        const missed = run(genFindUiExpression('reference sheet', false));
        expect(missed.count).toBe(0);
        expect(missed.nearMisses).toContain('Bible Reference');
    });

    it('clicks the control a label names', async () => {
        document.body.innerHTML = '<button id="go">Bible Reader</button>';
        let clicks = 0;
        document.getElementById('go').addEventListener('click', () => {
            clicks += 1;
        });
        const result = await run(genClickExpression(['Bible Reader']));
        expect(clicks).toBe(1);
        expect(result.matched).toBe('Bible Reader');
    });

    // What a press DID, not just what it hit. Written after an assistant
    // pressed a toolbar-reveal decoration and reported the projector was on.
    it('reports a toggle that flipped as proof the press worked', async () => {
        document.body.innerHTML =
            '<div role="button" aria-pressed="false" title="Toggle showing' +
            ' screen">on</div>';
        const target = document.querySelector('[role="button"]');
        target.addEventListener('click', () => {
            target.setAttribute('aria-pressed', 'true');
        });
        const result = await run(genClickExpression(['Toggle showing screen']));
        expect(result.isOnNow).toBe(true);
        expect(result.didChange).toBe(true);
        expect(result.unverified).toBe(undefined);
    });

    it('says a plain button press is unproven rather than nothing', async () => {
        document.body.innerHTML = '<button title="Show">S</button>';
        const result = await run(genClickExpression(['Show']));
        expect(result.clicked.label).toBe('S Show');
        expect(result.isOnNow).toBe(undefined);
        expect(result.didChange).toBe(false);
        expect(result.unverified).toContain('nothing is proven');
    });

    it('types into a box the React-compatible way', async () => {
        document.body.innerHTML = '<input id="ref" placeholder="Reference">';
        let inputValue = null;
        document.getElementById('ref').addEventListener('input', (event) => {
            inputValue = event.target.value;
        });
        const result = await run(genTypeExpression(['Reference'], 'John 3:16'));
        expect(result.typed).toBe('John 3:16');
        expect(inputValue).toBe('John 3:16');
        expect(document.getElementById('ref').value).toBe('John 3:16');
    });

    it('typing never settles for a button that merely shares the words', async () => {
        // onlyBoxes skips the button entirely: a history row that reads
        // "Genesis 1" is a thing to click, never a box to type into.
        document.body.innerHTML = '<button>Present</button>';
        const result = await run(genTypeExpression(['Present'], 'x'));
        expect(result.typed).toBe(null);
        expect(result.reason).toBe('nothing on screen to act on');
    });

    it('types into the box, not the button that shares its words', async () => {
        document.body.innerHTML = [
            '<button>Reference</button>',
            '<input id="ref" type="text" aria-label="Reference">',
        ].join('');
        const result = await run(genTypeExpression(['Reference'], 'Mark 1:1'));
        expect(result.typed).toBe('Mark 1:1');
        expect(result.into.tag).toBe('input');
        expect(document.getElementById('ref').value).toBe('Mark 1:1');
    });
});

describe('pointing at a region instead of a control', () => {
    function makeScroller(id, rect) {
        const element = document.createElement('div');
        element.id = id;
        document.body.append(element);
        Object.defineProperty(element, 'scrollHeight', { value: 900 });
        Object.defineProperty(element, 'clientHeight', { value: 200 });
        element.getBoundingClientRect = () => {
            return { ...rect, top: rect.y, left: rect.x };
        };
        return element;
    }

    it('takes the list under the point the guide last acted at', () => {
        const big = makeScroller('big', { x: 0, y: 0, width: 900, height: 700 });
        const near = makeScroller('near', {
            x: 500, y: 400, width: 300, height: 200,
        });
        document.elementFromPoint = () => near;
        const dm = install();
        // The biggest scroller on screen is `big`; the one the user is
        // looking at is `near`, and that is the one a step means by "the
        // list".
        expect(dm.findListRegion({ x: 600, y: 450 })?.id).toBe('near');
        expect(big.id).toBe('big');
    });

    it('falls back to the biggest list when nothing has been acted on', () => {
        makeScroller('small', { x: 0, y: 0, width: 300, height: 150 });
        makeScroller('biggest', { x: 0, y: 0, width: 900, height: 700 });
        document.elementFromPoint = () => null;
        const dm = install();
        expect(dm.findListRegion(null)?.id).toBe('biggest');
    });

    it('fires a real contextmenu inside the region, not at 0,0', () => {
        const list = makeScroller('list', {
            x: 100, y: 100, width: 400, height: 300,
        });
        document.elementFromPoint = () => list;
        const seen = [];
        list.addEventListener('contextmenu', (event) => {
            seen.push({ x: event.clientX, y: event.clientY });
        });
        const dm = install();
        const at = dm.openContextMenu(list);
        expect(seen).toHaveLength(1);
        // Bottom right INSIDE it: a list fills from the top left, so that is
        // the empty part -- and an item's own menu is a different menu.
        expect(at.x).toBe(480);
        expect(at.y).toBe(388);
        expect(seen[0]).toEqual({ x: 480, y: 388 });
    });
});

// A row of icons the app paints only while the mouse is over the part of
// the window it belongs to -- the six buttons above every bible view are
// this shape, and they were being ringed as though they were on show.
describe('controls the app hides until the mouse is over them', () => {
    // The real markup, cut down: the button is hidden by an ancestor
    // several levels up, and revealed by a rule on one further up still.
    const HOVER_MARKUP = [
        '<style>',
        '.motion .low { visibility: hidden; }',
        '.motion:hover .low { visibility: visible; }',
        '</style>',
        '<div class="motion"><div class="head"><div class="low">',
        '<button id="copy" title="Copy">C</button>',
        '</div></div></div>',
        '<div id="other">Copy of the service sheet</div>',
    ].join('');

    it('still finds one, and says it is not on show', () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        expect(dm.visibilityOf(document.getElementById('copy'))).toBe(
            'hidden',
        );
        const found = dm.findBest(['Copy']);
        expect(found?.element?.id).toBe('copy');
        const described = dm.describe(found.element);
        expect(described.isVisible).toBe(false);
        expect(described.showsOnHover).toBe(true);
    });

    // The point of ranking it below isControl and not above it: a hidden
    // BUTTON still beats a visible div, because only one of the two is a
    // thing to press.
    it('prefers a hover-hidden control over a visible container', () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        expect(dm.findBest(['Copy'])?.element?.id).toBe('copy');
    });

    it('prefers the twin that is already on show', () => {
        document.body.innerHTML =
            HOVER_MARKUP +
            '<button id="shown" title="Copy">C</button>';
        const dm = install();
        expect(dm.findBest(['Copy'])?.element?.id).toBe('shown');
    });

    // Forcing the hover rather than moving the mouse: the state the mouse
    // would have produced, held while the user reads the card.
    it('reveals it by forcing the hover on its container', () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        const target = document.getElementById('copy');
        expect(dm.revealHidden(target, 5000)).toBe(true);
        expect(dm.visibilityOf(target)).toBe('shown');
        expect(
            document.querySelectorAll('[data-owa-hover-style]').length,
        ).toBe(1);
        dm.releaseHidden();
        expect(dm.visibilityOf(target)).toBe('hidden');
        expect(
            document.querySelectorAll('[data-owa-hover-style]').length,
        ).toBe(0);
        expect(document.querySelectorAll('[data-owa-hover]').length).toBe(0);
    });

    // Found live: the guide card redraws its step every so often, and on
    // the second draw the control was visible -- because the card itself
    // was holding it -- so a caller that tested before asking dropped the
    // one sentence explaining why it was visible at all.
    it('reads as held while it is still being held', () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        const target = document.getElementById('copy');
        expect(dm.revealHidden(target, 5000)).toBe(true);
        expect(dm.revealHidden(target, 5000)).toBe(true);
        expect(
            document.querySelectorAll('[data-owa-hover-style]').length,
        ).toBe(1);
        dm.releaseHidden();
    });

    it('reads as not held for a control that never needed it', () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        const other = document.getElementById('other');
        expect(dm.revealHidden(other, 5000)).toBe(false);
        expect(document.querySelectorAll('[data-owa-hover]').length).toBe(0);
    });

    // One at a time: a window wearing several forced hovers is not a
    // window anybody could recognise, and every one of them is a style
    // element and a row of attributes left on the page.
    it('holds one reveal at a time', () => {
        document.body.innerHTML = HOVER_MARKUP + HOVER_MARKUP;
        const dm = install();
        const [one, other] = [...document.querySelectorAll('#copy')];
        expect(dm.revealHidden(one, 5000)).toBe(true);
        expect(dm.revealHidden(other, 5000)).toBe(true);
        expect(dm.visibilityOf(one)).toBe('hidden');
        expect(dm.visibilityOf(other)).toBe('shown');
        expect(
            document.querySelectorAll('[data-owa-hover-style]').length,
        ).toBe(1);
        dm.releaseHidden();
    });

    // Nothing to reveal is not the same as a reveal that failed, and
    // neither may leave a mark on the page.
    it('refuses what no hover can bring back, and leaves nothing', () => {
        document.body.innerHTML = [
            '<style>.dead { display: none; }</style>',
            '<div class="dead"><button id="gone" title="Copy">C</button>',
            '</div>',
        ].join('');
        const dm = install();
        const target = document.getElementById('gone');
        expect(dm.visibilityOf(target)).toBe('gone');
        expect(dm.revealHidden(target, 5000)).toBe(false);
        expect(document.querySelectorAll('[data-owa-hover]').length).toBe(0);
        expect(
            document.querySelectorAll('[data-owa-hover-style]').length,
        ).toBe(0);
    });

    // What owa_list_ui answers with. Leaving these off the list is what
    // stopped the assistant ever mentioning them; a control with no box
    // at all stays off it.
    it('lists a hover-revealed control, marked, and not a missing one', () => {
        document.body.innerHTML =
            HOVER_MARKUP +
            '<style>.dead { display: none; }</style>' +
            '<div class="dead"><button title="Export">E</button></div>';
        const dm = install();
        const labels = dm.listControls('', 50).map((row) => row.label);
        expect(labels).toContain('C Copy');
        expect(labels).not.toContain('E Export');
        const row = dm
            .listControls('C Copy', 50)
            .find((one) => one.label === 'C Copy');
        expect(row.showsOnHover).toBe(true);
        expect(row.isVisible).toBe(false);
    });

    // The click path: pressed for real, and the answer says the user
    // could not have seen it -- which is what the assistant tells them.
    it('reveals before clicking one', async () => {
        document.body.innerHTML = HOVER_MARKUP;
        const dm = install();
        const target = document.getElementById('copy');
        let clicks = 0;
        target.addEventListener('click', () => {
            clicks += 1;
        });
        const result = await run(genClickExpression(['Copy'], 100));
        expect(result.clicked.label).toBe('C Copy');
        expect(result.revealedForHover).toBe(true);
        expect(clicks).toBe(1);
        dm.releaseHidden();
    });
});

// A selector that finds one element again and nothing else.
//
// The element picker's whole answer rests on this: a person can point at a
// control and cannot describe it, so what comes back has to be re-findable.
// The rule the tests hold it to is that it is TESTED before it is returned --
// a selector matching two things is worse than none, because it looks right.
describe('selectorOf', () => {
    it('prefers the words the app chose over the position', () => {
        document.body.innerHTML = `
            <div>
                <button aria-label="Bible Lookup">B</button>
                <button>Other</button>
            </div>`;
        const dm = install();
        const target = document.querySelector('[aria-label="Bible Lookup"]');
        const selector = dm.selectorOf(target);
        expect(selector).toContain('[aria-label="Bible Lookup"]');
        expect(document.querySelectorAll(selector)).toHaveLength(1);
    });

    it('names a panel by the attribute that survives a re-render', () => {
        document.body.innerHTML =
            '<div data-widget-name="Background"><span>x</span></div>';
        const dm = install();
        const selector = dm.selectorOf(
            document.querySelector('[data-widget-name]'),
        );
        expect(selector).toBe('div[data-widget-name="Background"]');
    });

    it('falls back to position when nothing names it', () => {
        document.body.innerHTML =
            '<ul><li><i>a</i></li><li><i>b</i></li><li><i>c</i></li></ul>';
        const dm = install();
        const target = document.querySelectorAll('li')[2];
        const selector = dm.selectorOf(target);
        expect(document.querySelectorAll(selector)).toHaveLength(1);
        expect(document.querySelector(selector)).toBe(target);
    });

    it('never answers with a selector that matches two things', () => {
        // Three identical buttons under three identical parents. Whatever it
        // comes back with must still single one out -- or be null.
        document.body.innerHTML = `
            <div><div><button>Go</button></div></div>
            <div><div><button>Go</button></div></div>
            <div><div><button>Go</button></div></div>`;
        const dm = install();
        for (const target of document.querySelectorAll('button')) {
            const selector = dm.selectorOf(target);
            if (selector === null) {
                continue;
            }
            expect(document.querySelectorAll(selector)).toHaveLength(1);
            expect(document.querySelector(selector)).toBe(target);
        }
    });

    // React and Bootstrap both mint ids that change on the next render, so a
    // selector built on one stops working while the user is still looking at
    // the same screen.
    it('does not build on a generated id', () => {
        document.body.innerHTML =
            '<div><button id="radix-1729384756">Go</button></div>';
        const dm = install();
        const selector = dm.selectorOf(document.querySelector('button'));
        expect(selector).not.toContain('radix-1729384756');
        expect(document.querySelectorAll(selector)).toHaveLength(1);
    });

    it('uses an id the app wrote itself', () => {
        document.body.innerHTML = '<div id="app-header"><button>Go</button></div>';
        const dm = install();
        expect(dm.selectorOf(document.querySelector('#app-header'))).toBe(
            'div#app-header',
        );
    });

    it('answers nothing for the body and for nothing', () => {
        const dm = install();
        expect(dm.selectorOf(document.body)).toBeNull();
        expect(dm.selectorOf(null)).toBeNull();
    });
});
