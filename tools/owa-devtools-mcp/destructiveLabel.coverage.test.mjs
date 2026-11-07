import { describe, expect, test } from 'vitest';

import {
  findKeyRefusal,
  findPressRefusal,
  genDestructiveLabelRule,
} from './destructiveLabel.mjs';

// The page half of the interlock, fed plain objects shaped like the DOM it
// reads in the page: `closest`, `matches`, `getAttribute`, `textContent`, and
// a root that answers `querySelectorAll`.
const englishRule = genDestructiveLabelRule({ dictionaries: {} });

function genElement({ title = null, ariaLabel = null } = {}) {
  return {
    closest: () => {
      return null;
    },
    matches: () => {
      return false;
    },
    getAttribute: (name) => {
      return name === 'title'
        ? title
        : name === 'aria-label'
          ? ariaLabel
          : null;
    },
    textContent: '',
  };
}

function genRoot(elementList) {
  return {
    querySelectorAll: () => {
      return elementList;
    },
  };
}

describe('findPressRefusal', () => {
  // What the matcher resolved may be a text node, nothing at all, or a value
  // a broken page script returned: none of them is a control to refuse.
  test('anything that is not an element is not refused', () => {
    for (const value of [null, undefined, 'Delete', 42, {}, { closest: 1 }]) {
      expect(findPressRefusal(value, englishRule)).toBe(null);
    }
  });

  test('an element is still read when it is one', () => {
    expect(
      findPressRefusal(genElement({ title: 'Move to Trash' }), englishRule),
    ).toEqual({ refused: 'destructive', label: 'Move to Trash' });
  });
});

describe('findKeyRefusal', () => {
  test('a keystroke with no label is not refused', () => {
    expect(findKeyRefusal({ label: '   ' }, englishRule, genRoot([]))).toBe(
      null,
    );
    expect(findKeyRefusal(null, englishRule, genRoot([]))).toBe(null);
  });

  test('a key whose own name cannot be undone is refused on its name', () => {
    expect(findKeyRefusal({ label: 'Delete' }, englishRule, null)).toEqual({
      refused: 'destructive',
      label: 'Delete',
    });
  });

  // Without a document to read, a key is judged on its name alone.
  test('with no root to read, an ordinary key name is let through', () => {
    for (const root of [null, undefined, 'document', { querySelectorAll: 1 }]) {
      expect(findKeyRefusal({ label: 'F6' }, englishRule, root)).toBe(null);
    }
  });

  test('a key is as destructive as the control whose title names it', () => {
    const root = genRoot([
      genElement({ title: 'Clear Long Text [F9]' }),
      genElement({ title: 'Clear All [F6]' }),
    ]);
    expect(findKeyRefusal({ label: 'F6' }, englishRule, root)).toEqual({
      refused: 'destructive',
      label: 'Clear All [F6]',
    });
    expect(findKeyRefusal({ label: 'F9' }, englishRule, root)).toBe(null);
  });
});

// `genDestructiveLabelRule` reading a dictionary of translations is in each
// package's tests (`src/lang/data/online/<code>/tests/tools/owa-devtools-mcp/`).
