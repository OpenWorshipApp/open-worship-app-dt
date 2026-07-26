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

// -------------------------------------------------------------------------
// Constants & tiny helpers
// -------------------------------------------------------------------------

export type DemoType = {
    id: string;
    group: string;
    title: string;
    Comp: () => ReactNode;
};
