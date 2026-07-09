import { useCallback } from 'react';
import DownloadedBibleItemComp from './DownloadedBibleItemComp';
import type { BibleListType } from './bibleSettingHelpers';
import OnlineBibleItemComp from './OnlineBibleItemComp';
import LoadingComp from '../../others/LoadingComp';
import type { LocaleType } from '../../lang/langHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

type DownloadingBibleInfoType = {
    isUpdatable: boolean;
    filePath: string | undefined;
    locale: LocaleType;
    title: string;
    key: string;
    version: number;
    isDownloading: boolean;
};
export default function SettingDownloadedBibleComp({
    onlineBibleInfoList,
    downloadedBibleInfoList,
    setDownloadedBibleInfoList,
}: Readonly<{
    onlineBibleInfoList: BibleListType;
    downloadedBibleInfoList: BibleListType;
    setDownloadedBibleInfoList: (bbList: BibleListType) => void;
}>) {
    const setDownloadedBibleInfoListRef = useAppCurrentRef(
        setDownloadedBibleInfoList,
    );
    const handleRefresh = useCallback(() => {
        setDownloadedBibleInfoListRef.current(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (downloadedBibleInfoList === null) {
        return <LoadingComp />;
    }
    if (downloadedBibleInfoList === undefined) {
        return <div>Unable to get downloaded bible list</div>;
    }
    const bibleInfoList = downloadedBibleInfoList.map<DownloadingBibleInfoType>(
        (bibleInfo) => {
            const foundBibleInfo = onlineBibleInfoList
                ? onlineBibleInfoList.find((bible1) => {
                      return (
                          bible1.key === bibleInfo.key &&
                          bible1.version >= bibleInfo.version
                      );
                  })
                : undefined;
            return {
                isDownloading: false,
                ...bibleInfo,
                isUpdatable: !!foundBibleInfo,
                filePath: foundBibleInfo?.filePath,
            };
        },
    );
    return (
        <div className="w-100">
            <div>
                <button className="btn btn-info" onClick={handleRefresh}>
                    <i className="bi bi-arrow-clockwise" /> Refresh
                </button>
            </div>
            <ul className="list-group d-flex flex-fill">
                {bibleInfoList.length === 0 ? (
                    <div>No bible downloaded</div>
                ) : (
                    <>
                        {bibleInfoList.map((bibleInfo, i) => {
                            return (
                                <RenderItem
                                    key={bibleInfo.key}
                                    index={i}
                                    bibleInfoList={bibleInfoList}
                                    bibleInfo={bibleInfo}
                                    setDownloadedBibleInfoList={
                                        setDownloadedBibleInfoList
                                    }
                                />
                            );
                        })}
                    </>
                )}
            </ul>
        </div>
    );
}

function RenderItem({
    bibleInfoList,
    bibleInfo,
    index,
    setDownloadedBibleInfoList,
}: Readonly<{
    bibleInfoList: DownloadingBibleInfoType[];
    bibleInfo: DownloadingBibleInfoType;
    index: number;
    setDownloadedBibleInfoList: (bbList: BibleListType) => void;
}>) {
    const setDownloadedBibleInfoListRef = useAppCurrentRef(
        setDownloadedBibleInfoList,
    );
    const handleDownloadedEvent = useCallback(() => {
        setDownloadedBibleInfoListRef.current(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDeleting = useCallback(() => {
        setDownloadedBibleInfoListRef.current(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const bibleInfoRef = useAppCurrentRef(bibleInfo);
    const bibleInfoListRef = useAppCurrentRef(bibleInfoList);
    const handleUpdating = useCallback(() => {
        bibleInfoRef.current.isDownloading = true;
        setDownloadedBibleInfoListRef.current([...bibleInfoListRef.current]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (bibleInfo.isDownloading) {
        return (
            <OnlineBibleItemComp
                key={`${index}`}
                bibleInfo={bibleInfo}
                onDownloaded={handleDownloadedEvent}
            />
        );
    }
    return (
        <DownloadedBibleItemComp
            key={`${index}`}
            bibleInfo={bibleInfo}
            onDeleted={handleDeleting}
            onUpdate={handleUpdating}
        />
    );
}
