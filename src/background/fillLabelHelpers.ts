import { tran } from '../lang/langHelpers';
import {
    genFillCodeLabel,
    type FillMotionType,
    type FillPatternNameType,
    type FillType,
} from './fillValueHelpers';

// Each name a literal call, so `tranKeyCoverage.test.ts` sees every key.
export function tranFillPatternName(name: FillPatternNameType) {
    switch (name) {
        case 'dots':
            return tran('Dots');
        case 'grid':
            return tran('Grid');
        case 'stripes':
            return tran('Stripes');
        case 'diagonal':
            return tran('Diagonal Lines');
        case 'checks':
            return tran('Checks');
        case 'zigzag':
            return tran('Zigzag');
    }
}

export function tranFillMotion(motion: FillMotionType) {
    switch (motion) {
        case 'none':
            return tran('None');
        case 'slow':
            return tran('Slow');
        case 'normal':
            return tran('Normal');
        case 'fast':
            return tran('Fast');
    }
}

/**
 * A fill's name for a person: its codes and degrees (the same in every
 * language), a pattern's kind and a moving one's speed in the app's.
 */
export function genFillLabel(fill: FillType) {
    const parts = [genFillCodeLabel(fill)];
    if (fill.kind === 'pattern') {
        parts.unshift(tranFillPatternName(fill.name));
    }
    if (fill.kind !== 'solid' && fill.motion !== 'none') {
        parts.push(`(${tran('Speed')}: ${tranFillMotion(fill.motion)})`);
    }
    return parts.join(' ');
}
