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
