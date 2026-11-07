import { describe, expect, test } from 'vitest';

import {
    clearBackground,
    clearForeground,
    renderBackgroundColor,
    renderBackgroundImage,
    renderBackgroundVideo,
    renderFG,
    renderPresent,
} from './presentingHelpers';

// Nothing in the app imports this module any more: `renderPresent` is a stub
// that declines every script, so all a test can hold it to is that it stays
// inert and still refuses a background image that is not a URL.
describe('presentingHelpers', () => {
    test('renderPresent declines every script it is handed', () => {
        expect(renderPresent({ script: 'shadow.innerHTML = "";' })).toBe(false);
        expect(renderPresent(undefined)).toBe(false);
    });

    test('a background image path must be a URL', () => {
        expect(() => {
            renderBackgroundImage('backgrounds/cross.png');
        }).toThrow(TypeError);
        expect(
            renderBackgroundImage('file:///C:/backgrounds/cross.png'),
        ).toBeUndefined();
    });

    test('the other builders return nothing for the caller to use', () => {
        expect(renderFG('<p>Amazing grace</p>')).toBeUndefined();
        expect(clearForeground()).toBeUndefined();
        expect(renderBackgroundColor('#123456')).toBeUndefined();
        expect(renderBackgroundVideo('file:///loop.mp4')).toBeUndefined();
        expect(clearBackground()).toBeUndefined();
    });
});
