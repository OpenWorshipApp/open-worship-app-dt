import type ElectronAppController from './ElectronAppController';
import { isDev } from './electronHelpers';

export async function initDevtools(appController: ElectronAppController) {
    if (!isDev) {
        return;
    }
    const win = appController.mainController.win;
    win.webContents.openDevTools();
}
