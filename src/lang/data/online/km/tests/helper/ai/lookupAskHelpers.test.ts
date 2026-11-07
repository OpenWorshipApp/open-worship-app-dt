import { describe, expect, it } from 'vitest';

import {
    readBibleVersesKey,
    toValidLookupAsk,
} from '../../../../../../../helper/ai/lookupAskHelpers';

describe('what a Lookup Detail panel hands the assistant', () => {
    it('keeps a person, a place and a passage, each field checked', () => {
        expect(
            toValidLookupAsk({
                kind: 'name',
                target: '42bd6be4-e60a-4744-9eb8-42a111646073',
                title: '  អ័ដាម  ',
                langCode: 'km',
                page: 'https://localhost:3000/reader.html',
            }),
        ).toEqual({
            kind: 'name',
            target: '42bd6be4-e60a-4744-9eb8-42a111646073',
            title: 'អ័ដាម',
            langCode: 'km',
            page: 'https://localhost:3000/reader.html',
        });
        expect(
            toValidLookupAsk({
                kind: 'verse',
                target: 'GEN 2:19-21',
                title: 'លោកុប្បត្តិ ២:១៩-២១',
                bibleKey: 'គកប',
            }),
        ).toEqual({
            kind: 'verse',
            target: 'GEN 2:19-21',
            title: 'លោកុប្បត្តិ ២:១៩-២១',
            bibleKey: 'គកប',
        });
    });
});

// A Bible view's right-click reads the verse under the pointer off the key
// its element is stamped with.
describe('the key a verse carries in a Bible view', () => {
    it('is its Bible and its verse', () => {
        expect(readBibleVersesKey('(KJV) GEN 4:1')).toEqual({
            bibleKey: 'KJV',
            verseKey: 'GEN 4:1',
        });
        expect(readBibleVersesKey(' (ពគប) GEN 4:6 ')).toEqual({
            bibleKey: 'ពគប',
            verseKey: 'GEN 4:6',
        });
    });
});
