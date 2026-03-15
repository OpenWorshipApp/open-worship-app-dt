import { lazy, useCallback, useState } from 'react';

import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { AppDocumentSourceAbs } from '../../helper/AppEditableDocumentSourceAbs';
import { useAppEffectAsync } from '../../helper/debuggerHelpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    useAttachedBackgroundData,
    extractDropData,
    handleAttachBackgroundDrop,
} from '../../helper/dragHelpers';
import { DragTypeEnum } from '../../helper/DragInf';
import FileSource from '../../helper/FileSource';
import { stopDraggingState } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import AttachBackgroundIconComponent from '../../others/AttachBackgroundIconComponent';
import FileItemHandlerComp from '../../others/FileItemHandlerComp';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { copyToClipboard } from '../../server/appHelpers';
import Note from './Note';
import NoteItem from './NoteItem';
import { moveNoteItemTo } from './noteHelpers';

const LazyRenderNoteItemsComp = lazy(() => {
    return import('./RenderNoteItemsComp');
});

function genContextMenu(
    note: Note | null | undefined,
    {
        isAttachedBackgroundElement,
    }: Readonly<{
        isAttachedBackgroundElement: boolean;
    }>,
) {
    if (!note) {
        return [];
    }
    const hasItems = !!note?.items.length;
    const contextMenus: ContextMenuItemType[] = [
        ...(hasItems
            ? [
                  {
                      menuElement: tran('Empty'),
                      onSelect: () => {
                          showAppConfirm(
                              tran('Empty Note List'),
                              tran('Are you sure to empty this note list?'),
                              {
                                  confirmButtonLabel: 'Yes',
                              },
                          ).then((isOk) => {
                              if (!isOk) {
                                  return;
                              }
                              note.empty();
                              note.save();
                          });
                      },
                  },
                  {
                      menuElement: tran('Copy All Items'),
                      onSelect: async () => {
                          const contentList = note.items.map((item) => {
                              return item.content;
                          });
                          copyToClipboard(contentList.join('\n\n'));
                      },
                  },
                  {
                      menuElement: tran('Move All Items To'),
                      onSelect: (event: any) => {
                          moveNoteItemTo(event, note);
                      },
                  },
              ]
            : []),
        {
            menuElement: tran('New Note Item'),
            onSelect: () => {
                const newId = note.maxItemId + 1;
                const noteItemJsonData = NoteItem.genNewJsonData();
                noteItemJsonData.metadata.id = newId;
                const newNoteItem = new NoteItem(noteItemJsonData);
                note.addAndSaveNoteItem(newNoteItem);
            },
        },
        ...(isAttachedBackgroundElement
            ? genRemovingAttachedBackgroundMenu(note.filePath)
            : []),
    ];
    return contextMenus;
}

function NotePreview({ note }: Readonly<{ note: Note }>) {
    const fileSource = FileSource.getInstance(note.filePath);
    const handleToggleOpened = useCallback(() => {
        note.setIsOpened(!note.isOpened);
    }, [note]);
    return (
        <div className="w-100 accordion accordion-flush py-1 ms-2">
            <div
                className={'accordion-header d-flex app-caught-hover-pointer'}
                onClick={handleToggleOpened}
            >
                <div className="flex-fill">
                    <i
                        className={`bi ${
                            note.isOpened
                                ? 'bi-chevron-down'
                                : 'bi-chevron-right'
                        }`}
                    />
                    <span className="w-100 text-center">
                        <i
                            className={`bi bi-book${
                                note.isOpened ? '-fill' : ''
                            } px-1`}
                        />
                        {fileSource.name}
                    </span>
                </div>
                <div className="float-end">
                    <AttachBackgroundIconComponent filePath={note.filePath} />
                </div>
            </div>
            <div
                className={`accordion-collapse collapse ${
                    note.isOpened ? 'show' : ''
                }`}
                style={{
                    overflow: 'auto',
                }}
            >
                {note.isOpened && (
                    <div className="accordion-body p-0">
                        <AppSuspenseComp>
                            <LazyRenderNoteItemsComp note={note} />
                        </AppSuspenseComp>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function NoteFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const attachedBackgroundData = useAttachedBackgroundData(filePath);
    const [note, setNote] = useState<Note | null | undefined>(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            if (note !== undefined) {
                return;
            }
            const newNote = await Note.fromFilePath(filePath);
            methodContext.setData(newNote);
        },
        [note],
        { setData: setNote },
    );
    const handlerChildRendering = useCallback((note: AppDocumentSourceAbs) => {
        return <NotePreview note={note as Note} />;
    }, []);
    const handleReloading = useCallback(() => {
        setNote(undefined);
    }, []);
    useFileSourceEvents(
        ['update'],
        async () => {
            const newNote = await Note.fromFilePath(filePath);
            setNote(newNote);
        },
        [note],
        filePath,
    );
    const handleDataDropping = useCallback(
        (event: any) => {
            const droppedData = extractDropData(event);
            if (droppedData?.type === DragTypeEnum.NOTE_ITEM) {
                stopDraggingState(event);
                const noteItem = droppedData.item as NoteItem;
                if (noteItem.filePath === undefined) {
                    note?.addAndSaveNoteItem(droppedData.item);
                } else {
                    note?.moveItemFrom(noteItem.filePath, noteItem);
                }
            } else {
                handleAttachBackgroundDrop(event, {
                    filePath,
                });
            }
        },
        [note, filePath],
    );
    return (
        <FileItemHandlerComp
            index={index}
            fileData={note}
            reload={handleReloading}
            filePath={filePath}
            className="note-file"
            renderChild={handlerChildRendering}
            isDisabledColorNote
            userClassName={`p-0 ${note?.isOpened ? 'flex-fill' : ''}`}
            contextMenuItems={genContextMenu(note, {
                isAttachedBackgroundElement: !!attachedBackgroundData,
            })}
            isSelected={!!note?.isOpened}
            onDrop={handleDataDropping}
        />
    );
}
