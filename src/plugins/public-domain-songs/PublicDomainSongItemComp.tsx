import { tran } from '../../lang/langHelpers';
import type { PublicDomainSongType } from './publicDomainSongsData';

export default function PublicDomainSongItemComp({
    song,
    isDownloading,
    isDownloadDisabled,
    onDownload,
}: Readonly<{
    song: PublicDomainSongType;
    isDownloading: boolean;
    isDownloadDisabled: boolean;
    onDownload: () => void;
}>) {
    const firstLine = song.verses[0]?.split('\n')[0] ?? '';
    return (
        <li className="list-group-item p-2">
            <div
                className={
                    'd-flex justify-content-between align-items-center gap-2'
                }
            >
                <div className="flex-fill" style={{ minWidth: 0 }}>
                    <strong className="d-block text-truncate">
                        {song.title}
                    </strong>
                    <small className="text-secondary d-block text-truncate">
                        {song.authors.join(', ')}
                        {song.year ? ` · ${song.year}` : ''}
                    </small>
                    {firstLine ? (
                        <small className="d-block text-truncate">
                            {firstLine}
                        </small>
                    ) : null}
                </div>
                <button
                    className="btn btn-sm btn-outline-info"
                    type="button"
                    title={tran('Download')}
                    aria-label={tran('Download')}
                    disabled={isDownloading || isDownloadDisabled}
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
