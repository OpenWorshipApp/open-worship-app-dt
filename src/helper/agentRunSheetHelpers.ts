/**
 * The app side of `owa_app_state`'s `runSheet`: which run sheets (presenting
 * flows) are OPEN in their run player, where each run has got to, and what the
 * next press would put up -- said in words a help answer can repeat.
 *
 * ## Why the tool needed the app for this
 *
 * `selectedDocument` (`agentPresenterHelpers.ts`) says what the user picked
 * from the Documents list; `owa_list_screens` says what is on the wall.
 * Neither knows the RUN SHEET, which is how a service is actually driven: the
 * cursor of an open run lives in the floating preview's own store
 * (`presentingFlowPreviewFloatingHelpers.ts`) and no tool read it. Measured
 * 2026-09-09 (`EC-132`): *What's next in my running order?* cost the
 * assistant six rounds and 22 seconds across the state tool, a manual search,
 * a page and two control listings, and ended on an unverified guess about a
 * green mark. The one question the situational rung most wants answered was
 * answered by inference, which is a missing FIELD, not a prompt rule.
 *
 * ## What it says
 *
 * For every open run player: the sheet's name, its lines in order (number,
 * title, kind, parked or not), `cursor` -- the line the run is on and, inside
 * a document, the slide it is on -- and `next`, worked out the way the
 * player's Space / → keys work it out: a document is walked slide by slide
 * before the run leaves it, the run never wraps, and PARKED is the only reason
 * a line is stepped over. With no run player open it says so and names the
 * sheets the panel lists, because "which one do you mean?" is a better answer
 * than a guess.
 *
 * ## What it leaves out
 *
 * Never a path -- a sheet is its file NAME. A long sheet lists its first
 * lines and says how many more there are; `cursor` and `next` are always
 * answered whatever the count. And it PRESSES nothing: advancing a run puts
 * something on the congregation's screen, and that is offered, never done.
 * The module is imported LAZILY by the relay in `domHelpers.ts`, like the
 * two beside it -- reading a run sheet pulls in the presenting-flow graph,
 * and a help question must not make every window carry that.
 */
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import type PresentingFlowItem from '../presenting-flow/PresentingFlowItem';
import { DragTypeEnum } from './DragInf';
import { getFileName, pathBasename } from '../server/fileHelpers';

export type AgentRunLineType = {
    // The line number as the gutter draws it.
    n: number;
    title: string;
    // What kind of thing the line is, in words: "song", "slide document",
    // "Bible passage", "background", "foreground widget", "audio", "action".
    kind: string;
    isParked?: true;
};

export type AgentRunCursorType = AgentRunLineType & {
    // Inside a document element: the slide the run is on.
    slide?: { n: number; name: string; isLast: boolean };
};

export type AgentRunNextType = AgentRunLineType & {
    // When the next press stays inside the same document: the slide it goes
    // to. Absent when the press moves to the next line.
    slide?: { n: number; name: string };
};

export type AgentRunSheetType = {
    name: string;
    lineCount: number;
    lines: AgentRunLineType[];
    moreCount?: number;
    // Where the run is; null when nothing has been pressed in this player yet
    // (then `next` is the first line that is not parked).
    cursor: AgentRunCursorType | null;
    // What the next press would put up; null at the end of the sheet.
    next: AgentRunNextType | null;
    isAtEnd?: true;
};

export type AgentRunSheetStateType = {
    // Every run player that is open, in the order they were opened.
    openSheets: AgentRunSheetType[];
    // With no player open: the sheets the Presenting Flows panel lists, by
    // name, so the answer can say which one to open.
    availableSheets?: string[];
    note?: string;
};

// How many lines are listed with their titles. A service is a dozen lines; a
// hand-imported archive can be a hundred.
export const RUN_LINE_LIST_LIMIT = 30;

function toSheetName(filePath: string) {
    return getFileName(pathBasename(filePath)) || pathBasename(filePath);
}

/**
 * The kind of a line in the words the answer uses. A slide of a song is a
 * "song slide" and a whole song is a "song", because "the next line is a
 * song" and "the next line is the chorus" are different answers to give.
 */
