/**
 * What the window does with a song-from-a-document ask (EC-590,
 * `deckSongAskHelpers.ts` holds the rules): it reads the Documents list
 * once, and either drafts the ONE file the ask named, or offers the slide
 * documents, decks, Word files and PDFs there as buttons -- each of which
 * drafts its file (`draftDeckSongs`). Every draft is the song files' own,
 * with no model: the file read for its words the way the app reads that
 * kind (`readDocumentWords`), then `answerLyricSources`. Nothing is written
 * until **Create** is pressed.
 *
 * Loaded with the help window: the readers it calls are already there.
 */
import { appError } from '../helper/loggerHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    type DeckSongAskType,
    genDeckSongListAnswer,
    pickDeckFiles,
    toDeckFilePath,
} from './deckSongAskHelpers';
import { readDocumentWords } from './documentWordsHelpers';
import { answerLyricSources, type BotAnswerType } from './helpBotHelpers';
import { MAX_SONGS_PER_ASK } from './lyricDraftHelpers';
import { callTool, parseToolJson } from './mcpClient';
import type { ProgressReporterType } from './progressHelpers';
import { MEDIA_FILE_TOOL_NAME } from './webBackgroundAskHelpers';

export type DeckSongFileType = {
    filePath: string;
    name: string;
    /** Its words, when the window read them already (an attached deck). */
    text?: string;
};

export type DeckSongPlanType =
    | { kind: 'answer'; answer: BotAnswerType }
    | { kind: 'draft'; files: DeckSongFileType[] };

/**
 * The Documents folder and the names in it, or null when it could not be
 * read (no folder chosen, no tool host): the ask then goes on as before.
 */
export async function readDocumentList(): Promise<{
    folder: string;
    names: string[];
} | null> {
    try {
        const listed = parseToolJson(
            await callTool(MEDIA_FILE_TOOL_NAME, {
                action: 'list',
                kind: 'document',
            }),
        );
        if (
            typeof listed?.folder !== 'string' ||
            listed.folder === '' ||
            !Array.isArray(listed?.names)
        ) {
            return null;
        }
        return {
            folder: listed.folder,
            names: listed.names.filter((name: unknown) => {
                return typeof name === 'string' && name !== '';
            }),
        };
    } catch (error) {
        appError(error, 'song from a document file');
        return null;
    }
}

/**
 * What the window answers a song-from-a-document ask with: the one file the
 * ask NAMED, to draft at once, or the documents of the Documents list as
 * buttons (none: the way to attach one). Null when the list could not be
 * read.
 */
export async function planDeckSongAsk(
    ask: DeckSongAskType,
): Promise<DeckSongPlanType | null> {
    const listed = await readDocumentList();
    if (listed === null) {
        return null;
    }
    const { files, isNamed } = pickDeckFiles(
        listed.names,
        ask.nameWords,
        ask.kinds,
    );
    if (isNamed && files.length === 1) {
        return {
            kind: 'draft',
            files: [
                {
                    filePath: toDeckFilePath(listed.folder, files[0]),
                    name: files[0],
                },
            ],
        };
    }
    return {
        kind: 'answer',
        answer: genDeckSongListAnswer(listed.folder, files),
    };
}

/**
 * The songs of these files, drafted with no model -- each read for its
 * words the way the app reads that kind (`readDocumentWords`: a deck or a
 * Word file through the app's converter, a PDF's text layer, a slide
 * document's text boxes) unless they came with it, then written out the way
 * attached song files are. A file that cannot be read, or holds no words,
 * is said in its own sentence.
 */
export async function draftDeckSongs(
    files: readonly DeckSongFileType[],
    reportStep: ProgressReporterType | null = null,
): Promise<BotAnswerType> {
    const sources: { name: string; text: string }[] = [];
    const failures: string[] = [];
    for (const file of files.slice(0, MAX_SONGS_PER_ASK)) {
        const text = file.text ?? (await readDocumentWords(file.filePath));
        if (text === null) {
            failures.push(
                fillWords(tran('I could not find a song in "{name}".'), {
                    name: file.name,
                }),
            );
            continue;
        }
        sources.push({ name: file.name, text });
    }
    if (sources.length === 0) {
        return { text: failures.join('\n\n') };
    }
    const answer = await answerLyricSources(
        sources.map((source) => {
            return { kind: 'text' as const, ...source };
        }),
        0,
        reportStep,
    );
    return failures.length === 0
        ? answer
        : { ...answer, text: [answer.text, ...failures].join('\n\n') };
}
