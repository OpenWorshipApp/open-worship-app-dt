import { expect, test, vi } from 'vitest';

// Monaco's own URI class, without the editor: the JSON service matches each
// editor model to its schema by exactly these strings.
vi.mock('monaco-editor', async () => {
    const uriModule = 'monaco-editor/base/common/uri';
    const { URI } = await import(uriModule as string);
    return { Uri: URI };
});

import {
    bibleBookChapterUri,
    bibleExtraUri,
    bibleInfoUri,
} from './bibleEditorUriHelpers';

test('each Bible editor has its own model address', () => {
    expect(bibleInfoUri.toString()).toBe('file:///bible-info');
    expect(bibleBookChapterUri.toString()).toBe('file:///book-chapter');
    expect(bibleExtraUri.toString()).toBe('file:///bible-extra');
});
