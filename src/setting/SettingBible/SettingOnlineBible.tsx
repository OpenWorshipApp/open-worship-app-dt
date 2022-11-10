import { BibleListType } from './helpers';
import OnlineBibleItem from './OnlineBibleItem';

export default function SettingOnlineBible({
    downloadedBibleInfoList,
    onlineBibleInfoList,
    setOnlineBibleInfoList,
    setDownloadedBibleInfoList,
}: {
    downloadedBibleInfoList: BibleListType,
    onlineBibleInfoList: BibleListType,
    setOnlineBibleInfoList: (bbList: BibleListType) => void
    setDownloadedBibleInfoList: (bbList: BibleListType) => void,
}) {
    if (onlineBibleInfoList === null) {
        return <div>Loading...</div>;
    }
    const getRefresher = () => {
        return (
            <button className='btn btn-info'
                onClick={() => {
                    setOnlineBibleInfoList(null);
                }}>
                <i className='bi bi-arrow-clockwise' />
                Refresh
            </button>
        );
    };
    if (onlineBibleInfoList === undefined) {
        return (
            <div>
                <div>
                    {getRefresher()}
                </div>
                Unable to get online bible list
            </div>
        );
    }
    const bibleInfoList = onlineBibleInfoList.filter((bibleInfo) => {
        return bibleInfo.filePath && (!downloadedBibleInfoList ||
            downloadedBibleInfoList.length === 0 ||
            downloadedBibleInfoList.every((bible1) => {
                return bible1.key !== bibleInfo.key;
            }));
    });

    return (
        <div className='w-100'>
            <div>
                {getRefresher()}
            </div>
            <ul className='list-group d-flex flex-fill'>
                {bibleInfoList.map((bibleInfo, i) => {
                    return (
                        <OnlineBibleItem key={`${i}`}
                            bibleInfo={bibleInfo}
                            onDownloaded={() => {
                                setDownloadedBibleInfoList(null);
                            }} />
                    );
                })}
            </ul>
        </div>
    );
}
