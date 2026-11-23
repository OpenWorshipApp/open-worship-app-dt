import { describe, expect, it, vi } from 'vitest';

import {
  OFFICE_EDIT_ACTIONS,
  OFFICE_EDIT_DESCRIPTION,
  OFFICE_EDIT_TOOL_NAME,
  checkIsOfficeRemoval,
  registerOfficeEditTool,
  runOfficeEdit,
  toOfficeEditTarget,
} from './agentOfficeEdit.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
  MODEL_ON_ASK_TOOL_MAP,
  filterModelToolList,
  pickAskToolList,
} from './modelTools.mjs';

const DECK_PATH = 'C:\\data\\documents\\Sunday.pptx';

function genWorker(answer) {
  const calls = [];
  const worker = vi.fn(async (request, page) => {
    calls.push({ request, page });
    return answer;
  });
  return { worker, calls };
}

function readText(result) {
  return result.content[0].text;
}

describe('what `file` names', () => {
  it('is a whole .pptx / .docx path or a Documents name', () => {
    expect(toOfficeEditTarget(DECK_PATH)).toEqual({
      filePath: DECK_PATH,
      name: 'Sunday.pptx',
    });
    expect(toOfficeEditTarget('/Users/a/Letter.DOCX')).toEqual({
      filePath: '/Users/a/Letter.DOCX',
      name: 'Letter.DOCX',
    });
    expect(toOfficeEditTarget(' Sunday.pptx ')).toEqual({
      name: 'Sunday.pptx',
    });
  });

  it('refuses another kind, a path climbing out, and nothing', () => {
    expect(toOfficeEditTarget('C:\\data\\Sermon.ows')).toHaveProperty('reason');
    expect(toOfficeEditTarget('Old.ppt')).toHaveProperty('reason');
    expect(toOfficeEditTarget('C:\\data\\..\\x\\Sunday.pptx')).toHaveProperty(
      'reason',
    );
    expect(toOfficeEditTarget('a/b.pptx')).toHaveProperty('reason');
    expect(toOfficeEditTarget('  ')).toHaveProperty('reason');
  });
});

describe('one call', () => {
  it('reads through the app, by path, a page at a time', async () => {
    const { worker, calls } = genWorker({ file: 'Sunday.pptx', slides: [] });
    const result = await runOfficeEdit(
      { file: DECK_PATH, action: 'read', start: 3, page: 'presenter' },
      worker,
    );
    expect(calls).toEqual([
      {
        request: { action: 'read', filePath: DECK_PATH, start: 3 },
        page: 'presenter',
      },
    ]);
    expect(JSON.parse(readText(result))).toEqual({
      file: 'Sunday.pptx',
      slides: [],
    });
  });

  it('says what changed in the shape the window reads', async () => {
    const { worker, calls } = genWorker({
      file: 'Sunday.pptx',
      changed: ['Line 2.1 now reads “Hi”.'],
      didChange: true,
      undoId: 'abc',
    });
    const changes = [{ id: '2.1', text: 'Hi' }];
    const replace = [{ from: 'Lord', to: 'God' }];
    const result = await runOfficeEdit(
      { file: 'Sunday.pptx', action: 'edit', changes, replace },
      worker,
    );
    expect(calls[0].request).toEqual({
      action: 'edit',
      name: 'Sunday.pptx',
      changes,
      replace,
    });
    expect(JSON.parse(readText(result))).toEqual({
      name: 'Sunday.pptx',
      isChanged: true,
      file: 'Sunday.pptx',
      changed: ['Line 2.1 now reads “Hi”.'],
      undoId: 'abc',
    });
  });

  it('passes a refusal on, and refuses an unknown action itself', async () => {
    const refused = await runOfficeEdit(
      { file: DECK_PATH, action: 'edit', changes: [{ id: '9.9' }] },
      genWorker({ isError: true, reason: 'There is no line "9.9".' }).worker,
    );
    expect(refused.isError).toBe(true);
    expect(readText(refused)).toBe('There is no line "9.9".');
    const unknown = await runOfficeEdit(
      { file: DECK_PATH, action: 'delete' },
      genWorker({}).worker,
    );
    expect(readText(unknown)).toContain(OFFICE_EDIT_ACTIONS.join(', '));
  });
});

