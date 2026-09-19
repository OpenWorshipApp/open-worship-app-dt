// A picture of the app, taken from the widget that has just been drawn on.
//
// The Presenting Control is the one thing the operator already has open OVER
// the app -- the pointer, the brush, the spotlight -- so it is where a snapshot
// belongs: circle the thing that is wrong, press the camera, ask about it. The
// picture is of the app WITH the drawing on it, which is the whole point; a
// clean screenshot of the same window says nothing about which part of it the
// question is about.
//
// Three destinations, because the same picture answers three different needs:
// hand it to the help window (ask), put it on the clipboard (tell someone), or
// save it into the images the app can PRESENT (teach). One capture, one place
// that knows how to spend it.

import { captureAppWindow } from '../helper/appCaptureHelpers';
import DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import type { SrcData } from '../helper/FileSource';
import { dirSourceSettingNames } from '../helper/constants';
import { openChatbotPage } from '../helper/domHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { getDotExtensionFromBase64Data } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

const SNAPSHOT_TITLE = 'App Snapshot';

function toBlob(dataUrl: string) {
    const [head, body] = dataUrl.split(',');
    const mimeType = /:(.*?);/.exec(head)?.[1] ?? 'image/png';
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
}

export async function takeAppSnapshot() {
    try {
        return await captureAppWindow();
    } catch (error: any) {
        showSimpleToast(tran(SNAPSHOT_TITLE), String(error?.message ?? error));
        return null;
    }
}

/**
 * Hand it to the help window and let them ask about it.
 *
 * The window is opened (or brought back -- `handlePopupWindowOpen` restores the
 * one that is already there rather than making a second) BEFORE the picture is
 * sent, and the main process holds it until that window asks for it. A window
 * still loading cannot receive a message, and "the camera did nothing" is a
 * worse bug than a picture arriving a beat late.
 */
export function sendSnapshotToChatbot(dataUrl: string) {
    openChatbotPage();
    appProvider.messageUtils.sendData('all:app:chat-attach', { dataUrl });
}

export async function copySnapshot(dataUrl: string) {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': toBlob(dataUrl) }),
        ]);
        showSimpleToast(tran(SNAPSHOT_TITLE), tran('Copied to clipboard'));
    } catch (error: any) {
        showSimpleToast(tran(SNAPSHOT_TITLE), String(error?.message ?? error));
    }
}

/**
 * Into the background images, which is the folder the app can PRESENT from --
 * so a snapshot of the app can be put on the projector, which is what makes
 * this useful for teaching someone at the front of a room.
 *
 * The whole path already exists for pasting an image into that panel; this
 * walks the same three steps rather than inventing a fourth way to write a
 * picture to disk.
 */
export async function saveSnapshotToImages(dataUrl: string) {
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.BACKGROUND_IMAGE,
    );
    if (!dirSource.dirPath) {
        showSimpleToast(
            tran(SNAPSHOT_TITLE),
            tran('No images folder is set yet'),
        );
        return;
    }
    const dotExtension = getDotExtensionFromBase64Data(dataUrl);
    if (dotExtension === null) {
        showSimpleToast(tran(SNAPSHOT_TITLE), tran('Cannot save this picture'));
        return;
    }
    const filePath = await dirSource.genRandomFilePath(dotExtension);
    if (filePath === null) {
        showSimpleToast(tran(SNAPSHOT_TITLE), tran('Cannot save this picture'));
        return;
    }
    const isSuccess = await FileSource.writeFileBase64Data(
        filePath,
        dataUrl as SrcData,
    );
    showSimpleToast(
        tran(SNAPSHOT_TITLE),
        isSuccess
            ? tran('Saved into your images')
            : tran('Cannot save this picture'),
    );
    if (isSuccess) {
        dirSource.fireReloadEvent();
    }
}
