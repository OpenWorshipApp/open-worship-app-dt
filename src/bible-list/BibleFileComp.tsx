import { lazy, useState } from 'react';

import { tran } from '../lang/langHelpers';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import Bible from './Bible';
import AppSuspenseComp from '../others/AppSuspenseComp';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { moveBibleItemTo, useIsOnScreen } from './bibleHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    extractDropData,
    genRemovingAttachedBackgroundMenu,
    handleAttachBackgroundDrop,
    useAttachedBackgroundData,
} from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { stopDraggingState } from '../helper/helpers';
import type BibleItem from './BibleItem';
import AttachBackgroundIconComponent from '../others/AttachBackgroundIconComponent';

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
            menuElement: tran('Empty'),
            onSelect: () => {
                showAppConfirm(
                    'Empty Bible List',
                    'Are you sure to empty this bible list?',
                    {
                        confirmButtonLabel: 'Yes',
                    },
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
            menuElement: tran('Copy All Items'),
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
            menuElement: tran('Move All Items To'),
            onSelect: (event: any) => {
                moveBibleItemTo(event, bible);
            },
        },
        ...(isAttachedBackgroundElement
            ? genRemovingAttachedBackgroundMenu(bible.filePath)
            : []),
    ];
}

function BiblePreview({ bible }: Readonly<{ bible: Bible }>) {
    const fileSource = FileSource.getInstance(bible.filePath);
    const isOnScreen = useIsOnScreen(bible.items);
    return (
        <div className="w-100 accordion accordion-flush py-1 ms-2 pointer">
            <div
                className={`accordion-header d-flex ${isOnScreen ? 'app-on-screen' : ''}`}
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
                <div className="float-end">
                    <AttachBackgroundIconComponent filePath={bible.filePath} />
                </div>
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

export default function BibleFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const attachedBackgroundData = useAttachedBackgroundData(filePath);
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
        return <BiblePreview bible={bible as Bible} />;
    };
    const handleReloading = () => {
        setData(null);
    };
    useFileSourceEvents(['update'], handleReloading, [data], filePath);
    const handleDataDropping = (event: any) => {
        const droppedData = extractDropData(event);
        if (droppedData?.type === DragTypeEnum.BIBLE_ITEM) {
            stopDraggingState(event);
            const bibleItem = droppedData.item as BibleItem;
            if (bibleItem.filePath !== undefined) {
                data?.moveItemFrom(bibleItem.filePath, bibleItem);
            } else {
                data?.saveBibleItem(droppedData.item);
            }
        } else {
            handleAttachBackgroundDrop(event, {
                filePath,
            });
        }
    };
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
                isAttachedBackgroundElement: !!attachedBackgroundData,
            })}
            isSelected={!!data?.isOpened}
            onDrop={handleDataDropping}
        />
    );
}
