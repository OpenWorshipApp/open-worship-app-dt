// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  genInspectExpression,
  INSPECT_LIMIT_MAX,
  INSPECT_STYLE_PATTERN,
} from './inspect.mjs';

// Evaluated the way the app gets it: a string run in the page.
function run(expression) {
  return new Function(`return (${expression})`)();
}

beforeEach(() => {
  document.body.innerHTML = '';
  // jsdom has no checkVisibility; Electron's Chromium does.
  Element.prototype.checkVisibility = function (options = {}) {
    const style = getComputedStyle(this);
    if (style.display === 'none') {
      return false;
    }
    return !(options.checkVisibilityCSS && style.visibility === 'hidden');
  };
});

describe('genInspectExpression', () => {
  it('answers the count and what each match is, without acting', () => {
    document.body.innerHTML = `
      <div data-widget-name="Bibles" class="pane open" role="region">
        <button title="Copy" aria-pressed="true">Copy  verse</button>
      </div>
      <div data-widget-name="Bible Notes" class="pane" style="visibility: hidden">
        Notes
      </div>`;
    let clicked = 0;
    document.querySelector('button').addEventListener('click', () => {
      clicked++;
    });
    const result = run(genInspectExpression('[data-widget-name]'));
    expect(result.count).toBe(2);
    expect(result.more).toBeUndefined();
    expect(result.matches[0]).toMatchObject({
      tag: 'div',
      className: 'pane open',
      visibility: 'shown',
      attributes: { role: 'region', 'data-widget-name': 'Bibles' },
      text: 'Copy verse',
      childCount: 1,
    });
    expect(result.matches[1].visibility).toBe('hidden');
    expect(
      run(genInspectExpression('button')).matches[0].attributes,
    ).toEqual({ title: 'Copy', 'aria-pressed': 'true' });
    expect(clicked).toBe(0);
  });

  it('never reads what a field holds', () => {
    document.body.innerHTML = `
      <input class="key" value="sk-secret-value">
      <textarea>my own words</textarea>
      <div contenteditable="true"><p>a note being typed</p></div>`;
    const result = run(genInspectExpression('input, textarea, p'));
    expect(result.count).toBe(3);
    expect(JSON.stringify(result)).not.toMatch(/secret|own words|being typed/);
    expect(result.matches[0].className).toBe('key');
  });

  it('searches open shadow roots and says which matches are in one', () => {
    const host = document.createElement('div');
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<section class="slide">One</section>';
    document.body.insertAdjacentHTML(
      'beforeend',
      '<section class="slide">Two</section>',
    );
    const result = run(genInspectExpression('.slide'));
    expect(result.count).toBe(2);
    expect(
      result.matches.map((one) => {
        return [one.text, one.isInShadow === true];
      }),
    ).toEqual([
      ['Two', false],
      ['One', true],
    ]);
  });

  it('reads only the computed styles asked for, by name', () => {
    document.body.innerHTML = '<p style="color: red; margin-top: 4px">x</p>';
    const result = run(
      genInspectExpression('p', {
        styles: ['color', 'margin-top', 'x;alert(1)', 'a b'],
      }),
    );
    expect(result.matches[0].styles).toEqual({
      color: 'rgb(255, 0, 0)',
      'margin-top': '4px',
    });
    expect(INSPECT_STYLE_PATTERN.test('--app-gap')).toBe(true);
    expect(INSPECT_STYLE_PATTERN.test('color:red')).toBe(false);
  });

  it('caps the matches it describes and counts the rest', () => {
    document.body.innerHTML = '<i></i>'.repeat(30);
    const few = run(genInspectExpression('i', { limit: 3 }));
    expect([few.count, few.matches.length, few.more]).toEqual([30, 3, 27]);
    const capped = run(genInspectExpression('i', { limit: 999 }));
    expect(capped.matches).toHaveLength(INSPECT_LIMIT_MAX);
  });

  it('answers a selector the page cannot read in words, and nothing when none match', () => {
    expect(run(genInspectExpression('div[')).error).toMatch(/not a selector/);
    expect(run(genInspectExpression('.none'))).toEqual({
      count: 0,
      matches: [],
      more: undefined,
    });
  });

  it('carries the selector as data, never as code', () => {
    window.__owaInspectRan = false;
    const result = run(
      genInspectExpression('"); window.__owaInspectRan = true; ("'),
    );
    expect(window.__owaInspectRan).toBe(false);
    expect(result.error).toMatch(/not a selector/);
  });
});