export function toRunLineKind(item: {
    type: string;
    isAction: boolean;
    isError: boolean;
    isBibleItem: boolean;
    isBackground: boolean;
    isForeground: boolean;
    isAudio: boolean;
    isAppDocument: boolean;
    itemFilePath?: string | null;
}) {
    if (item.isError) {
        return 'damaged line';
    }
    if (item.isAction) {
        return 'action';
    }
    if (item.isBibleItem) {
        return 'Bible passage';
    }
    if (item.isAudio) {
        return 'audio';
    }
    if (item.isBackground) {
        return 'background';
    }
    if (item.isForeground) {
        return 'foreground widget';
    }
    const isLyric = /\.owl$/i.test(item.itemFilePath ?? '');
    if (item.isAppDocument) {
        return isLyric ? 'song' : 'document';
    }
    if (item.type === DragTypeEnum.LYRIC_SLIDE || isLyric) {
        return 'song slide';
    }
    if (item.type === DragTypeEnum.PDF_SLIDE) {
        return 'PDF page';
    }
    if (item.type === DragTypeEnum.PPTX_SLIDE) {
        return 'PowerPoint slide';
    }
    return 'slide';
}

function toRunLine(index: number, item: PresentingFlowItem): AgentRunLineType {
    const line: AgentRunLineType = {
        n: index + 1,
        title: String(item.title ?? '')
            .replace(/\s+/g, ' ')
            .trim(),
        kind: toRunLineKind(item),
    };
    if (item.isDisabled) {
        line.isParked = true;
    }
    return line;
}

/**
 * The next line after `fromIndex` that is not parked, or -1 at the end.
 * The player's own rule (`findNextPresentingFlowPreviewIndex`), written out
 * over plain flags so it can be tested without a sheet; a test holds the two
 * to the same answers.
 */
export function findNextRunIndex(
    flags: { isParked: boolean }[],
    fromIndex: number,
) {
    for (let i = fromIndex + 1; i < flags.length; i++) {
        if (!flags[i].isParked) {
            return i;
        }
    }
    return -1;
}

/**
 * What the next press does, over summaries so it can be tested with no
 * document behind it. `slideIndex` is where the run is inside the cursor's
 * document (-1 when the cursor is on the line itself), `slides` that
 * document's slides with the ones the sheet has parked marked.
 */
export function pickRunNext(
    lines: AgentRunLineType[],
    cursorIndex: number,
    slides: { n: number; name: string; isParked: boolean }[] | null,
    slideIndex: number,
): { next: AgentRunNextType | null; isAtEnd: boolean } {
    const flags = lines.map((line) => {
        return { isParked: line.isParked === true };
    });
    if (cursorIndex !== -1 && slides !== null) {
        const nextSlide = findNextRunIndex(slides, slideIndex);
        if (nextSlide !== -1) {
            const { n, name } = slides[nextSlide];
            return {
                next: { ...lines[cursorIndex], slide: { n, name } },
                isAtEnd: false,
            };
        }
    }
    const nextIndex = findNextRunIndex(flags, cursorIndex);
    if (nextIndex === -1) {
        return { next: null, isAtEnd: cursorIndex !== -1 };
    }
    return { next: { ...lines[nextIndex] }, isAtEnd: false };
}

async function readDocumentSlides(
    item: PresentingFlowItem,
): Promise<
    { n: number; name: string; id: number; isParked: boolean }[] | null
> {
    if (!item.isAppDocument || !item.itemFilePath) {
        return null;
    }
    const { loadVaryAppDocumentSlides } =
        await import('../presenting-flow/presentingFlowDocumentHelpers');
    const varySlides = await loadVaryAppDocumentSlides(item.itemFilePath);
    if (varySlides === null) {
        return null;
    }
    return varySlides.map((varySlide: VarySlideType, index) => {
        return {
            n: index + 1,
            name: String(varySlide.name ?? '')
                .replace(/\s+/g, ' ')
                .trim(),
            id: varySlide.id,
            isParked: item.checkIsVarySlideDisabled(varySlide),
        };
    });
}

