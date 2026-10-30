// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The real `Slide` underneath, on the same stubs as `slideModels.test.ts`;
// only the highlight helper (a DOM side effect) is recorded instead of run.
const h = vi.hoisted(() => ({
    notifyElementHighlight: vi.fn(),
    bringDomToCenterView: vi.fn(),
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: vi.fn(),
}));
vi.mock('../server/fontHelpers', () => ({ getFontFamilies: vi.fn() }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    bringDomToCenterView: h.bringDomToCenterView,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: vi.fn(), getInstanceBySrc: vi.fn() },
}));
vi.mock('../server/fileHelpers', () => ({ pathJoin: vi.fn() }));
vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: h.notifyElementHighlight,
}));

import LyricSlide, {
    INDEX_CLASSNAME_PREFIX,
    LYRIC_SLIDE_TYPE_KEY,
    STAGE_CLASSNAME_PREFIX,
    type LyricPropsType,
} from './LyricSlide';
import { DragTypeEnum } from '../helper/DragInf';

const FILE_PATH = '/songs/grace.owl';

function genJson(overrides: Partial<LyricPropsType> = {}): LyricPropsType {
    return {
        id: 3,
        canvasItems: [],
        metadata: { width: 1920, height: 1080 },
        type: 'lyric-slide',
        stage: 2,
        ...overrides,
    };
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('LyricSlide', () => {
    test('a verse is named by its place in the song', () => {
        const slide = new LyricSlide(FILE_PATH, genJson(), 'Verse 1', 0);
        expect(slide.name).toBe('(1)-Verse 1');
        expect(slide.openLyricKey).toBe('Verse 1');
        expect(slide.openLyricIndex).toBe(0);
        expect(slide.openLyricRepeat).toBeNull();
        expect(slide.originalJson.type).toBe(LYRIC_SLIDE_TYPE_KEY);
        // Written straight into the json it owns: building it is no edit.
        expect(slide.isChanged).toBe(false);
    });

    test('each play of a repeated step says which play it is', () => {
        const slide = new LyricSlide(FILE_PATH, genJson(), 'Chorus', 2, {
            index: 1,
            count: 3,
        });
        expect(slide.name).toBe('(3)-Chorus (2/3)');
        expect(slide.openLyricRepeat).toEqual({ index: 1, count: 3 });
    });

    test('an extra slide has no verse to point back at, only its key', () => {
        const slide = new LyricSlide(FILE_PATH, genJson(), 'First');
        expect(slide.openLyricIndex).toBe(-1);
        expect(slide.name).toBe('First');
    });

    test('carries its stage and index as classes the previewers look up', () => {
        const slide = new LyricSlide(
            FILE_PATH,
            genJson({ stage: 4 }),
            'Bridge',
            6,
        );
        expect(slide.stage).toBe(4);
        expect(slide.extraClassnames).toBe(
            `${STAGE_CLASSNAME_PREFIX}-4 ${INDEX_CLASSNAME_PREFIX}-6`,
        );
    });

    test('drags as a lyric slide', () => {
        const slide = new LyricSlide(FILE_PATH, genJson(), 'Verse 1', 0);
        expect(slide.dragType).toBe(DragTypeEnum.LYRIC_SLIDE);
    });
});

describe('validation', () => {
    test('accepts lyric slide json, and leaves the caller its own copy', () => {
        const json = genJson();
        expect(() => LyricSlide.validate(json)).not.toThrow();
        expect(LyricSlide.tryValidate(json)).toBe(true);
        expect(json.type).toBe('lyric-slide');
    });

    test('refuses another kind of slide', () => {
        const json = { ...genJson(), type: 'slide' };
        expect(() => LyricSlide.validate(json)).toThrow('Invalid type');
        expect(LyricSlide.tryValidate(json)).toBe(false);
    });

    test('refuses lyric json the slide schema rejects', () => {
        const json: any = genJson();
        delete json.metadata;
        expect(() => LyricSlide.validate(json)).toThrow(
            'Invalid slide data json',
        );
        expect(LyricSlide.tryValidate(json)).toBe(false);
    });
});

describe('notifyLyricElement', () => {
    function genPreviewer(indexes: number[]) {
        const previewer = document.createElement('div');
        for (const index of indexes) {
            const card = document.createElement('div');
            card.className = `${INDEX_CLASSNAME_PREFIX}-${index}`;
            previewer.append(card);
        }
        document.body.append(previewer);
        return previewer;
    }

    test('finds the card in THIS previewer, not the first in the document', () => {
        const otherPreviewer = genPreviewer([0, 1, 2]);
        const previewer = genPreviewer([0, 1, 2]);
        LyricSlide.notifyLyricElement(1, previewer);

        expect(h.notifyElementHighlight).toHaveBeenCalledTimes(1);
        const [getElement, options] = h.notifyElementHighlight.mock.calls[0];
        expect(getElement()).toBe(previewer.children[1]);
        expect(getElement()).not.toBe(otherPreviewer.children[1]);
        expect(options.moveToView).toBe(h.bringDomToCenterView);
    });

    test('no previewer, or a slide with no verse, highlights nothing', () => {
        LyricSlide.notifyLyricElement(1, null);
        LyricSlide.notifyLyricElement(-1, genPreviewer([0]));
        expect(h.notifyElementHighlight).not.toHaveBeenCalled();
    });
});
