import { useMemo, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { publicDomainSongCatalog } from './publicDomainSongsData';
import { filterPublicDomainSongs } from './publicDomainSongsHelpers';
import { importPublicDomainSongToDirectory } from './publicDomainSongsImportHelpers';
import PublicDomainSongItemComp from './PublicDomainSongItemComp';

// No debounce: the catalog is a small in-memory list, filtering it per
// keystroke is cheap — the debounce rule is for expensive work.
export default function PublicDomainSongsPanelComp({
    dirPath,
}: Readonly<{
    dirPath: string;
}>) {
    const [query, setQuery] = useState('');
    const [downloadingSongId, setDownloadingSongId] = useState<string | null>(
        null,
    );
    const songs = useMemo(() => {
        return filterPublicDomainSongs(publicDomainSongCatalog, query);
    }, [query]);

    const handleDownloading = async (songId: string) => {
        const song = publicDomainSongCatalog.find(({ id }) => {
            return id === songId;
        });
        if (!song || downloadingSongId !== null) {
            return;
        }
        setDownloadingSongId(song.id);
        try {
            await importPublicDomainSongToDirectory(dirPath, song);
        } finally {
            setDownloadingSongId(null);
        }
    };

    return (
        <div className="d-flex flex-column w-100 h-100">
            <div className="input-group input-group-sm p-2 pb-1">
                <span className="input-group-text">
                    <i className="bi bi-search" />
                </span>
                <input
                    className="form-control"
                    type="text"
                    value={query}
                    placeholder={`${tran('Search songs')}...`}
                    onChange={(event) => {
                        setQuery(event.target.value);
                    }}
                />
                {query === '' ? null : (
                    <button
                        className="btn btn-outline-secondary"
                        type="button"
                        title={tran('Clear search')}
                        aria-label={tran('Clear search')}
                        onClick={() => {
                            setQuery('');
                        }}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                )}
                <span className="input-group-text">{songs.length}</span>
            </div>
            {songs.length === 0 ? (
                <div
                    className={
                        'flex-fill d-flex align-items-center' +
                        ' justify-content-center p-2 text-center text-secondary'
                    }
                >
                    {tran('No matches')}
                </div>
            ) : (
                <ul
                    className={
                        'list-group list-group-flush flex-fill overflow-y-auto'
                    }
                >
                    {songs.map((song) => {
                        return (
                            <PublicDomainSongItemComp
                                key={song.id}
                                song={song}
                                isDownloading={downloadingSongId === song.id}
                                isDownloadDisabled={downloadingSongId !== null}
                                onDownload={() => {
                                    handleDownloading(song.id);
                                }}
                            />
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
