import { describe, expect, it } from 'vitest';

import {
  AGENT_MENU_ACTIONS,
  formatMenuResult,
  genMenuClickExpression,
  genMenuListExpression,
} from './agentMenu.mjs';

describe('owa_menu expressions', () => {
  it('asks the main process over its own channels, and refuses a locked window', () => {
    expect(AGENT_MENU_ACTIONS).toEqual(['list', 'click']);
    const list = genMenuListExpression();
    expect(list).toContain('sendSync("main:app:agent-menu-list")');
    expect(list).toContain("typeof require !== 'function'");
    const click = genMenuClickExpression('View > Reload');
    expect(click).toContain('"main:app:agent-menu-click", "View > Reload"');
  });

  // An item's words are caller-supplied text, and this string is evaluated
  // in a page.
  it('cannot be broken out of by what a caller writes', () => {
    const expression = genMenuClickExpression(`'); throw new Error("x"); ('`);
    expect(() => {
      return new Function(`return ${expression}`);
    }).not.toThrow();
  });

  it('passes a refusal through as the main process wrote it', () => {
    expect(formatMenuResult({ isError: true, reason: 'greyed out' })).toEqual({
      isError: true,
      text: 'greyed out',
    });
    expect(formatMenuResult({ clicked: 'View > Reload' })).toEqual({
      isError: false,
      text: '{"clicked":"View > Reload"}',
    });
    expect(formatMenuResult(null).isError).toBe(true);
  });
});
