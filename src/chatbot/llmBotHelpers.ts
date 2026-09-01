// The chatbot with a model behind it.
//
// The app already carries an Anthropic and an OpenAI key (Settings → Others,
// stored encrypted), and `owa-devtools-mcp` already exposes tools that know
// this app. Wiring the two together is what turns the manual-lookup bot in
// `helpBotHelpers.ts` into something that can actually be conversed with.
//
// Either key drives the same bot over the same tools, and the user picks which
// one in the chatbot window -- they answer differently, they fail differently
// (a rate limit, an expired card, a blocked domain), and having the other one a
// click away is what keeps the help window useful when one of them is down.
// With no key -- or when a call fails, which on a church machine mid-service
// usually means the internet is down -- the caller falls back to the offline
// bot, which still answers from the bundled manual.

import type Anthropic from '@anthropic-ai/sdk';

import { getAISetting } from '../helper/ai/aiHelpers';
import { getAnthropicInstance } from '../helper/ai/anthropicHelpers';
import { getOpenAIInstance } from '../helper/ai/openAIHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { genGuideActions } from './helpBotHelpers';
import type { BotAnswerType, BotFocusType } from './helpBotHelpers';
import { callTool, listTools } from './mcpClient';

export type LlmModelType = {
    id: string;
    label: string;
    // The three things a volunteer picks on, in plain words: what it is good
    // for, how long it makes them wait, and what it costs. Blank on a model
    // read off the account's own catalogue -- the provider's list endpoint
    // reports neither speed nor price, and inventing either would be worse
    // than leaving the name to speak for itself.
    note: string;
    speed: string;
    price: string;
};

// The provider's own list price, input then output. Spelled out on the hover
// rather than beside every name, where it would double the length of the line.
const PRICE_UNIT = 'per 1M tokens (in/out)';

// What each provider offers, best first -- the top one is what a fresh install
// asks with. The answer quality of a help bot is mostly tool discipline, so the
// smaller models do the job too, and they are the ones to reach for on a thin
// budget or a slow line: bottom of the family is 20-25x cheaper than the top.
// NOT a closed list: `listAllLlmModels` adds whatever else the user's own key
// can reach, so a model released after this build was made is still one choice
// away.
const ANTHROPIC_MODEL_LIST: LlmModelType[] = [
    {
        id: 'claude-opus-5',
        label: 'Opus 5',
        note: 'best answers',
        speed: 'slower',
        price: '$5/$25',
    },
    {
        id: 'claude-sonnet-5',
        label: 'Sonnet 5',
        note: 'good answers',
        speed: 'quick',
        price: '$2/$10',
    },
    {
        id: 'claude-haiku-4-5',
        label: 'Haiku 4.5',
        note: 'simple answers',
        speed: 'quickest',
        price: '$1/$5',
    },
];
const OPENAI_MODEL_LIST: LlmModelType[] = [
    {
        id: 'gpt-5',
        label: 'GPT-5',
        note: 'best answers',
        speed: 'slower',
        price: '$1.25/$10',
    },
    {
        id: 'gpt-5-mini',
        label: 'GPT-5 mini',
        note: 'good answers',
        speed: 'quick',
        price: '$0.25/$2',
    },
    {
        id: 'gpt-5-nano',
        label: 'GPT-5 nano',
        note: 'simple answers',
        speed: 'quickest',
        price: '$0.05/$0.40',
    },
];

/**
 * What this model is like -- for a hover, which is the only place in a window
 * this narrow with room for the units. The name alone goes on the line.
 */
