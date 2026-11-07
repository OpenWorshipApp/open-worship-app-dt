import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        getAttachedBackground: vi.fn(),
        getInstance: vi.fn(),
        showSimpleToast: vi.fn(),
    };
});

vi.mock('../../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: mocks.getAttachedBackground,
    },
}));
vi.mock('./ScreenBackgroundManager', () => ({
    default: { getInstance: mocks.getInstance },
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import { applyAttachBackground } from './screenBackgroundHelpers';

const slideBackground = { type: 'background-image', item: '/a.png' };
const documentBackground = { type: 'background-color', item: '#000' };

function genBackgroundManager() {
    return { receiveScreenDropped: vi.fn() };
}

beforeEach(() => {
    mocks.getAttachedBackground.mockResolvedValue(null);
    mocks.getInstance.mockReturnValue(null);
});

describe('applyAttachBackground', () => {
    test("the slide's own attached background goes up first", async () => {
        const backgroundManager = genBackgroundManager();
        mocks.getInstance.mockReturnValue(backgroundManager);
        mocks.getAttachedBackground.mockImplementation(
            async (_filePath: string, id?: number) => {
                return id === undefined ? documentBackground : slideBackground;
            },
        );

        await applyAttachBackground(2, '/docs/a.slide', 7);

        expect(mocks.getAttachedBackground).toHaveBeenCalledTimes(1);
        expect(mocks.getAttachedBackground).toHaveBeenCalledWith(
            '/docs/a.slide',
            7,
        );
        expect(mocks.getInstance).toHaveBeenCalledWith(2);
        expect(backgroundManager.receiveScreenDropped).toHaveBeenCalledWith(
            slideBackground,
        );
    });

    test("else the document's attached background", async () => {
        const backgroundManager = genBackgroundManager();
        mocks.getInstance.mockReturnValue(backgroundManager);
        mocks.getAttachedBackground.mockImplementation(
            async (_filePath: string, id?: number) => {
                return id === undefined ? documentBackground : null;
            },
        );

        await applyAttachBackground(2, '/docs/a.slide', 7);

        expect(mocks.getAttachedBackground).toHaveBeenLastCalledWith(
            '/docs/a.slide',
        );
        expect(backgroundManager.receiveScreenDropped).toHaveBeenCalledWith(
            documentBackground,
        );
    });

    test('nothing attached leaves the background alone', async () => {
        const backgroundManager = genBackgroundManager();
        mocks.getInstance.mockReturnValue(backgroundManager);

        await applyAttachBackground(2, '/docs/a.slide', 7);

        expect(mocks.getInstance).not.toHaveBeenCalled();
        expect(backgroundManager.receiveScreenDropped).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a closed screen is reported', async () => {
        mocks.getAttachedBackground.mockResolvedValue(slideBackground);

        await applyAttachBackground(9, '/docs/a.slide', 7);

        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
    });
});
