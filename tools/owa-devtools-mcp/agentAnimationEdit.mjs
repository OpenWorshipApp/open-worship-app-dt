// `owa_animation_edit`: an animation in Customize, changed by the help
// window's assistant (2026-11-19, the user, the shader's Edit Code panel
// open: _add chatbot icon to open in chatbot and let chatbot control
// editor_, the goal _chatbot can help handle css and glsl code editing_).
//
// It works through the animation editors open NOW -- the Background panel's
// Animations tab and Animation Show, one per screen holding an animation --
// so a change goes the way a press in Customize goes, and code is TYPED INTO
// the Edit Code panel (one edit Ctrl+Z takes back), checked, and applied when
// it passes: a shader's GLSL into Shader Code (the graphics card checks it),
// a CSS animation's own style sheet into CSS Code (2026-11-19: no address,
// keyframes on the compositor only). The code says its kind -- a shader has
// its mainImage -- and code of the other kind makes the animation that kind.
//
// The rules are the app's (`src/helper/agentAnimationHelpers.ts`, the pure
// `src/background/animationAgentRules.ts`); every change answers an
// `undoId` that `undo` puts back while its editor is open.
//
// Offered to the chatbot's model only in an ANIMATION conversation
// (`MODEL_ON_ASK_TOOL_MAP`, kind `animation`) -- the one the 🤖 in Customize
// or in Shader Code opens -- so the ordinary list and its ratchet did not
// move.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp, listTargets, requireLivePort } from './cdp.mjs';
import { formatForegroundResult } from './agentForeground.mjs';
import {
  ANIMATION_EDIT_ACTIONS,
  ANIMATION_EDIT_FIELDS,
  ANIMATION_EDIT_TOOL_NAME,
  toAnimationEditArgs,
} from './agentAnimationArgs.mjs';

export {
  ANIMATION_EDIT_ACTIONS,
  ANIMATION_EDIT_FIELDS,
  ANIMATION_EDIT_TOOL_NAME,
  toAnimationEditArgs,
};

export const ANIMATION_EDIT_DESCRIPTION =
  'The animation in Customize (Background → Animations or Animation ' +
  'Show), changed as its controls change it. "read": each open editor -- ' +
  'engine (css|glsl), effect, colors, speed, density/quality, opacity, ' +
  'blend -- and its code with codeError. "set": effect (css: ' +
  'aurora bokeh rays waves stars breathe snow clouds cross embers; glsl: ' +
  'plasma flow mesh aurora waves rays clouds cross flames glass ripples ' +
  'snow sunrise stars; both: leaves fireworks petals candles confetti ' +
  'hearts), colors (2-4, ground first; #RRGGBB or names), ' +
  'speed (slow|normal|fast|slower|faster), level (low|normal|high|less|' +
  'more), opacity (10-100), blend. "code": the WHOLE code, typed into ' +
  'Edit Code and applied once it passes (apply:false only tries it): ' +
  'GLSL with mainImage(out vec4 fragColor, in vec2 fragCoord), or CSS; ' +
  'code of the other kind switches the kind. "undo" with ' +
  'the id a change answered. `editor` from read when several are open.';

/**
 * The page half: a dependency-free expression that asks the app's worker
 * over the DOM event relay (`owa-agent-animation` in `domHelpers.ts`) and
 * waits for its answer.
 */
export function genAnimationEditExpression(request) {
  const payload = JSON.stringify(request ?? {});
  return `(() => {
        const request = Object.assign(${payload}, {
            token: Math.random().toString(36).slice(2),
        });
        return new Promise((resolve, reject) => {
            const onAnswer = (event) => {
                const detail = (event && event.detail) || {};
                if (detail.token !== request.token) {
                    return;
                }
                clearTimeout(timer);
                document.removeEventListener('owa-agent-animation-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-animation-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. Animations are changed ' +
                    'from the Presenter page.'
                ));
            }, 25000);
            document.addEventListener('owa-agent-animation-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-animation', { detail: request }),
            );
        });
    })()`;
}

function toTextResult(text) {
  return { content: [{ type: 'text', text }] };
}

function toErrorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: String(error?.message ?? error) }],
  };
}

async function runAnimationWorker(request) {
  // The Presenter page's alone: it holds the Background panel and the
  // foreground panels.
  const port = await requireLivePort();
  const targets = await listTargets(port);
  const hasPresenter = targets.some((target) => {
    return target.url.includes('presenter.html');
  });
  const { value } = await evaluateInApp(genAnimationEditExpression(request), {
    port,
    match: hasPresenter ? 'presenter.html' : undefined,
    // Edit Code opened for a `code` comes up lazily (Monaco).
    timeout: 30000,
  });
  return value;
}

/**
 * One call: the app reads or changes the animation and answers. Exported
 * for the tests, which hand it a stand-in for the app.
 */
export async function runAnimationEdit(args, runWorker = runAnimationWorker) {
  const meant = toAnimationEditArgs(args);
  const action = meant.action;
  if (!ANIMATION_EDIT_ACTIONS.includes(action)) {
    return toErrorResult(
      new Error(`\`action\` is one of ${ANIMATION_EDIT_ACTIONS.join(', ')}.`),
    );
  }
  const request = { action };
  for (const key of [
    'editor',
    'code',
    'apply',
    'id',
    ...ANIMATION_EDIT_FIELDS,
  ]) {
    if (meant[key] !== undefined) {
      request[key] = meant[key];
    }
  }
  const result = await runWorker(request);
  // A refusal that came with the compiler's words keeps them: the model
  // fixes the line they name.
  if (result?.isError === true && typeof result.codeError === 'string') {
    return toErrorResult(
      new Error(`${result.reason}\ncodeError: ${result.codeError}`),
    );
  }
  const formatted = formatForegroundResult(result);
  return formatted.isError
    ? toErrorResult(new Error(formatted.text))
    : toTextResult(formatted.text);
}

const COLOR_LIST_SCHEMA = z
  .preprocess(
    (value) => {
      return typeof value === 'string' ? value.split(/\s*[,;]\s*/) : value;
    },
    z.array(z.string().max(40)).min(1).max(6),
  )
  .optional();

export function registerAnimationEditTool(server) {
  server.registerTool(
    ANIMATION_EDIT_TOOL_NAME,
    {
      description: ANIMATION_EDIT_DESCRIPTION,
      inputSchema: {
        action: z.enum(ANIMATION_EDIT_ACTIONS).optional(),
        editor: z.string().max(40).optional(),
        effect: z.string().max(40).optional(),
        engine: z.enum(['css', 'glsl']).optional(),
        colors: COLOR_LIST_SCHEMA,
        speed: z.string().max(20).optional(),
        level: z.string().max(20).optional(),
        opacity: z.number().min(0).max(100).optional(),
        blend: z.string().max(20).optional(),
        code: z.string().max(12000).optional(),
        apply: z.boolean().optional(),
        id: z.string().max(80).optional(),
      },
    },
    async (args) => {
      try {
        return await runAnimationEdit(args);
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
