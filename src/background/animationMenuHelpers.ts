import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { parseAnimation, type AnimationType } from './animationValueHelpers';
import { genCssAnimationHtml } from './cssAnimationLayerHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';

/**
 * What Copy Code writes: a CSS animation as a whole web page that plays it
 * (a Webs-tab file can hold it, any HTML and CSS running there in a frame of
 * its own), a shader as its `mainImage` -- the code Edit Code starts from.
 */
export function genAnimationCodeText(animation: AnimationType): string {
    return animation.engine === 'css'
        ? genCssAnimationHtml(animation)
        : genGlslAnimationCode(animation);
}

/**
 * The right-click row that copies an animation's code, on a tile and on a
 * saved animation alike; none for a value that is not an animation. The
 * text is built when the row is chosen, not when the menu opens.
 */
export function genAnimationCopyCodeMenuItems(
    src: string,
): ContextMenuItemType[] {
    const animation = parseAnimation(src);
    if (animation === null) {
        return [];
    }
    const label = tran('Copy Code');
    return [
        {
            childBefore: genContextMenuItemIcon(
                animation.engine === 'css' ? 'filetype-html' : 'code-slash',
            ),
            menuElement: label,
            onSelect: () => {
                void copyToClipboard(genAnimationCodeText(animation), label);
            },
        },
    ];
}
