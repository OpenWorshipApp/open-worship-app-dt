import React, { lazy, useState } from 'react';

import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import Bible from './Bible';
import AppSuspenseComp from '../others/AppSuspenseComp';
import AppDocumentSourceAbs from '../helper/DocumentSourceAbs';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { moveBibleItemTo } from './bibleHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    onDropHandling,
} from '../helper/dragHelpers';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import { useAttachedBackgroundElement } from './BibleItemRenderComp';

const LazyRenderBibleItemsComp = lazy(() => {
    return import('./RenderBibleItemsComp');
});

function genContextMenu(
    bible: Bible | null | undefined,
    {
        isAttachedBackgroundElement,
    }: Readonly<{
        isAttachedBackgroundElement: boolean;
    }>,
): ContextMenuItemType[] {
    if (!bible) {
        return [];
    }
    return [
        {
            menuElement: '`' + 'Empty',
            onSelect: () => {
                showAppConfirm(
                    'Empty Bible List',
                    'Are you sure to empty this bible list?',
                ).then((isOk) => {
                    if (!isOk) {
                        return;
                    }
                    bible.empty();
                    bible.save();
                });
            },
        },
        {
            menuElement: '`' + 'Copy All Items',
            onSelect: async () => {
                const promises = bible.items.map((item) => {
                    return item.toTitleText();
                });
                const renderedItems = await Promise.all(promises);
                const text = renderedItems.map(({ title, text }) => {
                    return `${title}\n${text}`;
                });
                copyToClipboard(text.join('\n\n'));
            },
        },
        {
            menuElement: '`' + 'Move All Items To',
            onSelect: (event: any) => {
                moveBibleItemTo(event, bible);
            },
        },
        ...(isAttachedBackgroundElement
            ? genRemovingAttachedBackgroundMenu(bible.filePath)
            : []),
    ];
}

export default function BibleFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const attachedBackgroundElement = useAttachedBackgroundElement(filePath);
    const [data, setData] = useState<Bible | null | undefined>(null);
    useAppEffectAsync(
        async (methodContext) => {
            if (data === null) {
                const bible = await Bible.fromFilePath(filePath);
                methodContext.setData(bible);
            }
        },
        [data],
        { setData },
    );
    const handlerChildRendering = (bible: AppDocumentSourceAbs) => {
        return (
            <BiblePreview
                bible={bible as Bible}
                attachedBackgroundElement={attachedBackgroundElement}
            />
        );
    };
    const handleReloading = () => {
        setData(null);
    };
    useFileSourceEvents(['update'], handleReloading, [data], filePath);
    return (
        <FileItemHandlerComp
            index={index}
            data={data}
            reload={handleReloading}
            filePath={filePath}
            className="bible-file"
            renderChild={handlerChildRendering}
            isDisabledColorNote
            userClassName={`p-0 ${data?.isOpened ? 'flex-fill' : ''}`}
            contextMenuItems={genContextMenu(data, {
                isAttachedBackgroundElement: !!attachedBackgroundElement,
            })}
            isSelected={!!data?.isOpened}
            onDrop={(event) => {
                onDropHandling(event, {
                    filePath,
                });
            }}
            onTrashed={() => {
                attachBackgroundManager.deleteMetaDataFile(filePath);
            }}
        />
    );
}

function BiblePreview({
    bible,
    attachedBackgroundElement,
}: Readonly<{ bible: Bible; attachedBackgroundElement: React.ReactNode }>) {
    const fileSource = FileSource.getInstance(bible.filePath);
    return (
        <div className="accordion accordion-flush py-1">
            <div
                className="accordion-header app- d-flex"
                onClick={() => {
                    bible.setIsOpened(!bible.isOpened);
                }}
            >
                <div className="flex-fill">
                    <i
                        className={`bi ${
                            bible.isOpened
                                ? 'bi-chevron-down'
                                : 'bi-chevron-right'
                        }`}
                    />
                    <span className="w-100 text-center">
                        <i
                            className={`bi bi-book${
                                bible.isOpened ? '-fill' : ''
                            } px-1`}
                        />
                        {fileSource.name}
                    </span>
                </div>
                {attachedBackgroundElement}
            </div>
            <div
                className={`accordion-collapse collapse ${
                    bible.isOpened ? 'show' : ''
                }`}
                style={{
                    overflow: 'auto',
                }}
            >
                {bible.isOpened && (
                    <div className="accordion-body p-0">
                        <AppSuspenseComp>
                            <LazyRenderBibleItemsComp bible={bible} />
                        </AppSuspenseComp>
                    </div>
                )}
            </div>
        </div>
    );
}
