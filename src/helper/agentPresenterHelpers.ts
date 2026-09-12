/**
 * The app side of `owa_app_state`'s `selectedDocument`: what the user is in
 * the MIDDLE of on the Presenter page, said in words a help answer can repeat
 * and with the exact words an agent can press.
 *
 * ## Why the tool needed the app for this
 *
 * `owa_list_screens` says what is ON the projector; nothing said what the
 * user had picked to put there next. Measured 2026-09-09 on Claude Sonnet 5
 * with "Amazing Grace" highlighted in the Documents list and the projector
 * still holding a Khmer hymn: asked *which song is selected right now?* the
 * assistant answered with the hymn -- the only document any tool had ever
 * named -- and asked to *show the next slide* it spent ten rounds and 54
 * seconds hunting the slide cards through `owa_list_ui` (which never listed
 * them: a card had no accessible name), pressed a slide's index badge because
 * that happened to bubble to the card, changed the congregation's screen, and
 * then reported that it could not find an answer. "Answered only by
 * inference" is a missing FIELD, not a prompt rule.
 *
 * So this answers the selected document by name and kind, its slides in the
 * order the previewer shows them -- each with its number, its name, its first
 * words, the screens it is on, and `find`, the card's accessible name, which
 * `owa_click` presses to PRESENT that slide -- and `onScreen` / `next` /
 * `previous` worked out the way the arrow keys work them out, so "show the
 * next slide" is one press by exact words and one check.
 *
 * It reaches the tool the way `owa_list_screens` does: a dependency-free
 * page expression fires a DOM event, `domHelpers.ts` relays it here, and the
 * answer goes back on a second event. The import in `domHelpers.ts` is LAZY
 * on purpose -- the selected document pulls in the whole document graph and
 * the screen managers, and a help question must not make every window carry
 * that.
 *
 * ## What it leaves out
 *
 * Never a path -- the document's NAME is what a volunteer would say -- and
 * never a slide's whole content: a slide's words are cut to a line, enough to
 * recognise the verse. A long document (a 200-page PDF) lists its first
 * slides and says how many more there are; `onScreen`, `next` and `previous`
 * are always answered whatever the count, because they are what a press
 * needs.
 */
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type { VarySlideScreenDataType } from '../_screen/screenAppDocumentTypeHelpers';
import {
    checkIsLyricFilePath,
    getSelectedVaryAppDocument,
} from '../app-document-list/appDocumentHelpers';
import type {
    VaryAppDocumentType,
    VarySlideType,
} from '../app-document-list/appDocumentTypeHelpers';
import DocxAppDocument from '../app-document-list/DocxAppDocument';
import PdfAppDocument from '../app-document-list/PdfAppDocument';
import PptxAppDocument from '../app-document-list/PptxAppDocument';
import PptxSlide from '../app-document-list/PptxSlide';
import { toSlideAccessibleName } from '../app-document-presenter/items/slideAccessibleNameHelpers';
import appProvider from '../server/appProvider';
import { getFileName, pathBasename } from '../server/fileHelpers';
import {
    type AgentRunSheetStateType,
    describeRunSheetsForAgent,
} from './agentRunSheetHelpers';
import { toSlideText } from './agentScreenHelpers';

export type AgentSlideSummaryType = {
    // The number on the card, as the user counts it (a PPTX sub-slide reads
    // 2.01, exactly as its badge does).
    n: number;
    name: string;
    // The card's accessible name: the exact words `owa_click` presses it by.
    find: string;
    // The first words on it; null for a slide the app cannot read words off
    // (a PDF page, a picture).
    text: string | null;
    isDisabled?: true;
    onScreens?: number[];
};

export type AgentSelectedDocumentType = {
    name: string;
    kind: string;
    slideCount: number;
    slides: AgentSlideSummaryType[];
    // Slides past the listing cap, not in `slides`.
    moreCount?: number;
    // The slide of THIS document that is on a screen (the first, by screen
    // id, when two screens hold different ones), and the ones the arrow keys
    // would go to from it -- or, with none of it on any screen, `next` is the
    // first slide and `previous` is nothing.
    onScreen: AgentSlideSummaryType | null;
    next: AgentSlideSummaryType | null;
    previous: AgentSlideSummaryType | null;
};

export type AgentPresenterStateType = {
    isAuthoritative: boolean;
    selectedDocument: AgentSelectedDocumentType | null;
    // The run sheets open in their run player, where each has got to and
    // what comes next -- see `agentRunSheetHelpers.ts`.
    runSheet: AgentRunSheetStateType | null;
};

