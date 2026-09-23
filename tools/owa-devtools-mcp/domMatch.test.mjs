// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { genDestructiveLabelRule } from './destructiveLabel.mjs';
import {
  DOM_MATCH_RUNTIME,
  genClickExpression,
  genFindUiExpression,
  genListUiExpression,
  genTypeExpression,
} from './domMatch.mjs';
import { loadTranBundle } from './tran.mjs';

// What a press carries with the firewall on: the rule off the app's own
// dictionary, so the Khmer cases below are the real translations.
const GUARD = { rule: genDestructiveLabelRule(loadTranBundle()) };

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
    expect(dm.findBest(['Background > Videos'])?.element?.id).toBe('right');
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
    expect(dm.labelOf(document.getElementById('panel'))).toBe('Background');
  });

  it('finds a box by its placeholder, not only buttons by their text', () => {
    document.body.innerHTML = '<input id="ref" placeholder="Bible Reference">';
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

  it('says a name once when the title and the aria-label agree', () => {
    // The show/hide screen toggle: a styled div with the same words in
    // both attributes, which used to list as the label twice over.
    document.body.innerHTML =
      '<div id="toggle" role="button" tabindex="0"' +
      ' title="Toggle showing screen [F5]"' +
      ' aria-label="Toggle showing screen [F5]"><i></i></div>';
    const dm = install();
    const element = document.getElementById('toggle');
    expect(dm.labelPartsOf(element)).toEqual(['Toggle showing screen [F5]']);
    expect(dm.labelOf(element)).toBe('Toggle showing screen [F5]');
    expect(dm.listControls('', 10).map((row) => row.label)).toEqual([
      'Toggle showing screen [F5]',
    ]);
  });

  // The Mini Screen's Clear All and the editor's Save: a title WITH the
  // shortcut, an aria-label without. Listed as "Clear All [F6] Clear All"
  // by find and list while owa_list_screens said "Clear All [F6]" (2026-09-18).
  it('says a name once when only a shortcut tells the two apart', async () => {
    document.body.innerHTML =
      '<button id="clear" title="Clear All [F6]" aria-label="Clear All">' +
      '<i></i></button>';
    const dm = install();
    const element = document.getElementById('clear');
    expect(dm.shownLabelOf(element)).toBe('Clear All [F6]');
    expect(dm.describe(element).label).toBe('Clear All [F6]');
    expect(dm.listControls('', 10).map((row) => row.label)).toEqual([
      'Clear All [F6]',
    ]);
    // Matching still reads the bare name: it is the exact-name
    // tie-breaker between two controls that both say "Clear All".
    expect(dm.labelPartsOf(element)).toEqual(['Clear All [F6]', 'Clear All']);
    expect(dm.checkIsNamedExactly(element, 'clear all')).toBe(true);
    expect(dm.nearMisses(['clear everything'])).toEqual(['Clear All [F6]']);
    // A press compares the label before and after the SAME way, so one
    // that changed nothing is still reported as unproven.
    const result = await run(genClickExpression(['Clear All'], 100));
    expect(result.didChange).toBe(false);
    expect(result.unverified).toBeTruthy();
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

  it('ranks near misses on the words that mean something', () => {
    // Measured through the offline bot: "button to change the
    // background" scored a verse row two points for "to" and "the" and
    // the Background panel one, and offered a line of Genesis as the
    // control. The one real word must win.
    document.body.innerHTML = [
      '<div title="Click to open the verse">pass after</div>',
      '<div title="Click to open the verse">and she conceived</div>',
      '<button>Click or Double Click to scroll to the top</button>',
      '<div data-widget-name="Background" title="Background"></div>',
    ].join('');
    const dm = install();
    const misses = dm.nearMisses(['button to change the background']);
    expect(misses[0]).toBe('Background');
    expect(misses).not.toContain('pass after Click to open the verse');
  });

  it('has no near miss for a question made of filler words alone', () => {
    document.body.innerHTML = '<button>Click to open the verse</button>';
    const dm = install();
    expect(dm.nearMisses(['the to of'])).toEqual([]);
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
    expect(labels.filter((label) => label === 'Bible Reader')).toHaveLength(1);
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

  // This app's panel tabs keep their state in Bootstrap's 'active' class and
  // toggle their panel. Written after the assistant pressed Foreground
  // (already open), was told nothing changed, and never found the widget
  // it had just hidden (2026-09-11).
  it('reads a panel tab that toggled as a state change, not as nothing', async () => {
    document.body.innerHTML =
      '<ul><li class="nav-item"><button class="btn nav-link active">' +
      'Foreground</button></li></ul>';
    const tab = document.querySelector('.nav-link');
    tab.addEventListener('click', () => {
      tab.classList.toggle('active');
    });
    const closed = await run(genClickExpression(['Foreground']));
    expect(closed.isOnNow).toBe(false);
    expect(closed.didChange).toBe(true);
    expect(closed.unverified).toBe(undefined);
    const opened = await run(genClickExpression(['Foreground']));
    expect(opened.isOnNow).toBe(true);
  });

  // The guide card's bar, on the tool the model presses with. Written after
  // "show screen" matched the Bible Lookup's save-and-present button.
  it('refuses to press a loose match, and names what it found', async () => {
    document.body.innerHTML =
      '<button id="save" title="Save bible item and show on screen">' +
      'S</button><div title="Toggle showing screen [F5]" role="button"' +
      ' aria-pressed="false">t</div>';
    let clicks = 0;
    document.getElementById('save').addEventListener('click', () => {
      clicks += 1;
    });
    const result = await run(genClickExpression(['show screen'], 100));
    expect(clicks).toBe(0);
    expect(result.clicked).toBe(null);
    expect(result.reason).toContain('exact words');
    expect(result.nearest.label).toContain('show on screen');
    expect(
      result.nearMisses.some((label) => {
        return label.includes('Toggle showing screen [F5]');
      }),
    ).toBe(true);
    // The exact title, shortcut and all, still presses.
    const exact = await run(genClickExpression(['Toggle showing screen'], 100));
    expect(exact.clicked.label).toContain('Toggle showing screen');
  });

  // The page half of the interlock: judged by what the control IS. The
  // firewall reads the words a press was aimed with, and "X" is not a
  // destructive word -- the title on the button it lands on is.
  it('will not press a control named for what cannot be undone', async () => {
    document.body.innerHTML =
      '<button id="del" title="Delete this preset">X</button>';
    let clicks = 0;
    document.getElementById('del').addEventListener('click', () => {
      clicks += 1;
    });
    const refused = await run(
      genClickExpression(['X'], 100, 0, { guard: GUARD }),
    );
    expect(clicks).toBe(0);
    expect(refused).toMatchObject({
      clicked: null,
      refused: 'destructive',
      label: 'Delete this preset',
    });
    // With the firewall switched off there is no guard, and it presses.
    await run(genClickExpression(['X'], 100, 0));
    expect(clicks).toBe(1);
  });

  it('will not press a Khmer control named for what cannot be undone', async () => {
    document.body.innerHTML =
      '<div class="app-context-menu-item" title="ផ្លាស់ទីទៅធុងសំរាម">' +
      '<div>ផ្លាស់ទីទៅធុងសំរាម</div></div>';
    const refused = await run(
      genClickExpression(['ផ្លាស់ទីទៅធុងសំរាម'], 100, 0, { guard: GUARD }),
    );
    expect(refused.refused).toBe('destructive');
  });

  // "Delete, then Yes": the Yes belongs to the user.
  it('never answers a question the app is asking', async () => {
    document.body.innerHTML =
      '<div id="modal-container" class="modal-container--blocking">' +
      '<div id="app-confirm-popup"><button id="yes">Yes</button></div>' +
      '</div>';
    let clicks = 0;
    document.getElementById('yes').addEventListener('click', () => {
      clicks += 1;
    });
    const refused = await run(
      genClickExpression(['Yes'], 100, 0, { guard: GUARD }),
    );
    expect(clicks).toBe(0);
    expect(refused.refused).toBe('question');
  });

  // Choosing IS the press on a picker. Offering "Delete" is not refused;
  // being set to it is.
  it('reads a picker by the choice being made', async () => {
    document.body.innerHTML =
      '<select aria-label="When done"><option>Keep</option>' +
      '<option>Show</option><option>Delete</option></select>';
    const refused = await run(
      genTypeExpression(['When done'], 'Delete', { guard: GUARD }),
    );
    expect(refused).toMatchObject({ typed: null, refused: 'destructive' });
    expect(document.querySelector('select').value).toBe('Keep');
    const chosen = await run(
      genTypeExpression(['When done'], 'Show', { guard: GUARD }),
    );
    expect(chosen.typed).toBe('Show');
  });

  it('never fills in a box the app is asking the user to fill', async () => {
    document.body.innerHTML =
      '<div id="app-input-popup"><input aria-label="New name"></div>';
    const refused = await run(
      genTypeExpression(['New name'], 'x', { guard: GUARD }),
    );
    expect(refused.refused).toBe('question');
    expect(document.querySelector('input').value).toBe('');
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

  it('sets a range slider and sends the same change events as a drag', async () => {
    document.body.innerHTML =
      '<input id="size" type="range" aria-label="17" min="10" max="40" value="17">';
    let changedTo = null;
    document.getElementById('size').addEventListener('change', (event) => {
      changedTo = event.target.value;
    });
    const result = await run(genTypeExpression(['17'], '22'));
    expect(result.typed).toBe('22');
    expect(changedTo).toBe('22');
    expect(document.getElementById('size').value).toBe('22');
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

// A <select> used to be labelled with every option it holds glued together --
// "AssistantClaudeChatGPTKimiFree" -- which is on no control anywhere, so no
// picker in the app could be found, listed honestly, or changed.
describe('a drop-down', () => {
  const PICKER = [
    '<select aria-label="Which assistant answers">',
    '<option value="claude">Claude</option>',
    '<option value="chatgpt">ChatGPT</option>',
    '<option value="kimi" disabled>Kimi &mdash; needs an API key</option>',
    '</select>',
  ].join('');

  it('is named by the choice it is on, not by all of them', () => {
    document.body.innerHTML = PICKER;
    const dm = install();
    const parts = dm.labelPartsOf(document.querySelector('select'));
    expect(parts).toContain('Claude');
    expect(parts).toContain('Which assistant answers');
    expect(parts.join(' ')).not.toContain('ChatGPT');
  });

  it('is found by the words it is showing', async () => {
    document.body.innerHTML = PICKER;
    const result = await run(genFindUiExpression('Claude'));
    expect(result.count).toBe(1);
    expect(result.matches[0].tag).toBe('select');
  });

  it('is changed by naming the choice, not its value', async () => {
    document.body.innerHTML = PICKER;
    let changedTo = null;
    document.querySelector('select').addEventListener('change', (event) => {
      changedTo = event.target.value;
    });
    const result = await run(
      genTypeExpression(['Which assistant answers'], 'ChatGPT'),
    );
    expect(result.typed).toBe('ChatGPT');
    expect(result.chose).toBe('ChatGPT');
    // The option's VALUE is what lands on the element; its words are what
    // the caller said. React is told through a real change event.
    expect(document.querySelector('select').value).toBe('chatgpt');
    expect(changedTo).toBe('chatgpt');
  });

  it('answers a wrong choice with the choices there are', async () => {
    document.body.innerHTML = PICKER;
    const result = await run(
      genTypeExpression(['Which assistant answers'], 'Gemini'),
    );
    expect(result.typed).toBe(null);
    expect(result.reason).toContain('not one of the choices');
    expect(result.choices).toContain('Claude');
    expect(document.querySelector('select').value).toBe('claude');
  });

  it('refuses a choice that is listed but cannot be picked', async () => {
    document.body.innerHTML = PICKER;
    const result = await run(
      genTypeExpression(['Which assistant answers'], 'Kimi — needs an API key'),
    );
    expect(result.typed).toBe(null);
    expect(result.reason).toContain('cannot be picked');
    expect(document.querySelector('select').value).toBe('claude');
  });
});

// The matcher drops a trailing kind noun ("the Videos tab") from every
// needle -- and "Document List" and "Presenting Flow List" are panes NAMED
// with one, so asked for by their exact name they were a loose fit on
// their own label, which the demo refuses to press.
describe('a control named with a kind noun', () => {
  it('is an exact match on its whole name', () => {
    document.body.innerHTML =
      '<div data-widget-name="Presenting Flow List"></div>' +
      '<div role="separator" aria-label="Divider between Document List' +
      ' and Presenting Flow List"></div>';
    const dm = install();
    const pane = dm.findBest(['Presenting Flow List']);
    expect(pane.tier).toBe(0);
    expect(pane.isPressSafe).toBe(true);
    const divider = dm.findBest([
      'divider between Document List and Presenting Flow List',
    ]);
    expect(divider.element.getAttribute('role')).toBe('separator');
    expect(divider.tier).toBe(0);
    // The collapsed strip of that pane: named by the pane's name AND
    // by its own title, so the joined label is neither.
    document.body.innerHTML =
      '<div role="button" data-widget-name="Presenting Flow List"' +
      ' title="Enable Presenting Flow List">Presenting Flow List</div>';
    const strip = dm.findBest(['Presenting Flow List']);
    expect(strip.tier).toBe(0);
    expect(strip.isPressSafe).toBe(true);
    // The noun still comes off when it is the step's, not the label's.
    expect(dm.findBest(['Presenting Flow List panel']).isPressSafe).toBe(true);
  });
});

// The words a tool hands back carry the shortcut -- `owa_list_screens` says
// "Clear Bible [F9]", the button's own title -- and a press by exactly those
// words was refused: the label part had its bracket taken off for the
// comparison and the needle had not (EC-135).
describe('a needle carrying the shortcut a title carries', () => {
  it('is press-safe on a control whose title is those words', () => {
    document.body.innerHTML =
      '<button title="Clear Bible [F9]" aria-label="Clear Bible">BB' +
      '</button>' +
      '<button title="Close [Ctrl+Q]" aria-label="Close"><i></i>' +
      '</button>';
    const dm = install();
    const clear = dm.findBest(['Clear Bible [F9]']);
    expect(clear.element.getAttribute('aria-label')).toBe('Clear Bible');
    expect(clear.isPressSafe).toBe(true);
    expect(dm.findBest(['Clear Bible']).isPressSafe).toBe(true);
    expect(dm.findBest(['Close [Ctrl+Q]']).isPressSafe).toBe(true);
    expect(dm.findBest(['Close']).isPressSafe).toBe(true);
  });

  it('never lets bare decoration stand for the words', () => {
    document.body.innerHTML =
      '<button title="Clear Bible [F9]" aria-label="Clear Bible">BB' +
      '</button>';
    const dm = install();
    const found = dm.findBest(['[F9]']);
    expect(found === null || found.isPressSafe !== true).toBe(true);
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
      x: 500,
      y: 400,
      width: 300,
      height: 200,
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
      x: 100,
      y: 100,
      width: 400,
      height: 300,
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

  it('aims at the centre of a thing too thin to have an inside edge', () => {
    // A divider between two panes is six pixels wide: 20 in from its
    // right edge is a point in the pane beside it.
    const divider = document.createElement('div');
    divider.getBoundingClientRect = () => {
      return { x: 300, y: 40, width: 6, height: 500, top: 40, left: 300 };
    };
    document.body.append(divider);
    document.elementFromPoint = () => divider;
    const seen = [];
    divider.addEventListener('contextmenu', (event) => {
      seen.push({ x: event.clientX, y: event.clientY });
    });
    const dm = install();
    expect(dm.openContextMenu(divider)).toEqual({ x: 303, y: 290 });
    expect(seen).toEqual([{ x: 303, y: 290 }]);
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
    expect(dm.visibilityOf(document.getElementById('copy'))).toBe('hidden');
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
      HOVER_MARKUP + '<button id="shown" title="Copy">C</button>';
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
    expect(document.querySelectorAll('[data-owa-hover-style]').length).toBe(1);
    dm.releaseHidden();
    expect(dm.visibilityOf(target)).toBe('hidden');
    expect(document.querySelectorAll('[data-owa-hover-style]').length).toBe(0);
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
    expect(document.querySelectorAll('[data-owa-hover-style]').length).toBe(1);
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
    expect(document.querySelectorAll('[data-owa-hover-style]').length).toBe(1);
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
    expect(document.querySelectorAll('[data-owa-hover-style]').length).toBe(0);
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
    // A list row says only what is unusual about a control; the ordinary
    // keys are not there to be read (see the next describe block).
    expect(row.isVisible).toBeUndefined();
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

  // The reader routinely has two panes called "Bible View" side by side.
  // The named part stood for BOTH, and walking up could never rescue it --
  // every ancestor they share is the same node, so every longer candidate
  // still matched two. It returned null, which made the chip the user had
  // pointed at answer "there is nothing left to show for that one", and it
  // took every control INSIDE the pane down with it.
  it('tells two same-named siblings apart', () => {
    document.body.innerHTML = `
            <div>
                <div data-widget-name="Bible View"><span>KJV</span></div>
                <div data-widget-name="Bible View"><span>Khmer</span></div>
            </div>`;
    const dm = install();
    const panes = document.querySelectorAll('[data-widget-name]');
    for (const pane of panes) {
      const selector = dm.selectorOf(pane);
      expect(selector).not.toBeNull();
      // The name is KEPT -- it is what survives a re-render; the
      // position is added only to say which of the two.
      expect(selector).toContain('[data-widget-name="Bible View"]');
      expect(document.querySelectorAll(selector)).toHaveLength(1);
      expect(document.querySelector(selector)).toBe(pane);
    }
    expect(dm.selectorOf(panes[0])).not.toBe(dm.selectorOf(panes[1]));
  });

  it('reaches a control inside one of two same-named panes', () => {
    // The cost of the bug was never the pane itself: one ambiguous
    // ancestor made every descendant under it untraceable too.
    document.body.innerHTML = `
            <div>
                <div data-widget-name="Bible View">
                    <div><button>Verse 1</button></div>
                </div>
                <div data-widget-name="Bible View">
                    <div><button>Verse 1</button></div>
                </div>
            </div>`;
    const dm = install();
    for (const button of document.querySelectorAll('button')) {
      const selector = dm.selectorOf(button);
      expect(selector).not.toBeNull();
      expect(document.querySelector(selector)).toBe(button);
    }
  });

  it('still leaves a lone named panel unqualified', () => {
    // The position is added ONLY to break a tie. A pane with no twin
    // keeps the clean name, so an ordinary selector does not start
    // carrying a brittle index it never needed.
    document.body.innerHTML = `
            <div>
                <div data-widget-name="Background"><span>x</span></div>
                <div data-widget-name="Videos"><span>y</span></div>
            </div>`;
    const dm = install();
    expect(dm.selectorOf(document.querySelector('[data-widget-name]'))).toBe(
      'div[data-widget-name="Background"]',
    );
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

// A LIST row is the words and where they are, and nothing else. Measured
// 2026-09-09 (EC-130): a 200-row list at ~180 tokens a row was 34 574 tokens
// into the model's cache, and every row carried the component and source file
// names the prompt forbids the model to repeat. `describe` keeps the full
// shape for the one-control answers (find, click, the picker).
describe('a list row is trimmed to what a reader needs', () => {
  it('carries the label, the panel and the place, and no internals', () => {
    document.body.innerHTML =
      '<div data-react-comp-name="FooComp" data-react-comp-fp="src/Foo.tsx">' +
      '<button title="Bible Lookup">Bible Lookup</button>' +
      '<button disabled>Save</button>' +
      '</div>';
    const dm = install();
    const rows = dm.listControls('', 50);
    const lookup = rows.find((row) => row.label === 'Bible Lookup');
    expect(Object.keys(lookup).sort()).toEqual(['inPanel', 'label', 'where']);
    expect(lookup.component).toBeUndefined();
    expect(lookup.sourceFile).toBeUndefined();
    expect(lookup.position).toBeUndefined();
    const save = rows.find((row) => row.label === 'Save');
    expect(save.isDisabled).toBe(true);
    // The one-control answer still has the developer's fields.
    const full = dm.describe(document.querySelector('[title="Bible Lookup"]'));
    expect(full.component).toBe('FooComp');
    expect(full.position.width).toBeDefined();
  });

  it('a tooltip that is a file path is not part of the label', () => {
    document.body.innerHTML =
      '<div title="C:\\Users\\somebody\\documents\\Amazing Grace.owl">' +
      'Amazing Grace</div>' +
      '<div title="/Users/somebody/Documents/Hymn.owl">Hymn</div>' +
      '<button title="Open C: drive">Drive</button>';
    const dm = install();
    expect(dm.labelOf(document.querySelectorAll('div')[0])).toBe(
      'Amazing Grace',
    );
    expect(dm.labelOf(document.querySelectorAll('div')[1])).toBe('Hymn');
    // Words that merely start with a letter and a colon are words.
    expect(dm.labelOf(document.querySelector('button'))).toBe(
      'Drive Open C: drive',
    );
  });
});
