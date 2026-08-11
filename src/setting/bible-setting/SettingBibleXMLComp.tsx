import { useCallback } from 'react';
import type { DragEvent } from 'react';

import { useAppCurrentRef } from '../../helper/appHooks';
import { getAppFilePathFromFile } from '../../helper/localFileHelpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { getFileFullName } from '../../server/fileHelpers';
import BibleXMLArchiveComp from './BibleXMLArchiveComp';
import { checkIsBibleXMLArchiveFileFullName } from './bibleXMLArchiveHelpers';
import { handleBibleXMLImporting } from './bibleXMLArchiveMenuHelpers';
import { useBibleXMLKeys } from './bibleXMLHelpers';
import BibleXMLImportComp from './BibleXMLImportComp';
import BibleXMLListComp from './BibleXMLListComp';

const DIMMED_OPACITY = '0.5';

/**
 * Whether the drag carries files at all. The `length > 0` is not redundant:
 * `.every()` on an empty `dataTransfer.items` is vacuously true, so without it
 * a drag of pure text would light the section up as an accepted drop.
 */
function checkIsDraggingFiles(event: DragEvent) {
    const items = Array.from(event.dataTransfer.items);
    return (
        items.length > 0 &&
        items.every((item) => {
            return item.kind === 'file';
        })
    );
}

// Written against `currentTarget` rather than through `changeDragEventStyle`,
// which writes `event.target`: a drop onto one of the children below would then
// dim that child and leave it dimmed forever, because `dragleave` does not fire
// on a drop.
function setDimming(event: DragEvent, opacity: string) {
    (event.currentTarget as HTMLElement).style.opacity = opacity;
}

export default function SettingBibleXMLComp() {
    const { bibleKeysMap, isPending, loadBibleKeys } = useBibleXMLKeys();
    const handleDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        if (checkIsDraggingFiles(event)) {
            setDimming(event, DIMMED_OPACITY);
        }
    }, []);
    const handleDragLeave = useCallback((event: DragEvent) => {
        event.preventDefault();
        setDimming(event, '1');
    }, []);
    const loadBibleKeysRef = useAppCurrentRef(loadBibleKeys);
    const handleDropping = useCallback(async (event: DragEvent) => {
        event.preventDefault();
        setDimming(event, '1');
        for await (const file of readDroppedFiles(event)) {
            const fileFullName = getFileFullName(file);
            if (
                fileFullName === undefined ||
                !checkIsBibleXMLArchiveFileFullName(fileFullName)
            ) {
                // Anything else falls through silently, the way every other
                // drop gate in the app treats a file it does not own.
                continue;
            }
            // A bundle is read from where it already sits — the electron
            // preload stamps `appFilePath` onto every dropped `File` — because
            // copying it in just to unpack it is wasted I/O.
            const archiveFilePath = getAppFilePathFromFile(file);
            if (archiveFilePath === null) {
                continue;
            }
            await handleBibleXMLImporting(archiveFilePath, () => {
                loadBibleKeysRef.current();
            });
            // One bundle per drop: the import opens a dialog, and queueing a
            // second one behind it would stack popups the operator did not ask
            // for.
            break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'w-100 app-border-white-round p-2 d-flex flex-wrap' +
                ' justify-content-center'
            }
            style={{
                overflow: 'auto',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropping}
        >
            <div className="m-1" style={{ minWidth: '400px' }}>
                <BibleXMLImportComp loadBibleKeys={loadBibleKeys} />
                <BibleXMLArchiveComp loadBibleKeys={loadBibleKeys} />
            </div>
            <div
                className="app-border-white-round m-1 p-1"
                style={{ minWidth: '600px' }}
            >
                <BibleXMLListComp
                    isPending={isPending}
                    bibleKeysMap={bibleKeysMap}
                    loadBibleKeys={loadBibleKeys}
                />
            </div>
        </div>
    );
}
