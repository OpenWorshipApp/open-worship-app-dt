import { genScreenIdMenuItems } from '../_screen/managers/screenChoosingHelpers';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';

/**
 * Pin an entry to the screens it must always reach, whatever is selected.
 *
 * Built like `chooseColorNote` — a clearing row first, then the choices, and
 * exported from the component that draws the result, the same way that one is.
 * It is a CHECKLIST rather than a pick-one, so selecting a row toggles it and
 * reopens the menu where it stood: pinning a second screen would otherwise mean
 * walking the whole context menu again. Reopening waits a macrotask because the
 * host closes the menu around `onSelect`, and it uses a synthesized event at the
 * remembered coordinates since the original one is long gone by then.
 */
export function chooseScreenIdsPreset(
    screenIds: number[],
    setScreenIds: (newScreenIds: number[]) => void,
    event: any,
) {
    event.stopPropagation();
    const { clientX, clientY } = event;
    const showMenu = (currentScreenIds: number[], menuEvent: any) => {
        const items: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('x-lg', { color: 'red' }),
                menuElement: tran('No Specific Screen'),
                disabled: currentScreenIds.length === 0,
                onSelect: () => {
                    setScreenIds([]);
                },
            },
            ...genScreenIdMenuItems(
                (screenId) => {
                    const newScreenIds = currentScreenIds.includes(screenId)
                        ? currentScreenIds.filter((id) => {
                              return id !== screenId;
                          })
                        : [...currentScreenIds, screenId].sort((a, b) => {
                              return a - b;
                          });
                    setScreenIds(newScreenIds);
                    setTimeout(() => {
                        showMenu(
                            newScreenIds,
                            createMouseEvent(clientX, clientY),
                        );
                    }, 0);
                },
                (screenId) => {
                    return currentScreenIds.includes(screenId);
                },
            ),
        ];
        showAppContextMenu(menuEvent, items);
    };
    showMenu(screenIds, event);
}

/**
 * The `Set Specific Screen` entry itself, so the three places that offer it —
 * the element row, a document's slide rows in the tree, and the same slides in
 * the floating preview — cannot drift apart in label, icon or behaviour.
 *
 * `screenIds` is the pin being edited, which for a slide is its OWN pin rather
 * than the one it inherits: the clearing row then reads as "stop overriding the
 * document" instead of "go nowhere".
 */
export function genSetSpecificScreenContextMenu(
    screenIds: number[],
    setScreenIds: (newScreenIds: number[]) => void,
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon(
                screenIds.length > 0 ? 'pin-angle-fill' : 'pin-angle',
            ),
            menuElement: tran('Set Specific Screen'),
            onSelect: (event) => {
                chooseScreenIdsPreset(screenIds, setScreenIds, event);
            },
        },
    ];
}

/**
 * The screens an entry is pinned to, shown on the row and on the floating
 * preview's element header.
 *
 * A pin changes where a click lands and is otherwise invisible — an operator
 * who cannot see it has no way to tell a pinned element from one that follows
 * the selected screens, which is exactly the confusion this could cause. Ids
 * rather than an icon alone: WHICH screen is the whole point.
 */
export default function PlaylistScreenPinComp({
    screenIds,
}: Readonly<{ screenIds: number[] }>) {
    if (screenIds.length === 0) {
        return null;
    }
    return (
        <span
            className="app-playlist-row-screen-pin"
            title={`${tran('Set Specific Screen')}: ${screenIds.join(', ')}`}
        >
            <i className="bi bi-pin-angle-fill" />
            {screenIds.map((screenId, index) => {
                return (
                    <span key={screenId}>
                        {index > 0 ? <span>,</span> : null}
                        {/* Each id in ITS OWN screen's colour, the same one
                            that screen's mini-screen badge wears — which screen
                            a line goes to is the whole point of the badge, and
                            colour says it faster than the digit. */}
                        <span style={{ color: genColorFromScreenId(screenId) }}>
                            {screenId}
                        </span>
                    </span>
                );
            })}
        </span>
    );
}
