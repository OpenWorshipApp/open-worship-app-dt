/**
 * A session's own transition: one key under its Properties prefix. Here, in
 * the leaf, so the help window's look rules can name it without the
 * transition module's event handler; `foregroundTransitionHelpers` re-exports
 * it for its callers.
 */
export function genForegroundSessionTransitionSettingName(prefix: string) {
    return `${prefix}-setting-show-widget-transition`;
}

/**
 * The ONE key every Effects value of a widget is stored under (memory
 * `foreground-effects-one-setting`). `foregroundDecorationHelpers`
 * re-exports it for its callers.
 */
export function genDecorationSettingName(prefix: string) {
    return `${prefix}-setting-show-widget-decoration`;
}

/**
 * The setting keys a foreground session's Properties are stored under, with
 * no React and no styles: a Quick Text preset written from a Bible row's menu
 * needs the names and nothing of the panel that draws them.
 * `propertiesSettingHelpers` and `ForegroundCommonPropertiesSettingComp`
 * re-export these for their existing callers.
 */
export function genPropsSettingNames(prefix: string) {
    return {
        roundPercentage: `${prefix}-setting-show-widget-round-percentage`,
        widthPercentage: `${prefix}-setting-show-widget-width-percentage`,
        scale: `${prefix}-setting-show-widget-scale`,
        opacityPercentage: `${prefix}-setting-show-widget-opacity-percentage`,
        alignment: `${prefix}-setting-show-widget-alignment-data`,
        offsetX: `${prefix}-setting-show-widget-offset-x`,
        offsetY: `${prefix}-setting-show-widget-offset-y`,
        fontSize: `${prefix}-setting-show-widget-font-size`,
        roundSizePixel: `${prefix}-setting-show-widget-round-size-px`,
        blendMode: `${prefix}-setting-show-widget-blend-mode`,
        isAlwaysOnTop: `${prefix}-setting-show-widget-always-on-top`,
        zIndex: `${prefix}-setting-show-widget-z-index`,
        transitionEffect: genForegroundSessionTransitionSettingName(prefix),
        isBehind: `${prefix}-setting-show-widget-is-behind`,
    };
}

export function genCommonStyleSettingNames(prefix: string) {
    return {
        fontFamily: `${prefix}-common-font-family`,
        fontWeight: `${prefix}-common-font-weight`,
        color: `${prefix}-common-color`,
        backgroundColor: `${prefix}-common-background-color`,
        backdropFilter: `${prefix}-common-backdrop-filter`,
    };
}
