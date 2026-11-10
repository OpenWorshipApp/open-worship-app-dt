/**
 * A language the conversation is about, installed first -- with the person's
 * say-so (2026-11-05, the user, over a Bible import in a non-English window
 * where another language had been pressed and its Bibles listed at once:
 * _chatbot must ask user permission to install any language package that
 * related to chatting session, e.g. user input for <a language> so chatbot
 * should take a moment to help user install <it> first before proceed
 * further step_).
 *
 * Only English ships; every other language is a plugin
 * (`language-plugins-runtime`), and a Bible in it gets its book names,
 * digits and search words from that plugin. So when a conversation turns to
 * a language that is not installed -- the Bible import's language, a request
 * to install one -- the window asks `owa_language` and, when the catalog has
 * it, says so with **Install it** / **Not now**. The press is the consent:
 * the buttons are pseudo tools no model can press, and the model is never
 * offered `owa_language` at all (`modelTools.mjs`).
 *
 * A check that cannot be made -- the tool host down, the catalog offline --
 * says nothing and lets the conversation go on: an offer must never block
 * what the person came to do.
 */
import { toDownloadSizeText } from '../helper/agentLanguageNameHelpers';
import { appError } from '../helper/loggerHelpers';
import { checkIsLanguageWord, listAssistantLanguages } from './chatLangHelpers';
import { fillWords, tran, tranLabel } from './chatTranHelpers';
import type { BotActionType, BotAnswerType } from './helpBotHelpers';
import { callTool, parseToolJson } from './mcpClient';

// A pseudo tool, caught in the window's `handleActing`: no tool host
// registers it, so no model can press these buttons for the person.
export const LANG_INSTALL_STEP_TOOL_NAME = 'owa-lang-install-step';

// The buttons, stored in English (a typed "yes" is matched to them) and
// drawn in the app's language with `tranLabel`.
export const LANG_INSTALL_LABEL = 'Install it';
export const LANG_ENABLE_LABEL = 'Enable';
export const LANG_SKIP_LABEL = 'Not now';

export type ChatLangCheckType = {
    state:
        | 'english'
        | 'installed'
        | 'turned-off'
        | 'missing'
        | 'unavailable'
        | 'unknown';
    langCode?: string;
    name?: string;
    nativeName?: string;
    version?: string;
    size?: number;
    isOffline?: boolean;
};

function toCheck(value: unknown): ChatLangCheckType | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const state = (value as { state?: unknown }).state;
    return typeof state === 'string' ? (value as ChatLangCheckType) : null;
}

/**
 * What the app has of the language some words name -- a name, a code, a
 * locale -- or null when it could not be asked.
 */
export async function checkChatLanguage(
    language: string,
): Promise<ChatLangCheckType | null> {
    try {
        return toCheck(
            parseToolJson(
                await callTool('owa_language', { action: 'check', language }),
            ),
        );
    } catch (error) {
        appError(error, 'language check');
        return null;
    }
}

/**
 * Installs (or turns back on) the language: true when it is there now. The
 * main window's own toast says why when it is not.
 */
export async function installChatLanguage(langCode: string) {
    try {
        const result = parseToolJson(
            await callTool('owa_language', {
                action: 'install',
                language: langCode,
            }),
        );
        return (
            result !== null &&
            typeof result === 'object' &&
            result.problem === undefined &&
            (result.state === 'installed' || result.state === 'english')
        );
    } catch (error) {
        appError(error, 'language install');
        return false;
    }
}

/** Whether the language is one to OFFER: not installed, or turned off. */
export function checkIsLangOffer(
    check: ChatLangCheckType | null,
): check is ChatLangCheckType & { langCode: string } {
    return (
        check !== null &&
        typeof check.langCode === 'string' &&
        (check.state === 'missing' || check.state === 'turned-off')
    );
}

/**
 * The language as the Languages tab shows it: its own name, then its
 * English one in brackets -- the words the person will find it by there.
 */
export function toChatLangLabel(check: ChatLangCheckType) {
    const name = check.name ?? check.langCode ?? '';
    const nativeName = check.nativeName ?? '';
    return nativeName && nativeName !== name ? `${nativeName} (${name})` : name;
}

/** The offer's words: what is missing, why it helps, what it costs. */
export function genLangOfferText(check: ChatLangCheckType) {
    const language = toChatLangLabel(check);
    if (check.state === 'turned-off') {
        return fillWords(
            tran(
                '**{language} is installed but turned off.** Turn it on ' +
                    'first? It gives the app the Bible book names, numbers ' +
                    'and search words of {language}.',
            ),
            { language },
        );
    }
    const size = toDownloadSizeText(check.size);
    return [
        fillWords(
            tran(
                '**{language} is not installed in this app yet.** Install ' +
                    'it first? It gives the app the Bible book names, ' +
                    'numbers and search words of {language}.',
            ),
            { language },
        ),
        ...(size === null
            ? []
            : [
                  fillWords(
                      tran(
                          'It is a download of {size} from Open Worship. It ' +
                              'does not change the language the app is shown ' +
                              'in.',
                      ),
                      { size },
                  ),
              ]),
    ].join(' ');
}

