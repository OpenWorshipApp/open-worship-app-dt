/**
 * The app side of `owa_list_screens`: what is ON each presentation screen,
 * said in words a help answer can repeat.
 *
 * ## Why the tool needed the app for this
 *
 * The tool used to answer `isAnyShowing` and the display list, both read over
 * IPC from the main process, and nothing about the content -- and a model
 * handed "showing: true" for a screen with a verse on it and nothing else
 * INFERS the rest. Measured 2026-09-09 on the standing corpus, with the
 * projector showing a Khmer verse: asked *the words no come out big screen*
 * the assistant took nine rounds and 36 seconds to conclude, confidently,
 * that "nothing has actually been sent to it yet: turning the screen on just
 * gives you a blank canvas" -- to a volunteer standing in front of a
 * congregation reading that verse. The content lives in the presenter's
 * `ScreenManager` instances, which a page expression cannot reach and the MCP
 * package cannot import (the same files are spawned standalone over stdio,
 * where there is no app), so it comes the way `owa_lyric_file` does: a
 * dependency-free expression fires a DOM event, `domHelpers.ts` relays it here,
 * and the answer goes back on a second event. The import in `domHelpers.ts` is
 * LAZY on purpose -- the screen managers pull in the whole presenting graph,
 * and nothing about a help question justifies loading that in every window.
 *
 * ## What it says, and what it leaves out
 *
 * One object per screen the presenter knows about -- SHOWING OR NOT, because a
 * hidden screen still holds its layers, and "the screen is off but it already
 * has verse 2 on it, the show button is all that is missing" is the most
 * useful sentence the panic question can be answered with. Per screen: the
 * background (its kind and the file's name), the slide (the document, the
 * slide's own name, and the first words of its text), the Bible passage (the
 * reference and the version), and the foreground widgets by name. Never a
 * path -- a volunteer is never shown one, and the file's NAME is what they
 * would say -- and never the canvas JSON, which is the whole slide at ~5 000
 * characters and would ride every later round of the question.
 *
 * `isAuthoritative` is false outside the presenter: the managers there are
 * built with empty layers (their constructors load the on-screen setting only
 * on the presenter page), so an answer read from the Bible Reader would say
 * "blank" about a screen that is not.
 */
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type ScreenManager from '../_screen/managers/ScreenManager';
import type {
    BackgroundSrcType,
    BibleItemDataType,
    ForegroundDataType,
} from '../_screen/screenTypeHelpers';
import type { VarySlideScreenDataType } from '../_screen/screenAppDocumentTypeHelpers';
import appProvider from '../server/appProvider';
import { getFileName, pathBasename } from '../server/fileHelpers';

export type AgentScreenBackgroundSummaryType = {
    kind: string;
    name: string | null;
};

export type AgentScreenSlideSummaryType = {
    document: string;
    kind: string;
    name: string;
    text: string | null;
};

export type AgentScreenBibleSummaryType = {
    reference: string;
    version: string;
    // Every version rendered side by side, when there is more than one.
    versions?: string[];
};

export type AgentScreenSummaryType = {
    screenId: number;
    isShowing: boolean;
    isLocked: boolean;
    isSelected: boolean;
    displayId: number | null;
    stage: number;
    background: AgentScreenBackgroundSummaryType | null;
    slide: AgentScreenSlideSummaryType | null;
    bible: AgentScreenBibleSummaryType | null;
    foreground: string[];
    isBlank: boolean;
};

export type AgentScreensResultType = {
    isAuthoritative: boolean;
    screens: AgentScreenSummaryType[];
};

// How much of a slide's words to hand over: enough to recognise the verse
// ("that is the second verse, not the chorus"), not enough to be the verse.
const SLIDE_TEXT_LIMIT = 160;

const SLIDE_KIND_MAP: Record<string, string> = {
    slide: 'slide',
    'lyric-slide': 'song',
    'pdf-slide': 'PDF page',
    'pptx-slide': 'PowerPoint slide',
    'docx-slide': 'Word document page',
};

function toDocumentName(filePath: string) {
    return getFileName(pathBasename(filePath)) || pathBasename(filePath);
}

