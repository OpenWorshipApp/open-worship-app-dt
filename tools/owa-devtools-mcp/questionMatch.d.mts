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
    /** Words the passage of the recipe that answers it opens on. */
    passage?: string;
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
    /** The words SHOWN: the app language's once an overlay is applied. */
    text: string;
    /** The row's English words, whatever it shows. */
    textEn: string;
    kind: 'howto' | 'where' | 'what' | 'state' | 'fix';
    page: string;
    pageLabel: string;
    focus: QuestionFocusType;
    section: string;
    sectionLabel: string;
    sectionLabelEn: string;
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
    /** The English label, once an overlay has put its translation in `label`. */
    labelEn?: string;
    panel?: string;
    recipes?: string[];
    questions: {
        id: string;
        text: string;
        /** The English words, once an overlay has put its translation in `text`. */
        textEn?: string;
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

/** One `questions/i18n/<code>.json`. */
export type QuestionOverlayType = {
    lang: string;
    updated?: string;
    sections?: Record<string, { en: string; text: string }>;
    questions?: Record<string, { en: string; text: string }>;
};

export function applyQuestionOverlay(
    pages: QuestionPageType[],
    overlay: QuestionOverlayType | null | undefined,
): QuestionPageType[];

export function flattenQuestions(pages: QuestionPageType[]): QuestionRowType[];

export function findTemplateSample(
    text: string,
): { at: number; sample: string; kind: number } | null;

export function toEnglishTemplateAsk(
    typed: string,
    rows: QuestionRowType[],
): string | null;

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
