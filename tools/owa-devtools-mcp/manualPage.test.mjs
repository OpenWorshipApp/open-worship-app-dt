import { describe, expect, it } from 'vitest';

import { readManualPageDate, toManualPageBody } from './manualPage.mjs';

const PAGE = [
  '---',
  'id: W-07',
  'title: "Style the on-screen Bible text"',
  'verify: [PM-13, PM-14]',
  'workflowsVersion: "2026-10-11"',
  '---',
  '# W-07 — Style the on-screen Bible text',
  '',
  '1. Press **Bible Properties**. 📸',
  '',
  '::: details 🤖 Robot-ver',
  'click [data-widget-name]',
  ':::',
  '',
  '2. Drag **Font Size**.',
].join('\n');

describe('readManualPageDate', () => {
  it('reads the day off the front matter', () => {
    expect(readManualPageDate(PAGE)).toBe('2026-10-11');
    expect(readManualPageDate(PAGE.replaceAll('\n', '\r\n'))).toBe(
      '2026-10-11',
    );
  });

  it('is null for a page that carries none', () => {
    expect(readManualPageDate('# A page\n\n1. A step.')).toBeNull();
    // Only the front matter counts: a step may quote the word.
    expect(
      readManualPageDate('# A page\n\nworkflowsVersion: "2026-10-11"'),
    ).toBeNull();
    expect(readManualPageDate(undefined)).toBeNull();
  });
});

describe('toManualPageBody', () => {
  it('keeps the page and drops what is around it', () => {
    const body = toManualPageBody(PAGE);
    expect(body.startsWith('# W-07 — Style')).toBe(true);
    expect(body).toContain('1. Press **Bible Properties**.');
    expect(body).toContain('2. Drag **Font Size**.');
    expect(body).not.toContain('workflowsVersion');
    expect(body).not.toContain('Robot-ver');
    expect(body).not.toContain('data-widget-name');
    expect(body).not.toContain('📸');
  });

  // A page read off the web is cut at a length, which can fall inside the
  // robot's block.
  it('drops a robot block that was cut before its closing mark', () => {
    const cut = PAGE.slice(0, PAGE.indexOf('click [data') + 8);
    const body = toManualPageBody(cut);
    expect(body).toContain('1. Press **Bible Properties**.');
    expect(body).not.toContain('Robot-ver');
    expect(body).not.toContain('click [data');
  });
});
