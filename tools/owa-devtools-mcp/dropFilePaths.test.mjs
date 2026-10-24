import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    MAX_DROP_FILE_COUNT,
    checkDropFilePaths,
    checkIsUnderRoot,
    getDropFileRootList,
} from './dropFilePaths.mjs';

const ROOT = path.resolve('/fixtures/root');
const INSIDE = path.join(ROOT, 'a.png');
const OUTSIDE = path.resolve('/home/user/secret.txt');

// A disk with three things on it, and one link from the fixtures out.
const LINK = path.join(ROOT, 'escape.txt');
const fileSystem = {
    realpathSync(filePath) {
        const resolved = path.resolve(filePath);
        if (resolved === LINK) {
            return OUTSIDE;
        }
        if ([ROOT, INSIDE, OUTSIDE].includes(resolved)) {
            return resolved;
        }
        throw new Error('ENOENT');
    },
};

function check(pathList) {
    return checkDropFilePaths(pathList, {
        rootList: [ROOT],
        fileSystem,
        platform: 'linux',
    });
}

describe('which files owa_drop_files may drop', () => {
    it('takes a fixture, and the fixture folder itself', () => {
        expect(check([INSIDE, ROOT])).toEqual({ pathList: [INSIDE, ROOT] });
    });

    // A drop copies what it carries into the user's folders: nothing that
    // is not a fixture, however it is spelled, and no link out of one.
    it('refuses a file outside the fixtures, a relative path and a link out', () => {
        expect(check([OUTSIDE]).refusal).toContain('Only test fixtures');
        expect(check([path.join(ROOT, '..', 'x')]).refusal).toBeTruthy();
        expect(check(['a.png']).refusal).toContain('absolute path');
        expect(check([LINK]).refusal).toContain('Only test fixtures');
    });

    it('refuses a file that is not there, nothing, and too many', () => {
        expect(check([path.join(ROOT, 'missing.png')]).refusal).toContain(
            'no file or folder',
        );
        expect(check([]).refusal).toBeTruthy();
        expect(
            check(new Array(MAX_DROP_FILE_COUNT + 1).fill(INSIDE)).refusal,
        ).toContain(`at most ${MAX_DROP_FILE_COUNT}`);
    });

    it('compares a root without case on Windows and macOS only', () => {
        const root = path.resolve('/Fixtures');
        const lower = path.resolve('/fixtures/a.png');
        expect(checkIsUnderRoot(lower, root, 'win32')).toBe(true);
        expect(checkIsUnderRoot(lower, root, 'linux')).toBe(false);
        // A sibling that merely starts with the root's name is not inside.
        expect(
            checkIsUnderRoot(path.resolve('/fixtures-2/a'), ROOT, 'linux'),
        ).toBe(false);
    });

    it('allows the repository test-results and the temp folder', () => {
        const rootList = getDropFileRootList();
        expect(rootList).toHaveLength(2);
        expect(rootList[0].endsWith('test-results')).toBe(true);
    });
});
