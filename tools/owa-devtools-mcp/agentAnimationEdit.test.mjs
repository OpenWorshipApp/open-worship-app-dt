import { describe, expect, it, vi } from 'vitest';

import {
  ANIMATION_EDIT_ACTIONS,
  ANIMATION_EDIT_DESCRIPTION,
  ANIMATION_EDIT_FIELDS,
  ANIMATION_EDIT_TOOL_NAME,
  genAnimationEditExpression,
  registerAnimationEditTool,
  runAnimationEdit,
  toAnimationEditArgs,
} from './agentAnimationEdit.mjs';
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

describe('toAnimationEditArgs', () => {
  it('reads a call with no action as the model meant it', () => {
    expect(toAnimationEditArgs({ code: 'x' }).action).toBe('code');
    expect(toAnimationEditArgs({ apply: true }).action).toBe('code');
    expect(toAnimationEditArgs({ speed: 'slower' }).action).toBe('set');
    expect(toAnimationEditArgs({ id: 'animation.1.a' }).action).toBe('undo');
    expect(toAnimationEditArgs({}).action).toBe('read');
    expect(toAnimationEditArgs(null).action).toBe('read');
    expect(toAnimationEditArgs({ action: 'read', speed: 'x' }).action).toBe(
      'read',
    );
  });
});

describe('runAnimationEdit', () => {
  it('hands the app only the fields it knows', async () => {
    const { worker, calls } = genWorker({
      did: 'changed speed, colors',
      undoId: 'animation.1.abc',
    });
    const result = await runAnimationEdit(
      {
        speed: 'slower',
        colors: ['#000', 'gold'],
        editor: 'background:0',
        page: 'presenter.html',
        stray: 'never sent',
      },
      worker,
    );
    expect(calls).toEqual([
      {
        action: 'set',
        editor: 'background:0',
        speed: 'slower',
        colors: ['#000', 'gold'],
      },
    ]);
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(readText(result))).toEqual({
      did: 'changed speed, colors',
      undoId: 'animation.1.abc',
    });
  });

  it('refuses an action it does not know without asking the app', async () => {
    const { worker } = genWorker({});
    const result = await runAnimationEdit({ action: 'delete' }, worker);
    expect(result.isError).toBe(true);
    expect(readText(result)).toContain('read, set, code, undo');
    expect(worker).not.toHaveBeenCalled();
  });

  it('keeps the compiler’s words on a refused code', async () => {
    const { worker } = genWorker({
      isError: true,
      reason: 'The code does not compile, so nothing was applied.',
      codeError: "ERROR: 0:4: 'colour' : undeclared identifier",
    });
    const result = await runAnimationEdit({ code: 'void main() {}' }, worker);
    expect(result.isError).toBe(true);
    expect(readText(result)).toContain('nothing was applied');
    expect(readText(result)).toContain("codeError: ERROR: 0:4: 'colour'");
  });

  it('says a refusal in its own words, and a silent app as one', async () => {
    const refused = await runAnimationEdit(
      { action: 'undo', id: 'animation.9.x' },
      genWorker({ isError: true, reason: 'That change is gone.' }).worker,
    );
    expect(readText(refused)).toBe('That change is gone.');
    const silent = await runAnimationEdit({}, genWorker(null).worker);
    expect(silent.isError).toBe(true);
  });
});

describe('the page expression', () => {
  it('asks over the DOM relay and imports nothing', () => {
    const expression = genAnimationEditExpression({
      action: 'set',
      speed: 'slower',
    });
    expect(expression).toContain("'owa-agent-animation'");
    expect(expression).toContain("'owa-agent-animation-answer'");
    expect(expression).toContain('"speed":"slower"');
    // An injected expression must never load an app module
    // (memory `cdp-dynamic-import-hijack`).
    expect(expression).not.toMatch(/\bimport\s*\(/);
    expect(() => {
      return new Function(`return ${expression};`);
    }).not.toThrow();
  });
});

describe('the policy around it', () => {
  it('reads quietly; every change acts and says so in the banner', () => {
    for (const args of [{ action: 'read' }, {}, { editor: 'background:0' }]) {
      expect(checkIsActingCall(ANIMATION_EDIT_TOOL_NAME, args)).toBe(false);
      expect(describeToolNotice(ANIMATION_EDIT_TOOL_NAME, args)).toBe(null);
    }
    for (const args of [
      { action: 'set', speed: 'slower' },
      { code: 'void main() {}' },
      { action: 'undo', id: 'animation.1.a' },
      { opacity: 50 },
    ]) {
      expect(checkIsActingCall(ANIMATION_EDIT_TOOL_NAME, args)).toBe(true);
      expect(describeToolNotice(ANIMATION_EDIT_TOOL_NAME, args)?.text).toBe(
        'changed an animation',
      );
    }
    expect(listNoticeTranKeys()).toContain('changed an animation');
  });

  it('removes nothing: every change is undone, never trashed', () => {
    for (const action of ANIMATION_EDIT_ACTIONS) {
      expect(checkIsRemovingCall(ANIMATION_EDIT_TOOL_NAME, { action })).toBe(
        false,
      );
    }
  });

  it('is offered to an animation ask only, with its few shared tools', () => {
    expect(MODEL_ON_ASK_TOOL_MAP[ANIMATION_EDIT_TOOL_NAME]).toBe('animation');
    expect(MODEL_ASK_SHARED_TOOL_MAP.animation).toEqual([
      'owa_goto_page',
      'owa_help_search',
    ]);
    const tools = [
      { name: ANIMATION_EDIT_TOOL_NAME },
      { name: 'owa_goto_page' },
      { name: 'owa_click' },
    ];
    expect(filterModelToolList(tools)).not.toContainEqual({
      name: ANIMATION_EDIT_TOOL_NAME,
    });
    expect(pickAskToolList(tools, 'animation')).toEqual([
      { name: ANIMATION_EDIT_TOOL_NAME },
      { name: 'owa_goto_page' },
    ]);
    expect(pickAskToolList(tools, 'screen')).not.toContainEqual({
      name: ANIMATION_EDIT_TOOL_NAME,
    });
  });

  it('registers its schema with the description', () => {
    const server = { registerTool: vi.fn() };
    registerAnimationEditTool(server);
    const [name, config] = server.registerTool.mock.calls[0];
    expect(name).toBe(ANIMATION_EDIT_TOOL_NAME);
    expect(config.description).toBe(ANIMATION_EDIT_DESCRIPTION);
    expect(Object.keys(config.inputSchema)).toEqual([
      'action',
      'editor',
      ...ANIMATION_EDIT_FIELDS,
      'code',
      'apply',
      'id',
    ]);
    expect(config.inputSchema.action.safeParse(undefined).success).toBe(true);
    // Colours written as one line are a list.
    expect(config.inputSchema.colors.safeParse('#000, gold; red').data).toEqual(
      ['#000', 'gold', 'red'],
    );
    expect(config.inputSchema.opacity.safeParse(120).success).toBe(false);
    expect(config.inputSchema.code.safeParse('x'.repeat(12001)).success).toBe(
      false,
    );
    // Every action and field is said in the description.
    for (const word of [
      ...ANIMATION_EDIT_ACTIONS,
      'colors',
      'speed',
      'level',
    ]) {
      expect(ANIMATION_EDIT_DESCRIPTION, word).toContain(word);
    }
  });
});
