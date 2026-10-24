import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./protocolHelpers', () => {
    return {
        getRootUrl: () => 'https://localhost:3000',
    };
});

import { initDisplayMediaHandler } from './displayMediaHelpers';
import { electronMockState } from './testElectronModule';
import {
    markVirtualDisplayHost,
    setVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';

function getHandler() {
    initDisplayMediaHandler();
    const { setDisplayMediaRequestHandler } =
        electronMockState.session.defaultSession;
    return setDisplayMediaRequestHandler.mock.calls[0][0] as (
        request: any,
        callback: (streams: any) => void,
    ) => void;
}

describe('displayMediaHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
    });

    test('answers an app frame with a self capture of that frame', () => {
        const handler = getHandler();
        const frame = { name: 'frame' };
        const callback = vi.fn();

        handler(
            {
                frame,
                securityOrigin: 'https://localhost:3000/presenter.html',
                videoRequested: true,
                audioRequested: true,
            },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({
            video: frame,
            audio: frame,
            enableLocalEcho: true,
        });
    });

    test('leaves out the track that was not asked for', () => {
        const handler = getHandler();
        const frame = { name: 'frame' };
        const callback = vi.fn();

        handler(
            {
                frame,
                securityOrigin: 'https://localhost:3000/experiment.html',
                videoRequested: true,
                audioRequested: false,
            },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({
            video: frame,
            audio: undefined,
            enableLocalEcho: true,
        });
    });

    test('a virtual display compositor records itself without an echo', () => {
        const handler = getHandler();
        const host = { id: 7001, once: vi.fn() } as any;
        markVirtualDisplayHost(host);
        electronMockState.webContentsModule.fromFrame.mockReturnValue(host);
        const frame = { name: 'compositor' };
        const callback = vi.fn();

        handler(
            {
                frame,
                securityOrigin: 'https://localhost:3000/virtual-display.html',
                videoRequested: true,
                audioRequested: false,
            },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({
            video: frame,
            audio: undefined,
            enableLocalEcho: false,
        });
    });

    test('a screen named first is the audio of the next audio request only', () => {
        const handler = getHandler();
        const host = { id: 7002, once: vi.fn() } as any;
        markVirtualDisplayHost(host);
        electronMockState.webContentsModule.fromFrame.mockReturnValue(host);
        const frame = { name: 'compositor' };
        const guestFrame = { name: 'screen 0' };
        setVirtualDisplayAudioTarget(host, guestFrame as any);
        const callback = vi.fn();
        const request = {
            frame,
            securityOrigin: 'https://localhost:3000/virtual-display.html',
            videoRequested: true,
        };

        // A picture-only request leaves the named screen for the audio one.
        handler({ ...request, audioRequested: false }, callback);
        handler({ ...request, audioRequested: true }, callback);
        handler({ ...request, audioRequested: true }, callback);

        expect(callback).toHaveBeenNthCalledWith(1, {
            video: frame,
            audio: undefined,
            enableLocalEcho: false,
        });
        expect(callback).toHaveBeenNthCalledWith(2, {
            video: frame,
            audio: guestFrame,
            enableLocalEcho: false,
        });
        expect(callback).toHaveBeenNthCalledWith(3, {
            video: frame,
            audio: undefined,
            enableLocalEcho: false,
        });
    });

    test('denies a foreign origin and a dead frame', () => {
        const handler = getHandler();
        const callback = vi.fn();

        handler(
            {
                frame: { name: 'frame' },
                securityOrigin: 'https://www.youtube.com',
                videoRequested: true,
                audioRequested: false,
            },
            callback,
        );
        handler(
            {
                frame: null,
                securityOrigin: 'https://localhost:3000/presenter.html',
                videoRequested: true,
                audioRequested: false,
            },
            callback,
        );

        expect(callback).toHaveBeenNthCalledWith(1, {});
        expect(callback).toHaveBeenNthCalledWith(2, {});
    });
});
