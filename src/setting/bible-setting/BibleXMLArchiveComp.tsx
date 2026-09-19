import { useCallback } from 'react';

import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';
import { BIBLE_XML_ARCHIVE_DOT_EXTENSION } from './bibleXMLArchiveHelpers';
import {
    handleBibleXMLExporting,
    handleBibleXMLImporting,
} from './bibleXMLArchiveMenuHelpers';

/**
 * The Export/Import Bible Data panel of the Bible settings page — the
 * counterpart of the Documents and Presenting Flows bundles, for the XML bibles
 * listed beside it.
 *
 * The DROP target is not here but on the whole section
 * (`SettingBibleXMLComp`), so a bundle can be let go anywhere over the Bible
 * settings rather than onto this one small box.
 */
export default function BibleXMLArchiveComp({
    loadBibleKeys,
}: Readonly<{
    loadBibleKeys: () => void;
}>) {
    const loadBibleKeysRef = useAppCurrentRef(loadBibleKeys);
    const handleExporting = useCallback(() => {
        handleBibleXMLExporting();
    }, []);
    const handleImporting = useCallback(() => {
        handleBibleXMLImporting(undefined, () => {
            loadBibleKeysRef.current();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-border-white-round p-1 mt-2">
            <h3>{tran('Bible Data')}</h3>
            <div className="d-flex flex-wrap gap-2 p-1">
                <button
                    className="btn btn-outline-primary flex-grow-1"
                    title={tran('Export Bible Data')}
                    onClick={handleExporting}
                >
                    <i className="bi bi-box-arrow-up" />{' '}
                    {tran('Export Bible Data')}
                </button>
                <button
                    className="btn btn-outline-primary flex-grow-1"
                    title={tran('Import Bible Data')}
                    onClick={handleImporting}
                >
                    <i className="bi bi-box-arrow-in-down" />{' '}
                    {tran('Import Bible Data')}
                </button>
            </div>
            <div className="p-1">
                <small style={{ color: 'var(--bs-secondary-color)' }}>
                    <i className="bi bi-info-circle me-1" />
                    {tran('Drop an exported bible data file here to import')}
                    {' ('}
                    <code>{BIBLE_XML_ARCHIVE_DOT_EXTENSION}</code>
                    {')'}
                </small>
            </div>
        </div>
    );
}
