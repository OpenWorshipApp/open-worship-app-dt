import { tran } from '../../lang/langHelpers';
import type { SongSelectSearchRecordType } from './songSelectApiHelpers';

export default function SongSelectResultItemComp({
    record,
    isDownloading,
    isDownloadDisabled,
    onDownload,
}: Readonly<{
    record: SongSelectSearchRecordType;
    isDownloading: boolean;
    isDownloadDisabled: boolean;
    onDownload: () => void;
}>) {
    const isDownloadable = record.hasLyrics && record.isAuthorized;
    const downloadTitleKey = !record.hasLyrics
        ? 'Lyrics not available for this song'
        : !record.isAuthorized
          ? 'Not authorized for these lyrics'
          : 'Download';
    return (
        <li className="list-group-item p-2">
            <div
                className={
                    'd-flex justify-content-between align-items-center gap-2'
                }
            >
                <div className="flex-fill" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-1">
                        {/* Server data: never routed through tran() */}
                        <strong className="text-truncate">
                            {record.title}
                        </strong>
                        {record.isPublicDomain ? (
                            <span className="badge text-bg-secondary">
                                {tran('Public Domain')}
                            </span>
                        ) : null}
                    </div>
                    <small className="text-secondary d-block text-truncate">
                        {record.authors.join(', ')}
                        {record.songNumber ? ` · #${record.songNumber}` : ''}
                    </small>
                    {record.lyricsPreview ? (
                        <small className="d-block text-truncate">
                            {record.lyricsPreview}
                        </small>
                    ) : null}
                </div>
                <button
                    className="btn btn-sm btn-outline-info"
                    type="button"
                    title={tran(downloadTitleKey)}
                    aria-label={tran(downloadTitleKey)}
                    disabled={
                        !isDownloadable || isDownloading || isDownloadDisabled
                    }
                    onClick={onDownload}
                >
                    {isDownloading ? (
                        <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                        />
                    ) : (
                        <i className="bi bi-cloud-download" />
                    )}
                </button>
            </div>
        </li>
    );
}
