import { describe, expect, it } from 'vitest';

import {
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
    MAX_BIBLE_TEXT_FONT_SIZE,
    toBibleTextStyleView,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import {
    genBibleTextEffectPatch,
    genBibleTextLookEffect,
} from '../screen-setting/bibleTextLookHelpers';
import {
    SCREEN_GROUP_COLOR_LIST,
    checkIsScreenRefusal,
    describeScreenStyle,
    findScreenBibles,
    findScreenDisplay,
    genScreenStylePatch,
    pickScreenGroupColor,
    planScreenBibleKeys,
    toBibleTextLookId,
    toScreenFontSize,
    toScreenGroupName,
    toScreenTransition,
    type ScreenBibleInfoType,
    type ScreenDisplayInfoType,
    type ScreenStyleArgsType,
} from './agentScreenControlRules';

// White words on a dark picture, nothing else set: a fresh install's screen.
function genView(textStyle: Record<string, unknown> = {}) {
    return toBibleTextStyleView(textStyle);
}

function genPatch(
    args: ScreenStyleArgsType,
    view: BibleTextStyleViewType = genView(),
) {
    const result = genScreenStylePatch(view, args);
    if (checkIsScreenRefusal(result)) {
        throw new Error(`refused: ${result.reason}`);
    }
    return result;
}

function genReason(
    args: ScreenStyleArgsType,
    view: BibleTextStyleViewType = genView(),
) {
    const result = genScreenStylePatch(view, args);
    if (!checkIsScreenRefusal(result)) {
        throw new Error('expected a refusal');
    }
    return result.reason;
}

describe('checkIsScreenRefusal', () => {
    it('is a refusal only with a sentence in it', () => {
        expect(checkIsScreenRefusal({ reason: 'No.' })).toBe(true);
        expect(checkIsScreenRefusal({ reason: 3 })).toBe(false);
        expect(checkIsScreenRefusal(null)).toBe(false);
        expect(checkIsScreenRefusal(['No.'])).toBe(false);
    });
});

describe('toScreenFontSize', () => {
    it('steps the way the foreground steps, two steps for "much"', () => {
        expect(toScreenFontSize('larger', 65)).toBe(81);
        expect(toScreenFontSize('bigger', 65)).toBe(81);
        expect(toScreenFontSize('much bigger', 65)).toBe(102);
        expect(toScreenFontSize('smaller', 65)).toBe(52);
        expect(toScreenFontSize('a lot smaller', 65)).toBe(42);
    });

    it('takes pixels and the default, and stays readable and in range', () => {
        expect(toScreenFontSize(80, 65)).toBe(80);
        expect(toScreenFontSize('90px', 65)).toBe(90);
        expect(toScreenFontSize('default', 120)).toBe(
            DEFAULT_BIBLE_TEXT_FONT_SIZE,
        );
        expect(toScreenFontSize(500, 65)).toBe(MAX_BIBLE_TEXT_FONT_SIZE);
        expect(toScreenFontSize('larger', 190)).toBe(MAX_BIBLE_TEXT_FONT_SIZE);
        // The slider goes down to 1px; a verse a room reads does not.
        expect(toScreenFontSize(3, 65)).toBe(10);
    });

    it('refuses a word it cannot read, saying what it takes', () => {
        const result = toScreenFontSize('huge', 65);
        expect(checkIsScreenRefusal(result)).toBe(true);
        expect((result as { reason: string }).reason).toContain('"larger"');
    });
});

describe('toBibleTextLookId', () => {
    it('reads a tile by its id or a few words of one', () => {
        expect(toBibleTextLookId('Heavy Outline')).toBe('heavy-outline');
        expect(toBibleTextLookId('thick outline')).toBe('heavy-outline');
        expect(toBibleTextLookId('shadow')).toBe('soft-shadow');
        expect(toBibleTextLookId('blue glow')).toBe('blue-edge');
        expect(toBibleTextLookId('plain')).toBe('normal');
        expect(toBibleTextLookId('sparkle')).toBe(null);
        expect(toBibleTextLookId(7)).toBe(null);
    });
});

describe('genScreenStylePatch', () => {
    it('makes the words larger from the size the screens draw now', () => {
        const { patch, said } = genPatch(
            { size: 'larger' },
            genView({ fontSize: 80 }),
        );
        expect(patch).toEqual({ fontSize: 100 });
        expect(said).toEqual(['size 80px -> 100px']);
    });

    it('keeps the edge on the light side for a light colour', () => {
        const { patch } = genPatch({ color: 'yellow' });
        expect(patch).toEqual({ color: '#ffff00' });
    });

    it('flips the edge with the words for a dark colour, as the panel does', () => {
        const { patch } = genPatch({ color: 'navy' });
        expect(patch.color).toBe('#000080');
        // White words were edged in black; navy words are edged in white.
        expect(patch.effect.outlineColor).toBe(
            genBibleTextLookEffect('normal', 'light').outlineColor,
        );
        expect(patch.effect.outlineColor).not.toBe(
            genBibleTextLookEffect('normal', 'dark').outlineColor,
        );
    });

    it('makes several changes one patch: bold with a deep shadow', () => {
        const { patch, said } = genPatch({ bold: true, shadow: 'deep' });
        const deep = genBibleTextLookEffect('deep-shadow', 'dark');
        expect(patch.isBold).toBe(true);
        expect(patch.effect).toMatchObject({
            shadowX: deep.shadowX,
            shadowY: deep.shadowY,
            shadowBlur: deep.shadowBlur,
        });
        expect(patch.textShadow).not.toBe('none');
        expect(said).toEqual(['bold', 'a deep shadow']);
    });

    it('turns bold off by writing the key away, never false', () => {
        const { patch, said } = genPatch(
            { bold: 'no' },
            genView({ isBold: true }),
        );
        expect(Object.keys(patch)).toEqual(['isBold']);
        expect(patch.isBold).toBe(undefined);
        expect(said).toEqual(['not bold']);
    });

    it('puts a look of the panel on, replacing the whole effect', () => {
        const shadowed = genView(
            genBibleTextEffectPatch(
                genBibleTextLookEffect('deep-shadow', 'dark'),
            ),
        );
        const { patch, said } = genPatch({ look: 'heavy outline' }, shadowed);
        expect(patch.effect).toEqual(
            genBibleTextLookEffect('heavy-outline', 'dark'),
        );
        expect(said).toEqual(['the "heavy-outline" look']);
    });

    it('keeps the outline when a shadow is added', () => {
        const outlined = genView(
            genBibleTextEffectPatch(genBibleTextLookEffect('outline', 'dark')),
        );
        const { patch } = genPatch({ shadow: true }, outlined);
        expect(patch.effect.outlineWidth).toBe(0.04);
        expect(patch.effect.shadowBlur).toBeGreaterThan(0);
    });

    it('takes a shadow off and leaves the rest', () => {
        const lifted = genView(
            genBibleTextEffectPatch(genBibleTextLookEffect('lifted', 'dark')),
        );
        const { patch, said } = genPatch({ shadow: false }, lifted);
        expect(patch.effect).toMatchObject({
            shadowX: 0,
            shadowY: 0,
            shadowBlur: 0,
            outlineWidth: 0.02,
        });
        expect(said).toEqual(['no shadow']);
    });

    it('gives an outline its width and colour, and one to a colour alone', () => {
        expect(
            genPatch({ outline: 'thick', outlineColor: 'gold' }).patch.effect,
        ).toMatchObject({ outlineWidth: 0.07, outlineColor: '#ffd700' });
        // A colour for an outline that is not there asks for one.
        expect(
            genPatch({ outlineColor: 'red' }).patch.effect.outlineWidth,
        ).toBe(0.04);
        // Pixels written for em are read at the screen's size.
        expect(genPatch({ outline: 4 }).patch.effect.outlineWidth).toBe(0.062);
        expect(genPatch({ outline: false }).said).toEqual(['no outline']);
    });

    it('gives a glow, and one to a glow colour alone', () => {
        expect(genPatch({ glow: 'halo' }).patch.effect.glowSize).toBe(0.24);
        expect(genPatch({ glowColor: 'gold' }).patch.effect).toMatchObject({
            glowSize: 0.2,
            glowColor: '#ffd700',
        });
    });

    it('resets the look and keeps the size, as the panel Reset does', () => {
        const styled = genView({
            fontSize: 80,
            isBold: true,
            textAlign: 'center',
        });
        const { patch, said } = genPatch({ reset: true }, styled);
        expect(patch).not.toHaveProperty('fontSize');
        expect(patch.isBold).toBe(undefined);
        expect(patch.textAlign).toBe(undefined);
        expect(patch.textShadow).toBe('none');
        expect(said[0]).toContain('80px');
        // A size asked beside it still goes on.
        expect(
            genPatch({ reset: true, size: 'default' }, styled).patch.fontSize,
        ).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);
    });

    it('sets the backdrop, the line-up, the spacing and the font', () => {
        expect(genPatch({ backdrop: 'light' }).patch.color).toBe('#000000');
        expect(genPatch({ align: 'center' }).patch).toEqual({
            textAlign: 'center',
        });
        expect(genPatch({ align: 'left' }).patch).toEqual({
            textAlign: undefined,
        });
        expect(genPatch({ lineHeight: 'looser' }).patch.lineHeight).toBe(1.75);
        expect(
            genPatch({ lineHeight: 'default' }, genView({ lineHeight: 2 }))
                .patch,
        ).toEqual({ lineHeight: undefined });
        expect(genPatch({ lineHeight: 9 }).patch.lineHeight).toBe(3);
        expect(genPatch({ letterSpacing: 'wider' }).patch.letterSpacing).toBe(
            0.02,
        );
        expect(
            genPatch(
                { letterSpacing: 'default' },
                genView({ letterSpacing: 0.1 }),
            ).patch,
        ).toEqual({ letterSpacing: undefined });
        expect(genPatch({ font: ' Arial ' }).patch).toEqual({
            fontFamily: 'Arial',
        });
        expect(
            genPatch({ font: '' }, genView({ fontFamily: 'Arial' })).said,
        ).toEqual(["each Bible in its own language's font again"]);
    });

    it("marks the selected verse in the band for the words' side", () => {
        expect(genPatch({ highlight: 'yellow' }).patch).toEqual({
            highlightColorDark: '#ffff0033',
        });
        expect(
            genPatch({ highlight: 'yellow' }, genView({ color: '#000000' }))
                .patch,
        ).toEqual({ highlightColorLight: '#ffff0033' });
    });

    it("asks the window's own colour reader for a name it does not know", () => {
        const result = genScreenStylePatch(
            genView(),
            { color: 'rebeccapurple' },
            (value) => {
                return value === 'rebeccapurple' ? '#663399' : null;
            },
        );
        expect(checkIsScreenRefusal(result)).toBe(false);
        expect(result).toMatchObject({ patch: { color: '#663399' } });
    });

    it('refuses what it cannot do, naming what it takes', () => {
        expect(genReason({})).toContain('changed nothing');
        expect(genReason({ color: 'shiny' })).toContain('"shiny"');
        expect(genReason({ reset: 'maybe' })).toContain('`reset`');
        expect(genReason({ backdrop: 'grey' })).toContain('"dark"');
        expect(genReason({ align: 'diagonal' })).toContain('`align`');
        expect(genReason({ bold: 'very' })).toContain('`bold`');
        expect(genReason({ lineHeight: 'roomy' })).toContain('`lineHeight`');
        expect(genReason({ font: 3 })).toContain('`font`');
        expect(genReason({ look: 'sparkle' })).toContain('heavy-outline');
        expect(genReason({ shadow: 'blue' })).toContain('`shadow`');
        expect(genReason({ glow: 'bright' })).toContain('`glow`');
        expect(genReason({ outline: 'wavy' })).toContain('`outline`');
    });
});