export function genLangReadyText(language: string) {
    return fillWords(tran('**Done — {language} is ready.**'), { language });
}

export function genLangFailedText(language: string, isTurnOn: boolean) {
    return fillWords(
        tran(
            'I could not install {language}. Nothing was changed. Press ' +
                '**{button}** to try again, or do it in **Settings → ' +
                'Languages**.',
        ),
        {
            language,
            button: tran(isTurnOn ? LANG_ENABLE_LABEL : LANG_INSTALL_LABEL),
        },
    );
}

/** The waiting line while it downloads: a pack can be tens of megabytes. */
export function describeLangInstall(language: string) {
    return fillWords(tran('Installing {language} — this can take a minute'), {
        language,
    });
}

// --- a language asked for in so many words --------------------------------

export type LangInstallStepType = 'check' | 'install' | 'skip';

export type LangInstallStateType = {
    step: LangInstallStepType;
    // The words that name it, as the person wrote them.
    language: string;
    langCode?: string;
    label?: string;
    isTurnOn?: boolean;
};

// "Install the German language", "can you add Spanish language pack for
// me?", "download the language Thai". A question about HOW is the guide's
// (W-55), and a Bible in a language is the Bible import's.
const INSTALL_WORD_PATTERN =
    /\b(?:install|add|download|get|enable|turn\s+on)\b/i;
const LANGUAGE_WORD_PATTERN = /\blanguages?\b/i;
const QUESTION_START_PATTERN =
    /^(?:how|what|where|why|when|which|who|is|are|does|do|should)\b/i;
const OTHER_TOPIC_PATTERN =
    /\b(?:bibles?|verses?|songs?|lyrics?|slides?|screens?|fonts?|keyboard|spell\s*check)\b/i;
// The words of the request itself, taken off to leave the language's name.
const FILLER_PATTERN =
    /\b(?:please|pls|can|could|would|will|you|u|me|for|my|the|a|an|to|of|in|on|into|this|that|app|i|want|wanna|need|like|help|and|also|now|then|install|installing|add|adding|download|downloading|get|enable|turn|languages?|packs?|packages?|plugins?|support)\b/gi;

/**
 * A typed request to install a language, or null. Read off the person's own
 * words ahead of any model -- the window offers the install with its own
 * buttons, which no model could: English's words here, and every installed
 * language's own (`langInstallAsks` in its `assistant.json`, group
 * `language`). Asked in another language, it had gone to a model that wrote the steps
 * out with nothing to press (2026-11-05).
 */
