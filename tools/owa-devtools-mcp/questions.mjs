// The questions this assistant is willing to be asked, read off disk.
//
// `questions/*.json` is one file per PAGE of the app (presenter, reader,
// editor, settings, plus `common` for what is true everywhere), each split
// into SECTIONS that match the panel a volunteer is looking at. Every entry
// carries the resources that answer it -- the manual recipe id, the control to
// ring, the keystroke, the tools that can see the live answer -- so a question
// picked from this list is answered in one lookup instead of a search round.
//
// Two consumers, one file set and one ranking (`questionMatch.mjs`):
//
//   - the chatbot's ask box, which suggests as the user types. It bundles the
//     same JSON and ranks in the window, because a tool call per keystroke is
//     exactly the thing this app cannot afford;
//   - `owa_list_questions`, so the model (and an outside agent) can offer the
//     nearest supported question instead of inventing one the app cannot do.
//
// Nothing is cached here between calls. The whole corpus is well under 100 KB
// and is read from disk per call; the window-lifetime copy lives in the
// chatbot, which is where its lifetime can be reasoned about.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    matchQuestions as matchQuestionsIn,
    outlineQuestions as outlineQuestionsIn,
    flattenQuestions,
} from './questionMatch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = path.join(HERE, 'questions');

/**
 * The page ids on disk, from the file names alone -- no JSON parsed.
 *
 * `owa_list_questions` needs them to build its `page` enum, once per MCP
 * session, and parsing the whole corpus to answer "what pages are there" is
 * exactly the eager work this app cannot afford. The file name IS the page id
 * (`questions.test.mjs` holds that invariant), so the listing is enough.
 */
export function listQuestionPageIds() {
    if (!existsSync(QUESTIONS_DIR)) {
        return [];
    }
    return readdirSync(QUESTIONS_DIR)
        .sort()
        .filter((name) => {
            // `schema.json` documents the shape; it is not a page of questions.
            return name.endsWith('.json') && name !== 'schema.json';
        })
        .map((name) => {
            return name.slice(0, -'.json'.length);
        });
}

/** Every page file, in a stable order. Returns `[]` when the dir is missing. */
export function loadQuestionPages() {
    if (!existsSync(QUESTIONS_DIR)) {
        return [];
    }
    const pages = [];
    for (const name of readdirSync(QUESTIONS_DIR).sort()) {
        // `schema.json` documents the shape; it is not a page of questions.
        if (!name.endsWith('.json') || name === 'schema.json') {
            continue;
        }
        try {
            const page = JSON.parse(
                readFileSync(path.join(QUESTIONS_DIR, name), 'utf8'),
            );
            if (Array.isArray(page?.sections)) {
                pages.push(page);
            }
        } catch (_error) {
            // One malformed file must not take the whole ask box down with it.
            continue;
        }
    }
    return pages;
}

/** `questionMatch.matchQuestions`, over the corpus on disk. */
export function matchQuestions(query = '', options = {}) {
    return matchQuestionsIn(query, {
        ...options,
        pages: options.pages ?? loadQuestionPages(),
    });
}

/** `questionMatch.outlineQuestions`, over the corpus on disk. */
export function outlineQuestions(options = {}) {
    return outlineQuestionsIn({
        ...options,
        pages: options.pages ?? loadQuestionPages(),
    });
}

export { flattenQuestions };