describe('describeScreenStyle', () => {
    it('says a fresh screen in two parts', () => {
        expect(describeScreenStyle(genView())).toBe('65px, words #FFFFFF');
    });

    it('names everything that is set, in the order a person reads it', () => {
        const view = genView({
            fontSize: 80,
            color: '#ffff00',
            fontFamily: 'Arial',
            isBold: true,
            isItalic: true,
            textAlign: 'center',
            lineHeight: 2,
            letterSpacing: 0.04,
        });
        expect(describeScreenStyle(view)).toBe(
            '80px, words #ffff00, font "Arial", bold, italic, centred, ' +
                'line height 2, letter spacing 0.04em',
        );
    });

    it('names a panel look by its tile, and a shadow written by hand', () => {
        const outlined = genView(
            genBibleTextEffectPatch(
                genBibleTextLookEffect('heavy-outline', 'dark'),
            ),
        );
        expect(describeScreenStyle(outlined)).toContain(
            'the "heavy-outline" look',
        );
        const handWritten = genView({ textShadow: '2px 2px 4px #000000' });
        expect(describeScreenStyle(handWritten)).toContain(
            'a text shadow written by hand',
        );
    });
});

describe('toScreenTransition', () => {
    it("reads a person's word for each of the four", () => {
        expect(toScreenTransition('Fade')).toBe('fade');
        expect(toScreenTransition('cross-fade')).toBe('fade');
        expect(toScreenTransition('slide')).toBe('move');
        expect(toScreenTransition('scale')).toBe('zoom');
        expect(toScreenTransition('off')).toBe('none');
        expect(toScreenTransition('spin')).toBe(null);
        expect(toScreenTransition(3)).toBe(null);
    });
});

