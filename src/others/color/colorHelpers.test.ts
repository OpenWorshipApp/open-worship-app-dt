import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    handleDragStartMock: vi.fn(),
    removeOpacityFromHexColorMock: vi.fn((color: string) => color.slice(0, 7)),
}));

vi.mock('../../helper/dragHelpers', () => ({
    handleDragStart: mocks.handleDragStartMock,
}));

vi.mock('../../server/appHelpers', () => ({
    removeOpacityFromHexColor: mocks.removeOpacityFromHexColorMock,
}));

import { DragTypeEnum } from '../../helper/DragInf';
import {
    HEX_COLOR_BLACK,
    HEX_COLOR_WHITE,
    checkIsColorDark,
    colorDeserialize,
    colorToTransparent,
    compareColor,
    serializeForDragging,
    toHexColorString,
    transparentColor,
} from './colorHelpers';

describe('colorHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('normalizes hex, named, rgb, and transparent colors', () => {
        expect(HEX_COLOR_BLACK).toBe('#000000');
        expect(HEX_COLOR_WHITE).toBe('#FFFFFF');
        expect(toHexColorString('white')).toBe('#FFFFFF');
        expect(toHexColorString('BLACK')).toBe('#000000');
        expect(toHexColorString('#ABC')).toBe('#aabbcc');
        expect(toHexColorString('#123456')).toBe('#123456');
        expect(toHexColorString('#12345678')).toBe('#12345678');
        expect(toHexColorString('#12')).toBeNull();
        expect(toHexColorString('rgb(255, 0, 16)')).toBe('#ff0010');
        expect(toHexColorString('transparent')).toBeNull();
        expect(toHexColorString('not-a-color')).toBeNull();
    });

    test('handles alpha extraction and formatting', () => {
        expect(colorToTransparent('#11223344')).toBe(68);
        expect(colorToTransparent('#112233')).toBe(255);
        expect(transparentColor(5)).toBe('05');
        expect(transparentColor(255)).toBe('ff');
    });

    test('compares colors ignoring opacity and preserves serialized values', () => {
        expect(compareColor('#abcdef', '#ABCDEF99')).toBe(true);
        expect(compareColor('rgb(0, 0, 0)' as any, 'white' as any)).toBe(false);
        expect(mocks.removeOpacityFromHexColorMock).toHaveBeenCalled();

        expect(colorDeserialize('#123456')).toBe('#123456');
    });

    test('serializes dragging and classifies dark colors with alpha awareness', () => {
        const event = { dataTransfer: {} };
        serializeForDragging(event, '#123456');

        expect(mocks.handleDragStartMock).toHaveBeenCalledTimes(1);
        expect(mocks.handleDragStartMock.mock.calls[0]?.[0]).toBe(event);
        expect(
            mocks.handleDragStartMock.mock.calls[0]?.[1]?.dragSerialize(),
        ).toEqual({
            data: '#123456',
            type: DragTypeEnum.BACKGROUND_COLOR,
        });

        expect(checkIsColorDark('#000000')).toBe(true);
        expect(checkIsColorDark('#ffffff')).toBe(false);
        expect(checkIsColorDark('#00000000')).toBe(false);
        expect(checkIsColorDark('invalid')).toBe(false);
    });
});
