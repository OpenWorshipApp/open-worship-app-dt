import { beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ text: null as string | null }));
vi.mock('../../helper/settingHelpers', () => ({
    getSettingForce: () => state.text,
    setSetting: (_key: string, text: string) => {
        state.text = text;
    },
    removeSetting: () => {
        state.text = null;
    },
}));
import {
    readBibleImportAsk,
    requestBibleImport,
    takeBibleImportRequest,
} from './bibleImportRequestHelpers';
beforeEach(() => {
    state.text = null;
});
test('recognizes the sample and leaves unrelated, credential-bearing and ambiguous requests alone', () => {
    const url =
        'https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml';
    expect(readBibleImportAsk(`Import bible from xml url ${url}`)).toBe(url);
    expect(readBibleImportAsk('What is a Bible XML file?')).toBeNull();
    expect(
        readBibleImportAsk('Import bible xml https://a/b.xml https://b/c.xml'),
    ).toBeNull();
    expect(
        readBibleImportAsk(
            'Import bible xml https://user:secret@example.com/a.xml',
        ),
    ).toBeNull();
});
test('a cross-window request is consumed once and stale requests expire', () => {
    requestBibleImport('https://example.com/bible.xml');
    expect(takeBibleImportRequest()).toBe('https://example.com/bible.xml');
    expect(takeBibleImportRequest()).toBeNull();
    state.text = JSON.stringify({
        at: Date.now() - 31000,
        url: 'https://example.com/a.xml',
    });
    expect(takeBibleImportRequest()).toBeNull();
    expect(state.text).toBeNull();
});
