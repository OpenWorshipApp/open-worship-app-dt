import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import './PathSelectorComp.scss';

import type { ReactNode } from 'react';
import { lazy, useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import AppSuspenseComp from './AppSuspenseComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { openGeneralSetting } from '../setting/settingHelpers';
import RenderPathTitleComp from './RenderPathTitleComp';
import { useAppCurrentRef } from '../helper/appHooks';

const LazyPathEditorComp = lazy(() => {
    return import('./PathEditorComp');
});

function openContextMenu(dirSource: DirSource, event: any) {
    const dirPath = dirSource.dirPath;
    if (!dirPath) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    const menuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('clipboard'),
            menuElement: tran('Copy to Clipboard'),
            onSelect: () => {
                copyToClipboard(dirPath);
            },
        },
        {
            childBefore: genContextMenuItemIcon('folder2-open'),
            menuElement: getMenuTitleRevealFile(),
            onSelect: () => {
                showFileOrDirExplorer(dirPath);
            },
        },
    ];
    if (!appProvider.isPageSetting) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('pencil-square'),
            menuElement: tran('Edit Parent Path'),
            onSelect: () => {
                openGeneralSetting();
            },
        });
    }
    menuItems.push({
        childBefore: genContextMenuItemIcon('folder-x', {
            color: 'var(--bs-danger)',
        }),
        menuElement: tran('Unset Directory Path'),
        onSelect: () => {
            dirSource.dirPath = '';
        },
    });
    showAppContextMenu(event, menuItems);
}

export default function PathSelectorComp({
    dirSource,
    isForceShowEditor = false,
    placeholder = '',
    extraElements,
}: Readonly<{
    dirSource: DirSource;
    prefix: string;
    isForceShowEditor?: boolean;
    placeholder?: string;
    extraElements?: ReactNode;
}>) {
    const [isShowingEditor, setIsShowingEditor] = useState(false);
    const dirPath = dirSource.dirPath;
    const shouldShowingEditor =
        isForceShowEditor || !dirPath || isShowingEditor;
    const isShowingEditorRef = useAppCurrentRef(isShowingEditor);
    const handleToggleEditor = useCallback(() => {
        setIsShowingEditor(!isShowingEditorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="path-selector w-100"
            onContextMenu={openContextMenu.bind(null, dirSource)}
        >
            <div
                className="d-flex path-previewer app-caught-hover-pointer"
                title={(shouldShowingEditor ? 'Hide' : 'Show') + ' path editor'}
                onClick={handleToggleEditor}
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
                        extraElements={extraElements}
                    />
                )}
                {/* No handler: the selector around this row owns the menu. */}
                <ContextMenuDotsButtonComp />
            </div>
            {shouldShowingEditor && (
                <AppSuspenseComp>
                    <LazyPathEditorComp
                        dirSource={dirSource}
                        placeholder={placeholder}
                    />
                </AppSuspenseComp>
            )}
        </div>
    );
}
