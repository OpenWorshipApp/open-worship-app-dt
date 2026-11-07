// @vitest-environment jsdom
// The Khmer cases of `tools/owa-devtools-mcp/domMatch.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { beforeEach, describe, expect, it } from 'vitest';

import { genDestructiveLabelRule } from '../../../../../../../../tools/owa-devtools-mcp/destructiveLabel.mjs';
import {
  DOM_MATCH_RUNTIME,
  OPENED_WINDOW_WAIT_MS,
  addOpenedWindow,
  genClickExpression,
  genFindUiExpression,
  genListUiExpression,
  genTypeExpression,
} from '../../../../../../../../tools/owa-devtools-mcp/domMatch.mjs';
import { loadTranBundle } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

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

describe('the packaged expressions', () => {
  it('will not press a Khmer control named for what cannot be undone', async () => {
    document.body.innerHTML =
      '<div class="app-context-menu-item" title="ផ្លាស់ទីទៅធុងសំរាម">' +
      '<div>ផ្លាស់ទីទៅធុងសំរាម</div></div>';
    const refused = await run(
      genClickExpression(['ផ្លាស់ទីទៅធុងសំរាម'], 100, 0, { guard: GUARD }),
    );
    expect(refused.refused).toBe('destructive');
  });
});
