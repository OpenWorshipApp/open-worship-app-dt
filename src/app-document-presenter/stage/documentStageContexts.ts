import { createContext, use, useMemo } from 'react';

import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    genStageIndexLabel,
    resolveStageSides,
    type DocumentStageDefinitionType,
    type StageDeckType,
} from './documentStageHelpers';

/**
 * The stage a document's Stage Previewer pane draws (`DocumentStagePreviewerComp`).
 * 0 everywhere else: the main slide list, the slide editor, a song's own
 * stage panes (those are drawn by the song stages) and a run sheet preview.
 */
export const SlideStageContext = createContext(0);

export function useSlideStage() {
    return use(SlideStageContext);
}

export type SlideStageDeckType = {
    definition: DocumentStageDefinitionType;
    deck: StageDeckType;
};

/**
 * Set by the slide list of a pane drawing stage 1 or up, so every card can
 * find the slides around it. Built once per load of the slides, not per card.
 */
export const SlideStageDeckContext = createContext<SlideStageDeckType | null>(
    null,
);

export type SlideStageViewType = {
    definition: DocumentStageDefinitionType;
    label: string | null;
    sides: {
        offset: number;
        varySlide: VarySlideType | null;
        label: string | null;
    }[];
};

/**
 * What a card adds around its slide on this pane's stage, or `null` when it
 * draws the slide as it is.
 *
 * Read in the card, never inside the card's body: the body renders into a
 * shadow root with a React root of its own, which no context reaches.
 */
export function useSlideStageView(
    varySlide: VarySlideType,
): SlideStageViewType | null {
    const stageDeck = use(SlideStageDeckContext);
    return useMemo(() => {
        if (stageDeck === null) {
            return null;
        }
        const { definition, deck } = stageDeck;
        const offsets = definition.arrangement?.offsets ?? [];
        const sideSlides = resolveStageSides(deck, varySlide.id, offsets);
        return {
            definition,
            label: definition.isShowingIndex
                ? genStageIndexLabel(deck, varySlide)
                : null,
            sides: offsets.map((offset, i) => {
                const sideSlide = sideSlides[i];
                return {
                    offset,
                    varySlide: sideSlide,
                    label:
                        definition.isShowingIndex && sideSlide !== null
                            ? genStageIndexLabel(deck, sideSlide)
                            : null,
                };
            }),
        };
    }, [stageDeck, varySlide]);
}
