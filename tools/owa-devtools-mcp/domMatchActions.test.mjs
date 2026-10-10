// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { genDestructiveLabelRule } from './destructiveLabel.mjs';
import {
  PRESS_AT_CENTRE_SOURCE,
  genClickExpression,
  genDragExpression,
  genPressKeyExpression,
  genScrollExpression,
} from './domMatch.mjs';
import { toKeystroke } from './guide.mjs';
import { loadTranBundle } from './tran.mjs';

// The three things a user does on the page that no tool could do until
// 2026-10-10 -- right-click and double-click a control, press a key with the
// right panel focused, drag one thing onto another -- exercised the way the
// app gets them: the expression evaluated against a DOM. Same harness as
// `domMatch.test.mjs`; its own file so that one stays about matching.

const GUARD = { rule: genDestructiveLabelRule(loadTranBundle()) };

function run(expression) {
  return new Function(`return (${expression})`)();
}

beforeEach(() => {
  delete window.__owaDomMatch;
  document.body.innerHTML = '';
  Element.prototype.getBoundingClientRect = function () {
    return {
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      top: 10,
      left: 10,
      right: 50,
      bottom: 30,
    };
  };
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = function () {
    let node = this;
    while (node !== null && node.nodeType === 1) {
      if (getComputedStyle(node).display === 'none') {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  };
  // jsdom's elementFromPoint is a stub answering null; the drop lands on the
  // target itself then, which is what the fallback is for.
  document.elementFromPoint = () => null;
  // jsdom has neither. Chromium's DataTransfer lowercases a format and reads
  // 'text' as 'text/plain', which is what `carried` below expects to see.
  window.DataTransfer = class DataTransfer {
    constructor() {
      this.map = new Map();
      this.dropEffect = 'none';
      this.effectAllowed = 'all';
    }
    toKey(format) {
      const lowered = String(format).toLowerCase();
      return lowered === 'text' ? 'text/plain' : lowered;
    }
    setData(format, value) {
      this.map.set(this.toKey(format), String(value));
    }
    getData(format) {
      return this.map.get(this.toKey(format)) ?? '';
    }
    get types() {
      return [...this.map.keys()];
    }
  };
  window.DragEvent = class DragEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  };
});

describe('a press of another kind', () => {
  it('right-clicks as a contextmenu at the control, and nothing else', () => {
    document.body.innerHTML =
      '<li title="Amazing Grace.owl">Amazing Grace</li>';
    const row = document.querySelector('li');
    const seen = [];
    for (const type of ['click', 'dblclick', 'contextmenu']) {
      row.addEventListener(type, (event) => {
        seen.push([type, event.button, event.clientX]);
      });
    }
    const press = new Function(`return (${PRESS_AT_CENTRE_SOURCE})`)();
    expect(press(row, { button: 'right' })).toEqual({
      x: 30,
      y: 20,
      button: 'right',
    });
    expect(seen).toEqual([['contextmenu', 2, 30]]);
  });

  it('double-clicks as a mouse does: click, click, dblclick', () => {
    document.body.innerHTML = '<button>Open</button>';
    const button = document.querySelector('button');
    const seen = [];
    for (const type of ['click', 'dblclick', 'contextmenu']) {
      button.addEventListener(type, (event) => {
        seen.push([type, event.detail]);
      });
    }
    const press = new Function(`return (${PRESS_AT_CENTRE_SOURCE})`)();
    expect(press(button, { clicks: 2 })).toEqual({ x: 30, y: 20, clicks: 2 });
    expect(seen).toEqual([
      ['click', 1],
      ['click', 2],
      ['dblclick', 2],
    ]);
  });

  it('is an ordinary click when asked for nothing else', () => {
    document.body.innerHTML = '<button>Open</button>';
    const button = document.querySelector('button');
    const seen = [];
    for (const type of ['click', 'dblclick', 'contextmenu']) {
      button.addEventListener(type, (event) => {
        seen.push(type);
      });
    }
    const press = new Function(`return (${PRESS_AT_CENTRE_SOURCE})`)();
    // The guide card calls it with one argument.
    expect(press(button)).toEqual({ x: 30, y: 20 });
    expect(seen).toEqual(['click']);
  });

  it('reports the menu a right-click opened, and the button it used', async () => {
    document.body.innerHTML =
      '<li title="Amazing Grace.owl">Amazing Grace</li>' +
      '<div id="menu" role="menu" style="display:none">Rename</div>';
    const row = document.querySelector('li');
    row.addEventListener('contextmenu', () => {
      document.getElementById('menu').style.display = 'block';
    });
    const result = await run(
      genClickExpression(['Amazing Grace'], 100, 10, { button: 'right' }),
    );
    expect(result.button).toBe('right');
    expect(result.opened).toBe('menu');
    expect(result.didChange).toBe(true);
    expect(result.clicks).toBeUndefined();
  });

  // The firewall's page half reads the control whatever button is used: a
  // right-click on a Move to Trash button is still a press on it.
  it('still refuses a destructively named control on a right-click', async () => {
    document.body.innerHTML = '<button>Move to Trash</button>';
    const result = await run(
      genClickExpression(['Move to Trash'], 100, 10, {
        button: 'right',
        guard: GUARD,
      }),
    );
    expect(result.clicked).toBeNull();
    expect(result.refused).toBe('destructive');
  });
});

describe('pressing a key', () => {
  it('sends keydown and keyup with key and code, at the focused control', async () => {
    document.body.innerHTML =
      '<div id="list" tabindex="0" title="Slide list">slides</div>';
    const list = document.getElementById('list');
    const seen = [];
    list.addEventListener('keydown', (event) => {
      seen.push(['keydown', event.key, event.code, event.ctrlKey]);
    });
    document.addEventListener('keyup', (event) => {
      seen.push(['keyup', event.key]);
    });
    const result = await run(
      genPressKeyExpression(toKeystroke('ArrowRight'), {
        finds: ['Slide list'],
        settleMs: 10,
      }),
    );
    expect(result.pressed).toBe('ArrowRight');
    expect(result.focusedFirst).toContain('Slide list');
    expect(seen).toEqual([
      ['keydown', 'ArrowRight', 'ArrowRight', false],
      ['keyup', 'ArrowRight'],
    ]);
  });

  // A pane takes no focus; its keyboard surface is the tabIndex box inside
  // it -- never a button, which Enter would press.
  it('focuses the keyboard surface inside a named pane', async () => {
    document.body.innerHTML =
      '<div data-widget-name="Slides">' +
      '<button>Move to Trash</button>' +
      '<div id="inner" tabindex="0" title="Slide box">slides</div></div>';
    const seen = [];
    document.getElementById('inner').addEventListener('keydown', (event) => {
      seen.push(event.key);
    });
    const result = await run(
      genPressKeyExpression(toKeystroke('ArrowRight'), {
        finds: ['Slides'],
        settleMs: 10,
      }),
    );
    expect(result.pressed).toBe('ArrowRight');
    expect(result.focusedFirst).toContain('Slide box');
    expect(result.focusNote).toBeUndefined();
    expect(seen).toEqual(['ArrowRight']);
  });

  it('says when nothing there can take the focus', async () => {
    document.body.innerHTML =
      '<div data-widget-name="Slides"><span>nothing focusable</span></div>';
    const result = await run(
      genPressKeyExpression(toKeystroke('ArrowRight'), {
        finds: ['Slides'],
        settleMs: 10,
      }),
    );
    expect(result.pressed).toBe('ArrowRight');
    expect(result.focusedFirst).toBeUndefined();
    expect(result.focusNote).toContain('focus');
  });

  it('carries the modifiers a shortcut was written with', async () => {
    const seen = [];
    document.addEventListener('keydown', (event) => {
      seen.push([event.key, event.code, event.ctrlKey, event.shiftKey]);
    });
    const result = await run(
      genPressKeyExpression(toKeystroke('Ctrl+Shift+A'), { settleMs: 10 }),
    );
    expect(result.pressed).toBe('Ctrl+Shift+A');
    expect(seen).toEqual([['A', 'KeyA', true, true]]);
    // Nothing on screen changed, and the answer says so rather than
    // letting a missing field read as success.
    expect(result.didChange).toBe(false);
    expect(result.unverified).toBeTruthy();
  });

  // `MC-13`: the raw press_key is unguarded. This one is judged by the
  // control whose title names the key, as the walkthrough card's press is.
  it('refuses a key whose control cannot be undone', async () => {
    document.body.innerHTML =
      '<button title="Clear All [F6]">Clear All</button>';
    const seen = [];
    document.addEventListener('keydown', () => {
      seen.push('keydown');
    });
    const result = await run(
      genPressKeyExpression(toKeystroke('F6'), { guard: GUARD, settleMs: 10 }),
    );
    expect(result.pressed).toBeNull();
    expect(result.refused).toBe('destructive');
    expect(result.label).toContain('Clear All');
    expect(seen).toEqual([]);
  });

  it('lets a key whose control is ordinary through', async () => {
    document.body.innerHTML =
      '<button title="Clear Bible [F9]">Clear Bible</button>';
    const result = await run(
      genPressKeyExpression(toKeystroke('F9'), { guard: GUARD, settleMs: 10 }),
    );
    expect(result.pressed).toBe('F9');
  });

  it('refuses every key while the app is asking the user a question', async () => {
    document.body.innerHTML =
      '<div id="app-confirm-popup"><button>Yes</button></div>';
    const seen = [];
    document.addEventListener('keydown', () => {
      seen.push('keydown');
    });
    for (const phrase of ['Enter', 'Escape', 'Tab']) {
      const result = await run(
        genPressKeyExpression(toKeystroke(phrase), {
          guard: GUARD,
          settleMs: 10,
        }),
      );
      expect(result.refused, phrase).toBe('question');
    }
    expect(seen).toEqual([]);
  });

  // The exact case `MC-13` was filed for.
  it('refuses Enter and Space on a focused control that cannot be undone', async () => {
    document.body.innerHTML = '<button>Move to Trash</button>';
    document.querySelector('button').focus();
    for (const phrase of ['Enter', 'Space']) {
      const result = await run(
        genPressKeyExpression(toKeystroke(phrase), {
          guard: GUARD,
          settleMs: 10,
        }),
      );
      expect(result.refused, phrase).toBe('destructive');
    }
    // ...and an arrow key on the same focus is not a press of it.
    const result = await run(
      genPressKeyExpression(toKeystroke('ArrowDown'), {
        guard: GUARD,
        settleMs: 10,
      }),
    );
    expect(result.pressed).toBe('ArrowDown');
  });

  it('will not focus a destructively named control to key it', async () => {
    document.body.innerHTML = '<button>Move to Trash</button>';
    const result = await run(
      genPressKeyExpression(toKeystroke('Enter'), {
        finds: ['Move to Trash'],
        guard: GUARD,
        settleMs: 10,
      }),
    );
    expect(result.refused).toBe('destructive');
    expect(document.activeElement).toBe(document.body);
  });

  it('answers with the near misses when the control to focus is not there', async () => {
    document.body.innerHTML = '<button>Slide list</button>';
    const result = await run(
      genPressKeyExpression(toKeystroke('ArrowRight'), {
        finds: ['Run player'],
        timeoutMs: 50,
        settleMs: 10,
      }),
    );
    expect(result.pressed).toBeNull();
    expect(result.reason).toContain('focus');
    expect(Array.isArray(result.nearMisses)).toBe(true);
  });
});

describe('dragging one thing onto another', () => {
  function setUpDragAndDrop() {
    document.body.innerHTML =
      '<ul><li id="song" draggable="true" title="Amazing Grace.owl">' +
      '<span>Amazing Grace</span></li></ul>' +
      '<div id="sheet" data-widget-name="Presenting Flows">' +
      '<div id="row" title="Sunday.owapf">Sunday</div></div>';
    const song = document.getElementById('song');
    const row = document.getElementById('row');
    const seen = [];
    song.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(
        'text',
        JSON.stringify({ type: 'appDocument' }),
      );
      event.dataTransfer.setData('application/x-owa-drag-appdocument', '');
      seen.push('dragstart');
    });
    song.addEventListener('dragend', () => {
      seen.push('dragend');
    });
    row.addEventListener('dragover', (event) => {
      if (
        event.dataTransfer.types.includes('application/x-owa-drag-appdocument')
      ) {
        event.preventDefault();
        seen.push(['dragover', event.ctrlKey, event.clientY]);
      }
    });
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      seen.push(['drop', JSON.parse(event.dataTransfer.getData('text')).type]);
    });
    return seen;
  }

  it('carries one DataTransfer from the dragstart to the drop', async () => {
    const seen = setUpDragAndDrop();
    const result = await run(
      genDragExpression(['Amazing Grace'], ['Sunday'], { settleMs: 10 }),
    );
    expect(result.dragged.label).toContain('Amazing Grace');
    expect(result.onto.label).toContain('Sunday');
    expect(result.accepted).toBe(true);
    expect(result.dropped).toBe(true);
    expect(result.carried).toEqual([
      'text/plain',
      'application/x-owa-drag-appdocument',
    ]);
    expect(result.unverified).toBeUndefined();
    expect(seen).toEqual([
      'dragstart',
      ['dragover', false, 20],
      ['drop', 'appDocument'],
      'dragend',
    ]);
  });

  // `before` and `after` are the row's reorder bands, sent with Ctrl held --
  // what this app's rows read as "put it here" rather than "attach it".
  it('aims before or after the target with Ctrl held', async () => {
    const seen = setUpDragAndDrop();
    await run(
      genDragExpression(['Amazing Grace'], ['Sunday'], {
        place: 'before',
        settleMs: 10,
      }),
    );
    expect(seen[1]).toEqual(['dragover', true, 12]);
    const seenAfter = setUpDragAndDrop();
    await run(
      genDragExpression(['Amazing Grace'], ['Sunday'], {
        place: 'after',
        settleMs: 10,
      }),
    );
    expect(seenAfter[1]).toEqual(['dragover', true, 28]);
  });

  // A Ctrl drop on a row is "put it at MY position" whichever edge it hits,
  // so `after` a row that has a next one is `before` that next one.
  it('lands after a row on the next row, before it', async () => {
    const seen = setUpDragAndDrop();
    const sheet = document.getElementById('sheet');
    const monday = document.createElement('div');
    monday.title = 'Monday.owapf';
    monday.textContent = 'Monday';
    sheet.appendChild(monday);
    const onMonday = [];
    monday.addEventListener('dragover', (event) => {
      event.preventDefault();
      onMonday.push(['dragover', event.ctrlKey, event.clientY]);
    });
    const result = await run(
      genDragExpression(['Amazing Grace'], ['Sunday'], {
        place: 'after',
        settleMs: 10,
      }),
    );
    expect(onMonday).toEqual([['dragover', true, 12]]);
    expect(seen).toEqual(['dragstart', 'dragend']);
    expect(result.accepted).toBe(true);
  });

  it('says so when nothing under the point took the drop', async () => {
    document.body.innerHTML =
      '<li id="song" draggable="true" title="Amazing Grace.owl">Amazing Grace</li>' +
      '<button>Bible Lookup</button>';
    document.getElementById('song').addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text', '{"type":"appDocument"}');
    });
    const result = await run(
      genDragExpression(['Amazing Grace'], ['Bible Lookup'], { settleMs: 10 }),
    );
    expect(result.accepted).toBe(false);
    expect(result.dropped).toBe(false);
    expect(result.unverified).toBeTruthy();
  });

  it('refuses a control that is not draggable, or starts no drag', async () => {
    document.body.innerHTML =
      '<button>Bible Lookup</button><div title="Sunday.owapf">Sunday</div>';
    const fixed = await run(
      genDragExpression(['Bible Lookup'], ['Sunday'], { settleMs: 10 }),
    );
    expect(fixed.dragged).toBeNull();
    expect(fixed.reason).toContain('cannot be dragged');
    document.body.innerHTML =
      '<div draggable="true" title="Box">Box</div><div title="Sunday.owapf">Sunday</div>';
    const silent = await run(
      genDragExpression(['Box'], ['Sunday'], { settleMs: 10 }),
    );
    expect(silent.dragged).toBeNull();
    expect(silent.reason).toContain('starts no drag');
  });

  it('refuses either end that is named for what cannot be undone', async () => {
    document.body.innerHTML =
      '<li draggable="true" title="Amazing Grace.owl">Amazing Grace</li>' +
      '<button>Move to Trash</button>';
    const result = await run(
      genDragExpression(['Amazing Grace'], ['Move to Trash'], {
        guard: GUARD,
        settleMs: 10,
      }),
    );
    expect(result.dragged).toBeNull();
    expect(result.refused).toBe('destructive');
  });

  it('answers with the near misses for an end that is not on screen', async () => {
    document.body.innerHTML =
      '<li draggable="true" title="Amazing Grace.owl">Amazing Grace</li>';
    const result = await run(
      genDragExpression(['Amazing Grace'], ['Sunday'], {
        timeoutMs: 50,
        settleMs: 10,
      }),
    );
    expect(result.dragged).toBeNull();
    expect(result.reason).toContain('drop on');
    expect(Array.isArray(result.nearMisses)).toBe(true);
  });
});

