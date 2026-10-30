import { describe, expect, it } from 'vitest';

import {
    readBibleVersesKey,
    toLookupCardArgs,
    toLookupToolArgs,
    toValidLookupAsk,
} from './lookupAskHelpers';

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

    // A saved conversation and a setting are both files a person can edit:
    // nothing but the listed fields, and nothing malformed, comes back.
    it('refuses what is not a request, and drops what does not fit', () => {
        expect(toValidLookupAsk(null)).toBeNull();
        expect(toValidLookupAsk({ kind: 'song', target: 'x' })).toBeNull();
        expect(toValidLookupAsk({ kind: 'name', target: '' })).toBeNull();
        expect(
            toValidLookupAsk({ kind: 'name', target: 'a\nb', title: 'x' }),
        ).toBeNull();
        const ask = toValidLookupAsk({
            kind: 'location',
            target: 'eden',
            title: '',
            bibleKey: 'has space',
            langCode: 'not a code',
            page: 'two words',
            dataUrl: 'data:image/png;base64,AAAA',
        });
        expect(ask).toEqual({
            kind: 'location',
            target: 'eden',
            title: 'eden',
        });
    });

    it('cuts a long title', () => {
        const ask = toValidLookupAsk({
            kind: 'name',
            target: 'x',
            title: 'y'.repeat(500),
        });
        expect(ask?.title).toHaveLength(200);
    });

    it('is read by the record tool by id, and a passage by its reference', () => {
        expect(
            toLookupToolArgs({
                kind: 'name',
                target: 'id-1',
                title: 'Adam',
                langCode: 'en',
                page: 'reader.html',
            }),
        ).toEqual({
            kind: 'name',
            id: 'id-1',
            lang: 'en',
            page: 'reader.html',
        });
        expect(
            toLookupToolArgs({
                kind: 'verse',
                target: 'JHN 3:16',
                title: 'John 3:16',
                bibleKey: 'KJV',
            }),
        ).toEqual({ kind: 'verse', ref: 'JHN 3:16', bible: 'KJV' });
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

    it('is nothing else', () => {
        expect(readBibleVersesKey('')).toBeNull();
        expect(readBibleVersesKey('GEN 4:1')).toBeNull();
        expect(readBibleVersesKey('(two words) GEN 4:1')).toBeNull();
        expect(readBibleVersesKey('(KJV) ')).toBeNull();
    });
});

describe('what a card reads its record with', () => {
    it('a passage also asks where its cross references lead', () => {
        expect(
            toLookupCardArgs({
                kind: 'verse',
                target: 'GEN 8:1-22',
                title: 'Genesis 8',
                bibleKey: 'KJV',
            }),
        ).toEqual({
            kind: 'verse',
            ref: 'GEN 8:1-22',
            bible: 'KJV',
            related: true,
        });
    });

    it('a person or a place is read as the tool reads it', () => {
        const ask = {
            kind: 'location' as const,
            target: 'place-1',
            title: 'Eden',
            langCode: 'km',
        };
        expect(toLookupCardArgs(ask)).toEqual(toLookupToolArgs(ask));
        expect(toLookupCardArgs(ask)).not.toHaveProperty('related');
    });
});
