/**
 * CCLI Song Search and Import Component
 * 
 * Provides UI for searching CCLI SongSelect and importing
 * licensed worship songs as lyrics.
 */

import './CCLISongSearchComp.scss';

import { useState, FormEvent } from 'react';
import { showSimpleToast } from '../../toast/toastHelpers';
import { searchCCLISongs, getCCLISongDetails, hasCCLICredentials } from './ccliService';
import { CCLISongType, CCLISearchResultType } from './ccliTypes';
import LoadingComp from '../../others/LoadingComp';
import { handleError } from '../../helper/errorHelpers';
import { importCCLISongAsLyric } from './ccliImportHelpers.js';
import DirSource from '../../helper/DirSource';

type CCLISongSearchCompProps = {
    dirSource: DirSource;
    onImportComplete?: () => void;
    onClose?: () => void;
};

export default function CCLISongSearchComp({
    dirSource,
    onImportComplete,
    onClose,
}: Readonly<CCLISongSearchCompProps>) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CCLISearchResultType | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedSong, setSelectedSong] = useState<CCLISongType | null>(null);
    const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

    // Check credentials on mount
    useState(() => {
        hasCCLICredentials().then(setHasCredentials);
    });

    const handleSearch = async (event?: FormEvent) => {
        if (event) {
            event.preventDefault();
        }

        if (!searchQuery.trim()) {
            showSimpleToast('Search', 'Please enter a search term');
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchCCLISongs({
                query: searchQuery,
                page: 1,
                pageSize: 20,
            });
            setSearchResults(results);
            
            if (results && results.songs.length === 0) {
                showSimpleToast('Search', 'No songs found');
            }
        } catch (error) {
            handleError(error);
            showSimpleToast('Search Error', 'Failed to search songs');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSongSelect = async (song: CCLISongType) => {
        try {
            // Get full song details including lyrics
            const fullSong = await getCCLISongDetails(song.songId);
            if (fullSong) {
                setSelectedSong(fullSong);
            }
        } catch (error) {
            handleError(error);
        }
    };

    const handleImport = async () => {
        if (!selectedSong) {
            return;
        }

        setIsImporting(true);
        try {
            const success = await importCCLISongAsLyric(
                selectedSong,
                dirSource.dirPath,
                {
                    includeChords: true,
                    autoFormat: true,
                },
            );

            if (success) {
                showSimpleToast(
                    'CCLI Import',
                    `Successfully imported "${selectedSong.title}"`,
                );
                setSelectedSong(null);
                setSearchResults(null);
                setSearchQuery('');
                
                if (onImportComplete) {
                    onImportComplete();
                }
            }
        } catch (error) {
            handleError(error);
            showSimpleToast('Import Error', 'Failed to import song');
        } finally {
            setIsImporting(false);
        }
    };

    if (hasCredentials === null) {
        return <LoadingComp />;
    }

    if (!hasCredentials) {
        return (
            <div className="ccli-song-search">
                <div className="alert alert-warning">
                    <h5>CCLI Credentials Required</h5>
                    <p>
                        To use CCLI SongSelect integration, please configure your
                        CCLI credentials in Settings.
                    </p>
                    <p>
                        You need a valid CCLI SongSelect subscription and API access.
                    </p>
                    {onClose && (
                        <button className="btn btn-sm btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="ccli-song-search">
            <div className="search-header">
                <h5>CCLI SongSelect</h5>
                {onClose && (
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={onClose}
                        title="Close"
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                )}
            </div>

            <form onSubmit={handleSearch} className="search-form">
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search by title, author, or CCLI#"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isSearching}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSearching}
                    >
                        {isSearching ? (
                            <LoadingComp />
                        ) : (
                            <i className="bi bi-search" />
                        )}
                    </button>
                </div>
            </form>

            {searchResults && (
                <div className="search-results">
                    <div className="results-header">
                        <small>
                            {searchResults.totalResults} result(s) found
                        </small>
                    </div>
                    <div className="results-list">
                        {searchResults.songs.map((song) => (
                            <div
                                key={song.songId}
                                className={`song-item ${selectedSong?.songId === song.songId ? 'selected' : ''}`}
                                onClick={() => handleSongSelect(song)}
                            >
                                <div className="song-title">{song.title}</div>
                                <div className="song-info">
                                    <small>
                                        {song.author} • CCLI# {song.ccliNumber}
                                    </small>
                                </div>
                                {song.copyright && (
                                    <div className="song-copyright">
                                        <small>{song.copyright}</small>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedSong && (
                <div className="song-preview">
                    <div className="preview-header">
                        <h6>{selectedSong.title}</h6>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setSelectedSong(null)}
                        >
                            <i className="bi bi-x" />
                        </button>
                    </div>
                    <div className="preview-meta">
                        <div><strong>Author:</strong> {selectedSong.author}</div>
                        <div><strong>CCLI#:</strong> {selectedSong.ccliNumber}</div>
                        {selectedSong.copyright && (
                            <div><strong>Copyright:</strong> {selectedSong.copyright}</div>
                        )}
                        {selectedSong.themes && selectedSong.themes.length > 0 && (
                            <div>
                                <strong>Themes:</strong> {selectedSong.themes.join(', ')}
                            </div>
                        )}
                    </div>
                    {selectedSong.lyrics && (
                        <div className="preview-lyrics">
                            <pre>{selectedSong.lyrics}</pre>
                        </div>
                    )}
                    <div className="preview-actions">
                        <button
                            className="btn btn-success"
                            onClick={handleImport}
                            disabled={isImporting}
                        >
                            {isImporting ? <LoadingComp /> : 'Import Song'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
