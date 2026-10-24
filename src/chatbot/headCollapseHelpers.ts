/**
 * The head of the help window -- the pickers, the hourly limit, the running
 * bill -- folded to ONE line, and opened again.
 *
 * Asked for on 2026-10-09 with a picture of that head circled: _make the area
 * collapsible_. In the window as it is usually sized the pickers wrap onto a
 * second line, and with the tab strip above them that is a fifth of the
 * window spent on four choices that are made once and then read for the rest
 * of a service.
 *
 * Two things this is NOT, and both are decisions (see `chatbot-window.md`):
 *   * it never folds by itself. The head tucked away on a scroll for one day
 *     (2026-09-10) and came out whole the next morning, because a control
 *     that has to be found again before it can be pressed is a control in the
 *     way. A fold happens when the arrow is pressed and at no other time.
 *   * folded is not hidden. The line that stays says what every picker is
 *     set to -- see `genHeadSummary` -- so "who is answering this?" is still
 *     answered at a glance, and the whole line is the button that opens it.
 *
 * Remembered for the WINDOW, not the tab: it is about how much room the
 * window has, which is the same in every tab, and a fold that undid itself
 * on the next `+` would have to be pressed again in every conversation.
 */
import { getSetting, setSetting } from '../helper/settingHelpers';

const HEAD_COLLAPSED_SETTING_NAME = 'chatbot-head-collapsed';

/** Open unless it was folded by hand: a fresh install shows every picker. */
export function getIsHeadCollapsed() {
    return getSetting(HEAD_COLLAPSED_SETTING_NAME) === 'true';
}

/** One tiny setting, written once per press. */
export function saveIsHeadCollapsed(isCollapsed: boolean) {
    setSetting(HEAD_COLLAPSED_SETTING_NAME, isCollapsed ? 'true' : 'false');
}

/**
 * What the folded line reads: each picker's own chosen words, in the order
 * the pickers stand in -- "Presenter · Claude · Sonnet 5". No captions: the
 * line has to fit a 460px window, and the values are what is being looked
 * for. A picker with nothing chosen (no provider at all has no model) leaves
 * no gap and no stray dot behind.
 */
export function genHeadSummary(parts: readonly (string | null | undefined)[]) {
    return parts
        .map((part) => {
            return (part ?? '').trim();
        })
        .filter((part) => {
            return part.length > 0;
        })
        .join(' · ');
}