describe('findScreenDisplay', () => {
    const displays: ScreenDisplayInfoType[] = [
        {
            id: 1,
            name: 'Built-in Retina Display',
            isVirtual: false,
            isPrimary: true,
            width: 1512,
            height: 982,
        },
        {
            id: 2000,
            name: 'Virtual Display 1',
            isVirtual: true,
            isPrimary: false,
            width: 1920,
            height: 1080,
        },
        {
            id: 2001,
            name: 'Virtual Display 2',
            isVirtual: true,
            isPrimary: false,
            width: 1280,
            height: 720,
        },
    ];

    it('finds a display by its id, its name or the main one', () => {
        expect(findScreenDisplay(displays, 2001)).toBe(displays[2]);
        expect(findScreenDisplay(displays, '2000')).toBe(displays[1]);
        expect(findScreenDisplay(displays, 'virtual display 1')).toBe(
            displays[1],
        );
        expect(findScreenDisplay(displays, 'Retina')).toBe(displays[0]);
        expect(findScreenDisplay(displays, 'primary')).toBe(displays[0]);
    });

    it('asks which when a name fits two, and lists them when none', () => {
        const twice = findScreenDisplay(displays, 'virtual');
        expect(checkIsScreenRefusal(twice)).toBe(true);
        expect((twice as { reason: string }).reason).toContain(
            'fits more than one display',
        );
        const none = findScreenDisplay(displays, 'TV');
        expect((none as { reason: string }).reason).toBe(
            'No display is called "TV". The displays: "Built-in Retina ' +
                'Display" (id 1), "Virtual Display 1" (id 2000, virtual), ' +
                '"Virtual Display 2" (id 2001, virtual).',
        );
        expect(
            (findScreenDisplay(displays, '') as { reason: string }).reason,
        ).toContain('Name a display');
    });
});

