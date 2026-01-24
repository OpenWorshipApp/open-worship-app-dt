import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import type ScreenManagerBase from '../managers/ScreenManagerBase';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { getAllDisplays } from '../screenHelpers';

function handleDisplayChoosing(
    screenManagerBase: ScreenManagerBase,
    displayId: number,
    event: any,
) {
    const { primaryDisplay, displays } = getAllDisplays();
    const contextMenuItems: ContextMenuItemType[] = displays.map((display) => {
        const label = (display as any).label ?? 'Unknown';
        const bounds = display.bounds;
        const isPrimary = display.id === primaryDisplay.id;
        const isSelected = display.id === displayId;
        const menuElement =
            (isSelected ? '*' : '') +
            `${label}(${display.id}): ` +
            `${bounds.width}x${bounds.height}` +
            (isPrimary ? ' (primary)' : '');
        return {
            menuElement,
            onSelect: () => {
                screenManagerBase.displayId = display.id;
            },
        };
    });
    showAppContextMenu(event, contextMenuItems);
}

export default function DisplayControl() {
    const screenManagerBase = useScreenManagerBaseContext();
    const { displayId } = screenManagerBase;
    useScreenManagerEvents(['display-id'], screenManagerBase);

    const { displays } = getAllDisplays();
    const currentDisplay = displays.find((display) => {
        return display.id === displayId;
    });
    const currentDisplayLabel = currentDisplay
        ? (currentDisplay as any).label
        : 'Unknown';
    return (
        <button
            className="btn btn-sm btn-outline-secondary app-ellipsis"
            title={
                `Display:${currentDisplayLabel}, ` +
                `screen id:${screenManagerBase.screenId}` +
                `, display id:${displayId}`
            }
            onClick={handleDisplayChoosing.bind(
                null,
                screenManagerBase,
                displayId,
            )}
            style={{ maxWidth: '80px' }}
        >
            <i className="bi bi-display" />
            {currentDisplayLabel}({screenManagerBase.screenId}):{displayId}
        </button>
    );
}