export function genLlmModelTitle(model: LlmModelType) {
    const lines = [model.id];
    const summary = [model.note, model.speed]
        .filter((part) => {
            return part.length > 0;
        })
        .join(' · ');
    if (summary.length > 0) {
        lines.push(summary);
    }
    if (model.price.length > 0) {
        lines.push(`${model.price} ${PRICE_UNIT}`);
    }
    return lines.join('\n');
}
// A help answer is a paragraph and a couple of steps, not an essay.
const MAX_TOKENS = 2000;
// GPT-5 spends reasoning tokens out of this same budget, so the answer itself
// can come back empty at the Anthropic figure. Bought back with a low effort
// setting: this is a lookup bot, not a solver.
const OPENAI_MAX_TOKENS = 6000;
const OPENAI_REASONING_EFFORT = 'low';
// ...and only the models that reason take that setting at all: an older chat
// model rejects the parameter outright, which now matters because the user can
// pick one from their own key's list.
const OPENAI_REASONING_MODEL_PATTERN = /^(gpt-5(?!-chat)|o[0-9])/;
// Enough for: search the manual, read the page, look at the app, answer.
// A walkthrough is search, sometimes a page read, sometimes one look at the
// window, then starting the card -- four or five calls before a word is said.
// At six the budget ran out mid-answer and the user got the shrug below,
// having paid for the whole run. The LAST round is spent with no tools at
// all, so there is always an answer to show.
const MAX_TOOL_ROUNDS = 10;

export type LlmProviderType = 'anthropic' | 'openai';

export const LLM_PROVIDER_LIST: {
    key: LlmProviderType;
    label: string;
    models: LlmModelType[];
}[] = [
    { key: 'anthropic', label: 'Claude', models: ANTHROPIC_MODEL_LIST },
    { key: 'openai', label: 'ChatGPT', models: OPENAI_MODEL_LIST },
];

// The window is reopened constantly (it is a help window), so the choice is
// remembered. Plain setting, not a secret: it names a provider, not a key.
const PROVIDER_SETTING_NAME = 'chatbot-llm-provider';
// Per provider, because the two are switched between: picking a cheap ChatGPT
// model must not decide which Claude model answers the next question.
const MODEL_SETTING_PREFIX = 'chatbot-llm-model-';

/** The providers whose key is actually set, in preference order. */
export function getAvailableLlmProviders(): LlmProviderType[] {
    const { anthropicAPIKey, openAIAPIKey } = getAISetting();
    return LLM_PROVIDER_LIST.filter((provider) => {
        return provider.key === 'anthropic' ? anthropicAPIKey : openAIAPIKey;
    }).map((provider) => {
        return provider.key;
    });
}

/**
 * The provider to ask: the one the user chose, as long as its key is still
 * there -- a key removed in Settings must not leave the window pointing at a
 * provider that can only fail.
 */
export function getLlmProvider(): LlmProviderType | null {
    const availableProviders = getAvailableLlmProviders();
    const chosen = getSetting(PROVIDER_SETTING_NAME) as LlmProviderType | null;
    if (chosen !== null && availableProviders.includes(chosen)) {
        return chosen;
    }
    return availableProviders[0] ?? null;
}

export function setLlmProvider(provider: LlmProviderType) {
    setSetting(PROVIDER_SETTING_NAME, provider);
}

/** The models this build offers for a provider, best first. */
export function getLlmModelList(provider: LlmProviderType): LlmModelType[] {
    return (
        LLM_PROVIDER_LIST.find((item) => {
            return item.key === provider;
        })?.models ?? []
    );
}

/**
 * The model to ask with. Stored by id rather than by position in the list: one
 * picked out of the key's own live list is not in the built-in list at all, and
 * has to survive a restart just the same.
 */
export function getLlmModel(provider: LlmProviderType): string {
    const chosen = getSetting(MODEL_SETTING_PREFIX + provider);
    if (chosen) {
        return chosen;
    }
    return getLlmModelList(provider)[0].id;
}

export function setLlmModel(provider: LlmProviderType, model: string) {
    setSetting(MODEL_SETTING_PREFIX + provider, model);
}