describe('findScreenBibles', () => {
    const bibles: ScreenBibleInfoType[] = [
        {
            key: 'KJV',
            title: 'King James Version',
            locale: 'en',
            language: 'English',
        },
        {
            key: 'ASV',
            title: 'American Standard Version',
            locale: 'en',
            language: 'English',
        },
        {
            key: 'TST',
            title: 'Test Bible 2001',
            locale: 'zz',
            language: 'Testish',
        },
    ];

    it('finds a Bible by its key, its language or words of its title', () => {
        expect(findScreenBibles(bibles, ['kjv'])).toEqual([bibles[0]]);
        expect(findScreenBibles(bibles, ['the Testish Bible'])).toEqual([
            bibles[2],
        ]);
        expect(findScreenBibles(bibles, ['King James', 'standard'])).toEqual([
            bibles[0],
            bibles[1],
        ]);
    });

    it('asks which one when a language has two installed', () => {
        const result = findScreenBibles(bibles, ['English']);
        expect((result as { reason: string }).reason).toBe(
            'More than one English Bible is installed: KJV ("King James ' +
                'Version"), ASV ("American Standard Version"). Ask which ' +
                'one, by its key.',
        );
    });

    it('says what is installed, and where one is added, for none', () => {
        const result = findScreenBibles(bibles, ['NIV']);
        expect((result as { reason: string }).reason).toContain(
            'No Bible called "NIV" is installed.',
        );
        expect((result as { reason: string }).reason).toContain(
            'KJV (English), ASV (English), TST (Testish)',
        );
        expect((result as { reason: string }).reason).toContain('Settings');
        // Only the words a person adds round a name: nothing named.
        expect(
            (findScreenBibles(bibles, ['the version']) as { reason: string })
                .reason,
        ).toContain('Name a Bible');
    });
});

