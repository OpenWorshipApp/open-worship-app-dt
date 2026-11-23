/**
 * What the window does with a PowerPoint-to-slide-document ask (2026-11-20,
 * `EC-763`; `pptxSlideAskHelpers.ts` holds the rules): it reads the
 * Documents list once, and either converts the ONE PowerPoint the ask
 * named, or offers the PowerPoints there as buttons -- each of which
 * converts its file. The conversion is `owa_media_file` `convert`, with no
 * model: the app's own converter, each shape a box, and slides drawn both
 * ways to say how alike they look. The PowerPoint is never changed; the new
 * document takes a free name, and its Undo moves it to the trash.
 */
import { appError } from '../helper/loggerHelpers';
import { readDocumentList } from './deckSongAnswerHelpers';
import { toDeckFilePath } from './deckSongAskHelpers';
import type { CreatedDocumentType } from './documentCreateHelpers';
import { callTool, parseToolJson } from './mcpClient';
import {
    genPptxSlidesFailedText,
    genPptxSlidesListAnswer,
    genPptxSlidesMadeText,
    genPptxSlidesProgressText,
    pickPptxFiles,
    type PptxSlidesActionType,
    type PptxSlidesAskType,
    readPptxSlidesResult,
} from './pptxSlideAskHelpers';
import type { ProgressReporterType } from './progressHelpers';
import { MEDIA_FILE_TOOL_NAME } from './webBackgroundAskHelpers';

export type PptxSlidesFileType = { filePath: string; name: string };

export type PptxSlidesPlanType =
    | {
          kind: 'answer';
          answer: { text: string; actions: PptxSlidesActionType[] };
      }
    | { kind: 'convert'; file: PptxSlidesFileType };

/**
 * The one PowerPoint the ask NAMED, to convert at once, or the PowerPoints
 * of the Documents list as buttons (none: how to put one there). Null when
 * the list could not be read: the ask then goes on as before.
 */
export async function planPptxSlidesAsk(
    ask: PptxSlidesAskType,
): Promise<PptxSlidesPlanType | null> {
    const listed = await readDocumentList();
    if (listed === null) {
        return null;
    }
    const { files, isNamed } = pickPptxFiles(listed.names, ask.nameWords);
    if (isNamed && files.length === 1) {
        return {
            kind: 'convert',
            file: {
                filePath: toDeckFilePath(listed.folder, files[0]),
                name: files[0],
            },
        };
    }
    return {
        kind: 'answer',
        answer: genPptxSlidesListAnswer(listed.folder, files),
    };
}

/**
 * One PowerPoint of the Documents list made into a slide document: the
 * sentence the window answers with, and the document made (for its Undo
 * and its card), or null when nothing was made.
 */
export async function convertPptxSlides(
    file: PptxSlidesFileType,
    reportStep: ProgressReporterType | null = null,
): Promise<{ text: string; created: CreatedDocumentType | null }> {
    const finishStep = reportStep?.(genPptxSlidesProgressText(file.name));
    try {
        const result = readPptxSlidesResult(
            parseToolJson(
                await callTool(MEDIA_FILE_TOOL_NAME, {
                    action: 'convert',
                    kind: 'document',
                    name: file.name,
                }),
            ),
        );
        if (result === null) {
            return { text: genPptxSlidesFailedText(file.name), created: null };
        }
        return {
            text: genPptxSlidesMadeText(result),
            created: {
                kind: 'slide',
                name: result.created,
                filePath: result.filePath,
                undoId:
                    typeof result.undoId === 'string' && result.undoId !== ''
                        ? result.undoId
                        : null,
            },
        };
    } catch (error) {
        appError(error, 'slide document from a PowerPoint');
        return { text: genPptxSlidesFailedText(file.name), created: null };
    } finally {
        finishStep?.();
    }
}
