import { attachBackgroundManager } from '../../others/AttachBackgroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import { showSimpleToast } from '../../toast/toastHelpers';

export async function applyAttachBackground(
    screenId: number,
    filePath: string,
    id: string | number,
) {
    const droppedData =
        (await attachBackgroundManager.getAttachedBackground(filePath, id)) ??
        (await attachBackgroundManager.getAttachedBackground(filePath));
    if (droppedData === null) {
        return;
    }
    const screenBackgroundManager =
        ScreenBackgroundManager.getInstance(screenId);
    if (screenBackgroundManager === null) {
        showSimpleToast(
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
        return;
    }
    screenBackgroundManager.receiveScreenDropped(droppedData);
}
