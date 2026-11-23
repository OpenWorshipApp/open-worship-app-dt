import type { ColorModeType } from '../others/color/colorContrastHelpers';
import { tran } from '../lang/langHelpers';
import {
    findAnimationSample,
    type AnimationCategoryGroupType,
    type AnimationCategoryType,
} from './animationBuiltInHelpers';
import {
    type AnimationLevelType,
    type AnimationSpeedType,
    type AnimationType,
    type CssAnimationNameType,
    type GlslAnimationNameType,
} from './animationValueHelpers';

// Each name a literal call, so `tranKeyCoverage.test.ts` sees every key.
export function tranCssAnimationName(name: CssAnimationNameType | 'custom') {
    switch (name) {
        case 'custom':
            return tran('Custom CSS');
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
        case 'leaves':
            return tran('Falling Leaves');
        case 'fireworks':
            return tran('Fireworks');
        case 'petals':
            return tran('Petals');
        case 'candles':
            return tran('Candlelight');
        case 'confetti':
            return tran('Confetti');
        case 'hearts':
            return tran('Hearts');
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
        case 'leaves':
            return tran('Falling Leaves');
        case 'fireworks':
            return tran('Fireworks');
        case 'petals':
            return tran('Petals');
        case 'candles':
            return tran('Candlelight');
        case 'confetti':
            return tran('Confetti');
        case 'hearts':
            return tran('Hearts');
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

export function tranAnimationCategory(category: AnimationCategoryType) {
    switch (category) {
        case 'sunday-worship':
            return tran('Sunday Worship');
        case 'worship-night':
            return tran('Worship Night');
        case 'prayer-meeting':
            return tran('Prayer Meeting');
        case 'bible-study':
            return tran('Bible Study');
        case 'youth-service':
            return tran('Youth Service');
        case 'children-service':
            return tran("Children's Service");
        case 'revival':
            return tran('Revival');
        case 'evangelism':
            return tran('Evangelism');
        case 'missions':
            return tran('Missions');
        case 'advent':
            return tran('Advent');
        case 'christmas':
            return tran('Christmas');
        case 'epiphany':
            return tran('Epiphany');
        case 'ash-wednesday':
            return tran('Ash Wednesday');
        case 'lent':
            return tran('Lent');
        case 'palm-sunday':
            return tran('Palm Sunday');
        case 'maundy-thursday':
            return tran('Maundy Thursday');
        case 'good-friday':
            return tran('Good Friday');
        case 'resurrection-day':
            return tran('Resurrection Day');
        case 'ascension-day':
            return tran('Ascension Day');
        case 'pentecost':
            return tran('Pentecost');
        case 'trinity-sunday':
            return tran('Trinity Sunday');
        case 'transfiguration':
            return tran('Transfiguration');
        case 'reformation-day':
            return tran('Reformation Day');
        case 'all-saints-day':
            return tran("All Saints' Day");
        case 'christ-the-king':
            return tran('Christ the King');
        case 'baptism':
            return tran('Baptism');
        case 'communion':
            return tran('Communion');
        case 'wedding':
            return tran('Wedding');
        case 'funeral':
            return tran('Funeral');
        case 'baby-dedication':
            return tran('Baby Dedication');
        case 'confirmation':
            return tran('Confirmation');
        case 'ordination':
            return tran('Ordination');
        case 'church-anniversary':
            return tran('Church Anniversary');
        case 'graduation':
            return tran('Graduation');
        case 'healing-service':
            return tran('Healing Service');
        case 'new-year':
            return tran('New Year');
        case 'thanksgiving':
            return tran('Thanksgiving');
        case 'harvest':
            return tran('Harvest');
        case 'mothers-day':
            return tran("Mother's Day");
        case 'fathers-day':
            return tran("Father's Day");
        case 'national-day':
            return tran('National Day');
        case 'springtime':
            return tran('Springtime');
        case 'summer':
            return tran('Summer');
        case 'autumn':
            return tran('Autumn');
        case 'winter':
            return tran('Winter');
        case 'glory':
            return tran('Glory');
        case 'heaven':
            return tran('Heaven');
        case 'holy-spirit':
            return tran('Holy Spirit');
        case 'living-water':
            return tran('Living Water');
        case 'grace':
            return tran('Grace');
        case 'peace':
            return tran('Peace');
        case 'joy':
            return tran('Joy');
        case 'majesty':
            return tran('Majesty');
        case 'hope':
            return tran('Hope');
        case 'praise':
            return tran('Praise');
        case 'light-of-the-world':
            return tran('Light of the World');
        case 'morning-light':
            return tran('Morning Light');
    }
}

export function tranAnimationCategoryGroup(group: AnimationCategoryGroupType) {
    switch (group) {
        case 'services':
            return tran('Services');
        case 'church-year':
            return tran('Church Year');
        case 'special-services':
            return tran('Special Services');
        case 'holidays':
            return tran('Holidays');
        case 'seasons':
            return tran('Seasons');
        case 'themes':
            return tran('Themes');
    }
}

export function tranAnimationEffectName(animation: AnimationType) {
    return animation.engine === 'css'
        ? tranCssAnimationName(animation.name)
        : tranGlslAnimationName(animation.name);
}

/**
 * A sample's effect for its tile, numbered from its second look on
 * (`Snowfall`, `Snowfall 2`): the Category list already says the occasion.
 */
export function genAnimationSampleCaption(
    animation: AnimationType,
    number = 1,
) {
    const name = tranAnimationEffectName(animation);
    return number > 1 ? `${name} ${number}` : name;
}

/**
 * A sample's name for a person: its category with its effect, and a Light
 * one says so (`Christmas - Snowfall (Light)`) -- the Dark side keeps the
 * names it always had, which saved presets and run sheets show.
 */
export function genAnimationCategoryLabel(
    category: AnimationCategoryType,
    animation: AnimationType,
    number = 1,
    tone: ColorModeType = 'dark',
) {
    const label = `${tranAnimationCategory(category)} - ${genAnimationSampleCaption(animation, number)}`;
    return tone === 'light' ? `${label} (${tran('Light')})` : label;
}

/**
 * An animation's name for a person, in the app's language: a sample's
 * category with its effect (`Christmas - Snowfall`, its further looks
 * numbered, `Christmas - Snowfall 2`, a Light one marked), else the effect
 * alone.
 */
export function genAnimationLabel(animation: AnimationType) {
    const sample = findAnimationSample(animation);
    return sample === null
        ? tranAnimationEffectName(animation)
        : genAnimationCategoryLabel(
              sample.category,
              animation,
              sample.number,
              sample.tone,
          );
}
