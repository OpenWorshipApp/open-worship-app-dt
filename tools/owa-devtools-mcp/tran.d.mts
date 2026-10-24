// What a language's `src/lang/data/<code>/assistant.json` says about asking
// and answering in it. Every field but the names is optional.
export type AssistantFactsType = {
  name: string;
  nativeName: string;
  scriptPattern: string;
  nativeDigits?: string;
  functionWords?: string[];
  yesWords?: string[];
  noWords?: string[];
  yesReply?: string;
  noReply?: string;
  yesNoQuestionLeads?: string[];
  yesNoQuestionEndings?: string[];
  walkthroughEchoWords?: string[];
  frameAliases?: Record<string, string[]>;
  glossary?: Record<string, string>;
};

export type TranBundle = {
  languages?: {
    code: string;
    name: string;
    nativeName: string;
    assistant?: AssistantFactsType | null;
  }[];
  dictionaries: Record<string, Record<string, string>>;
};

export const DEFAULT_LANG_CODE: 'en';
export function extractDictionary(source: string): Record<string, string>;
export function extractLangMeta(source: string): {
  name: string | null;
  nativeName: string | null;
};
export function loadTranBundle(): TranBundle;
export function listTranLanguages(): NonNullable<TranBundle['languages']>;
export function readSourceAssistantFacts(
  langCode: string,
): AssistantFactsType | null;
export function getLanguageFacts(
  langCode: string | null,
  bundle?: TranBundle | null,
): AssistantFactsType | null;
export function tranText(
  text: string,
  langCode: string | null,
  bundle?: TranBundle | null,
): string;
export function resolveTranTemplates(
  text: string,
  langCode: string | null,
  bundle?: TranBundle | null,
): string;
export function listTranTemplateKeys(text: string): {
  sourceLang: string;
  kind: string;
  key: string;
}[];