export async function describeRunSheetForAgent(
    filePath: string,
): Promise<AgentRunSheetType | null> {
    const [{ default: PresentingFlow }, playerHelpers] = await Promise.all([
        import('../presenting-flow/PresentingFlow'),
        import('../presenting-flow/presentingFlowPreviewFloatingHelpers'),
    ]);
    const presentingFlow = PresentingFlow.getInstance(filePath);
    const items = await presentingFlow.getItems();
    if (items === null) {
        return null;
    }
    const lines = items.map((item, index) => toRunLine(index, item));
    const cursorIndex = playerHelpers.resolvePresentingFlowPreviewSelectedIndex(
        filePath,
        items,
    );
    let cursor: AgentRunCursorType | null = null;
    let slides: Awaited<ReturnType<typeof readDocumentSlides>> = null;
    let slideIndex = -1;
    if (cursorIndex !== -1) {
        const item = items[cursorIndex];
        cursor = { ...lines[cursorIndex] };
        slides = await readDocumentSlides(item);
        if (slides !== null) {
            const childId =
                playerHelpers.getPresentingFlowPreviewSelectedChildId(
                    filePath,
                    playerHelpers.toPresentingFlowPreviewItemKey(item),
                    cursorIndex,
                );
            slideIndex =
                childId === null
                    ? -1
                    : slides.findIndex((slide) => slide.id === childId);
            if (slideIndex !== -1) {
                const { n, name } = slides[slideIndex];
                cursor.slide = {
                    n,
                    name,
                    isLast: findNextRunIndex(slides, slideIndex) === -1,
                };
            }
        }
    }
    const { next, isAtEnd } = pickRunNext(
        lines,
        cursorIndex,
        slides,
        slideIndex,
    );
    const listed = lines.slice(0, RUN_LINE_LIST_LIMIT);
    const sheet: AgentRunSheetType = {
        name: toSheetName(filePath),
        lineCount: lines.length,
        lines: listed,
        cursor,
        next,
    };
    if (lines.length > listed.length) {
        sheet.moreCount = lines.length - listed.length;
    }
    if (isAtEnd) {
        sheet.isAtEnd = true;
    }
    return sheet;
}

async function listAvailableSheetNames(): Promise<string[]> {
    try {
        const [{ dirSourceSettingNames }, { default: DirSource }] =
            await Promise.all([import('./constants'), import('./DirSource')]);
        const dirSource = await DirSource.getInstance(
            dirSourceSettingNames.PRESENTING_FLOW,
        );
        const filePaths = await dirSource.getFilePaths('presentingFlow');
        return (filePaths ?? []).map(toSheetName);
    } catch {
        // No directory set up yet, or one that cannot be read: an empty list
        // is the honest answer and the note says what to open.
        return [];
    }
}

export async function describeRunSheetsForAgent(): Promise<AgentRunSheetStateType> {
    const { getPresentingFlowPreviewFilePaths } =
        await import('../presenting-flow/presentingFlowPreviewFloatingHelpers');
    const openFilePaths = getPresentingFlowPreviewFilePaths();
    const openSheets: AgentRunSheetType[] = [];
    for (const filePath of openFilePaths) {
        try {
            const sheet = await describeRunSheetForAgent(filePath);
            if (sheet !== null) {
                openSheets.push(sheet);
            }
        } catch {
            // A sheet that cannot be read is left out; the others still answer.
        }
    }
    if (openSheets.length > 0) {
        return { openSheets };
    }
    const availableSheets = await listAvailableSheetNames();
    return {
        openSheets,
        availableSheets,
        note:
            availableSheets.length === 0
                ? 'No run sheet (presenting flow) is open, and the Presenting ' +
                  'Flows panel lists none.'
                : 'No run sheet (presenting flow) is open in its run player, ' +
                  'so there is no "next" yet. The Presenting Flows panel ' +
                  'lists the sheets named here; the Preview Presenting Flow ' +
                  'button on one opens its run player.',
    };
}
