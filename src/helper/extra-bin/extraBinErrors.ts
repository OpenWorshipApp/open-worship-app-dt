/**
 * A leaf module on purpose: the media download path imports this statically to
 * recognise the "pack not installed" rejection, while the helpers that raise it
 * stay behind a dynamic import (they pull in the storage helpers and the confirm
 * dialog, neither of which belongs on the launch path).
 */
export const EXTRA_BIN_MISSING_ERROR_MESSAGE = 'extra-bin is not installed';

/**
 * The user already answered a dialog about this, so the generic
 * "download failed" toast on top of it would be noise.
 */
export function checkIsExtraBinMissingError(error: any) {
    return `${error?.message ?? ''}`.includes(EXTRA_BIN_MISSING_ERROR_MESSAGE);
}
