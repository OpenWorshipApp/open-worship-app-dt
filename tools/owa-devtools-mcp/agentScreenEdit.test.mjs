import { describe, expect, it, vi } from 'vitest';

import {
  SCREEN_EDIT_ACTIONS,
  SCREEN_EDIT_CLEARS,
  SCREEN_EDIT_DESCRIPTION,
  SCREEN_EDIT_FIELDS,
  SCREEN_EDIT_SELECTS,
  SCREEN_EDIT_TOOL_NAME,
  genScreenEditExpression,
  registerScreenEditTool,
  runScreenEdit,
  toScreenEditArgs,
} from './agentScreenEdit.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice, listNoticeTranKeys } from './notify.mjs';
import {
  MODEL_ASK_SHARED_TOOL_MAP,
  MODEL_ON_ASK_TOOL_MAP,
  filterModelToolList,
  pickAskToolList,
} from './modelTools.mjs';

function genWorker(answer) {
  const calls = [];
  const worker = vi.fn(async (request) => {
    calls.push(request);
    return answer;
  });
  return { worker, calls };
}

function readText(result) {
  return result.content[0].text;
}

describe('runScreenEdit', () => {
  it('hands the app only the fields it knows, each whole', async () => {
    const { worker, calls } = genWorker({
      did: 'the Bible text larger (65 → 80px)',
      undoId: '20261113-231000000-ab12',
      undo: 'owa_undo with id "20261113-231000000-ab12" puts this back.',
    });
    const result = await runScreenEdit(
      {
        action: 'set',
        screens: [0, 1],
        style: { size: 'larger', color: 'gold' },
        transition: { slide: 'zoom' },
        group: true,
        page: 'presenter.html',
        stray: 'never sent',
      },
      worker,
    );
    expect(calls).toEqual([
      {
        action: 'set',
        screens: [0, 1],
        style: { size: 'larger', color: 'gold' },
        transition: { slide: 'zoom' },
        group: true,
      },
    ]);
    expect(result.isError).toBeUndefined();
    // The window reads the id off the answer: its Undo button.
    expect(JSON.parse(readText(result)).undoId).toBe('20261113-231000000-ab12');
  });

  it("passes the app's refusal on as the model's sentence", async () => {
    const result = await runScreenEdit(
      { action: 'set', display: 'Nowhere' },
      genWorker({
        isError: true,
        reason: 'No display is called "Nowhere".',
      }).worker,
    );
    expect(result.isError).toBe(true);
    expect(readText(result)).toBe('No display is called "Nowhere".');
  });

  // EC-615: the shared gemma4:cloud left `action` out of 83 of its 96
  // changes, sent a look as a list of one and a Bible alone as a string.
  it('takes a call with no action as a set when it sends a field', async () => {
    const { worker, calls } = genWorker({ did: 'the Bible text larger' });
    await runScreenEdit(
      { screens: [0], style: [{ size: 'larger' }, { bold: true }] },
      worker,
    );
    await runScreenEdit({ screens: [0], versions: { add: 'KJV' } }, worker);
    await runScreenEdit({ screens: [0], lineSync: true }, worker);
    // Nothing to change is a read.
    await runScreenEdit({ screens: [0] }, worker);
    await runScreenEdit(undefined, worker);
    expect(calls).toEqual([
      {
        action: 'set',
        screens: [0],
        style: { size: 'larger', bold: true },
      },
      { action: 'set', screens: [0], versions: { add: ['KJV'] } },
      { action: 'set', screens: [0], lineSync: true },
      { action: 'read', screens: [0] },
      { action: 'read' },
    ]);
  });

  // EC-630: a screen added is a set of its own, with or without an action.
  it('passes a screen added on, as a set', async () => {
    const { worker, calls } = genWorker({ did: 'added screen 2', newScreen: 2 });
    await runScreenEdit({ newScreen: true }, worker);
    await runScreenEdit({ action: 'set', newScreen: true }, worker);
    expect(calls).toEqual([
      { action: 'set', newScreen: true },
      { action: 'set', newScreen: true },
    ]);
  });

  it('keeps the shapes it was always given as they are', () => {
    expect(
      toScreenEditArgs({
        action: 'set',
        style: { size: 30 },
        versions: { add: ['KJV'], remove: 'ASV' },
      }),
    ).toEqual({
      action: 'set',
      style: { size: 30 },
      versions: { add: ['KJV'], remove: ['ASV'] },
    });
    // A list holding no look is no look at all.
    expect(toScreenEditArgs({ style: ['bold', null] })).toEqual({
      action: 'set',
      style: {},
    });
  });

  // 2026-11-14: _Group screen 0 and screen 1 together_ came as
  // `group: [0, 1]` six times running, each refused.
  it('reads a group named by its screens as those screens grouped', () => {
    expect(toScreenEditArgs({ group: [0, 1], screens: [0, 1] })).toEqual({
      action: 'set',
      group: true,
      screens: [0, 1],
    });
    // The numbers alone name the screens; with others named, both.
    expect(toScreenEditArgs({ group: [1, 0] })).toEqual({
      action: 'set',
      group: true,
      screens: [0, 1],
    });
    expect(toScreenEditArgs({ group: '0, 2', screens: [1] })).toEqual({
      action: 'set',
      group: true,
      screens: [0, 1, 2],
    });
    // A colour, a flag and a list of anything else are left as sent.
    for (const group of ['blue', true, false, ['blue'], [-1]]) {
      expect(toScreenEditArgs({ group }).group).toEqual(group);
    }
  });

  it('refuses an unknown action itself, naming the ones there are', async () => {
    const { worker } = genWorker({});
    const result = await runScreenEdit({ action: 'delete' }, worker);
    expect(result.isError).toBe(true);
    expect(readText(result)).toContain(SCREEN_EDIT_ACTIONS.join(', '));
    expect(worker).not.toHaveBeenCalled();
  });

  it('says when the app did not answer', async () => {
    const result = await runScreenEdit(
      { action: 'read' },
      genWorker(null).worker,
    );
    expect(result.isError).toBe(true);
    expect(readText(result)).toBe('The app did not answer.');
  });
});

