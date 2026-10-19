// Types for `modelTools.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the list the model is SENT and the calls the window REFUSES have to come from
// one place, or a tool is withheld in name only.

/** Tool name -> what to tell the model to do instead. */
export const MODEL_HIDDEN_TOOL_MAP: Record<string, string>;

export function checkIsModelHiddenTool(name: string): boolean;
export function findModelHiddenReason(name: string): string | null;
export function filterModelToolList<T extends { name: string }>(
    toolList: T[],
): T[];

/** Tool name -> the one kind of ask it is offered for. */
export const MODEL_ON_ASK_TOOL_MAP: Record<string, string>;
/** Ask kind -> the ordinary tools it is sent beside its own. */
export const MODEL_ASK_SHARED_TOOL_MAP: Record<string, string[]>;

export function checkIsModelOnAskTool(name: string): boolean;
export function pickAskToolList<T extends { name: string }>(
    toolList: T[],
    askKind: string,
): T[];
