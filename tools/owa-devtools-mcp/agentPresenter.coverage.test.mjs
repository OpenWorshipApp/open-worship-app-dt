// The sentences the offline bot and the `/` commands say about the selection
// and the run sheet, when a field the relay hands over is not the object it
// should be. A sentence for a person must never say "slide undefined".

import { describe, expect, test } from 'vitest';

import {
  describeRunSheet,
  describeSelectedDocument,
} from './agentPresenter.mjs';

describe('a slide or a run line that is not an object', () => {
  test('the selection is still named, and nothing reads "undefined"', () => {
    const said = describeSelectedDocument({
      name: 'Blue Lantern',
      kind: 'song',
      slideCount: 2,
      onScreen: 'not a slide',
      next: 7,
    });
    expect(said).toMatch(
      /^The song "Blue Lantern" is selected \(2 slides\)\. /,
    );
    expect(said).not.toContain('undefined');
    expect(said).not.toContain('slide ');
  });

  test('the run sheet is still named, and nothing reads "undefined"', () => {
    const said = describeRunSheet({
      openSheets: [
        { name: 'Sunday', lineCount: 3, cursor: 'not a line', next: 5 },
      ],
    });
    expect(said).toMatch(/^The run sheet "Sunday" is open \(3 lines\)\. /);
    expect(said).not.toContain('undefined');
    expect(said).not.toContain('line ');
  });
});
