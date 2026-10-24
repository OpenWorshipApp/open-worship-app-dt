import { expect, test, vi } from 'vitest';

const { settings } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    useStateSettingBoolean: () => [false, vi.fn()],
    useStateSettingNumber: () => [0, vi.fn()],
    useStateSettingString: () => ['', vi.fn()],
}));
vi.mock('../_screen/transitionEffectHelpers', () => ({
    transitionEffect: { fade: ['bi-fade'], zoom: ['bi-zoom'] },
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: <T,>(value: T) => ({ current: value }),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/AppRangeComp', () => ({ default: () => null }));
vi.mock('./ForegroundPositionPadComp', () => ({ default: () => null }));
vi.mock('./ForegroundPropRowComp', () => ({ default: () => null }));
vi.mock('./ForegroundCommonPropertiesSettingComp', () => ({
    DEFAULT_BACKDROP_FILTER: 0,
    DEFAULT_BACKGROUND_COLOR: '',
    DEFAULT_TEXT_COLOR: '',
    genCommonStyleSettingNames: () => ({}),
    getForegroundCommonProperties: () => ({
        backgroundColor: '#123456',
        backdropFilter: 'blur(4px)',
    }),
}));
vi.mock('../others/BlendModeSelectComp', () => ({ default: () => null }));
vi.mock('../helper/blendModeHelpers', () => ({
    DEFAULT_BLEND_MODE: 'normal',
    checkIsBlending: (mode: string) => mode === 'multiply',
    toValidBlendMode: (mode: string) =>
        mode === 'multiply' ? 'multiply' : 'normal',
}));
vi.mock('./ForegroundDecorationSettingComp', () => ({ default: () => null }));
vi.mock('./foregroundDecorationHelpers', () => ({
    genForegroundDecorationStyle: () => ({}),
    getForegroundDecoration: () => ({}),
}));
vi.mock('./ForegroundTransitionControlsComp', () => ({
    ForegroundTransitionPropComp: () => null,
}));
import {
    genForegroundExtraStyle,
    genPropsSettingNames,
    getForegroundIsBehind,
    getForegroundWidthScale,
} from './propertiesSettingHelpers';
import { resolveForegroundTransition } from './foregroundTransitionHelpers';

test('reads presentation-only width and transition settings with safe defaults', () => {
    expect(genPropsSettingNames('video').widthPercentage).toBe(
        'video-setting-show-widget-width-percentage',
    );
    expect(getForegroundWidthScale('video')).toBe(50);
    settings.set('video-setting-show-widget-width-percentage', '180');
    expect(getForegroundWidthScale('video')).toBe(100);
    // No transition of its own and none for the component: the datum carries
    // nothing and the screen's `Foreground:` effect applies.
    expect(resolveForegroundTransition('video', 'video')).toBeUndefined();
    settings.set('foreground-component-transition-video', 'fade');
    expect(resolveForegroundTransition('video', 'video')).toBe('fade');
    // The session's own wins over the component's -- and is the key the old
    // Transition picker always wrote, so an earlier choice still counts.
    expect(genPropsSettingNames('video').transitionEffect).toBe(
        'video-setting-show-widget-transition',
    );
    settings.set('video-setting-show-widget-transition', 'zoom');
    expect(resolveForegroundTransition('video', 'video')).toBe('zoom');
    // Anything that is not an effect is no override at all.
    settings.set('video-setting-show-widget-transition', 'sparkle');
    expect(resolveForegroundTransition('video', 'video')).toBe('fade');
    settings.delete('video-setting-show-widget-transition');
    settings.delete('foreground-component-transition-video');
});

test('builds geometry from bounded settings and keeps a pinned overlay above normal paint order', () => {
    settings.set('video-setting-show-widget-width-percentage', '-10');
    settings.set('video-setting-show-widget-opacity-percentage', '140');
    settings.set(
        'video-setting-show-widget-alignment-data',
        JSON.stringify({
            horizontalAlignment: 'right',
            verticalAlignment: 'end',
        }),
    );
    settings.set('video-setting-show-widget-offset-x', '12');
    settings.set('video-setting-show-widget-offset-y', '-4');
    settings.set('video-setting-show-widget-scale', '1.5');
    settings.set('video-setting-show-widget-always-on-top', 'true');
    settings.set('video-setting-show-widget-z-index', '7');
    expect(
        genForegroundExtraStyle('video', {
            isFontSize: true,
            isGeometry: true,
            isCommonStyle: false,
            isBlendMode: false,
        }),
    ).toMatchObject({
        position: 'absolute',
        width: '1%',
        opacity: 1,
        right: '12px',
        bottom: '-4px',
        transform: 'scale(1.5) rotate(0deg)',
        transformOrigin: 'right bottom',
        zIndex: 7,
        fontSize: '100px',
    });
});

test('drops Always on Top from an overlay put behind the slide', () => {
    settings.clear();
    settings.set('logo-setting-show-widget-always-on-top', 'true');
    settings.set('logo-setting-show-widget-z-index', '7');
    const option = {
        isFontSize: false,
        isGeometry: true,
        isCommonStyle: false,
        isBlendMode: false,
    };
    expect(getForegroundIsBehind('logo')).toBe(false);
    expect(genForegroundExtraStyle('logo', option)).toMatchObject({
        zIndex: 7,
    });
    // Its root makes no stacking context, so a z-index would lift it back
    // over the slide and the Bible text it was put behind.
    settings.set('logo-setting-show-widget-is-behind', 'true');
    expect(getForegroundIsBehind('logo')).toBe(true);
    expect(genForegroundExtraStyle('logo', option)).not.toHaveProperty(
        'zIndex',
    );
});

test('anchors centered, edge and corner widgets to their selected origin', () => {
    settings.clear();
    const names = genPropsSettingNames('caption');
    const option = {
        isFontSize: false,
        isGeometry: true,
        isCommonStyle: false,
        isBlendMode: false,
    };
    settings.set(names.offsetX, '12');
    settings.set(names.offsetY, '-4');
    expect(genForegroundExtraStyle('caption', option)).toMatchObject({
        left: '50%',
        top: '50%',
        transform:
            'translate(calc(-50% + 12px), calc(-50% - 4px)) scale(1) rotate(0deg)',
        transformOrigin: 'center center',
    });

    settings.set(
        names.alignment,
        JSON.stringify({
            horizontalAlignment: 'center',
            verticalAlignment: 'start',
        }),
    );
    expect(genForegroundExtraStyle('caption', option)).toMatchObject({
        left: '50%',
        top: '-4px',
        transform: 'translateX(calc(-50% + 12px)) scale(1) rotate(0deg)',
        transformOrigin: 'center top',
    });

    settings.set(
        names.alignment,
        JSON.stringify({
            horizontalAlignment: 'right',
            verticalAlignment: 'center',
        }),
    );
    expect(genForegroundExtraStyle('caption', option)).toMatchObject({
        right: '12px',
        top: '50%',
        transform: 'translateY(calc(-50% - 4px)) scale(1) rotate(0deg)',
        transformOrigin: 'right center',
    });

    settings.set(
        names.alignment,
        JSON.stringify({
            horizontalAlignment: 'left',
            verticalAlignment: 'end',
        }),
    );
    expect(genForegroundExtraStyle('caption', option)).toMatchObject({
        left: '12px',
        bottom: '-4px',
        transformOrigin: 'left bottom',
    });
});

test('keeps non-geometric text square until rounded and bounds opacity', () => {
    settings.clear();
    const names = genPropsSettingNames('marquee');
    const option = {
        isFontSize: true,
        isGeometry: false,
        isCommonStyle: false,
        isBlendMode: false,
    };
    expect(genForegroundExtraStyle('marquee', option)).toMatchObject({
        borderRadius: '0%',
        fontSize: '100px',
    });
    settings.set(names.roundPercentage, '80');
    settings.set(names.fontSize, '48');
    expect(genForegroundExtraStyle('marquee', option)).toMatchObject({
        borderRadius: '40%',
        fontSize: '48px',
    });
    settings.set(names.roundSizePixel, '9');
    expect(genForegroundExtraStyle('marquee', option).borderRadius).toBe('9px');

    settings.set(names.opacityPercentage, '-25');
    settings.set(names.widthPercentage, '250');
    expect(
        genForegroundExtraStyle('marquee', { ...option, isGeometry: true }),
    ).toMatchObject({ opacity: 0, width: '100%' });
});

test('blending removes the backdrop filter but preserves the common color', () => {
    settings.clear();
    settings.set(genPropsSettingNames('image').blendMode, 'multiply');
    expect(
        genForegroundExtraStyle('image', {
            isFontSize: false,
            isGeometry: false,
            isCommonStyle: true,
            isBlendMode: true,
        }),
    ).toMatchObject({
        backgroundColor: '#123456',
        backdropFilter: 'none',
        mixBlendMode: 'multiply',
    });
});
