// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { genHighlightSelectorExpression } from './domMatch.mjs';

// The expression is evaluated in the app page, so it is exercised the same
// way: evaluated. The wrapping parenthesis matters (the string starts with a
// newline, and a bare `return` before it would come back empty-handed).
function run(expression) {
  return new Function(`return (${expression})`)();
}

const originalRect = Element.prototype.getBoundingClientRect;
const originalCheckVisibility = Element.prototype.checkVisibility;

beforeEach(() => {
  delete window.__owaDomMatch;
  document.body.innerHTML = '';
  // jsdom lays nothing out; the ring needs a box to be drawn around.
  Element.prototype.getBoundingClientRect = function () {
    return { x: 10, y: 20, width: 40, height: 20, top: 20, left: 10 };
  };
  Element.prototype.checkVisibility = function () {
    return true;
  };
});

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.getBoundingClientRect = originalRect;
  if (originalCheckVisibility === undefined) {
    delete Element.prototype.checkVisibility;
  } else {
    Element.prototype.checkVisibility = originalCheckVisibility;
  }
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// The user POINTED at this control: its chip rings exactly that element,
// never a guess through the label matcher.
describe('genHighlightSelectorExpression', () => {
  it('says so in words when the selector cannot be read', () => {
    expect(
      run(genHighlightSelectorExpression('##not a selector', true)),
    ).toEqual({
      found: false,
      reason: 'That is not a selector this page can read.',
    });
  });

  it('says so in words when the control has gone', () => {
    expect(run(genHighlightSelectorExpression('#gone', true))).toEqual({
      found: false,
      reason: 'That control is not on the screen any more.',
    });
  });

  // "Copy" is on two controls; the one picked is the one that lights up.
  it('rings the element the selector names for four seconds', () => {
    vi.useFakeTimers();
    Element.prototype.getBoundingClientRect = function () {
      return this.id === 'copy-two'
        ? { x: 300, y: 40, width: 50, height: 20, top: 40, left: 300 }
        : { x: 10, y: 20, width: 40, height: 20, top: 20, left: 10 };
    };
    document.body.innerHTML =
      '<button id="copy-one" title="Copy">Copy</button>' +
      '<button id="copy-two" title="Copy">Copy</button>';
    const result = run(genHighlightSelectorExpression('#copy-two', true));
    expect(result.found).toBe(true);
    expect(result.match.label).toBe('Copy');
    expect(result.match.position).toEqual({
      x: 300,
      y: 40,
      width: 50,
      height: 20,
    });
    expect(result.revealedForHover).toBeUndefined();
    const markers = document.querySelectorAll('[data-owa-find-marker]');
    expect(markers).toHaveLength(1);
    expect(markers[0].style.left).toBe('300px');
    expect(markers[0].style.top).toBe('40px');
    vi.advanceTimersByTime(4000);
    expect(document.querySelectorAll('[data-owa-find-marker]')).toHaveLength(0);
  });

  it('only describes the element when not asked to ring it', () => {
    document.body.innerHTML = '<button id="save">Save</button>';
    const result = run(genHighlightSelectorExpression('#save', false));
    expect(result.found).toBe(true);
    expect(result.match.label).toBe('Save');
    expect(document.querySelectorAll('[data-owa-find-marker]')).toHaveLength(0);
  });
});