function toPlainText(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

// Block boundaries become spaces before the markup is read, so two lines of
// a slide do not run into one word; inline boundaries do not, so a chord
// removed from the middle of a word leaves the word whole.
const BLOCK_TAG_PATTERN = /<(div|p|br|li|h[1-6]|section|tr|td|th)\b/gi;

/**
 * The words in a slide's markup, as sung. A song slide from open-lyric
 * renders its chords INTO the words -- `ចូរមានស|[G]ង្ឃឹម`, the chord landing
 * mid-word as chords do -- which is right on a projector and noise in a
 * sentence about what is on it. The chord boxes (every one is marked
 * aria-hidden, and carries the segment-chord class) come out of the tree
 * BEFORE the text is read, so the word closes up again exactly as the page's
 * own text nodes have it, with no guessing about which spaces were real.
 */
export function toSungText(html: string) {
    if (typeof DOMParser === 'undefined') {
        return toPlainText(html.replace(/<[^>]+>/g, ' '));
    }
    const doc = new DOMParser().parseFromString(
        html.replace(BLOCK_TAG_PATTERN, ' <$1'),
        'text/html',
    );
    const chordBoxes = doc.querySelectorAll(
        '[aria-hidden="true"], .ol-preview-lyric-segment__chord, ' +
            '.ol-preview-chord, .ol-preview-bar',
    );
    for (const element of Array.from(chordBoxes)) {
        element.remove();
    }
    return toPlainText(doc.body?.textContent ?? '');
}

function cutText(text: string) {
    if (text.length <= SLIDE_TEXT_LIMIT) {
        return text;
    }
    return `${text.slice(0, SLIDE_TEXT_LIMIT).trimEnd()}…`;
}

/**
 * The first words on a slide, read off its text and html boxes in the order
 * they are laid out. A PDF or a PowerPoint page has no words the app can read
 * -- it is a picture -- so those answer `null` rather than an empty string,
 * and the model is told the difference in the tool's description.
 */
export function toSlideText(itemJson: VarySlideScreenDataType['itemJson']) {
    const canvasItems: any[] = (itemJson as any).canvasItems ?? [];
    if (!Array.isArray(canvasItems) || canvasItems.length === 0) {
        return null;
    }
    const parts: string[] = [];
    for (const item of canvasItems) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        if (item.type === 'text' && typeof item.text === 'string') {
            parts.push(toPlainText(item.text));
        } else if (item.type === 'html' && typeof item.html === 'string') {
            parts.push(toSungText(item.html));
        } else if (item.type === 'bible') {
            parts.push('(a Bible verse box)');
        }
    }
    const text = parts.filter((part) => part.length > 0).join(' / ');
    return text.length > 0 ? cutText(text) : '';
}

export function toSlideSummary(
    data: VarySlideScreenDataType | null,
): AgentScreenSlideSummaryType | null {
    if (data === null || typeof data !== 'object') {
        return null;
    }
    const { filePath, itemJson } = data;
    const type: string = (itemJson as any)?.type ?? 'slide';
    let name: string;
    if (type === 'pdf-slide') {
        name = `page ${(itemJson as any).pdfPageNumber ?? '?'}`;
    } else {
        const ownName = (itemJson as any)?.name;
        name =
            typeof ownName === 'string' && ownName.trim().length > 0
                ? ownName.trim()
                : `slide ${(itemJson as any)?.id ?? '?'}`;
    }
    return {
        document: toDocumentName(filePath ?? ''),
        kind: SLIDE_KIND_MAP[type] ?? 'slide',
        name,
        text: toSlideText(itemJson),
    };
}

export function toBackgroundSummary(
    backgroundSrc: BackgroundSrcType | null,
): AgentScreenBackgroundSummaryType | null {
    if (backgroundSrc === null || typeof backgroundSrc !== 'object') {
        return null;
    }
    const { type, src } = backgroundSrc;
    if (type === 'color') {
        return { kind: 'color', name: src ?? null };
    }
    if (type === 'web') {
        return { kind: 'web page', name: src ?? null };
    }
    if (type === 'camera') {
        return { kind: 'camera', name: null };
    }
    return {
        kind: type,
        name: src ? pathBasename(src) : null,
    };
}

export function toBibleSummary(
    viewData: BibleItemDataType | null,
): AgentScreenBibleSummaryType | null {
    if (viewData === null || typeof viewData !== 'object') {
        return null;
    }
    const renderedList = viewData.bibleItemData?.renderedList ?? [];
    const first = renderedList[0];
    const bibleItem = viewData.bibleItemData?.bibleItem;
    const version = first?.bibleKey ?? bibleItem?.bibleKey ?? '?';
    let reference = first?.title ?? '';
    if (reference.length === 0 && bibleItem?.target) {
        const { bookKey, chapter, verseStart, verseEnd } = bibleItem.target;
        reference =
            `${bookKey} ${chapter}:${verseStart}` +
            (verseEnd !== verseStart ? `-${verseEnd}` : '');
    }
    const summary: AgentScreenBibleSummaryType = { reference, version };
    if (renderedList.length > 1) {
        summary.versions = renderedList.map((item) => item.bibleKey);
    }
    return summary;
}

