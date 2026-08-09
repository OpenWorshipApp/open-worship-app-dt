import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import type { CustomMenusDataType } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { handleError } from '../helper/errorHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { clearWidgetSizeSetting } from './flexSizeHelpers';
import {
    checkAreNamesUnique,
    getWidgetEntries,
    resetAllWidgets,
    subscribeWidgetsChanged,
    toggleWidget,
} from './widgetRegistry';

const MENU_KEY = 'view-widgets';
const WIDGETS_TITLE = 'Widgets';
const RESET_TITLE = 'Reset Widgets Size';

type WidgetClickDataType = { widgetToggle?: string; widgetReset?: boolean };

/**
 * The app's **View → Widgets** menu: one checkbox per collapsible pane, plus
 * `Reset Widgets Size`.
 *
 * It is here rather than in Settings because it is a layout command, not a
 * preference — and because a collapsed pane is otherwise only reachable by
 * finding the thin strip it left behind. The native menu is plain text drawn by
 * the OS, so labels are translated here; they follow the locale because the app
 * reloads its windows when the language changes.
 */
export function genViewMenuItems(): CustomMenusDataType['view'] {
    const entries = getWidgetEntries();
    checkAreNamesUnique(entries);
    return [
        ...(entries.length === 0
            ? []
            : [
                  {
                      label: tran(WIDGETS_TITLE),
                      submenu: entries.map((entry) => {
                          return {
                              label: entry.widgetName,
                              type: 'checkbox' as const,
                              checked: !entry.isHidden,
                              clickData: { widgetToggle: entry.id },
                          };
                      }),
                  },
              ]),
        { label: tran(RESET_TITLE), clickData: { widgetReset: true } },
    ];
}

async function handleResetting() {
    const isConfirmed = await showAppConfirm(
        tran(RESET_TITLE),
        tran('Are you sure to reset every widget size and reopen the widgets?'),
        { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
    );
    if (!isConfirmed) {
        return;
    }
    // Clear first: this wipes the keys of actors that are NOT mounted (other
    // pages, other windows, per-document panes) so they come up on defaults,
    // and the fan-out below re-seeds the mounted ones as it restores them.
    await clearWidgetSizeSetting();
    resetAllWidgets();
}

/**
 * Contributed from the MAIN window only. Popups hide their menu bar, and the
 * main process routes a menu click back to the window that last registered the
 * key — so a second registrant would take the items over and answer for widgets
 * the user is not looking at.
 */
export function initWidgetAppMenu() {
    const unregister = registerAppMenuClicked(
        (_event: any, clickData: WidgetClickDataType) => {
            // Every menu click for this window lands here, including other
            // features' items and parents that carry no `clickData`.
            if (clickData?.widgetReset) {
                handleResetting().catch(handleError);
                return;
            }
            const widgetId = clickData?.widgetToggle;
            if (widgetId === undefined) {
                return;
            }
            toggleWidget(widgetId);
        },
    );
    const rebuild = () => {
        setAppMenuItems(MENU_KEY, { view: genViewMenuItems() });
    };
    const unsubscribe = subscribeWidgetsChanged(rebuild);
    rebuild();
    // The native menu is global and outlives this page. Withdraw the items when
    // the window navigates, or the checkboxes keep showing while their clicks
    // land in a renderer that no longer listens. A route change is a full page
    // load, which React never gets to clean up after — hence `pagehide`.
    const withdraw = () => {
        setAppMenuItems(MENU_KEY, null);
    };
    globalThis.addEventListener('pagehide', withdraw);
    return () => {
        globalThis.removeEventListener('pagehide', withdraw);
        unsubscribe();
        unregister();
        withdraw();
    };
}

// The native menu is drawn by the OS and therefore unreachable from CDP, so an
// automated QA run (and a developer) needs another way at the same commands.
// Same dev-only pattern as `tryDataExport` / `getCanvasInsertMenuItems`.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).getViewWidgetMenuItems = genViewMenuItems;
    (globalThis as any).tryToggleWidget = toggleWidget;
    (globalThis as any).tryResetWidgetsSize = handleResetting;
}