describe('the page expression', () => {
  it('asks over the DOM relay and imports nothing', () => {
    const expression = genScreenEditExpression({
      action: 'set',
      style: { size: 'larger' },
    });
    expect(expression).toContain("'owa-agent-screen-edit'");
    expect(expression).toContain("'owa-agent-screen-edit-answer'");
    expect(expression).toContain('"size":"larger"');
    // An injected expression must never load an app module
    // (memory `cdp-dynamic-import-hijack`).
    expect(expression).not.toMatch(/\bimport\s*\(/);
    expect(() => {
      return new Function(`return ${expression};`);
    }).not.toThrow();
  });
});

describe('the policy around it', () => {
  it('reads quietly; every set acts and says so in the banner', () => {
    expect(checkIsActingCall(SCREEN_EDIT_TOOL_NAME, { action: 'read' })).toBe(
      false,
    );
    expect(describeToolNotice(SCREEN_EDIT_TOOL_NAME, { action: 'read' })).toBe(
      null,
    );
    expect(checkIsActingCall(SCREEN_EDIT_TOOL_NAME, { action: 'set' })).toBe(
      true,
    );
    expect(
      describeToolNotice(SCREEN_EDIT_TOOL_NAME, {
        action: 'set',
        style: { size: 'larger' },
      })?.text,
    ).toBe('changed a screen');
    // Clearing alone is what taking content off a screen says.
    expect(
      describeToolNotice(SCREEN_EDIT_TOOL_NAME, {
        action: 'set',
        screens: [0],
        clear: 'bible',
      })?.text,
    ).toBe(describeToolNotice('owa_hide_screens', {})?.text);
    expect(listNoticeTranKeys()).toContain('changed a screen');
  });

  it('removes nothing: every change is undone, never trashed', () => {
    for (const action of SCREEN_EDIT_ACTIONS) {
      expect(checkIsRemovingCall(SCREEN_EDIT_TOOL_NAME, { action })).toBe(
        false,
      );
    }
  });

  it('is offered to a screen ask only, with its few shared tools', () => {
    expect(MODEL_ON_ASK_TOOL_MAP[SCREEN_EDIT_TOOL_NAME]).toBe('screen');
    expect(MODEL_ASK_SHARED_TOOL_MAP.screen).toEqual([
      'owa_present_bible',
      'owa_undo',
      'owa_goto_page',
      'owa_help_search',
    ]);
    const tools = [
      { name: SCREEN_EDIT_TOOL_NAME },
      { name: 'owa_list_screens' },
      { name: 'owa_undo' },
      { name: 'owa_click' },
    ];
    expect(filterModelToolList(tools)).not.toContainEqual({
      name: SCREEN_EDIT_TOOL_NAME,
    });
    expect(pickAskToolList(tools, 'screen')).toEqual([
      { name: SCREEN_EDIT_TOOL_NAME },
      { name: 'owa_undo' },
    ]);
    expect(pickAskToolList(tools, 'foreground')).not.toContainEqual({
      name: SCREEN_EDIT_TOOL_NAME,
    });
  });

  it('registers its schema with the description', () => {
    const server = { registerTool: vi.fn() };
    registerScreenEditTool(server);
    const [name, config] = server.registerTool.mock.calls[0];
    expect(name).toBe(SCREEN_EDIT_TOOL_NAME);
    expect(config.description).toBe(SCREEN_EDIT_DESCRIPTION);
    expect(Object.keys(config.inputSchema)).toEqual([
      'action',
      'screens',
      ...SCREEN_EDIT_FIELDS,
    ]);
    // Optional, and a look or a Bible may come as a list or alone (EC-615).
    expect(config.inputSchema.action.safeParse(undefined).success).toBe(true);
    expect(config.inputSchema.style.safeParse([{ bold: true }]).success).toBe(
      true,
    );
    expect(
      config.inputSchema.versions.safeParse({ add: 'KJV' }).success,
    ).toBe(true);
    // A group by its screens rides as their numbers, read back above.
    expect(config.inputSchema.group.safeParse([0, 1]).data).toBe('0,1');
    expect(toScreenEditArgs({ group: '0,1' })).toEqual({
      action: 'set',
      group: true,
      screens: [0, 1],
    });
    expect(config.inputSchema.select.unwrap().options).toEqual(
      SCREEN_EDIT_SELECTS,
    );
    expect(config.inputSchema.clear.unwrap().options).toEqual(
      SCREEN_EDIT_CLEARS,
    );
    // Every field the tool takes is said in its description.
    for (const field of SCREEN_EDIT_FIELDS) {
      expect(SCREEN_EDIT_DESCRIPTION, field).toContain(`\`${field}\``);
    }
  });
});
