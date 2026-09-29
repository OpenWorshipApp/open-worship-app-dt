// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

// `appHooks` reads `systemUtils.isDev` at module load, and the chain into
// `flexSizeHelpers` goes through it.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        pathUtils: { sep: '/' },
    },
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {},
}));

vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));

import { toNoteClosedFlexSize } from './previewerNoteCloseMigration';

describe('toNoteClosedFlexSize', () => {
    it('closes the note pane and hands its grow to the slides', () => {
        expect(toNoteClosedFlexSize('{"v1":["6"],"v2":["1"]}')).toBe(
            '{"v1":["7",null],"v2":["1",["second",1]]}',
        );
    });

    it('keeps a dragged layout and reads the grow off the shorthand', () => {
        expect(
            toNoteClosedFlexSize(
                '{"v1":["6.45902 1 0%"],"v2":["0.540984 1 0%"]}',
            ),
        ).toBe(
            '{"v1":["7.000004 1 0%",null],"v2":["0.540984 1 0%",' +
                '["second",0.540984]]}',
        );
    });

    it('treats an explicit null flag as open', () => {
        expect(toNoteClosedFlexSize('{"v1":["5 1 0%"],"v2":["1",null]}')).toBe(
            '{"v1":["6 1 0%",null],"v2":["1",["second",1]]}',
        );
    });

    it('leaves a layout the user already collapsed alone', () => {
        expect(
            toNoteClosedFlexSize('{"v1":["6"],"v2":["1",["second",1]]}'),
        ).toBeNull();
    });

    it('leaves anything that is not the two-pane previewer layout alone', () => {
        expect(toNoteClosedFlexSize('{"h1":["1"],"h2":["1"]}')).toBeNull();
        expect(toNoteClosedFlexSize('{"v2":["1"]}')).toBeNull();
        expect(toNoteClosedFlexSize('not json')).toBeNull();
        expect(toNoteClosedFlexSize('[1,2]')).toBeNull();
        expect(toNoteClosedFlexSize('')).toBeNull();
    });
});