describe('the policy around it', () => {
  it('reads quietly, and every edit acts and is announced by file', () => {
    expect(checkIsActingCall(OFFICE_EDIT_TOOL_NAME, { action: 'read' })).toBe(
      false,
    );
    expect(describeToolNotice(OFFICE_EDIT_TOOL_NAME, { action: 'read' })).toBe(
      null,
    );
    expect(checkIsActingCall(OFFICE_EDIT_TOOL_NAME, { action: 'edit' })).toBe(
      true,
    );
    expect(
      describeToolNotice(OFFICE_EDIT_TOOL_NAME, {
        action: 'edit',
        file: DECK_PATH,
      })?.text,
    ).toBe('changed "Sunday.pptx"');
  });

  it('is a removal only when it takes a line, a slide or a box out', () => {
    // a picture taken off a slide by its name (EC-768)
    expect(
      checkIsRemovingCall(OFFICE_EDIT_TOOL_NAME, {
        action: 'edit',
        changes: [{ removeBox: 'Picture 3' }],
      }),
    ).toBe(true);
    expect(
      checkIsOfficeRemoval({
        action: 'edit',
        changes: [{ slide: 1, background: 'navy', removeBox: '' }],
      }),
    ).toBe(false);
    const removing = {
      action: 'edit',
      changes: [
        { id: '1.1', text: 'a' },
        { slide: 2, removeSlide: true },
      ],
    };
    expect(checkIsOfficeRemoval(removing)).toBe(true);
    expect(checkIsRemovingCall(OFFICE_EDIT_TOOL_NAME, removing)).toBe(true);
    expect(
      checkIsRemovingCall(OFFICE_EDIT_TOOL_NAME, {
        action: 'edit',
        changes: [{ id: '3', remove: true }],
      }),
    ).toBe(true);
    expect(
      checkIsRemovingCall(OFFICE_EDIT_TOOL_NAME, {
        action: 'edit',
        changes: [{ id: '1.1', text: 'a' }],
        replace: [{ from: 'a', to: '' }],
      }),
    ).toBe(false);
    expect(checkIsRemovingCall(OFFICE_EDIT_TOOL_NAME, { action: 'read' })).toBe(
      false,
    );
    // a table's row or column taken out is a removal; one added is not
    expect(
      checkIsOfficeRemoval({
        action: 'edit',
        changes: [{ slide: 2, table: 'Table 1', removeRow: 3 }],
      }),
    ).toBe(true);
    expect(
      checkIsOfficeRemoval({
        action: 'edit',
        changes: [{ slide: 2, table: 'Table 1', removeColumn: 1 }],
      }),
    ).toBe(true);
    expect(
      checkIsOfficeRemoval({
        action: 'edit',
        changes: [{ slide: 2, table: 'Table 1', addRow: 3 }],
      }),
    ).toBe(false);
  });

  it('is offered to an office ask only', () => {
    expect(MODEL_ON_ASK_TOOL_MAP[OFFICE_EDIT_TOOL_NAME]).toBe('office');
    const tools = [
      { name: OFFICE_EDIT_TOOL_NAME },
      { name: 'owa_slide_edit' },
      { name: 'owa_help_search' },
    ];
    expect(filterModelToolList(tools)).not.toContainEqual({
      name: OFFICE_EDIT_TOOL_NAME,
    });
    expect(pickAskToolList(tools, 'office')).toEqual([
      { name: OFFICE_EDIT_TOOL_NAME },
    ]);
    // a verse asked for is read, never written from memory
    expect(
      pickAskToolList([...tools, { name: 'owa_find_verse' }], 'office'),
    ).toEqual([{ name: OFFICE_EDIT_TOOL_NAME }, { name: 'owa_find_verse' }]);
  });

  it('registers its schema with the description', () => {
    const server = { registerTool: vi.fn() };
    registerOfficeEditTool(server);
    const [name, config] = server.registerTool.mock.calls[0];
    expect(name).toBe(OFFICE_EDIT_TOOL_NAME);
    expect(config.description).toBe(OFFICE_EDIT_DESCRIPTION);
    expect(Object.keys(config.inputSchema)).toEqual([
      'file',
      'action',
      'start',
      'changes',
      'replace',
      'page',
    ]);
    expect(
      config.inputSchema.changes.safeParse([
        { id: '2.3', text: 'x' },
        { id: 12, remove: true },
        { slide: 1, note: 'n' },
      ]).success,
    ).toBe(true);
    expect(
      config.inputSchema.replace.safeParse([{ from: '', to: 'x' }]).success,
    ).toBe(false);
    // the look: of a line, a slide's lines, every line; a slide's own
    expect(
      config.inputSchema.changes.safeParse([
        { color: 'green' },
        { slide: 2, size: 40, bold: true, font: 'Arial', align: 'center' },
        { id: '2.1', highlight: 'none', italic: false, underline: true },
        { slide: 3, background: '#000080', hidden: true },
      ]).success,
    ).toBe(true);
    // a size against each word's own, some words, a box, a text box, the
    // show (the goal: everything on a pptx)
    expect(
      config.inputSchema.changes.safeParse([
        { size: '+20%' },
        { slide: 4, words: 'Jesus', color: 'red' },
        { slide: 2, box: 'Title 1', at: [null, 86, null, null] },
        { slide: 1, textBox: 'Welcome', at: [10, 80, 80, 12], size: 40 },
        { transition: 'fade', advance: 5 },
        { slideSize: '4:3' },
        { slide: 3, picture: 'Choir.jpg', at: [0, 0, 100, 100] },
        { box: 'Curtain', picture: '/pics/back.png' },
      ]).data,
    ).toEqual([
      { size: '+20%' },
      { slide: 4, words: 'Jesus', color: 'red' },
      { slide: 2, box: 'Title 1', at: [null, 86, null, null] },
      { slide: 1, textBox: 'Welcome', at: [10, 80, 80, 12], size: 40 },
      { transition: 'fade', advance: 5 },
      { slideSize: '4:3' },
      { slide: 3, picture: 'Choir.jpg', at: [0, 0, 100, 100] },
      { box: 'Curtain', picture: '/pics/back.png' },
    ]);
    expect(OFFICE_EDIT_DESCRIPTION).toContain('{slide, picture: an attached');
    // an animation, a table's rows and columns, a slide from a layout, a
    // chart's words and numbers (EC-771)
    const more = [
      { slide: 3, box: 'Body', animation: 'fade', byLine: true, when: 'click' },
      { slide: 2, table: 'Table 1', addRow: 3, cells: ['9:00', 'Prayer'] },
      { slide: 2, table: 'Table 1', removeColumn: 2 },
      { newSlide: true, layout: 'Title Only', to: 4, title: 'Amen' },
      {
        slide: 5,
        chart: 'Chart 2',
        chartTitle: 'Giving',
        categories: ['Jan', 'Feb'],
        series: [{ index: 0, name: '2026', values: [12, null] }],
      },
    ];
    expect(config.inputSchema.changes.safeParse(more).data).toEqual(more);
    expect(
      config.inputSchema.changes.safeParse([{ slide: 1, when: 'later' }])
        .success,
    ).toBe(false);
    expect(
      config.inputSchema.changes.safeParse([{ box: 'T', at: [1, 2, 3] }])
        .success,
    ).toBe(false);
    expect(
      config.inputSchema.changes.safeParse([{ id: '1.1', align: 'up' }])
        .success,
    ).toBe(false);
    expect(
      config.inputSchema.changes.safeParse([{ id: '1.1', size: 0 }]).success,
    ).toBe(false);
  });
});
