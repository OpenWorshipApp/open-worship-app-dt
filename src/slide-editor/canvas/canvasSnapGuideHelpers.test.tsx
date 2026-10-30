// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import {
    CanvasSnapContext,
    useCanvasSnapContext,
    type CanvasSnapContextType,
} from './canvasSnapGuideHelpers';

describe('useCanvasSnapContext', () => {
    function SnapProbeComp() {
        const context = useCanvasSnapContext();
        const targets = context.getSnapTargets([1, 2]);
        return <i>{`${targets.vertical.join(',')}|${targets.horizontal}`}</i>;
    }

    test('hands out the snap context the canvas provides', () => {
        const value: CanvasSnapContextType = {
            getSnapTargets: (excludeIds) => ({
                vertical: excludeIds.map((id) => id * 10),
                horizontal: [5],
            }),
            setSnapLines: () => {},
        };

        expect(
            renderToStaticMarkup(
                <CanvasSnapContext value={value}>
                    <SnapProbeComp />
                </CanvasSnapContext>,
            ),
        ).toBe('<i>10,20|5</i>');
    });

    test('refuses to run outside a canvas', () => {
        expect(() => renderToStaticMarkup(<SnapProbeComp />)).toThrow(
            'useCanvasSnapContext must be used inside a CanvasSnapContext',
        );
    });
});
