import { useStateSettingBooleanSynced } from '../../helper/settingHelpers';
import { MINI_SCREEN_NO_RENDERING_SETTING_PREFIX } from '../managers/screenSettingKeyHelpers';

/**
 * The preview card's "No rendering" toggle, one per screen.
 *
 * For a machine too weak to draw every screen twice: the projected window
 * (`screen.html`) keeps drawing, and the presenter's mini preview of that
 * screen stops. Every control works as before -- the managers still hold and
 * sync what is on the screen; what goes is the picture of it in the card.
 *
 * Synced, because three components read it and two live in DIFFERENT React
 * roots: the header's toggle, the card's body (the striped "No rendering"
 * face) and `MiniScreenAppComp` inside the previewer's shadow root (which
 * unmounts the layers). Kept on disk so a low-spec machine that is restarted
 * does not come back drawing.
 */
export function useIsMiniScreenNoRendering(screenId: number) {
    return useStateSettingBooleanSynced(
        `${MINI_SCREEN_NO_RENDERING_SETTING_PREFIX}${screenId}`,
        false,
    );
}
