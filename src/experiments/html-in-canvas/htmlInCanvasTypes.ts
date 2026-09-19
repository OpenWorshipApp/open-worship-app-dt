/**
 * Types for the (not yet standard) HTML-in-Canvas API. See ./README.md.
 */
import type { ReactNode } from 'react';

export type ElementImageType = {
    readonly width: number;
    readonly height: number;
    close(): void;
};

export type PaintEventType = Event & { readonly changedElements: Element[] };

export type DrawSourceType = Element | ElementImageType;

export interface HicContextType extends CanvasRenderingContext2D {
    drawElementImage(source: DrawSourceType, dx: number, dy: number): DOMMatrix;
    drawElementImage(
        source: DrawSourceType,
        dx: number,
        dy: number,
        dWidth: number,
        dHeight: number,
    ): DOMMatrix;
    drawElementImage(
        source: DrawSourceType,
        sx: number,
        sy: number,
        sWidth: number,
        sHeight: number,
        dx: number,
        dy: number,
        dWidth: number,
        dHeight: number,
    ): DOMMatrix;
}

export type HicCanvasType = HTMLCanvasElement & {
    requestPaint(): void;
    captureElementImage(element: Element): ElementImageType;
    getElementTransform(element: Element, drawTransform: DOMMatrix): DOMMatrix;
    onpaint: ((event: PaintEventType) => void) | null;
};

/**
 * Region Capture and Element Capture — the two ways to narrow a self
 * tab-capture down to one element, which is the only way to get the pixels of a
 * cross-origin `<iframe>`. Present in Chromium 150 but absent from TS's DOM lib
 * (`BrowserCaptureMediaStreamTrack` is not typed either), so they are declared
 * here alongside the other not-yet-standard surface this playground uses.
 */
declare global {
    const CropTarget: {
        fromElement(element: Element): Promise<CropTargetType>;
    };
    const RestrictionTarget: {
        fromElement(element: Element): Promise<RestrictionTargetType>;
    };
}

export type CropTargetType = { readonly __cropTarget: unique symbol };
export type RestrictionTargetType = {
    readonly __restrictionTarget: unique symbol;
};

export type CaptureTrackType = MediaStreamTrack & {
    cropTo(target: CropTargetType | null): Promise<void>;
    restrictTo(target: RestrictionTargetType | null): Promise<void>;
};

// -------------------------------------------------------------------------
// Constants & tiny helpers
// -------------------------------------------------------------------------

export type DemoType = {
    id: string;
    group: string;
    title: string;
    Comp: () => ReactNode;
    /**
     * `<fileName>#<symbol>` references, listed under the preview as code. See
     * ./demoSourceHelpers.ts.
     */
    sourceList: string[];
};
