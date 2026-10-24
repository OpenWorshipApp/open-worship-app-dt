import type { VarySlideDataType } from '../../app-document-list/appDocumentTypeHelpers';
import type {
    StageLookAheadDataType,
    StageLookAheadSideType,
} from '../screenAppDocumentTypeHelpers';
import {
    filterSideCanvasItems,
    genStageIndexLabel,
    getDocumentStageDefinition,
    resolveStageSides,
    toStageDeck,
} from '../../app-document-presenter/stage/documentStageHelpers';
import { LYRIC_SLIDE_TYPE_KEY } from '../../lyric-list/LyricSlide';

/**
 * A side slide as the screen needs it: words and pictures only, so the
 * on-screen map it is saved in stays small and nothing in a side box plays.
 */
function toSideItemJson(itemJson: VarySlideDataType): VarySlideDataType {
    const json = itemJson as any;
    if (Array.isArray(json.canvasItems)) {
        return {
            ...json,
            canvasItems: filterSideCanvasItems(json.canvasItems),
        };
    }
    if (Array.isArray(json.subHtmlFilePaths)) {
        // A PowerPoint slide's animation steps are slides of their own.
        return { ...json, subHtmlFilePaths: [], subHtmls: [] };
    }
    return itemJson;
}

/**
 * What a screen on `stage` draws around slide `itemJson` of `filePath`: the
 * corner count and the slides around it (`documentStageHelpers`). `undefined`
 * when it draws the slide as it is -- stage 0, and a song, whose slide is
 * rebuilt for its stage instead (`getTargetLyricSlideItemData`).
 *
 * Runs on the PRESENTER only, which has the document open; the screen window
 * keeps what the sync hands it.
 */
export async function genStageLookAheadData(
    filePath: string,
    itemJson: VarySlideDataType,
    stage: number,
): Promise<StageLookAheadDataType | undefined> {
    // Cheap, import-free outs first: stage 0 is the common case and must cost
    // nothing.
    const definition = getDocumentStageDefinition(stage);
    if (definition === null) {
        return undefined;
    }
    const json = itemJson as { type?: unknown; stage?: unknown; id: number };
    if (json.type === LYRIC_SLIDE_TYPE_KEY || typeof json.stage === 'number') {
        return undefined;
    }
    // Dynamic: `appDocumentHelpers` pulls in every document kind, and this
    // module sits in the screen manager's static closure.
    const { checkIsLyricFilePath, varyAppDocumentFromFilePath } =
        await import('../../app-document-list/appDocumentHelpers');
    if (checkIsLyricFilePath(filePath)) {
        return undefined;
    }
    const varySlides = await varyAppDocumentFromFilePath(filePath).getSlides();
    const deck = toStageDeck(varySlides);
    const index = deck.indexById.get(json.id);
    const currentSlide = index === undefined ? undefined : deck.list[index];
    const offsets = definition.arrangement?.offsets ?? [];
    const sideSlides = resolveStageSides(deck, json.id, offsets);
    return {
        stage,
        label:
            definition.isShowingIndex && currentSlide !== undefined
                ? genStageIndexLabel(deck, currentSlide)
                : null,
        sideList: sideSlides.map((sideSlide, i) => {
            if (sideSlide === null) {
                return null;
            }
            const side: StageLookAheadSideType = {
                offset: offsets[i],
                itemJson: toSideItemJson(
                    sideSlide.toJson() as VarySlideDataType,
                ),
                // Every slide on the stage carries its count, the coming ones
                // too: a singer reads where each one is in the document.
                label: definition.isShowingIndex
                    ? genStageIndexLabel(deck, sideSlide)
                    : null,
            };
            return side;
        }),
    };
}

/**
 * `data` if it is a well-formed `StageLookAheadDataType`, else `null`. It is
 * read back from the saved on-screen map, which a hand edit or an older build
 * may have left in any shape; a bad one draws the slide as it is.
 */
export function checkStageLookAheadData(
    data: unknown,
): StageLookAheadDataType | null {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const { stage, label, sideList } = data as Record<string, unknown>;
    if (
        typeof stage !== 'number' ||
        (label !== null && typeof label !== 'string') ||
        !Array.isArray(sideList)
    ) {
        return null;
    }
    const isValidSideList = sideList.every((side) => {
        return (
            side === null ||
            (typeof side === 'object' &&
                typeof side.offset === 'number' &&
                typeof side.itemJson === 'object' &&
                side.itemJson !== null &&
                (side.label === undefined ||
                    side.label === null ||
                    typeof side.label === 'string'))
        );
    });
    return isValidSideList ? (data as StageLookAheadDataType) : null;
}