/**
 * The foreground widgets by name, with the one thing each is showing: a
 * marquee's words, a quick text's words, a clock's title. A countdown's target
 * time is a `Date` and is said as the local time it counts to.
 */
export function toForegroundSummary(
    foregroundData: ForegroundDataType | null | undefined,
): string[] {
    if (foregroundData === null || typeof foregroundData !== 'object') {
        return [];
    }
    const items: string[] = [];
    // Messages lead, like they do in the launcher: they are what an operator
    // puts up mid-service and the likeliest answer to "what is that on the
    // screen?". A rotating set names its COUNT and its first line -- naming
    // only whatever happens to be up would be stale before it was read.
    for (const message of foregroundData.messageDataList ?? []) {
        const textList = message.textList ?? [];
        const first = `"${cutText(toPlainText(textList[0] ?? ''))}"`;
        items.push(
            message.intervalSecond !== null && textList.length > 1
                ? `messages in turn (${textList.length}), first: ${first}`
                : `message: ${first}`,
        );
    }
    if (foregroundData.countdownData) {
        const target = foregroundData.countdownData.dateTime;
        const when =
            target instanceof Date && !Number.isNaN(target.getTime())
                ? ` to ${target.toLocaleTimeString()}`
                : '';
        items.push(`countdown${when}`);
    }
    if (foregroundData.stopwatchData) {
        items.push('stopwatch');
    }
    for (const time of foregroundData.timeDataList ?? []) {
        items.push(time.title ? `clock "${time.title}"` : 'clock');
    }
    if (foregroundData.marqueeTopData) {
        items.push(
            `marquee at the top: "${cutText(toPlainText(foregroundData.marqueeTopData.text ?? ''))}"`,
        );
    }
    if (foregroundData.marqueeBottomData) {
        items.push(
            `marquee at the bottom: "${cutText(toPlainText(foregroundData.marqueeBottomData.text ?? ''))}"`,
        );
    }
    if (foregroundData.quickTextData) {
        items.push(
            `quick text: "${cutText(toPlainText(foregroundData.quickTextData.htmlText ?? ''))}"`,
        );
    }
    for (const _camera of foregroundData.cameraDataList ?? []) {
        items.push('camera');
    }
    for (const web of foregroundData.webDataList ?? []) {
        items.push(`web page ${pathBasename(web.filePath ?? '')}`.trim());
    }
    for (const video of foregroundData.videoDataList ?? []) {
        items.push(`video ${pathBasename(video.filePath ?? '')}`.trim());
    }
    for (const image of foregroundData.imageDataList ?? []) {
        items.push(`picture ${pathBasename(image.filePath ?? '')}`.trim());
    }
    return items;
}

function toScreenSummary(screenManager: ScreenManager): AgentScreenSummaryType {
    const background = toBackgroundSummary(
        screenManager.screenBackgroundManager.backgroundSrc,
    );
    const slide = toSlideSummary(
        screenManager.screenVaryAppDocumentManager.varySlideData,
    );
    const bible = toBibleSummary(
        screenManager.screenBibleManager.screenViewData,
    );
    const foreground = toForegroundSummary(
        screenManager.screenForegroundManager.foregroundData,
    );
    let displayId: number | null = null;
    try {
        displayId = screenManager.displayId;
    } catch {
        // No display information in this window; the tool merges the
        // main process's own list anyway.
    }
    return {
        screenId: screenManager.screenId,
        isShowing: screenManager.isShowing,
        isLocked: screenManager.isLocked,
        isSelected: screenManager.isSelected,
        displayId,
        stage: screenManager.stage,
        background,
        slide,
        bible,
        foreground,
        isBlank:
            background === null &&
            slide === null &&
            bible === null &&
            foreground.length === 0,
    };
}

export function describeScreensForAgent(): AgentScreensResultType {
    const screens = getAllScreenManagers()
        .filter((screenManager) => {
            return !screenManager.isDeleted;
        })
        .sort((one, other) => {
            return one.screenId - other.screenId;
        })
        .map(toScreenSummary);
    return {
        isAuthoritative: appProvider.isPagePresenter,
        screens,
    };
}
