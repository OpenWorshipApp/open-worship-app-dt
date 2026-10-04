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
    getForegroundCommonProperties: () => ({}),
}));
vi.mock('../others/BlendModeSelectComp', () => ({ default: () => null }));
vi.mock('../helper/blendModeHelpers', () => ({
    DEFAULT_BLEND_MODE: 'normal',
    checkIsBlending: () => false,
    toValidBlendMode: () => 'normal',
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
