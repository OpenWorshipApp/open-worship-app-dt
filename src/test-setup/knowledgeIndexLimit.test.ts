import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANUAL_DIR = path.join(REPO_ROOT, 'docs', 'manual-sources');

function listPages(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return listPages(fullPath);
        }
        return entry.name.endsWith('.md') ? [fullPath] : [];
    });
}

// The help search reads a manual page only as far as the knowledge build's
// cap, and past it nothing is found: the help window's own page passed the
// old 60 000 characters by itself, and its answer to "Can you write the
// notation for words I paste in?" went out of the search with nothing said
// (EC-284). The cap is read off the script, so the two cannot drift.
describe('the help search reads every manual page whole', () => {
    test('no page is longer than the knowledge index keeps', () => {
        const script = fs.readFileSync(
            path.join(REPO_ROOT, 'extra-work', 'build-knowledge.mjs'),
            'utf8',
        );
        const match = /const MANUAL_SEARCH_TEXT_LIMIT = (\d+);/.exec(script);
        expect(match, 'the cap is named in build-knowledge.mjs').not.toBeNull();
        const limit = Number(match![1]);
        const pageList = listPages(MANUAL_DIR);
        expect(pageList.length).toBeGreaterThan(50);
        // The whole file, front matter and all: a page under this is under
        // the cap whatever the build strips first.
        const tooLong = pageList
            .map((page) => {
                return {
                    page: path.relative(MANUAL_DIR, page),
                    length: fs.readFileSync(page, 'utf8').length,
                };
            })
            .filter((one) => {
                return one.length >= limit;
            });
        expect(tooLong).toEqual([]);
    });
});
