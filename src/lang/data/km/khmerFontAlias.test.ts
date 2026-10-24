// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';

import khmer from './index';

// A Khmer font installed on the presenting computer never reaches a phone or
// TV watching a virtual display: each drew its own system face instead.
describe('Khmer font names answered by the shipped Battambang', () => {
    const css = khmer.genCss();
    const facesOf = (family: string) => {
        return css
            .split('@font-face')
            .filter((rule) => rule.includes(`font-family: "${family}";`));
    };

    test('`Battambang` is the shipped font, in every weight', () => {
        const faces = facesOf('Battambang');
        expect(faces).toHaveLength(5);
        for (const weight of ['normal', 'bold', '300', '100', '900']) {
            expect(
                faces.some((face) => face.includes(`font-weight: ${weight};`)),
            ).toBe(true);
        }
        // The same file as the app's own family: no installed copy needed.
        expect(faces.every((face) => !face.includes('local('))).toBe(true);
    });

    test('a look-alike installed here wins; a device without it gets ours', () => {
        for (const family of ['Khmer OS Battambang', 'Kh Battambang']) {
            const [face, ...rest] = facesOf(family);
            expect(rest).toHaveLength(0);
            expect(face).toMatch(
                new RegExp(`src: local\\("${family}"\\), url\\(.+\\)`),
            );
        }
    });
});