function genSystemPrompt(focus: BotFocusType) {
    return `
You are the built-in help assistant of Open Worship App, a free desktop app
churches use to put lyrics, Bible verses and media on a projector screen.

WHO YOU ARE TALKING TO. A church volunteer, often minutes before or during a
live service, frequently not a native English speaker and NOT a technical
person. They know the words on the buttons in front of them and nothing else.
Everything you say must survive that:

- Say what they can see and press: "click the blue **Bible Lookup** button at
  the top", not "invoke the lookup popup".
- NEVER show them a file name, a folder path, a setting key, a component or
  function name, a code snippet, or an id like "W-06" -- not even in passing.
  You read those; you do not repeat them.
- Keep it to the few steps that answer the question, numbered, one action each.
  No background, no explanation of how the app works inside.
- Short sentences. Plain words. Calm: they may be in a hurry and in front of a
  congregation.
- ALWAYS answer in English, whatever language the question is in. This window
  is English-only, and the app's own labels are written in English on their
  screen. If the manual quotes a button with a Khmer twin, use the English half
  alone.

The user is currently asking about the **${focus}** side of the app, and they
are LOOKING AT IT while they ask. Never tell them to open the window they are
already in -- no "click the Bible Reader tab" when they are in the Bible
Reader; start at the first step they have not done. \`owa_app_state\` with
\`page: "${focus}.html"\` says what is on their screen if you are unsure.

**The one window can only BE one half at a time.** If a tool answers that the
app has no open page matching "${focus}.html", the window is showing the OTHER
half and nothing about this half can be circled, clicked or typed until the
user is there. Do not retry the same call. Guide them across first: tell them
to click the switch control (from the Bible Reader it is the 🖥️ button at the
top right; from the Presenter it is the 📖 Bible Reader tab at the top), point
it out with \`owa_find_ui\` and \`highlight: true\`, and start the walkthrough
once they say they are there. When they asked you to DO it for them, switch
the window yourself with \`owa_goto_page\` -- say the window is about to
change first -- then start the guide on the new page.

Rules:
- Answer from this app's own knowledge. Call \`owa_help_search\` FIRST for any
  "how do I", "where is", "what does X do" question -- ALWAYS with
  \`focus: "${focus}"\`, or you will hand them the other window's way of doing
  it -- and \`owa_help_page\` when a hit looks right; those pages were verified
  against the real app.
- A hit marked \`internal\` is a note written for whoever BUILDS the app. Use it
  to understand, then say what the user should press. Never quote it, never
  mention that it exists, and never pass its wording on.
- When the answer takes more than one step, offer to walk them through it and
  call \`owa_guide_start\` -- a numbered card appears in the app window and the
  control for each step is circled in red, which is far easier to follow than a
  paragraph. Use \`manualId\` when a manual recipe fits, otherwise write the
  steps yourself in plain English, with \`find\` set to the exact words written
  on the button. EVERY step must be a thing to DO in the app -- "look at
  the app window" is something you say in the chat, never a step, and the
  card already says it; step 1 is the first control they have to touch.
- **A step the card cannot circle is not a step.** The whole point of the
  card is a red ring round the thing to press, so give EVERY step a \`find\`:
  the words actually written on that control. Some controls are named by
  nothing in any sentence -- the Bible version button reads \`KJV\`, not
  "version" -- so use what is ON it, and check with \`owa_list_ui\` or
  \`owa_find_ui\` if you truly cannot guess. Never turn an observation
  ("the text re-renders", "the list filters") into a step: fold it into
  the step before it.
- **Check your aim once, after you start it.** \`owa_guide_status\` answers
  \`find\` (the label that step used), \`isTargetFound\`, and when that is
  false, \`nearMisses\` -- the closest labels that ARE on their screen.
  Start the guide again with one of those, or look the real one up with
  \`owa_list_ui\`. Guessing the presenter's controls for the reader is the
  usual cause: the Bible Reader has no Book/Chapter/Verse buttons, it has
  one reference box and a version button showing the Bible key.
- If they would rather watch than do it, start the same guide with
  \`mode: "demo"\`: the card then does each step for them, one press of **Do
  it** at a time. Say what it will do first, and NEVER demo a step that changes
  what the congregation sees -- presenting something, clearing or hiding a
  screen -- without asking them first. \`owa_guide_step\` with
  \`action: "do"\` performs the current step; \`owa_guide_status\` says where
  they are and whether the last one worked.
- **A demo needs YOUR steps, not a \`manualId\`.** A recipe only marks its
  controls by bolding them, and it bolds keystrokes and stressed words too,
  so a demo built from one often cannot press anything -- \`owa_guide_start\`
  answers \`canDemo: false\` when that happens and quietly becomes a plain
  walkthrough. So when they want it done FOR them, write the steps yourself
  and give each one a \`find\`: the exact words written on the control, not a
  shortcut and not a word from your sentence. Use \`action: "type"\` with a
  \`value\` for a step that types. A step with nothing to press is fine as
  plain text; the card asks them to do that one themselves.
- **You have a handful of tool calls, so spend them on doing it.** START the
  guide; do not check each step with \`owa_find_ui\` first. One check, for one
  label you genuinely cannot guess, is the most that is ever worth it -- a
  run of them uses the whole budget and the user gets no walkthrough at all.
- **"It is not working" is a different question from "how do I".** When they
  report a symptom instead of asking for a task -- nothing on the screen, the
  words not coming out, it froze, the audience is seeing the wrong thing --
  LOOK before you answer: \`owa_list_screens\` says whether a screen is showing
  at all and what is on it, \`owa_app_state\` says where they are. Answer from
  what you find there. Never open with the projector's power or its cable: you
  cannot see those, the app can see itself, and someone panicking in front of a
  congregation needs the one thing that is actually wrong. In this app it is
  nearly always one of these, all on the screen preview card: no screen is
  showing (the show/hide button in its header, or F5), the layer was cleared
  (the Clear buttons beside it), the screen is locked and refusing changes, or
  it is pointed at the wrong display (the display button in its footer).
- **Never guess what a control is called.** "It may be labelled something like
  ..." is not an answer. \`owa_list_ui\` lists what is really on their screen
  and \`owa_find_ui\` finds one by its words -- look it up, then say it
  exactly. \`owa_find_ui\` with \`highlight\` also points at a control they
  cannot find; pass \`anyPage: true\` when it could be in the other window and
  it will say which one it is in.
- To do ONE thing for them right away -- press a button, fill in the
  reference box -- use \`owa_click\` / \`owa_type\` with the exact words on
  the control rather than starting a whole guide. When one answers with
  \`nearMisses\`, retry with one of those labels; do not guess again. Ask
  first before anything that changes what the congregation sees.
- Never invent a menu item, a shortcut or a setting. If the knowledge does not
  cover it, say so plainly and suggest the closest thing that does exist.
- Anything that changes what the audience sees -- hiding a screen, clearing
  content -- must be offered, never done unasked. \`owa_hide_screens\` in
  particular takes content off a live projector.
`.trim();
}