export function readLangInstallAsk(text: string): LangInstallStateType | null {
    const trimmed = text.trim();
    if (
        trimmed === '' ||
        trimmed.length > 120 ||
        trimmed.startsWith('/') ||
        /https?:\/\//i.test(trimmed)
    ) {
        return null;
    }
    if (
        QUESTION_START_PATTERN.test(trimmed) ||
        !INSTALL_WORD_PATTERN.test(trimmed) ||
        !LANGUAGE_WORD_PATTERN.test(trimmed) ||
        OTHER_TOPIC_PATTERN.test(trimmed)
    ) {
        return readOwnLangInstallAsk(trimmed);
    }
    const language = trimmed
        .replace(FILLER_PATTERN, ' ')
        .replace(/[?!.,:;"'“”«»()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // "Install a language" names none: how to is the guide's.
    if (language === '' || language.split(' ').length > 4) {
        return null;
    }
    return { step: 'check', language };
}

// The same request in a language's own words: the name its pattern found,
// one to four words of it (a sentence there is a question, not a name).
function readOwnLangInstallAsk(text: string): LangInstallStateType | null {
    for (const language of listAssistantLanguages()) {
        for (const pattern of language.langInstallAskPatterns) {
            const name = pattern.exec(text)?.groups?.language?.trim() ?? '';
            if (name !== '' && name.split(/\s+/).length <= 4) {
                return { step: 'check', language: name };
            }
        }
    }
    return null;
}

function toAction(label: string, state: LangInstallStateType): BotActionType {
    return { label, toolName: LANG_INSTALL_STEP_TOOL_NAME, args: state };
}

function genOfferAnswer(
    state: LangInstallStateType,
    check: ChatLangCheckType & { langCode: string },
): BotAnswerType {
    const isTurnOn = check.state === 'turned-off';
    const next: LangInstallStateType = {
        step: 'install',
        language: state.language,
        langCode: check.langCode,
        label: toChatLangLabel(check),
        ...(isTurnOn ? { isTurnOn: true } : {}),
    };
    return {
        text: genLangOfferText(check),
        actions: [
            toAction(isTurnOn ? LANG_ENABLE_LABEL : LANG_INSTALL_LABEL, next),
            toAction(LANG_SKIP_LABEL, {
                step: 'skip',
                language: state.language,
            }),
        ],
    };
}

function genSomethingWrongText() {
    return tran(
        'Something went wrong on my side. The app may still be starting — ' +
            'try again in a moment. Nothing was installed.',
    );
}

async function runCheck(state: LangInstallStateType): Promise<BotAnswerType> {
    const check = await checkChatLanguage(state.language);
    if (check === null) {
        return { text: genSomethingWrongText() };
    }
    if (checkIsLangOffer(check)) {
        return genOfferAnswer(state, check);
    }
    if (check.state === 'english' || check.state === 'installed') {
        return {
            text: fillWords(
                tran(
                    '**{language} is already installed.** To show the app ' +
                        'in it, press its name in **Settings → Languages**.',
                ),
                { language: toChatLangLabel(check) },
            ),
        };
    }
    return {
        text: fillWords(
            tran(
                'I could not find “{language}” in the list of languages. ' +
                    'Check the name and the internet connection, or look ' +
                    'for it in **Settings → Languages**.',
            ),
            {
                language:
                    check.state === 'unavailable'
                        ? toChatLangLabel(check)
                        : state.language,
            },
        ),
    };
}

async function runInstall(state: LangInstallStateType): Promise<BotAnswerType> {
    const label = state.label ?? state.language;
    if (
        typeof state.langCode === 'string' &&
        (await installChatLanguage(state.langCode))
    ) {
        return { text: genLangReadyText(label) };
    }
    return {
        text: genLangFailedText(label, state.isTurnOn === true),
        actions: [
            toAction(
                state.isTurnOn === true
                    ? LANG_ENABLE_LABEL
                    : LANG_INSTALL_LABEL,
                state,
            ),
            toAction(LANG_SKIP_LABEL, {
                step: 'skip',
                language: state.language,
            }),
        ],
    };
}

/** One step of a language asked for: never throws, never shows a tool's words. */
export async function runLangInstallStep(
    state: LangInstallStateType,
): Promise<BotAnswerType> {
    try {
        switch (state.step) {
            case 'check':
                return await runCheck(state);
            case 'install':
                return await runInstall(state);
            case 'skip':
                return { text: tran('Stopped. Nothing was installed.') };
            default:
                return { text: tran('That step is not one I know.') };
        }
    } catch (error) {
        appError(error, `language install ${state.step}`);
        return { text: genSomethingWrongText() };
    }
}

/** The waiting line for a step that takes long enough to look stuck. */
export function describeLangInstallStep(state: LangInstallStateType) {
    return state.step === 'install'
        ? describeLangInstall(state.label ?? state.language)
        : null;
}

function checkIsYesWord(said: string) {
    return (
        /^(?:yes|yeah|yep|ok|okay|sure|go ahead|do it|install|install it|please)$/.test(
            said,
        ) || checkIsLanguageWord(said, 'yes')
    );
}

function checkIsNoWord(said: string) {
    return (
        /^(?:no|nope|not now|later|stop|cancel|never mind|nevermind|no thanks)$/.test(
            said,
        ) || checkIsLanguageWord(said, 'no')
    );
}

/**
 * A typed "yes" / "no" -- or a button's own words -- under the window's
 * offer of a language is its press.
 */
export function findLangInstallTypedPress(
    actions: BotActionType[] | undefined,
    text: string,
): LangInstallStateType | null {
    const said = text
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, '');
    const own = (actions ?? []).filter((action) => {
        return action.toolName === LANG_INSTALL_STEP_TOOL_NAME;
    });
    if (own.length === 0 || said === '') {
        return null;
    }
    const byLabel = own.find((action) => {
        return (
            action.label.toLowerCase() === said ||
            tranLabel(action.label).toLowerCase() === said
        );
    });
    if (byLabel !== undefined) {
        return byLabel.args as LangInstallStateType;
    }
    const wanted = checkIsYesWord(said)
        ? [LANG_INSTALL_LABEL, LANG_ENABLE_LABEL]
        : checkIsNoWord(said)
          ? [LANG_SKIP_LABEL]
          : [];
    return (
        (own.find((action) => {
            return wanted.includes(action.label);
        })?.args as LangInstallStateType | undefined) ?? null
    );
}
