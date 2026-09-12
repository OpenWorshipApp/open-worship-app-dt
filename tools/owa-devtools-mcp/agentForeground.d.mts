// Types for the renderer's import of `agentForeground.mjs` -- the describer
// the `/countdown` and `/marquee` commands and the offline bot share with the
// server.
export type AgentForegroundScreenRefType = {
    screenId: number;
    isShowing: boolean;
    isLocked: boolean;
    foreground: string[];
};

export type AgentForegroundResultRefType =
    | { isError: true; reason: string }
    | {
          isError?: false;
          did: 'started' | 'stopped' | 'checked';
          widget: string | null;
          detail: string;
          screens: AgentForegroundScreenRefType[];
          isAnyShowing: boolean;
          note?: string;
      };

export declare const AGENT_FOREGROUND_WIDGETS: readonly [
    'countdown',
    'stopwatch',
    'clock',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    'all',
];
export declare const AGENT_FOREGROUND_ACTIONS: readonly [
    'start',
    'stop',
    'check',
];
export declare function toForegroundWidgetNoun(widget: unknown): string;
export declare function genForegroundExpression(request: {
    action?: string;
    widget?: string;
    minutes?: number;
    at?: string;
    text?: string;
    seconds?: number;
}): string;
export declare function formatForegroundResult(result: unknown): {
    isError: boolean;
    text: string;
};
export declare function describeForeground(
    result: AgentForegroundResultRefType | null | undefined,
): string;
