// Types for `questionMatch.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the MCP server and the renderer must rank a half-typed question the same way,
// and the only way to guarantee that is to run the same module.

import type { BotFocusType } from './botFocus.d.mts';

/**
 * Which window(s) a page of questions belongs to. A list because one page can
 * belong to several -- the slide editor is a tab of the main window, so its
 * questions answer from the Presenter as well -- and `null` for what reads the
 * same from every window at all.
 */
export type QuestionFocusType = BotFocusType | BotFocusType[] | null;

export type QuestionResourcesType = {
    /** The manual recipe that answers it, e.g. `"W-06"`. */
    recipe?: string;
    /** Other recipes worth reading, same id shape. */
    related?: string[];
    /** The exact visible control to ring, in `owa_find_ui`'s syntax. */
    find?: string;
    /** A native menu path, which cannot be ringed: `"View → Widgets"`. */
    menu?: string;
    /** The keystroke that does it, written the way the manual writes it. */
    shortcut?: string;
    /** The `owa_*` tools that can answer it from the live app. */
    tools?: string[];
    /** Whether a step-by-step walkthrough can be run for it. */
    guide?: boolean;
};

export type QuestionRowType = {
    /** `<page>.<section>.<question>`, stable across edits to the wording. */
    id: string;
    text: string;
    kind: 'howto' | 'where' | 'what' | 'state' | 'fix';
    page: string;
    pageLabel: string;
    focus: QuestionFocusType;
    section: string;
    sectionLabel: string;
    panel: string | null;
    keywords: string[];
    starter: boolean;
    /** Where it sits among the empty window's few chips; lower leads. */
    starterRank: number | null;
    /** A chip that fills the ask box rather than asking: it has a blank in it. */
    isTemplate: boolean;
    resources: QuestionResourcesType;
};

export type QuestionSectionType = {
    id: string;
    label: string;
    panel?: string;
    recipes?: string[];
    questions: {
        id: string;
        text: string;
        kind?: QuestionRowType['kind'];
        keywords?: string[];
        starter?: boolean;
        starterRank?: number;
        template?: boolean;
        resources?: QuestionResourcesType;
    }[];
};

export type QuestionPageType = {
    page: string;
    label: string;
    window: string | null;
    focus: QuestionFocusType;
    description?: string;
    updated?: string;
    sections: QuestionSectionType[];
};

export type MatchOptionsType = {
    pages: QuestionPageType[];
    focus?: BotFocusType | null;
    page?: string | null;
    section?: string | null;
    limit?: number;
};

export function flattenQuestions(pages: QuestionPageType[]): QuestionRowType[];

export function matchQuestions(
    query: string,
    options: MatchOptionsType,
): QuestionRowType[];

export function outlineQuestions(options: {
    pages: QuestionPageType[];
    focus?: BotFocusType | null;
}): {
    page: string;
    label: string;
    sections: { id: string; label: string; count: number }[];
}[];
