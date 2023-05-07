import ElectronAppController from './ElectronAppController';
import {
    initApp, initPresent,
} from './electronEventListener';
import { initMenu } from './electronMenu';
import { initDevtools } from './devtools';

const electron = require('electron');

electron.app.whenReady().then(() => {
    const appController = ElectronAppController.getInstance();
    initApp(appController);
    initPresent(appController);
    initMenu(appController);
    initDevtools(appController);
});
