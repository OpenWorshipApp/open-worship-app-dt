export type AgentScreenContentType = {
    slide?: {
        document: string;
        kind: string;
        name: string;
        text: string | null;
    } | null;
    bible?: {
        reference: string;
        version: string;
        versions?: string[];
    } | null;
    background?: { kind: string; name: string | null } | null;
    foreground?: string[];
};

export declare function genListScreensExpression(): string;
export declare function describeScreenContent(
    screen: AgentScreenContentType | null | undefined,
): string;
