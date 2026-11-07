import { tran } from '../lang/langHelpers';
import {
    toggleBibleCustomStyleFloatingShowing,
    useBibleCustomStyleFloatingShowing,
} from './bibleCustomStyleFloatingHelpers';

/**
 * Opens and closes the one Bible/LongText Properties panel. It sits under the
 * Mini Screen, under the Bibles tab's passage and in Long Text Show, because
 * that panel's style is the whole layer's: a Bible passage and a long text go
 * up in the same place and are drawn in the same look.
 */
export default function BibleCustomStyleFloatingToggleComp() {
    const isShowing = useBibleCustomStyleFloatingShowing();
    const label = tran('Bible/LongText Properties');
    return (
        <button
            type="button"
            className={`btn btn-sm btn-${isShowing ? 'info' : 'secondary'}`}
            title={label}
            aria-label={label}
            onClick={() => {
                toggleBibleCustomStyleFloatingShowing();
            }}
        >
            <i className="bi bi-book" />
            <i className="bi bi-gear-fill ms-1" />
        </button>
    );
}
