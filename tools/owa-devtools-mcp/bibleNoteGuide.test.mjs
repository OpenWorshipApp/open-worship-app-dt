import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BIBLE_NOTE_GUIDE_ID_PREFIX,
  BIBLE_NOTE_GUIDE_SOURCE_LINE,
  DROPPED_CHUNK_ID_LIST,
  genBibleNoteGuideFile,
  parseBibleNoteGuide,
  resolveBibleNoteGuidePath,
  REWRITTEN_CHUNK_BODY_MAP,
  SAVE_HISTORY_LINE,
  toBibleNoteGuideFileName,
  toBibleNoteGuidePages,
} from '../../extra-work/bibleNoteGuideHelpers.mjs';

// Against the REAL guide the package ships, as `openLyric.test.mjs` reads
// open-lyric's schema: a guide that moved or changed shape must fail here,
// not leave the chatbot quietly knowing nothing about the note editor. A
// silent skip is how this would stop guarding anything.
const REPO_ROOT = join(import.meta.dirname, '..', '..');
const GUIDE_PATH = resolveBibleNoteGuidePath(REPO_ROOT);

function readGuide() {
  expect(GUIDE_PATH, 'bible-note/knowledge/ui-rag.md not found').not.toBe(null);
  return readFileSync(GUIDE_PATH, 'utf8');
}

describe('the Bible Note editor guide, read for the chatbot', () => {
  it('reads every chunk the guide says it has, each id once', () => {
    const { frontMatter, chunks } = parseBibleNoteGuide(readGuide());
    expect(chunks.length).toBe(Number(frontMatter.chunks));
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
    for (const chunk of chunks) {
      expect(chunk.title, chunk.id).not.toBe('');
      expect(chunk.body.length, chunk.id).toBeGreaterThan(40);
    }
  });

  it('still finds upstream every chunk it leaves out or rewrites', () => {
    // A chunk renamed upstream would come back in under its new name,
    // saying again what is false in this app.
    const ids = new Set(
      parseBibleNoteGuide(readGuide()).chunks.map((chunk) => chunk.id),
    );
    for (const id of [
      ...DROPPED_CHUNK_ID_LIST,
      ...Object.keys(REWRITTEN_CHUNK_BODY_MAP),
    ]) {
      expect(ids.has(id), `${id} is gone from the guide`).toBe(true);
    }
  });

  it('gives pages that ride whole, with nothing of a release in them', () => {
    const pages = toBibleNoteGuidePages(readGuide());
    expect(pages.length).toBe(
      parseBibleNoteGuide(readGuide()).chunks.length -
        DROPPED_CHUNK_ID_LIST.length,
    );
    for (const page of pages) {
      expect(page.id.startsWith(`${BIBLE_NOTE_GUIDE_ID_PREFIX}ui/`)).toBe(true);
      const file = genBibleNoteGuideFile(page);
      // Under the 6 000 characters a known question's page rides whole.
      expect(file.length, page.id).toBeLessThan(6000);
      expect(file, page.id).not.toMatch(/bible-note@|<!--|"package"/);
      expect(file, page.id).not.toMatch(/\d+\.\d+\.\d+/);
      expect(toBibleNoteGuideFileName(page)).toBe(
        `bible-note/${page.chunkId}.md`,
      );
    }
    const kept = new Set(pages.map((page) => page.chunkId));
    for (const id of DROPPED_CHUNK_ID_LIST) {
      expect(kept.has(id), id).toBe(false);
    }
  });

  it('says beside the editor undo that the window keeps a history too', () => {
    const pages = toBibleNoteGuidePages(readGuide());
    const withLine = pages.filter((page) => {
      return page.body.includes(SAVE_HISTORY_LINE);
    });
    expect(withLine.map((page) => page.chunkId).sort()).toEqual([
      'ui/formatting-text/undo-and-redo-changes',
      'ui/getting-started/undo-and-redo-changes',
      'ui/import-export-and-print/clear-the-whole-note',
    ]);
  });
});

describe('what the guide says of saving, in this app', () => {
  it('says the window has Save, never that it saves by itself', () => {
    const page = toBibleNoteGuidePages(readGuide()).find((one) => {
      return one.chunkId === 'ui/getting-started/how-your-note-is-saved';
    });
    expect(page.body).toContain('[en:tran:Save]');
    expect(page.body).toContain('[en:tran:Undo Saved Change]');
    expect(page.body).not.toMatch(/no Save button|automatically/i);
  });
});

describe('parseBibleNoteGuide', () => {
  const sample = [
    '---',
    'title: Guide',
    'version: 9.9.9',
    'chunks: 2',
    '---',
    '',
    '# Guide',
    '',
    'An opening nobody asks about.',
    '',
    '## One › First',
    '',
    '<!-- chunk {"id":"ui/one/first","section":"One","title":"First","tags":["a"],"package":"bible-note@9.9.9"} -->',
    '',
    'Type this:',
    '',
    '```',
    '## not a heading',
    '```',
    '',
    '## One › Second',
    '',
    '<!-- chunk {"id":"ui/one/second","section":"One","title":"Second","tags":[]} -->',
    '',
    'The end (bible-note@9.9.9).',
  ].join('\r\n');

  it('splits on headings outside code, without the comments or a version', () => {
    const { frontMatter, chunks } = parseBibleNoteGuide(sample);
    expect(frontMatter.chunks).toBe('2');
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      'ui/one/first',
      'ui/one/second',
    ]);
    expect(chunks[0].body).toBe('Type this:\n\n```\n## not a heading\n```');
    expect(chunks[1].body).toBe('The end.');
    expect(chunks[0].tags).toEqual(['a']);
  });

  it('writes a page as its title, where it is from, and its words', () => {
    const [page] = toBibleNoteGuidePages(sample);
    expect(genBibleNoteGuideFile(page)).toBe(
      `# First\n\n${BIBLE_NOTE_GUIDE_SOURCE_LINE}\n\nType this:\n\n` +
        '```\n## not a heading\n```\n',
    );
  });

  it('keeps a heading with no chunk comment inside the chunk before it', () => {
    const { chunks } = parseBibleNoteGuide(
      '## A › B\n\n<!-- chunk {"id":"ui/a/b","title":"B"} -->\n\nText\n\n## Loose\n\nMore',
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].body).toBe('Text\n\n## Loose\n\nMore');
  });
});
