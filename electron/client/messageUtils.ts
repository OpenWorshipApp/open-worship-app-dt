import { ipcRenderer, IpcRendererEvent } from 'electron';
import { messageChannels } from '../electronHelpers';

const messageUtils = {
    messageChannels,
    sendData(channel: string, ...args: any[]) {
        ipcRenderer.send(channel, ...args);
    },
    sendDataSync(channel: string, ...args: any[]) {
        return ipcRenderer.sendSync(channel, ...args);
    },
    listenForData(
        channel: string,
        callback: (event: IpcRendererEvent, ...args: any[]) => void,
    ) {
        ipcRenderer.on(channel, callback);
    },
    listenOnceForData(
        channel: string,
        callback: (event: IpcRendererEvent, ...args: any[]) => void,
    ) {
        ipcRenderer.once(channel, callback);
    },
};

export default messageUtils;
