import { describe, expect, it } from 'vitest';

import {
  selectGuideStepIndexForTopic,
  selectGuideStepsForTopic,
  toKeyCode,
  toKeystroke,
} from './guide.mjs';

describe('toKeyCode', () => {
  it('names the space bar the way a key event does', () => {
    expect(toKeyCode(' ')).toBe('Space');
    expect(toKeyCode('a')).toBe('KeyA');
    expect(toKeyCode('7')).toBe('Digit7');
    expect(toKeyCode('F9')).toBe('F9');
  });
});

// A step's bold text is handed in as it was found; anything that is not
// words is no keystroke, and must never become a key pressed into the app.
describe('toKeystroke', () => {
  it('reads nothing out of what is not text', () => {
    expect(toKeystroke(undefined)).toBeNull();
    expect(toKeystroke(null)).toBeNull();
    expect(toKeystroke(42)).toBeNull();
    expect(toKeystroke({ key: 'F9' })).toBeNull();
  });

  it('still reads a written shortcut', () => {
    expect(toKeystroke('Ctrl+Q')).toMatchObject({
      key: 'q',
      code: 'KeyQ',
      ctrlKey: true,
      shiftKey: false,
    });
  });
});

// A topic word and a step word are read in their singular: "colours" asked
// for must find the step that says "colour", and the other way round.
describe('a topic in the plural', () => {
  const steps = [
    { text: 'Open the Background panel.' },
    { text: 'Pick a colour you like.' },
  ];

  it('finds the step written in the singular', () => {
    expect(selectGuideStepIndexForTopic(steps, 'colours')).toBe(1);
    expect(selectGuideStepsForTopic(steps, 'colours')).toEqual([steps[1]]);
  });

  it('finds a plural step from a singular topic', () => {
    const plural = [steps[0], { text: 'Pick one of the colours.' }];
    expect(selectGuideStepIndexForTopic(plural, 'colour')).toBe(1);
  });

  // A short word is never cut: "bus" is not "bu".
  it('keeps a word of four letters or fewer whole', () => {
    const short = [steps[0], { text: 'Wait for the bu stop.' }];
    expect(selectGuideStepIndexForTopic(short, 'bus')).toBeNull();
  });
});

// A translation read as the English page's steps (`lineUpTranslatedSteps`)
// is in each package's tests (`src/lang/data/online/<code>/tests/tools/owa-devtools-mcp/`).
