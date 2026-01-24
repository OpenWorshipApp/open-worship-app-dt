import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import type DirSource from '../helper/DirSource';
import { openPopupEditorWindow } from '../helper/domHelpers';
import FileSource from '../helper/FileSource';
import { tran } from '../lang/langHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import appProvider from '../server/appProvider';
import { fsWriteFile } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

export function genNewFileNameInput(
    fieName: string,
    onChange: (newFileName: string) => void,
) {
    return (
        <input
            type="text"
            autoFocus
            className="form-control"
            defaultValue={fieName}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
    );
}

function genDefaultHtml(fileFullName: string) {
    // https://codepen.io/P1N2O/pen/pyBNzX
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileFullName}</title>
    <style>
    body {
        background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
        background-size: 400% 400%;
        animation: gradient 15s ease infinite;
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    @keyframes gradient {
        0% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }
    </style>
</head>
<body></body>
</html>`;
}

export function genBackgroundWebContextMenuItems(
    dirSource: DirSource,
): ContextMenuItemType[] {
    return [
        {
            menuElement: tran('New File'),
            onSelect: async () => {
                let fileName = '';
                const isConfirmInput = await showAppInput(
                    tran('New File Name'),
                    genNewFileNameInput(fileName, (newFileName) => {
                        fileName = newFileName;
                    }),
                    {
                        escToCancel: false,
                        enterToOk: false,
                    },
                );
                if (isConfirmInput && fileName.trim().length > 0) {
                    const fileFullName = `${fileName}.html`;
                    const existFileFullNames =
                        await dirSource.getAllFileFullNames();
                    if (existFileFullNames.includes(fileFullName)) {
                        showSimpleToast(
                            'Create New Web File',
                            'File already exists',
                        );
                        return;
                    }
                    const fileSource =
                        dirSource.getFileSourceInstance(fileFullName);
                    fsWriteFile(
                        fileSource.filePath,
                        genDefaultHtml(fileFullName),
                    );
                }
            },
        },
    ];
}

function openPopupWebEditorWindow(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    const fileFullName = fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const pathName = `${appProvider.webEditorHomePage}?file=${fileFullNameEncoded}`;
    return openPopupEditorWindow(pathName);
}

export function genBackgroundWebExtraItemContextMenuItems(filePath: string) {
    return [
        {
            menuElement: tran('Edit'),
            title: tran('Edit this web file'),
            onSelect: () => {
                openPopupWebEditorWindow(filePath);
            },
        },
    ];
}
