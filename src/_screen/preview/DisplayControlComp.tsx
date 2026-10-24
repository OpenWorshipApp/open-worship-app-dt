import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { tran } from '../../lang/langHelpers';
import { getAllDisplays } from '../managers/screenHelpers';
import type ScreenManagerBase from '../managers/ScreenManagerBase';
import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';
import { isVirtualDisplayId } from '../../../electron/virtualDisplayProtocol';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { setMirrorPanelShowing } from '../../screen-mirror/mirrorConnectionHelpers';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';

// The name the OS gives a display -- often EMPTY on Windows, which left the
// button's tooltip reading `Display:, screen id:1`.
function getRawDisplayLabel(display: unknown) {
    return (display as { label?: string } | undefined)?.label?.trim() ?? '';
}

// What to call a display when the OS gives it no name. "Unknown" said
// nothing: it was what the built-in screen of every laptop read, and also
// what a screen kept on a Screen Mirror guest that is not connected read --
// the one case where pressing show cannot work.
function toDisplayLabel(
    display: unknown,
    { displayId, isPrimary }: { displayId: number; isPrimary: boolean },
) {
    const label = getRawDisplayLabel(display);
    if (label) {
        return label;
    }
    if (display === undefined) {
        if (isVirtualDisplayId(displayId)) {
            return tran('Virtual display not found');
        }
        return displayId <= MIRROR_REMOTE_DISPLAY_FIRST
            ? tran('Guest display, not connected')
            : tran('Not connected');
    }
    return isPrimary ? tran('Primary display') : tran('Unnamed display');
}

function handleDisplayChoosing(
    screenManagerBase: ScreenManagerBase,
    displayId: number,
    event: any,
) {
    const { primaryDisplay, displays } = getAllDisplays();
    const contextMenuItems: ContextMenuItemType[] = displays.map((display) => {
        const bounds = display.bounds;
        const isPrimary =
            display.id === primaryDisplay.id ||
            (display as { isPrimary?: boolean }).isPrimary === true;
        const label =
            getRawDisplayLabel(display) ||
            // "(primary)" follows on that row already.
            toDisplayLabel(display, {
                displayId: display.id,
                isPrimary: false,
            });
        const isSelected = display.id === displayId;
        const isVirtual = isVirtualDisplayId(display.id);
        const menuElement =
            (isSelected ? '*' : '') +
            (isVirtual
                ? `${label} (${tran('Virtual')}): `
                : (display as { guestId?: string }).guestId
                  ? `${label}: `
                  : `${label}(${display.id}): `) +
            `${bounds.width}x${bounds.height}` +
            (isPrimary ? ` (${tran('primary')})` : '');
        return {
            menuElement,
            onSelect: () => {
                screenManagerBase.displayId = display.id;
            },
        };
    });
    // Where virtual displays are made, from where they are chosen.
    contextMenuItems.push({
        childBefore: genContextMenuItemIcon('display'),
        menuElement: tran('Manage Virtual Displays'),
        onSelect: () => {
            setMirrorPanelShowing(true, 'virtual');
        },
    });
    showAppContextMenu(event, contextMenuItems);
}

export default function DisplayControlComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const { displayId } = screenManagerBase;
    useScreenManagerEvents(['display-id'], screenManagerBase);

    const { primaryDisplay, displays } = getAllDisplays();
    const currentDisplay = displays.find((display) => {
        return display.id === displayId;
    });
    const currentDisplayLabel = toDisplayLabel(currentDisplay, {
        displayId,
        isPrimary:
            displayId === primaryDisplay.id ||
            (currentDisplay as { isPrimary?: boolean } | undefined)
                ?.isPrimary === true,
    });
    const isMissing = currentDisplay === undefined;
    const isGuest =
        !!(currentDisplay as { guestId?: string } | undefined)?.guestId ||
        (currentDisplay !== undefined && isVirtualDisplayId(displayId));
    return (
        <button
            className="btn btn-sm btn-outline-secondary app-ellipsis app-data"
            title={
                `${tran('Display')}: ${currentDisplayLabel}, ` +
                `${tran('Screen id')}: ${screenManagerBase.screenId}, ` +
                `${tran('Display id')}: ${displayId}`
            }
            onClick={handleDisplayChoosing.bind(
                null,
                screenManagerBase,
                displayId,
            )}
            style={{ maxWidth: '80px' }}
        >
            {/* Shown before it is pressed: a screen whose display is gone
                cannot be shown, and the toggle says so only afterwards. */}
            <i
                className={
                    isMissing
                        ? 'bi bi-exclamation-triangle text-warning'
                        : 'bi bi-display'
                }
            />
            {/* The raw name: an 80px button has no room for "Unknown". */}
            {isGuest ? (
                `${currentDisplayLabel}: ${currentDisplay!.bounds.width}x${currentDisplay!.bounds.height}`
            ) : (
                <>
                    {getRawDisplayLabel(currentDisplay)}(
                    {screenManagerBase.screenId}):{displayId}
                </>
            )}
        </button>
    );
}