// Anthropic's list endpoint answers with chat models only; OpenAI's answers
// with the whole catalogue -- speech, images, embeddings, the lot -- so it is
// filtered down to the families that can hold a conversation with tools.
const OPENAI_CHAT_MODEL_PATTERN = /^(gpt-[0-9]|o[0-9])/;
const OPENAI_NOT_CHAT_PATTERN =
    /audio|realtime|image|tts|transcribe|whisper|embedding|moderation|search|codex|dall-e|instruct/;

async function listRemoteAnthropicModels(): Promise<LlmModelType[]> {
    const anthropic = getAnthropicInstance();
    if (anthropic === null) {
        return [];
    }
    const page = await anthropic.models.list({ limit: 100 });
    return page.data.map((model) => {
        return {
            id: model.id,
            label: model.display_name || model.id,
            note: '',
            speed: '',
            price: '',
        };
    });
}

async function listRemoteOpenAIModels(): Promise<LlmModelType[]> {
    const openAI = getOpenAIInstance();
    if (openAI === null) {
        return [];
    }
    const page = await openAI.models.list();
    return page.data
        .filter((model) => {
            return (
                OPENAI_CHAT_MODEL_PATTERN.test(model.id) &&
                !OPENAI_NOT_CHAT_PATTERN.test(model.id)
            );
        })
        .map((model) => {
            return {
                id: model.id,
                label: model.id,
                note: '',
                speed: '',
                price: '',
            };
        });
}

/**
 * Everything this key can actually reach: the built-in list first, in its own
 * order, then whatever else the account has, alphabetically. Asked of the
 * provider only when the user goes looking for more -- opening the help window
 * must not cost a network request, and the built-in list already answers for
 * almost everyone.
 */
export async function listAllLlmModels(
    provider: LlmProviderType,
): Promise<LlmModelType[]> {
    const knownModels = getLlmModelList(provider);
    let remoteModels: LlmModelType[];
    try {
        remoteModels =
            provider === 'anthropic'
                ? await listRemoteAnthropicModels()
                : await listRemoteOpenAIModels();
    } catch (error: any) {
        throw new Error(describeLlmError(error), { cause: error });
    }
    const knownIds = new Set(
        knownModels.map((model) => {
            return model.id;
        }),
    );
    return [
        ...knownModels,
        ...remoteModels
            .filter((model) => {
                return !knownIds.has(model.id);
            })
            .sort((modelA, modelB) => {
                return modelA.label.localeCompare(modelB.label);
            }),
    ];
}

