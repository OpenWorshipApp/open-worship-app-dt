import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { tran } from '../../lang/langHelpers';
import { getAllDisplays } from '../managers/screenHelpers';
import type ScreenManagerBase from '../managers/ScreenManagerBase';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';

// The name the OS gives a display -- often EMPTY on Windows, which left the
// button's tooltip reading `Display:, screen id:1`.
function getRawDisplayLabel(display: unknown) {
    return (display as { label?: string } | undefined)?.label?.trim() ?? '';
}

function toDisplayLabel(display: unknown) {
    return getRawDisplayLabel(display) || tran('Unknown');
}

function handleDisplayChoosing(
    screenManagerBase: ScreenManagerBase,
    displayId: number,
    event: any,
) {
    const { primaryDisplay, displays } = getAllDisplays();
    const contextMenuItems: ContextMenuItemType[] = displays.map((display) => {
        const label = toDisplayLabel(display);
        const bounds = display.bounds;
        const isPrimary =
            display.id === primaryDisplay.id ||
            (display as { isPrimary?: boolean }).isPrimary === true;
        const isSelected = display.id === displayId;
        const menuElement =
            (isSelected ? '*' : '') +
            ((display as { guestId?: string }).guestId
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
    showAppContextMenu(event, contextMenuItems);
}

export default function DisplayControlComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const { displayId } = screenManagerBase;
    useScreenManagerEvents(['display-id'], screenManagerBase);

    const { displays } = getAllDisplays();
    const currentDisplay = displays.find((display) => {
        return display.id === displayId;
    });
    const currentDisplayLabel = toDisplayLabel(currentDisplay);
    const isGuest = !!(currentDisplay as { guestId?: string } | undefined)
        ?.guestId;
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
            <i className="bi bi-display" />
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
