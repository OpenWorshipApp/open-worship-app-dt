import { tran } from '../lang/langHelpers';

import BibleItemsViewController, {
    useBibleItemsViewControllerContext,
} from '../bible-reader/BibleItemsViewController';
import { exportToWordDocument } from '../bible-list/bibleHelpers';

async function handleWordExporting(
    bibleItemsViewController: BibleItemsViewController,
) {
    const bibleItems =
        await bibleItemsViewController.getBibleItemsForExportingMSWord();
    exportToWordDocument(bibleItems);
}

export default function RenderExportWordComp() {
    const bibleItemsViewController = useBibleItemsViewControllerContext();
    return (
        <button
            className="btn btn-sm btn-secondary"
            title={tran('Export MS Word')}
            onClick={handleWordExporting.bind(null, bibleItemsViewController)}
        >
            <i
                className="bi bi-file-earmark-word"
                style={{
                    color: 'blue',
                }}
            />
        </button>
    );
}
