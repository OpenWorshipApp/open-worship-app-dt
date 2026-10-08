import type { WebContents } from 'electron';
import WebSocket from 'ws';

import { messageChannels } from './electronHelpers';
import {
    removeVirtualScreenOutput,
    setVirtualScreenOutput,
    type ScreenOutputType,
} from './screenOutputRegistry';
import {
    readScreenMessageCameras,
    type ScreenCameraType,
} from './virtualDisplayProtocol';

// A viewer this far behind on its socket is not watching live any more.
const MAX_SOCKET_BACKLOG = 4 * 1024 * 1024;

// A screen shown on a virtual display. It has pages only while somebody is
// watching that display:
//  - a `<webview>` guest in the display's compositor, while an MP4 player is
//    watching (the compositor records itself);
//  - a page in each watching browser, which draws the screen itself from the
//    same messages, carried over a WebSocket.
// With nobody watching there is neither; the presenter treats the screen as
// showing and what it sends goes nowhere. A page is handed the current state
// when it loads.
export default class VirtualScreenController implements ScreenOutputType {
    guest: WebContents | null = null;
    readonly sockets = new Set<WebSocket>();
    isMoving = false;
    // Shown later sits on top, as a window opened later does on a monitor.
    order = 0;
    private isClosed = false;
    private closedListeners: (() => void)[] = [];
    // The cameras on this screen now, per layer: the only ones a browser
    // watching it may ask this computer to stream.
    private cameras: Record<'foreground' | 'background', ScreenCameraType[]> = {
        foreground: [],
        background: [],
    };

    constructor(
        readonly screenId: number,
        public displayNumber: number,
        private readonly onDetach: (
            controller: VirtualScreenController,
        ) => void,
    ) {
        setVirtualScreenOutput(screenId, this);
    }

    get isLive() {
        return this.guest !== null && !this.guest.isDestroyed();
    }

    // One serialisation for every browser watching.
    private sendToSockets(packet: unknown) {
        if (this.sockets.size === 0) {
            return;
        }
        const text = JSON.stringify(packet);
        for (const socket of this.sockets) {
            if (socket.readyState !== WebSocket.OPEN) {
                continue;
            }
            if (socket.bufferedAmount > MAX_SOCKET_BACKLOG) {
                socket.close(1013, 'Too slow');
                continue;
            }
            socket.send(text);
        }
    }

    sendData(channel: string, data: any) {
        if (this.isLive) {
            this.guest!.send(channel, data);
        }
        if (channel === 'mirror:context') {
            this.sendToSockets({ type: 'context-update', data });
        }
    }

    // What a message (or the state a page loads with) puts on the screen.
    noteCameras(messages: { type?: unknown; data?: any }[]) {
        let isChanged = false;
        for (const message of messages) {
            const read = readScreenMessageCameras(message);
            if (
                read !== null &&
                JSON.stringify(read.cameras) !==
                    JSON.stringify(this.cameras[read.layer])
            ) {
                this.cameras[read.layer] = read.cameras;
                isChanged = true;
            }
        }
        if (isChanged) {
            for (const listener of this.camerasChangedListeners) {
                listener();
            }
        }
    }
    readonly camerasChangedListeners = new Set<() => void>();

    checkIsCameraShown(cameraId: string) {
        return [...this.cameras.foreground, ...this.cameras.background].some(
            (camera) => camera.id === cameraId,
        );
    }

    sendMessage(type: string, data: any) {
        const message = { screenId: this.screenId, type, data };
        this.noteCameras([message]);
        if (this.isLive) {
            this.guest!.send(messageChannels.screenMessage, message);
        }
        this.sendToSockets({ type: 'message', message });
    }

    onClosed(listener: () => void) {
        this.closedListeners.push(listener);
    }

    close() {
        if (this.isClosed) {
            return;
        }
        this.isClosed = true;
        removeVirtualScreenOutput(this.screenId, this);
        this.onDetach(this);
        this.guest = null;
        for (const socket of this.sockets) {
            socket.close(1000, 'Screen hidden');
        }
        this.sockets.clear();
        for (const listener of this.closedListeners.splice(0)) {
            listener();
        }
    }

    capture() {
        return this.isLive ? this.guest!.capturePage() : null;
    }
}
