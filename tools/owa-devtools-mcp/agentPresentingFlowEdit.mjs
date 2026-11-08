// `owa_presenting_flow_edit`: one of the user's presenting flows (run
// sheets) changed by the help window's assistant -- its order of service
// built from words or a picture, a clear put between items, timeouts that
// move it on by itself, shortcuts, colours, screen pins, countdowns and the
// other foreground lines, and the CC elements that ride along with a line
// (2026-11-07, the user, with a presenting flow's row menu open: _add `Open
// in Chatbot` … follow what working for appdocument. goal: chatbot can help
// the presenting flow modification_).
//
// The rules are the app's (`src/helper/agentFlowEditRules.ts`, pure, and
// the worker `agentPresentingFlowEditHelpers.ts`): the sheet is read as the
// panel reads it, every change is checked by the panel's own rules, and the
// whole batch is ONE write and ONE backup -- a run sheet has no Save, so the
// backup is its whole undo. What this adds over `owa_presenting_flow`:
//
//   - `lines` reads every line WHOLE: how it is armed, its colour and
//     screens, what rides along with it, what is wrong with it, plus the
//     actions, the foreground widgets, the Documents names and the screens;
//   - `update-lines` makes MANY changes in one call and one undo, each line
//     named by its number as read;
//   - `file` takes the sheet as the help window ATTACHED it, by its whole
//     path, wherever it lives.
//
// Offered to the chatbot's model only in a conversation about an attached
// presenting flow (`MODEL_ON_ASK_TOOL_MAP`, kind `flow`), where the window
// puts the attached file's own path in `file` (`src/chatbot/
// flowChatHelpers.ts`): a model names the sheet, never a path. An outside
// agent over stdio may give a whole `.owpf` path; the app checks it again at
// the disk. `owa_presenting_flow` stays as it was, for the ordinary question.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp } from './cdp.mjs';
import { genAgentDataExpression } from './agentData.mjs';
import { checkAgentFileName } from './agentFileName.mjs';

export const FLOW_EDIT_TOOL_NAME = 'owa_presenting_flow_edit';

export const FLOW_EDIT_ACTIONS = ['lines', 'update-lines', 'remove-lines'];

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const FLOW_EXTENSION_PATTERN = /\.owpf$/i;

/**
 * What `file` names: `{filePath, name}` for a whole path, `{name}` for a
 * presenting flow of the Presenting Flows folder (a trailing `.owpf`
 * dropped), or `{reason}` when it is neither.
 */
export function toFlowEditTarget(file) {
  const text = typeof file === 'string' ? file.trim() : '';
  if (text === '') {
    return {
      reason:
        'Name the presenting flow (`file`): as it is attached, or as ' +
        'it reads in the Presenting Flows list.',
    };
  }
  if (ABSOLUTE_PATH_PATTERN.test(text)) {
    if (!FLOW_EXTENSION_PATTERN.test(text)) {
      return {
        reason: 'Only a presenting flow (.owpf) can be changed here.',
      };
    }
    if (
      text.split(/[\\/]/).some((part) => {
        return part === '..';
      })
    ) {
      return {
        reason:
          'A presenting flow path may not step out of its folder ' +
          'with "..".',
      };
    }
    const name = (text.split(/[\\/]/).pop() ?? '').replace(
      FLOW_EXTENSION_PATTERN,
      '',
    );
    return { filePath: text, name };
  }
  const name = text.replace(FLOW_EXTENSION_PATTERN, '');
  const nameReason = checkAgentFileName(name);
  return nameReason === null ? { name } : { reason: nameReason };
}

async function runFlowWorker(request, page) {
  const { value } = await evaluateInApp(
    genAgentDataExpression('presenting-flow-edit', request),
    { match: page },
  );
  if (value === null || typeof value !== 'object') {
    return { isError: true, reason: 'The app did not answer.' };
  }
  return value;
}

function toTextResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function toErrorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: String(error?.message ?? error) }],
  };
}

export const FLOW_EDIT_DESCRIPTION =
  "Change one of the user's presenting flows (a service's running " +
  'order). `file`: the flow as attached. `lines` reads every line: n, ' +
  'title, kind, how it is armed (seconds/time/key), color, screenIds, ' +
  'isParked, its CCs (what rides along with it), problems -- plus ' +
  '`actions`, `foregroundWidgets`, `documentChoices` and `screens`; with ' +
  "`line` it also lists that document's slides. `update-lines` makes MANY " +
  'changes in ONE call: `changes` [...], each naming lines by their number ' +
  'AS READ (never renumber). A change is {add:{document | reference ' +
  '(+version) | actionId (+seconds|time|key, screenIds, target for a Jump ' +
  'to) | foreground:{widget, ...}, color}, after} -- `after` a line number, ' +
  '0 for the top, left out for the end -- or {line, ...} with any of: ' +
  '`after` (move it), copy, park (true/false), seconds | time ("HH:mm") | ' +
  'key ("Ctrl+Shift+A"), color (a name, "#RRGGBB" or "none"), screenIds ' +
  '([] for none), slides [{slide, park, screenIds}], foreground {fields}, ' +
  'cc {add:{line | actionId (+seconds)}, slide?, screenIds?, mediaControl?} ' +
  'to attach a CC, or cc {index, slide?, remove | screenIds | seconds | ' +
  'time | clearArming | mediaControl} to change one. `remove-lines` takes ' +
  '`lines` [n...]. Every change is kept at once (no Save) and keeps a ' +
  'backup owa_undo puts back -- say so. Change only what was asked.';

