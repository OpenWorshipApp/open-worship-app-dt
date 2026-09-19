import { beforeEach, describe, expect, test, vi } from 'vitest';

const { handleErrorMock } = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appUtils: {
            handleError: handleErrorMock,
        },
    },
}));

import { handleError } from './errorHelpers';

describe('errorHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('forwards errors to appProvider.appUtils.handleError', () => {
        const error = new Error('boom');

        handleError(error);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });
});