// MC-51: a file row's title is the name WITH its extension, and an expanded
// run-sheet row's own text is every line of the sheet -- the title is the one
// part left that names it.
describe('a row named by its file name', () => {
  it('is press-safe by its bare name, through the extension', async () => {
    document.body.innerHTML =
      '<ul><li title="Sunday.owpf"><div>Sunday</div>' +
      '<div>1 Clear All</div><div>2 Amazing Grace</div></li></ul>';
    const row = document.querySelector('li');
    let presses = 0;
    row.addEventListener('contextmenu', () => {
      presses += 1;
    });
    const result = await run(
      genClickExpression(['Sunday'], 100, 10, { button: 'right' }),
    );
    expect(result.clicked).not.toBeNull();
    expect(result.button).toBe('right');
    expect(presses).toBe(1);
  });

  it('still refuses a name that merely begins another', async () => {
    document.body.innerHTML =
      '<ul><li title="Sunday Evening.owpf"><div>Sunday Evening</div>' +
      '<div>1 Clear All</div></li></ul>';
    const result = await run(genClickExpression(['Sunday'], 100, 10));
    expect(result.clicked).toBeNull();
    expect(result.nearest.label).toContain('Sunday Evening');
  });
});

// MC-54: the long lists are windowed, so a row past the fold is not in the
// DOM until the list is scrolled.
describe('scrolling a list', () => {
  function setUpList() {
    document.body.innerHTML =
      '<div data-widget-name="Document List"><div id="list">' +
      '<li title="Alpha.owl">Alpha</li><li title="Beta.owl">Beta</li>' +
      '</div></div><button>Elsewhere</button>';
    const list = document.getElementById('list');
    Object.defineProperty(list, 'scrollHeight', { value: 1000 });
    Object.defineProperty(list, 'clientHeight', { value: 200 });
    list.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        top: 0,
        left: 0,
        right: 300,
        bottom: 200,
      };
    };
    return list;
  }

  it('pages the list a row is in and says what is in view', async () => {
    const list = setUpList();
    // The browser fires scroll for a moved scrollTop by itself (jsdom does
    // not); a synthetic one on top made a windowed list render twice.
    let scrollEvents = 0;
    list.addEventListener('scroll', () => {
      scrollEvents += 1;
    });
    const result = await run(
      genScrollExpression(['Alpha'], { to: 'down', settleMs: 10 }),
    );
    expect(result.scrolled).toBe('Document List');
    expect(result.from).toBe(0);
    expect(result.now).toBe(180);
    expect(result.max).toBe(800);
    expect(result.didChange).toBe(true);
    expect(result.isAtTop).toBe(false);
    // The words a row is listed under, the same `owa_list_ui` shows.
    expect(result.inView).toEqual(['Alpha Alpha.owl', 'Beta Beta.owl']);
    expect(scrollEvents).toBe(0);
    expect(list.scrollTop).toBe(180);
  });

  it('finds the list inside a named panel, and stops at the ends', async () => {
    const list = setUpList();
    const bottom = await run(
      genScrollExpression(['Document List'], { to: 'bottom', settleMs: 10 }),
    );
    expect(bottom.now).toBe(800);
    expect(bottom.isAtBottom).toBe(true);
    const top = await run(
      genScrollExpression(['Document List'], { to: 'top', settleMs: 10 }),
    );
    expect(top.now).toBe(0);
    expect(top.isAtTop).toBe(true);
    expect(list.scrollTop).toBe(0);
  });

  it('answers with the near misses when nothing is called that', async () => {
    setUpList();
    const result = await run(
      genScrollExpression(['Nowhere'], { timeoutMs: 50, settleMs: 10 }),
    );
    expect(result.scrolled).toBeNull();
    expect(result.reason).toContain('scroll');
  });
});
