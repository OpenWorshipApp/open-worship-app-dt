// Types for the renderer's import of `agentBible.mjs` -- the describer the
// `/verse` command and the offline bot share with the server.
export type AgentBibleScreenRefType = {
    screenId: number;
    isShowing: boolean;
    isLocked: boolean;
    bible: { reference: string; version: string; versions?: string[] } | null;
};

export type AgentBibleResultRefType =
    | { isError: true; reason: string; versions?: string[] }
    | {
          isError?: false;
          isPresented: boolean;
          reference: string;
          version: string;
          text: string;
          screens: AgentBibleScreenRefType[];
          isAnyShowing: boolean;
          note?: string;
      };

export declare const AGENT_BIBLE_ACTIONS: readonly ['present', 'check'];
export declare function genPresentBibleExpression(request: {
    reference?: string;
    version?: string;
    action?: string;
}): string;
export declare function formatPresentBibleResult(result: unknown): {
    isError: boolean;
    text: string;
};
export declare function describePresentedBible(
    result: AgentBibleResultRefType | null | undefined,
): string;
