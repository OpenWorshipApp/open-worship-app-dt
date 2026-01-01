import './PathSelectorComp.scss';

import { lazy, useState } from 'react';

import DirSource from '../helper/DirSource';
import AppSuspenseComp from './AppSuspenseComp';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { menuTitleRevealFile } from '../helper/helpers';
import { copyToClipboard, showExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { openGeneralSetting } from '../setting/settingHelpers';
import RenderPathTitleComp from './RenderPathTitleComp';

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
            menuElement: menuTitleRevealFile,
            onSelect: () => {
                showExplorer(dirPath);
            },
        },
    ];
    if (!appProvider.isPageSetting) {
        menuItems.push({
            menuElement: '`Edit Parent Path`',
            onSelect: () => {
                openGeneralSetting();
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
