import { type ChangeEvent, useCallback, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import type DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import { readTextFromClipboard } from '../server/appHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import appProvider from '../server/appProvider';
import {
    type MessageCallbackType,
    writeStreamToFile,
} from '../helper/bible-helpers/downloadHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { showProgressBarMessage } from '../progress-bar/progressBarHelpers';

function InputUrlComp({
    defaultUrl,
    onChange,
    title,
}: Readonly<{
    defaultUrl: string;
    onChange: (newUrl: string) => void;
    title: string;
}>) {
    const [url, setUrl] = useState(defaultUrl);
    const invalidMessage = url.trim() === '' ? 'Cannot be empty' : '';
    const handleUrlChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setUrl(e.target.value);
            onChange(e.target.value);
        },
        [onChange],
    );
    return (
        <div className="w-100 h-100">
            <div className="input-group" title={invalidMessage}>
                <div className="input-group-text">{title}</div>
                <input
                    className={
                        'form-control form-control-sm' +
                        (invalidMessage ? ' is-invalid' : '')
                    }
                    type="text"
                    value={url}
                    onChange={handleUrlChange}
                />
            </div>
        </div>
    );
}

export async function askForURL(title: string, subTitle: string) {
    let url = '';
    const clipboardText = await readTextFromClipboard();
    if (clipboardText?.trim().startsWith('http')) {
        url = clipboardText.trim();
    }
    const isConfirmInput = await showAppInput(
        title,
        <InputUrlComp
            defaultUrl={url}
            onChange={(newUrl) => {
                url = newUrl;
            }}
            title={subTitle}
        />,
    );
    if (!isConfirmInput) {
        return null;
    }
    if (!url.trim().startsWith('http')) {
        showSimpleToast(tran('Download From URL'), 'Invalid URL');
        return null;
    }
    return url;
}

export function getOpenSharedLinkMenuItem(
    sharedKey: string,
): ContextMenuItemType {
    const sharedLink = `${appProvider.appInfo.homepage}/shared#${sharedKey}`;
    return {
        menuElement: tran('Open Shared Link'),
        title: sharedLink,
        onSelect: async () => {
            appProvider.browserUtils.openExternalURL(sharedLink);
        },
    };
}

export async function genDownloadContextMenuItems(
    { title, subTitle }: { title: string; subTitle: string },
    dirSource: DirSource,
    download: (url: string) => Promise<void>,
    sharedKey?: string,
) {
    if (dirSource.dirPath === '') {
        return [];
    }
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: tran('Download From URL'),
            onSelect: async () => {
                const url = await askForURL(title, subTitle);
                if (url === null) {
                    return;
                }
                await download(url);
            },
        },
        ...(sharedKey ? [getOpenSharedLinkMenuItem(sharedKey)] : []),
    ];
    return contextMenuItems;
}

const attemptTimeout = genTimeoutAttempt(3000);
let attemptCount = 0;
function blockUnload(event: BeforeUnloadEvent) {
    attemptTimeout(() => {
        attemptCount = 0;
    });
    attemptCount++;
    if (attemptCount > 3) {
        window.removeEventListener('beforeunload', blockUnload);
        return;
    }
    event.preventDefault();
    showSimpleToast(
        tran('Downloading in progress'),
        tran("Can't leave the page while downloading.") +
            ' ' +
            tran('Please wait until the download is complete.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

export function streamDownloadFile(
    filePath: string,
    response: any,
    messageCallback: MessageCallbackType,
) {
    return new Promise<void>((resolve, reject) => {
        writeStreamToFile(
            filePath,
            {
                onStart: (total) => {
                    globalThis.addEventListener('beforeunload', blockUnload);
                    const fileSize = Number.parseInt(total.toFixed(2));
                    messageCallback(
                        `Start downloading (File size: ${fileSize}MB)...`,
                    );
                },
                onProgress: (progress) => {
                    messageCallback(`${(progress * 100).toFixed(2)}% done`);
                },
                onDone: (error) => {
                    globalThis.removeEventListener('beforeunload', blockUnload);
                    if (error) {
                        showSimpleToast('Download Error', `Error: ${error}`);
                        reject(error);
                        return;
                    }
                    showSimpleToast(
                        'Download Completed',
                        `File saved at: ${filePath}`,
                    );
                    resolve();
                },
            },
            response,
        );
    });
}

export function messageCallback(message: string | null) {
    showProgressBarMessage(message ?? '');
}
