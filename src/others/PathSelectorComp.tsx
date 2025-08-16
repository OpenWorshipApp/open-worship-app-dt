import './PathSelectorComp.scss';

import { lazy, useState } from 'react';

import DirSource from '../helper/DirSource';
import AppSuspenseComp from './AppSuspenseComp';
import { PathPreviewerComp } from './PathPreviewerComp';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { menuTitleRealFile } from '../helper/helpers';
import { copyToClipboard, showExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { goToGeneralSetting } from '../setting/settingHelpers';

const LazyPathEditorComp = lazy(() => {
    return import('./PathEditorComp');
});

function openContextMenu(dirPath: string, event: any) {
    if (!dirPath) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    const menuItems: ContextMenuItemType[] = [
        {
            menuElement: 'Copy to Clipboard',
            onSelect: () => {
                copyToClipboard(dirPath);
            },
        },
        {
            menuElement: menuTitleRealFile,
            onSelect: () => {
                showExplorer(dirPath);
            },
        },
    ];
    if (!appProvider.isPageSetting) {
        menuItems.push({
            menuElement: '`Edit Parent Path`',
            onSelect: () => {
                goToGeneralSetting();
            },
        });
    }
    showAppContextMenu(event, menuItems);
}

export default function PathSelectorComp({
    dirSource,
    addItems,
    isForceShowEditor = false,
}: Readonly<{
    dirSource: DirSource;
    prefix: string;
    addItems?: (event: any) => void;
    isForceShowEditor?: boolean;
}>) {
    const [isShowingEditor, setIsShowingEditor] = useState(false);
    const dirPath = dirSource.dirPath;
    const shouldShowingEditor =
        isForceShowEditor || !dirPath || isShowingEditor;
    return (
        <div
            className="path-selector w-100"
            onContextMenu={openContextMenu.bind(null, dirPath)}
        >
            <div
                className="d-flex path-previewer app-caught-hover-pointer"
                title={(shouldShowingEditor ? 'Hide' : 'Show') + ' path editor'}
                onClick={() => {
                    setIsShowingEditor(!isShowingEditor);
                }}
            >
                <i
                    className={`bi ${
                        shouldShowingEditor
                            ? 'bi-chevron-down'
                            : 'bi-chevron-right'
                    }`}
                />
                {!shouldShowingEditor && (
                    <RenderPathTitleComp
                        dirSource={dirSource}
                        addItems={addItems}
                    />
                )}
            </div>
            {shouldShowingEditor && (
                <AppSuspenseComp>
                    <LazyPathEditorComp dirSource={dirSource} />
                </AppSuspenseComp>
            )}
        </div>
    );
}

function RenderPathTitleComp({
    dirSource,
    addItems,
}: Readonly<{
    dirSource: DirSource;
    addItems?: (event:any) => void;
}>) {
    if (!dirSource.dirPath) {
        return null;
    }
    return (
        <>
            <PathPreviewerComp dirPath={dirSource.dirPath} />
            <div
                className="ps-2"
                title="Reload"
                onClick={(event) => {
                    event.stopPropagation();
                    dirSource.fireReloadEvent();
                }}
            >
                <i className="bi bi-arrow-clockwise" />
            </div>
            {addItems !== undefined ? (
                <div
                    className="app-add-items-button px-1"
                    title="Add items"
                    onClick={(event) => {
                        event.stopPropagation();
                        addItems(event);
                    }}
                >
                    <i className="bi bi-plus-lg" />
                </div>
            ) : null}
        </>
    );
}