// How many slides are listed with their names. A song is a dozen sections; a
// scanned hymnal is two hundred pages nobody will press by name.
export const SLIDE_LIST_LIMIT = 24;
// How much of a slide's words ride along: enough to tell verse 2 from the
// chorus, not the verse.
const SLIDE_WORDS_LIMIT = 60;

function toDocumentName(filePath: string) {
    return getFileName(pathBasename(filePath)) || pathBasename(filePath);
}

export function toDocumentKind(varyAppDocument: VaryAppDocumentType) {
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        return 'PDF';
    }
    if (PptxAppDocument.checkIsThisType(varyAppDocument)) {
        return 'PowerPoint';
    }
    if (DocxAppDocument.checkIsThisType(varyAppDocument)) {
        return 'Word document';
    }
    if (checkIsLyricFilePath(varyAppDocument.filePath)) {
        return 'song';
    }
    return 'slide document';
}

function cutWords(text: string | null) {
    if (text === null) {
        return null;
    }
    if (text.length <= SLIDE_WORDS_LIMIT) {
        return text;
    }
    return `${text.slice(0, SLIDE_WORDS_LIMIT).trimEnd()}…`;
}

/**
 * The cards in the order and with the numbers the previewer draws them: a
 * PPTX slide's sub-slides follow it, numbered the way its own renderer
 * numbers them, so `n` and `find` here are the badge and the accessible name
 * on the card the user is looking at.
 */
export function flattenVarySlides(varySlides: VarySlideType[]) {
    const flat: { viewIndex: number; varySlide: VarySlideType }[] = [];
    varySlides.forEach((varySlide, i) => {
        flat.push({ viewIndex: i + 1, varySlide });
        if (PptxSlide.checkIsThisType(varySlide)) {
            varySlide.subSlides.forEach((subSlide, j) => {
                flat.push({
                    viewIndex: PptxSlide.calcIndex(i, j) + 1,
                    varySlide: subSlide,
                });
            });
        }
    });
    return flat;
}

/**
 * The arrow keys' own rule (`findNextSlide` in `varyAppDocumentHelpers`):
 * wrap round at either end, and step over a disabled slide. Written out here
 * rather than imported because that helper is a module of the presenter's
 * event plumbing and this one is read from a relay; the rule is a few lines
 * and the test holds the two to the same answers.
 */
export function findNeighbourIndex(
    flags: { isDisabled: boolean }[],
    fromIndex: number,
    isNext: boolean,
): number | null {
    const count = flags.length;
    if (count === 0 || fromIndex < 0 || fromIndex >= count) {
        return null;
    }
    const enabledCount = flags.filter((flag) => !flag.isDisabled).length;
    if (enabledCount === 0) {
        return null;
    }
    if (enabledCount === 1 && !flags[fromIndex].isDisabled) {
        return null;
    }
    let index = fromIndex;
    for (let step = 0; step < count; step++) {
        index = (index + (isNext ? 1 : -1) + count) % count;
        if (!flags[index].isDisabled) {
            return index === fromIndex ? null : index;
        }
    }
    return null;
}

function readOnScreenMap(): Map<string, number[]> {
    // Every screen the presenter knows about, showing or not -- a hidden
    // screen still holds its slide, and "next" is next after THAT.
    const map = new Map<string, number[]>();
    for (const screenManager of getAllScreenManagers()) {
        if (screenManager.isDeleted) {
            continue;
        }
        const data: VarySlideScreenDataType | null =
            screenManager.screenVaryAppDocumentManager.varySlideData;
        if (data === null || typeof data !== 'object') {
            continue;
        }
        const id = (data.itemJson as any)?.id;
        if (id === undefined || id === null) {
            continue;
        }
        const key = `${data.filePath}#${id}`;
        map.set(key, [...(map.get(key) ?? []), screenManager.screenId]);
    }
    return map;
}

function toSlideSummary(
    viewIndex: number,
    varySlide: VarySlideType,
    onScreens: number[] | undefined,
): AgentSlideSummaryType {
    let text: string | null = null;
    try {
        text = cutWords(toSlideText(varySlide.toJson() as any));
    } catch {
        // A slide whose JSON will not render is still a slide with a number.
    }
    const summary: AgentSlideSummaryType = {
        n: viewIndex,
        name: (varySlide.name ?? '').replace(/\s+/g, ' ').trim(),
        find: toSlideAccessibleName(viewIndex, varySlide.name),
        text,
    };
    if (varySlide.isDisabled) {
        summary.isDisabled = true;
    }
    if (onScreens !== undefined && onScreens.length > 0) {
        summary.onScreens = [...onScreens].sort((one, other) => one - other);
    }
    return summary;
}

