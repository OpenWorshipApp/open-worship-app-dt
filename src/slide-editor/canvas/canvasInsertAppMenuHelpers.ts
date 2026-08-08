import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../../lang/langHelpers';
import type CanvasController from './CanvasController';
import { canvasInsertActionList } from './canvasInsertActionHelpers';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import appProvider from '../../server/appProvider';
import { handleError } from '../../helper/errorHelpers';

const MENU_KEY = 'canvas-insert';

type CanvasInsertClickDataType = { canvasInsert?: string };

/**
 * The app's **Insert** menu — the canvas right-click actions, surfaced on the
 * native menu bar so an operator can see what a slide accepts without having to
 * discover the context menu first.
 *
 * The native menu is plain text drawn by the OS, so labels are translated here
 * rather than rendered; they follow the locale because this re-runs on mount and
 * the app reloads its windows when the language changes.
 */
function genInsertMenuItems() {
    return canvasInsertActionList.map((action) => {
        return {
            label: tran(action.label),
            clickData: { canvasInsert: action.key },
        };
    });
}

export function useCanvasInsertAppMenu(canvasController: CanvasController) {
    const canvasControllerRef = useAppCurrentRef(canvasController);
    useAppEffect(() => {
        const unregister = registerAppMenuClicked(
            (_event: any, clickData: CanvasInsertClickDataType) => {
                // Every menu click for this window lands here, including other
                // features' items and parents that carry no `clickData`.
                const actionKey = clickData?.canvasInsert;
                if (actionKey === undefined) {
                    return;
                }
                const action = canvasInsertActionList.find((item) => {
                    return item.key === actionKey;
                });
                if (action === undefined) {
                    return;
                }
                // No event: the menu bar has no pointer, so the new box is
                // centered on the slide.
                Promise.resolve(
                    action.handle(canvasControllerRef.current),
                ).catch(handleError);
            },
        );
        setAppMenuItems(MENU_KEY, { insert: genInsertMenuItems() });
        // The native menu is global and outlives this page. Withdraw the items
        // when the editor goes away, or the Insert menu keeps showing on the
        // presenter with every entry dead. A route change is a full page load,
        // which React never gets to clean up after — hence `pagehide` too.
        const withdraw = () => {
            setAppMenuItems(MENU_KEY, null);
        };
        globalThis.addEventListener('pagehide', withdraw);
        return () => {
            globalThis.removeEventListener('pagehide', withdraw);
            unregister();
            withdraw();
        };
    }, []);
}

// The native menu is drawn by the OS and therefore unreachable from CDP, so an
// automated QA run (and a developer) needs another way at the same commands.
// Same dev-only pattern as `tryDataExport` / `tryDataImport`.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).getCanvasInsertMenuItems = genInsertMenuItems;
}
