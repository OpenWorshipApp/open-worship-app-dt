import { useState } from 'react';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import DirSource from '../helper/DirSource';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import { readTextFromClipboard } from '../server/appHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

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
    return (
        <div className="w-100 h-100">
            <div className="input-group" title={invalidMessage}>
                <div className="input-group-text">{title}</div>
                <input
                    className={
                        'form-control' + (invalidMessage ? ' is-invalid' : '')
                    }
                    type="text"
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        onChange(e.target.value);
                    }}
                />
            </div>
        </div>
    );
}

export async function genContextMenuItems(
    { title, subTitle }: { title: string; subTitle: string },
    dirSource: DirSource,
    download: (url: string) => Promise<void>,
) {
    if (dirSource.dirPath === '') {
        return [];
    }
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: '`Download From URL',
            onSelect: async () => {
                let url = '';
                const clipboardText = await readTextFromClipboard();
                if (
                    clipboardText !== null &&
                    clipboardText.trim().startsWith('http')
                ) {
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
                    return;
                }
                if (!url.trim().startsWith('http')) {
                    showSimpleToast('`Download From URL', 'Invalid URL');
                    return;
                }
                await download(url);
            },
        },
    ];
    return contextMenuItems;
}