/**
 * The slide of this document that is up, the one the arrow keys would go to
 * from it, and the one before -- worked out over the summaries so the pure
 * part can be tested with no document and no screen behind it.
 */
export function pickOnScreenAndNeighbours(summaries: AgentSlideSummaryType[]) {
    let onScreenIndex = -1;
    let lowestScreenId = Number.POSITIVE_INFINITY;
    summaries.forEach((summary, index) => {
        const first = summary.onScreens?.[0];
        if (first !== undefined && first < lowestScreenId) {
            lowestScreenId = first;
            onScreenIndex = index;
        }
    });
    const flags = summaries.map((summary) => {
        return { isDisabled: summary.isDisabled === true };
    });
    if (onScreenIndex === -1) {
        return {
            onScreen: null,
            next:
                summaries.find((summary) => summary.isDisabled !== true) ??
                null,
            previous: null,
        };
    }
    const nextIndex = findNeighbourIndex(flags, onScreenIndex, true);
    const previousIndex = findNeighbourIndex(flags, onScreenIndex, false);
    return {
        onScreen: summaries[onScreenIndex],
        next: nextIndex === null ? null : summaries[nextIndex],
        previous: previousIndex === null ? null : summaries[previousIndex],
    };
}

export async function describeSelectedDocumentForAgent(
    varyAppDocument: VaryAppDocumentType,
): Promise<AgentSelectedDocumentType> {
    const varySlides = await varyAppDocument.getSlides();
    const flat = flattenVarySlides(varySlides);
    const onScreenMap = readOnScreenMap();
    const summaries = flat.map(({ viewIndex, varySlide }) => {
        return toSlideSummary(
            viewIndex,
            varySlide,
            onScreenMap.get(`${varySlide.filePath}#${varySlide.id}`),
        );
    });
    const listed = summaries.slice(0, SLIDE_LIST_LIMIT);
    const result: AgentSelectedDocumentType = {
        name: toDocumentName(varyAppDocument.filePath),
        kind: toDocumentKind(varyAppDocument),
        slideCount: summaries.length,
        slides: listed,
        ...pickOnScreenAndNeighbours(summaries),
    };
    if (summaries.length > listed.length) {
        result.moreCount = summaries.length - listed.length;
    }
    return result;
}

/**
 * The document AS THE PREVIEWER SHOWS IT. A song is the one case where the
 * selected instance is not the one drawn: the base `LyricAppDocument` lists
 * the song's structure with empty canvases, and the previewer draws the
 * stage-0 subclass, which renders the words and appends the attachment
 * slides -- five cards where the base answers four, none with a word on it.
 * Read the same one the cards come from. A dynamic import, as
 * `lyricSlideScreenHelpers` does it, because `lyricHelpers` closes the
 * lyric import cycle and this module is itself loaded lazily.
 */
async function toPreviewedDocument(varyAppDocument: VaryAppDocumentType) {
    if (!checkIsLyricFilePath(varyAppDocument.filePath)) {
        return varyAppDocument;
    }
    const { getLyricAppDocumentStageByStage } =
        await import('../lyric-list/lyricHelpers');
    const [, stageDocument] = getLyricAppDocumentStageByStage(
        varyAppDocument.filePath,
        0,
    );
    return stageDocument;
}

export async function describePresenterForAgent(): Promise<AgentPresenterStateType> {
    const isAuthoritative = appProvider.isPagePresenter;
    if (!isAuthoritative) {
        return { isAuthoritative, selectedDocument: null, runSheet: null };
    }
    // The run sheet is read whatever the selection: a service driven from
    // the run sheet may have nothing selected in the Documents list at all.
    const runSheetPromise = describeRunSheetsForAgent().catch(() => null);
    const varyAppDocument = await getSelectedVaryAppDocument();
    const selectedDocument =
        varyAppDocument === null || varyAppDocument === undefined
            ? null
            : await describeSelectedDocumentForAgent(
                  await toPreviewedDocument(varyAppDocument),
              );
    return {
        isAuthoritative,
        selectedDocument,
        runSheet: await runSheetPromise,
    };
}