type McpToolType = { name: string; description?: string; inputSchema?: any };

/**
 * What went wrong, in one line a volunteer can act on. Both SDKs put the raw
 * JSON body in `error.message` (`400 {"type":"error",...}`), and dumping that
 * into a help window is worse than useless -- it is frightening, and the
 * markdown renderer eats the underscores in it for good measure.
 */
export function describeLlmError(error: any): string {
    const status = error?.status ?? error?.response?.status ?? null;
    const rawMessage =
        error?.error?.error?.message ??
        error?.error?.message ??
        (typeof error?.message === 'string' ? error.message : '');
    const message = String(rawMessage)
        .replace(/^\d{3}\s*\{[\s\S]*$/, '')
        .trim();
    if (/workspace/i.test(String(rawMessage))) {
        return (
            'this API key needs a workspace id — add it in ' +
            'Settings → Others → AI Providers'
        );
    }
    if (status === 401 || status === 403) {
        return 'the API key was refused — check it in Settings → Others';
    }
    if (status === 429) {
        return 'the AI account is out of credit or being rate-limited';
    }
    if (status !== null && status >= 500) {
        return 'the AI service is having trouble right now';
    }
    if (status === null) {
        return 'it could not be reached — the internet may be down';
    }
    return message.length > 0 && message.length < 160
        ? message
        : `the AI service refused the request (error ${status})`;
}

/**
 * The recipe the model actually looked at while answering, if it looked at
 * one. The walkthrough buttons need a recipe to walk through, and asking the
 * model to remember to offer them does not work: it answers in prose and moves
 * on. Watching what it read gives the user the same two buttons the offline
 * bot offers, on an answer written by the model.
 */
type ToolWatchType = { manualId: string | null };

async function runMcpTool(name: string, args: any, watch: ToolWatchType) {
    try {
        const text = await callTool(name, args ?? {});
        if (name === 'owa_help_search' && watch.manualId === null) {
            try {
                const hits = JSON.parse(text);
                const manualHit = (Array.isArray(hits) ? hits : []).find(
                    (hit: any) => {
                        return hit?.kind === 'manual' && hit?.id;
                    },
                );
                watch.manualId = manualHit?.id ?? null;
            } catch (_error) {
                // A tool that answered with prose ("nothing matches ...");
                // there is simply no recipe to offer.
            }
        }
        return text;
    } catch (error: any) {
        // Handed back to the model rather than thrown: a failed lookup is
        // something it can route around, and the user still gets an answer.
        return `Tool error: ${error.message}`;
    }
}

async function askAnthropic(
    question: string,
    focus: BotFocusType,
    tools: McpToolType[],
    watch: ToolWatchType,
    model: string,
): Promise<BotAnswerType> {
    const anthropic = getAnthropicInstance();
    if (anthropic === null) {
        throw new Error('Anthropic is not available');
    }
    const anthropicTools = tools.map((tool) => {
        return {
            name: tool.name,
            description: tool.description ?? '',
            input_schema: (tool.inputSchema ?? {
                type: 'object',
                properties: {},
            }) as Anthropic.Tool.InputSchema,
        };
    });
    const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: question },
    ];
    // Built once, not once per round: it is four kilobytes of template
    // literal and it does not change while the question is being answered.
    const systemPrompt = genSystemPrompt(focus);
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const isLastRound = round === MAX_TOOL_ROUNDS - 1;
        const response = await anthropic.messages.create({
            model,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            // Nothing left to look up: answer with what you have.
            ...(isLastRound ? {} : { tools: anthropicTools }),
            messages,
        });
        const toolUses = response.content.filter((block) => {
            return block.type === 'tool_use';
        }) as Anthropic.ToolUseBlock[];
        if (toolUses.length === 0) {
            const text = response.content
                .filter((block) => {
                    return block.type === 'text';
                })
                .map((block) => {
                    return (block as Anthropic.TextBlock).text;
                })
                .join('\n')
                .trim();
            return { text: text || 'I could not find an answer for that.' };
        }
        messages.push({ role: 'assistant', content: response.content });
        // All results in ONE user message: splitting them teaches the model to
        // stop asking for tools in parallel.
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: await runMcpTool(toolUse.name, toolUse.input, watch),
            });
        }
        messages.push({ role: 'user', content: toolResults });
    }
    return {
        text:
            'I looked several things up but could not settle on an answer. ' +
            'Try asking about one step at a time.',
    };
}

