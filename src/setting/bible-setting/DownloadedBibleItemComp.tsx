import { useCallback } from 'react';

import { fsCheckDirExist, fsDeleteDir } from '../../server/fileHelpers';
import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function DownloadedBibleItemComp({
    bibleInfo,
    onDeleted,
    onUpdate,
}: Readonly<{
    bibleInfo: BibleMinimalInfoType & { isUpdatable: boolean };
    onDeleted: () => void;
    onUpdate: () => void;
}>) {
    const { key, title } = bibleInfo;
    const keyRef = useAppCurrentRef(key);
    const titleRef = useAppCurrentRef(title);
    const onDeletedRef = useAppCurrentRef(onDeleted);
    const handleBibleDeleting = useCallback(async () => {
        const isOk = await showAppConfirm(
            'Delete Bible',
            `Are you sure to delete bible "${titleRef.current}"?`,
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isOk) {
            return;
        }
        try {
            const progressKey = `Deleting bible "${titleRef.current}"`;
            showProgressBar(progressKey);
            const bibleDestination = await bibleDataReader.toBiblePath(
                keyRef.current,
            );
            if (
                bibleDestination !== null &&
                (await fsCheckDirExist(bibleDestination))
            ) {
                await fsDeleteDir(bibleDestination);
                await bibleDataReader.clearBibleDatabaseData(keyRef.current);
            }
            hideProgressBar(progressKey);
            onDeletedRef.current();
        } catch (error: any) {
            showSimpleToast('Deleting', error.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onUpdateRef = useAppCurrentRef(onUpdate);
    const handleUpdate = useCallback(() => {
        onUpdateRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <li className="list-group-item">
            <div>
                <span>
                    ({key}) {title}
                </span>
                <div className="float-end">
                    <div className="btn-group">
                        <button
                            className="btn btn-danger"
                            onClick={handleBibleDeleting}
                        >
                            Delete
                        </button>
                        {bibleInfo.isUpdatable && (
                            <button
                                className="btn btn-warning"
                                onClick={handleUpdate}
                            >
                                Update
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </li>
    );
}
