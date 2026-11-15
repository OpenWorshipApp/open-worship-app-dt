import { tran } from '../lang/langHelpers';
import {
    findAnimationSampleTheme,
    type AnimationThemeType,
} from './animationBuiltInHelpers';
import {
    toAnimationSrc,
    type AnimationLevelType,
    type AnimationSpeedType,
    type AnimationType,
    type CssAnimationNameType,
    type GlslAnimationNameType,
} from './animationValueHelpers';

// Each name a literal call, so `tranKeyCoverage.test.ts` sees every key.
export function tranCssAnimationName(name: CssAnimationNameType) {
    switch (name) {
        case 'aurora':
            return tran('Aurora');
        case 'bokeh':
            return tran('Bokeh');
        case 'rays':
            return tran('Light Rays');
        case 'waves':
            return tran('Waves');
        case 'stars':
            return tran('Starfield');
        case 'breathe':
            return tran('Breathe');
        case 'snow':
            return tran('Snowfall');
        case 'clouds':
            return tran('Clouds');
        case 'cross':
            return tran('Cross');
        case 'embers':
            return tran('Embers');
    }
}

export function tranGlslAnimationName(name: GlslAnimationNameType | 'custom') {
    switch (name) {
        case 'plasma':
            return tran('Plasma');
        case 'flow':
            return tran('Flow');
        case 'mesh':
            return tran('Mesh Gradient');
        case 'aurora':
            return tran('Aurora');
        case 'waves':
            return tran('Waves');
        case 'rays':
            return tran('Light Rays');
        case 'clouds':
            return tran('Clouds');
        case 'cross':
            return tran('Cross');
        case 'flames':
            return tran('Flames');
        case 'glass':
            return tran('Stained Glass');
        case 'ripples':
            return tran('Ripples');
        case 'snow':
            return tran('Snowfall');
        case 'sunrise':
            return tran('Sunrise');
        case 'stars':
            return tran('Starry Night');
        case 'custom':
            return tran('Custom Shader');
    }
}

export function tranAnimationSpeed(speed: AnimationSpeedType) {
    switch (speed) {
        case 'slow':
            return tran('Slow');
        case 'normal':
            return tran('Normal');
        case 'fast':
            return tran('Fast');
    }
}

export function tranAnimationLevel(level: AnimationLevelType) {
    switch (level) {
        case 'low':
            return tran('Low');
        case 'normal':
            return tran('Normal');
        case 'high':
            return tran('High');
    }
}

export function tranAnimationTheme(theme: AnimationThemeType) {
    switch (theme) {
        case 'glory':
            return tran('Glory');
        case 'heaven':
            return tran('Heaven');
        case 'holy-spirit':
            return tran('Holy Spirit');
        case 'living-water':
            return tran('Living Water');
        case 'silent-night':
            return tran('Silent Night');
        case 'christmas':
            return tran('Christmas');
        case 'advent':
            return tran('Advent');
        case 'lent':
            return tran('Lent');
        case 'easter':
            return tran('Easter');
        case 'calvary':
            return tran('Calvary');
        case 'grace':
            return tran('Grace');
        case 'peace':
            return tran('Peace');
        case 'joy':
            return tran('Joy');
        case 'majesty':
            return tran('Majesty');
        case 'worship':
            return tran('Worship');
        case 'pentecost':
            return tran('Pentecost');
        case 'hope':
            return tran('Hope');
        case 'praise':
            return tran('Praise');
        case 'baptism':
            return tran('Baptism');
        case 'light-of-the-world':
            return tran('Light of the World');
        case 'morning-light':
            return tran('Morning Light');
        case 'resurrection':
            return tran('Resurrection');
        case 'communion':
            return tran('Communion');
        case 'revival':
            return tran('Revival');
    }
}

export function tranAnimationEffectName(animation: AnimationType) {
    return animation.engine === 'css'
        ? tranCssAnimationName(animation.name)
        : tranGlslAnimationName(animation.name);
}

/**
 * An animation's name for a person, in the app's language: a sample's theme
 * with its effect (`Christmas - Snowfall`), else the effect alone.
 */
export function genAnimationLabel(animation: AnimationType) {
    const effectName = tranAnimationEffectName(animation);
    const theme = findAnimationSampleTheme(toAnimationSrc(animation));
    return theme === null
        ? effectName
        : `${tranAnimationTheme(theme)} - ${effectName}`;
}
