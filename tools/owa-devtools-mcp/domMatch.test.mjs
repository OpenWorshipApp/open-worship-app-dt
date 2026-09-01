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
