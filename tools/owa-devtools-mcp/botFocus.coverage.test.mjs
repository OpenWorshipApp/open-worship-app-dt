import { describe, expect, it } from 'vitest';

import {
  BOT_FOCUS_KEYS,
  DEFAULT_BOT_FOCUS,
  detectBotFocus,
  getBotFocus,
  toBotFocus,
} from './botFocus.mjs';

// A focus read back off disk, off a URL or handed in by a model is not
// trusted: an unknown one answers as the presenter, never as nothing.
describe('toBotFocus', () => {
  it('keeps every declared focus as it is', () => {
    for (const key of BOT_FOCUS_KEYS) {
      expect(toBotFocus(key)).toBe(key);
    }
  });

  it('answers anything undeclared as the presenter', () => {
    expect(DEFAULT_BOT_FOCUS).toBe('presenter');
    for (const value of [
      'presenter.html',
      'Reader',
      '',
      undefined,
      null,
      42,
      { key: 'reader' },
    ]) {
      expect(toBotFocus(value)).toBe('presenter');
    }
  });
});

describe('getBotFocus and detectBotFocus', () => {
  it('hands out the descriptor of a declared key only', () => {
    expect(getBotFocus('reader')?.window).toBe('reader.html');
    expect(getBotFocus('nope')).toBeNull();
  });

  // The longest window name wins, so `appDocumentEditor.html` is not taken
  // by a shorter key that happens to be inside it.
  it('reads which window a URL is showing', () => {
    expect(
      detectBotFocus('https://localhost:3000/appDocumentEditor.html?x=1'),
    ).toBe('appDocumentEditor');
    expect(detectBotFocus('/bibleNote.html')).toBe('bibleNote');
    expect(detectBotFocus('/screen.html')).toBeNull();
    expect(detectBotFocus('')).toBeNull();
    expect(detectBotFocus(undefined)).toBeNull();
  });
});
