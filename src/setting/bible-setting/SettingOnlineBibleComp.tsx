import LoadingComp from '../../others/LoadingComp';
import type { BibleListType } from './bibleSettingHelpers';
import { useBibleXMLKeys } from './bibleXMLHelpers';
import OnlineBibleItemComp from './OnlineBibleItemComp';

export default function SettingOnlineBibleComp({
    downloadedBibleInfoList,
    onlineBibleInfoList,
    setOnlineBibleInfoList,
    setDownloadedBibleInfoList,
}: Readonly<{
    downloadedBibleInfoList: BibleListType;
    onlineBibleInfoList: BibleListType;
    setOnlineBibleInfoList: (bbList: BibleListType) => void;
    setDownloadedBibleInfoList: (bbList: BibleListType) => void;
}>) {
    const {
        bibleKeysMap,
        isPending: isPendingBibleXMLKeys,
        loadBibleKeys: loadBibleXMLKeys,
    } = useBibleXMLKeys();
    const handleDownloadedEvent = () => {
        setDownloadedBibleInfoList(null);
    };
    if (onlineBibleInfoList === null || isPendingBibleXMLKeys) {
        return <LoadingComp />;
    }
    const handleRefreshing = () => {
        setOnlineBibleInfoList(null);
        loadBibleXMLKeys();
    };
    const getRefresher = () => {
        return (
            <button className="btn btn-info" onClick={handleRefreshing}>
                <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
        );
    };
    if (onlineBibleInfoList === undefined || bibleKeysMap === null) {
        return (
            <div>
                <div>{getRefresher()}</div>
                Unable to get online bible list
            </div>
        );
    }
    const bibleInfoList = onlineBibleInfoList.filter((bibleInfo) => {
        return (
            bibleInfo.filePath &&
            (!downloadedBibleInfoList ||
                downloadedBibleInfoList.every((bible1) => {
                    return bible1.key !== bibleInfo.key;
                }))
        );
    });

    return (
        <div className="w-100">
            <div>{getRefresher()}</div>
            <ul className="list-group d-flex flex-fill">
                {bibleInfoList.map((bibleInfo) => {
                    return (
                        <OnlineBibleItemComp
                            key={bibleInfo.key}
                            bibleInfo={bibleInfo}
                            onDownloaded={handleDownloadedEvent}
                            bibleXMLKeysMap={bibleKeysMap}
                            refresh={handleRefreshing}
                        />
                    );
                })}
            </ul>
        </div>
    );
}
