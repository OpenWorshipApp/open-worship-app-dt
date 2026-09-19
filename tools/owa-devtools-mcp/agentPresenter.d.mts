// Types for the renderer's import of `agentPresenter.mjs` -- the describer
// the offline bot and the `/` commands share with the server.
export type AgentSlideRefType = {
    n: number;
    name: string;
    find: string;
    text: string | null;
    isDisabled?: true;
    onScreens?: number[];
};

export type AgentSelectedDocumentType = {
    name: string;
    kind: string;
    slideCount: number;
    slides: AgentSlideRefType[];
    moreCount?: number;
    onScreen: AgentSlideRefType | null;
    next: AgentSlideRefType | null;
    previous: AgentSlideRefType | null;
};

export type AgentRunLineRefType = {
    n: number;
    title: string;
    kind: string;
    isParked?: true;
    slide?: { n: number; name: string; isLast?: boolean };
};

export type AgentRunSheetRefType = {
    name: string;
    lineCount: number;
    lines: AgentRunLineRefType[];
    moreCount?: number;
    cursor: AgentRunLineRefType | null;
    next: AgentRunLineRefType | null;
    isAtEnd?: true;
};

export type AgentRunSheetStateRefType = {
    openSheets: AgentRunSheetRefType[];
    availableSheets?: string[];
    note?: string;
};

export declare function genPresenterStateExpression(): string;
export declare function foldPresenterState<T extends object>(
    answer: T,
    relayResult: unknown,
): T & {
    selectedDocument?: AgentSelectedDocumentType | null;
    runSheet?: AgentRunSheetStateRefType | null;
    note?: string;
};
export declare function describeRunSheet(
    runSheet: AgentRunSheetStateRefType | null | undefined,
): string;
export declare function describeSelectedDocument(
    selectedDocument: AgentSelectedDocumentType | null | undefined,
): string;