describe('planScreenBibleKeys', () => {
    it('adds after those up, removes, and swaps in one call', () => {
        expect(planScreenBibleKeys(['KJV'], ['ASV'], [])).toEqual([
            'KJV',
            'ASV',
        ]);
        expect(planScreenBibleKeys(['KJV', 'ASV'], [], ['asv'])).toEqual([
            'KJV',
        ]);
        expect(planScreenBibleKeys(['KJV'], ['kjv'], [])).toEqual(['KJV']);
        expect(planScreenBibleKeys(['KJV'], ['ASV'], ['KJV'])).toEqual(['ASV']);
    });

    it('keeps one version at least, and refuses one not up', () => {
        const none = planScreenBibleKeys(['KJV'], [], ['KJV']);
        expect((none as { reason: string }).reason).toContain(
            '`clear: "bible"`',
        );
        expect(
            (planScreenBibleKeys(['KJV'], [], ['ASV']) as { reason: string })
                .reason,
        ).toBe('ASV is not on the screen; it shows KJV.');
    });
});

describe('pickScreenGroupColor and toScreenGroupName', () => {
    it("takes a colour note by its word or hex, else the first nobody's", () => {
        expect(pickScreenGroupColor('red', [])).toEqual({
            name: 'red',
            color: '#FF0000',
        });
        expect(pickScreenGroupColor('grey', [])).toEqual({
            name: 'gray',
            color: '#808080',
        });
        expect(pickScreenGroupColor('#123456', [])).toEqual({
            name: '#123456',
            color: '#123456',
        });
        expect(
            pickScreenGroupColor(undefined, ['#ffff00', '#00FF00', null]),
        ).toEqual({ name: 'aqua', color: '#00FFFF' });
        const allUsed = SCREEN_GROUP_COLOR_LIST.map(([, color]) => color);
        expect(pickScreenGroupColor(undefined, allUsed)).toEqual({
            name: 'yellow',
            color: '#FFFF00',
        });
        expect(
            (pickScreenGroupColor('sparkly', []) as { reason: string }).reason,
        ).toContain('yellow, lime, aqua');
    });

    it('says a colour note in words when it has one', () => {
        expect(toScreenGroupName('#ffff00')).toBe('yellow');
        expect(toScreenGroupName('#123456')).toBe('#123456');
        expect(toScreenGroupName(null)).toBe(null);
        expect(toScreenGroupName('')).toBe(null);
    });
});
