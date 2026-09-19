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