/**
 * One call: the app reads, changes, checks and writes. Exported for the
 * tests, which hand it a stand-in for the app.
 */
export async function runPresentingFlowEdit(args, runWorker = runFlowWorker) {
  const target = toFlowEditTarget(args?.file);
  if (target.reason !== undefined) {
    return toErrorResult(new Error(target.reason));
  }
  const action = args?.action;
  if (!FLOW_EDIT_ACTIONS.includes(action)) {
    return toErrorResult(
      new Error(`\`action\` is one of ${FLOW_EDIT_ACTIONS.join(', ')}.`),
    );
  }
  const request = {
    action,
    ...(target.filePath === undefined
      ? { name: target.name }
      : { filePath: target.filePath }),
  };
  for (const key of ['line', 'changes', 'lines']) {
    if (args?.[key] !== undefined) {
      request[key] = args[key];
    }
  }
  const value = await runWorker(request, args?.page);
  if (value.isError === true) {
    return toErrorResult(
      new Error(value.reason ?? 'The presenting flow could not be read.'),
    );
  }
  if (action === 'lines') {
    return toTextResult(value);
  }
  // The window reads `name`, `isChanged` and `undoId` off this answer
  // (`readEditedLyric`): the button that puts the change back.
  const { didChange, ...rest } = value;
  return toTextResult({
    name: target.name,
    isChanged: didChange !== false,
    ...rest,
  });
}

const ARMING_FIELDS = {
  seconds: z.number().optional(),
  time: z.string().max(5).optional(),
  key: z.string().max(40).optional(),
};

const LOOSE_FOREGROUND_SCHEMA = z.looseObject({
  widget: z.string().max(30).optional(),
});

const LOOSE_MEDIA_CONTROL_SCHEMA = z.looseObject({
  mode: z.string().max(10).optional(),
});

const SCREEN_IDS_SCHEMA = z.array(z.number().int().min(0)).max(20).optional();

const FLOW_CHANGE_SCHEMA = z.object({
  add: z
    .object({
      document: z.string().max(200).optional(),
      reference: z.string().max(200).optional(),
      version: z.string().max(60).optional(),
      actionId: z.string().max(60).optional(),
      ...ARMING_FIELDS,
      screenIds: SCREEN_IDS_SCHEMA,
      target: z.number().int().min(1).optional(),
      color: z.string().max(30).optional(),
      foreground: LOOSE_FOREGROUND_SCHEMA.optional(),
    })
    .optional(),
  line: z.number().int().min(1).optional(),
  after: z.number().int().min(0).optional(),
  copy: z.boolean().optional(),
  park: z.boolean().optional(),
  ...ARMING_FIELDS,
  clearArming: z.boolean().optional(),
  color: z.string().max(30).nullable().optional(),
  screenIds: SCREEN_IDS_SCHEMA,
  slides: z
    .array(
      z.object({
        slide: z.number().int().min(1),
        park: z.boolean().optional(),
        screenIds: SCREEN_IDS_SCHEMA,
      }),
    )
    .max(100)
    .optional(),
  foreground: LOOSE_FOREGROUND_SCHEMA.optional(),
  cc: z
    .object({
      add: z
        .object({
          line: z.number().int().min(1).optional(),
          actionId: z.string().max(60).optional(),
          ...ARMING_FIELDS,
        })
        .optional(),
      slide: z.number().int().min(1).optional(),
      index: z.number().int().min(1).optional(),
      remove: z.boolean().optional(),
      screenIds: SCREEN_IDS_SCHEMA,
      ...ARMING_FIELDS,
      clearArming: z.boolean().optional(),
      mediaControl: LOOSE_MEDIA_CONTROL_SCHEMA.optional(),
    })
    .optional(),
});

export function registerPresentingFlowEditTool(server) {
  server.registerTool(
    FLOW_EDIT_TOOL_NAME,
    {
      description: FLOW_EDIT_DESCRIPTION,
      inputSchema: {
        file: z.string().max(400),
        action: z.enum(FLOW_EDIT_ACTIONS),
        line: z.number().int().min(1).optional(),
        changes: z.array(FLOW_CHANGE_SCHEMA).max(120).optional(),
        lines: z.array(z.number().int().min(1)).max(200).optional(),
        page: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return await runPresentingFlowEdit(args);
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
