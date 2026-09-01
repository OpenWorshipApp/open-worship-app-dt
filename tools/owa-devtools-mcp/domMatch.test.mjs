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

    it('refuses a label that only mentions the word inside another', () => {
        document.body.innerHTML =
            '<button title="...\\khmer-study-bible-pdf">GEN.0.pdf</button>';
        const dm = install();
        expect(dm.findBest(['bible-pdf-data'])).toBe(null);
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
        const missed = run(genFindUiExpression('reference box', false));
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
