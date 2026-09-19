/**
 * Slide transitions expressed as canvas drawing, because CSS transforms and
 * composited animations on a drawn element are invisible to the canvas.
 */
import type { HicContextType } from './htmlInCanvasTypes';
import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    centeredScale,
} from './htmlInCanvasHelpers';

export type TransitionRenderType = (
    context: HicContextType,
    progress: number,
    drawOutgoing: () => void,
    drawIncoming: () => void,
) => void;

export const TRANSITION_MAP: Record<string, TransitionRenderType> = {
    fade: (context, progress, drawOutgoing, drawIncoming) => {
        context.globalAlpha = 1 - progress;
        drawOutgoing();
        context.globalAlpha = progress;
        drawIncoming();
        context.globalAlpha = 1;
    },
    'zoom in': (context, progress, drawOutgoing, drawIncoming) => {
        drawOutgoing();
        context.save();
        context.globalAlpha = progress;
        centeredScale(context, 0.55 + 0.45 * progress);
        drawIncoming();
        context.restore();
    },
    'zoom out': (context, progress, drawOutgoing, drawIncoming) => {
        drawIncoming();
        context.save();
        context.globalAlpha = 1 - progress;
        centeredScale(context, 1 + 0.6 * progress);
        drawOutgoing();
        context.restore();
    },
    push: (context, progress, drawOutgoing, drawIncoming) => {
        context.save();
        context.translate(-SLIDE_WIDTH * progress, 0);
        drawOutgoing();
        context.translate(SLIDE_WIDTH, 0);
        drawIncoming();
        context.restore();
    },
    'push up': (context, progress, drawOutgoing, drawIncoming) => {
        context.save();
        context.translate(0, -SLIDE_HEIGHT * progress);
        drawOutgoing();
        context.translate(0, SLIDE_HEIGHT);
        drawIncoming();
        context.restore();
    },
    wipe: (context, progress, drawOutgoing, drawIncoming) => {
        drawOutgoing();
        context.save();
        context.beginPath();
        context.rect(0, 0, SLIDE_WIDTH * progress, SLIDE_HEIGHT);
        context.clip();
        drawIncoming();
        context.restore();
    },
    iris: (context, progress, drawOutgoing, drawIncoming) => {
        drawOutgoing();
        context.save();
        context.beginPath();
        context.arc(
            SLIDE_WIDTH / 2,
            SLIDE_HEIGHT / 2,
            progress * 1150,
            0,
            Math.PI * 2,
        );
        context.clip();
        drawIncoming();
        context.restore();
    },
    blinds: (context, progress, drawOutgoing, drawIncoming) => {
        drawOutgoing();
        context.save();
        context.beginPath();
        const bandCount = 10;
        const bandHeight = SLIDE_HEIGHT / bandCount;
        for (let index = 0; index < bandCount; index += 1) {
            context.rect(
                0,
                index * bandHeight,
                SLIDE_WIDTH,
                bandHeight * progress,
            );
        }
        context.clip();
        drawIncoming();
        context.restore();
    },
    'blur dissolve': (context, progress, drawOutgoing, drawIncoming) => {
        context.filter = `blur(${(progress * 8).toFixed(2)}px)`;
        context.globalAlpha = 1 - progress;
        drawOutgoing();
        context.filter = `blur(${((1 - progress) * 8).toFixed(2)}px)`;
        context.globalAlpha = progress;
        drawIncoming();
        context.filter = 'none';
        context.globalAlpha = 1;
    },
    'fall away': (context, progress, drawOutgoing, drawIncoming) => {
        drawIncoming();
        context.save();
        context.globalAlpha = 1 - progress;
        context.translate(SLIDE_WIDTH / 2, SLIDE_HEIGHT / 2);
        context.rotate(progress * 0.35);
        context.scale(1 - progress * 0.35, 1 - progress * 0.35);
        context.translate(
            -SLIDE_WIDTH / 2,
            -SLIDE_HEIGHT / 2 + progress * SLIDE_HEIGHT * 0.6,
        );
        drawOutgoing();
        context.restore();
    },
};

export const TRANSITION_NAME_LIST = Object.keys(TRANSITION_MAP);
