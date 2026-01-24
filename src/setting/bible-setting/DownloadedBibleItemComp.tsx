import { fsCheckDirExist, fsDeleteDir } from '../../server/fileHelpers';
import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';

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
    const handleBibleDeleting = async () => {
        const isOk = await showAppConfirm(
            'Delete Bible',
            `Are you sure to delete bible "${title}"?`,
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isOk) {
            return;
        }
        try {
            const progressKey = `Deleting bible "${title}"`;
            showProgressBar(progressKey);
            const bibleDestination = await bibleDataReader.toBiblePath(key);
            if (
                bibleDestination !== null &&
                (await fsCheckDirExist(bibleDestination))
            ) {
                await fsDeleteDir(bibleDestination);
                await bibleDataReader.clearBibleDatabaseData(key);
            }
            hideProgressBar(progressKey);
            onDeleted();
        } catch (error: any) {
            showSimpleToast('Deleting', error.message);
        }
    };
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
                                onClick={() => {
                                    onUpdate();
                                }}
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
