import type { RefObject } from 'react';
import { createContext, use } from 'react';

/**
 * Which slides previewer a slide card belongs to.
 *
 * There used to be exactly one slides previewer on a page, so everything that
 * needed "the container" just took the first `.app-slide-items-container` in the
 * document. Floating document previews put several on screen at once, and a
 * first-match lookup then answers for the WRONG one: the keyboard handler
 * compares `document.activeElement` against the main panel's container and
 * silently does nothing, and a touch-drag autoscrolls the panel behind the
 * widget instead of the widget.
 *
 * Deliberately a leaf module (react-only imports): `varyAppDocumentHelpers` is
 * mocked with a couple of exports by several tests, so a context added there
 * would resolve to `undefined` in them.
 */

export const SLIDES_PREVIEWER_SCOPE_KEY = 'data-slides-previewer-scope';

export type SlidesPreviewerScopeType = {
    scopeId: string;
    // Some consumers can only take a SELECTOR STRING, not an element:
    // `data-scroll-container-selector` is read back through
    // `document.querySelector` in `touchDragHelpers` and `domHelpers`.
    containerSelector: string;
    containerRef: RefObject<HTMLDivElement | null>;
};

export const SlidesPreviewerScopeContext =
    createContext<SlidesPreviewerScopeType | null>(null);

/**
 * `null` wherever no previewer is above — a slide card also renders inside the
 * presenting flow preview and on the screen page — in which case every consumer keeps
 * its historical document-wide behaviour.
 */
export function useSlidesPreviewerScope() {
    return use(SlidesPreviewerScopeContext);
}

let scopeCount = 0;

export function genSlidesPreviewerScope(
    containerRef: RefObject<HTMLDivElement | null>,
): SlidesPreviewerScopeType {
    // A plain counter rather than `useId`: the id is concatenated into a CSS
    // selector by two helpers that do no escaping, and React's generated ids
    // carry characters (`:`, `«»`) that need it.
    scopeCount += 1;
    const scopeId = `slides-previewer-${scopeCount}`;
    return {
        scopeId,
        containerSelector: `[${SLIDES_PREVIEWER_SCOPE_KEY}="${scopeId}"]`,
        containerRef,
    };
}

/**
 * Which setting key a previewer's thumbnail scale is stored under.
 *
 * Three components read the scale independently (the previewer, the slide list
 * and the footer's slider), so the key travels as context rather than as a prop
 * threaded through all three. `null` means "the app-wide key", i.e. the main
 * panel and the lyric stage previewer keep sharing one scale as before.
 */
export type ThumbnailScaleSettingType = {
    settingName: string;
    defaultSize: number;
};

export const ThumbnailScaleSettingContext =
    createContext<ThumbnailScaleSettingType | null>(null);

export function useThumbnailScaleSettingOptions(
    fallback: Partial<ThumbnailScaleSettingType> = {},
) {
    return use(ThumbnailScaleSettingContext) ?? fallback;
}