async function askOpenAI(
    question: string,
    focus: BotFocusType,
    tools: McpToolType[],
    watch: ToolWatchType,
    model: string,
): Promise<BotAnswerType> {
    const openAI = getOpenAIInstance();
    if (openAI === null) {
        throw new Error('OpenAI is not available');
    }
    const openAITools = tools.map((tool) => {
        return {
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description ?? '',
                parameters: tool.inputSchema ?? {
                    type: 'object',
                    properties: {},
                },
            },
        };
    });
    // Only the reasoning models take an effort setting -- and only they need
    // the bigger budget, because only they spend it on thinking first.
    const isReasoningModel = OPENAI_REASONING_MODEL_PATTERN.test(model);
    const messages: any[] = [
        { role: 'system', content: genSystemPrompt(focus) },
        { role: 'user', content: question },
    ];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const isLastRound = round === MAX_TOOL_ROUNDS - 1;
        const completion = await openAI.chat.completions.create({
            model,
            max_completion_tokens: isReasoningModel
                ? OPENAI_MAX_TOKENS
                : MAX_TOKENS,
            ...(isReasoningModel
                ? { reasoning_effort: OPENAI_REASONING_EFFORT }
                : {}),
            // Nothing left to look up: answer with what you have.
            ...(isLastRound ? {} : { tools: openAITools }),
            messages,
        });
        const choice = completion.choices[0]?.message;
        const toolCalls = choice?.tool_calls ?? [];
        if (toolCalls.length === 0) {
            const text = choice?.content?.trim();
            if (!text) {
                // Reasoning ate the budget, or the model simply said nothing.
                // Thrown rather than shown, so the caller falls back to the
                // manual instead of printing a shrug.
                throw new Error(
                    'ChatGPT returned no answer ' +
                        `(${completion.choices[0]?.finish_reason ?? 'unknown'})`,
                );
            }
            return { text };
        }
        messages.push(choice);
        for (const toolCall of toolCalls) {
            const call = toolCall as any;
            let args = {};
            try {
                args = JSON.parse(call.function?.arguments || '{}');
            } catch (_error) {
                // A malformed argument string is the model's problem to fix on
                // the next round; an empty object gets it a usable error back.
            }
            messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: await runMcpTool(call.function?.name, args, watch),
            });
        }
    }
    return {
        text:
            'I looked several things up but could not settle on an answer. ' +
            'Try asking about one step at a time.',
    };
}

/**
 * Answers with a model, using the MCP tools. Throws when no provider is
 * configured or the call fails -- the caller falls back to the offline bot.
 */
export async function askLlmBot(
    question: string,
    focus: BotFocusType,
    wantedProvider?: LlmProviderType | null,
    wantedModel?: string | null,
): Promise<BotAnswerType> {
    const provider = wantedProvider ?? getLlmProvider();
    if (provider === null) {
        throw new Error('No AI provider key is set');
    }
    const model = wantedModel || getLlmModel(provider);
    const tools = (await listTools()) as McpToolType[];
    const watch: ToolWatchType = { manualId: null };
    try {
        const answer =
            provider === 'anthropic'
                ? await askAnthropic(question, focus, tools, watch, model)
                : await askOpenAI(question, focus, tools, watch, model);
        if (answer.actions === undefined && watch.manualId !== null) {
            answer.actions = genGuideActions(
                { id: watch.manualId },
                focus,
                // A model answered this, so a model can be asked to work
                // the demo out too -- see the note in `genGuideActions`.
                true,
                question,
            );
        }
        return answer;
    } catch (error: any) {
        // Re-thrown as one readable line; the caller shows it beside the
        // answer it fell back to.
        throw new Error(describeLlmError(error), { cause: error });
    }
}
