import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { useDownloadBible } from './bibleDownloadingHelpers';
import { getAllXMLFileKeys } from './bibleXMLJsonDataHelpers';

export default function OnlineBibleItemComp({
    bibleInfo,
    onDownloaded,
    bibleXMLKeysMap = {},
    refresh,
}: Readonly<{
    bibleInfo: BibleMinimalInfoType;
    onDownloaded: () => void;
    bibleXMLKeysMap?: { [key: string]: string };
    refresh?: () => void;
}>) {
    const [downloadingProgress, startDownloadBible] = useDownloadBible(
        bibleInfo,
        onDownloaded,
    );
    const handleDownloadStarting = async () => {
        const keysMap = await getAllXMLFileKeys();
        if (keysMap[bibleInfo.key]) {
            showSimpleToast('Already in XML', 'This bible is already in XML');
            refresh?.();
            return;
        }
        startDownloadBible();
    };
    const isBibleXMLExist = !!bibleXMLKeysMap[bibleInfo.key];
    return (
        <li className="list-group-item">
            <div
                className="w-100"
                title={isBibleXMLExist ? 'Already in XML' : ''}
            >
                <span>
                    {bibleInfo.title} ({bibleInfo.key})
                </span>
                {downloadingProgress === null ? (
                    <div className="float-end">
                        <button
                            className="btn btn-info"
                            disabled={isBibleXMLExist}
                            onClick={handleDownloadStarting}
                        >
                            Download <i className="bi bi-cloud-arrow-down" />
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="progress">
                            <div
                                className={
                                    'progress-bar progress-bar-striped ' +
                                    'progress-bar-animated'
                                }
                                role="progressbar"
                                aria-valuenow={downloadingProgress * 100}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                style={{
                                    width: `${downloadingProgress * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </li>
    );
}
