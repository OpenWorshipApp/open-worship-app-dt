import { beforeEach, describe, expect, test, vi } from 'vitest';

const { showSimpleToastMock } = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../event/ToastEventListener', () => ({
    default: {
        showSimpleToast: showSimpleToastMock,
    },
}));

import { showSimpleToast } from './toastHelpers';

describe('toastHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('forwards simple toast payloads to the event listener', () => {
        showSimpleToast('Saved', 'The file was saved');

        expect(showSimpleToastMock).toHaveBeenCalledWith({
            title: 'Saved',
            message: 'The file was saved',
        });
    });
});
