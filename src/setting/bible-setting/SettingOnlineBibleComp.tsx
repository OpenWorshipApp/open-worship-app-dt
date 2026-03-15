import { useCallback, useMemo } from 'react';

import { tran } from '../../lang/langHelpers';
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
    const handleDownloadedEvent = useCallback(() => {
        setDownloadedBibleInfoList(null);
    }, [setDownloadedBibleInfoList]);
    const handleRefreshing = useCallback(() => {
        setOnlineBibleInfoList(null);
        loadBibleXMLKeys();
    }, [setOnlineBibleInfoList, loadBibleXMLKeys]);
    const bibleInfoList = useMemo(() => {
        if (!onlineBibleInfoList) {
            return [];
        }
        return onlineBibleInfoList.filter((bibleInfo) => {
            return (
                bibleInfo.filePath &&
                (!downloadedBibleInfoList ||
                    downloadedBibleInfoList.every((bible1) => {
                        return bible1.key !== bibleInfo.key;
                    }))
            );
        });
    }, [onlineBibleInfoList, downloadedBibleInfoList]);
    if (onlineBibleInfoList === null || isPendingBibleXMLKeys) {
        return <LoadingComp />;
    }
    const getRefresher = () => {
        return (
            <button className="btn btn-info" onClick={handleRefreshing}>
                <i className="bi bi-arrow-clockwise" /> {tran('Refresh')}
            </button>
        );
    };
    if (onlineBibleInfoList === undefined || bibleKeysMap === null) {
        return (
            <div>
                <div>{getRefresher()}</div>
                <br />
                {tran('Unable to get online bible list')}
            </div>
        );
    }

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
