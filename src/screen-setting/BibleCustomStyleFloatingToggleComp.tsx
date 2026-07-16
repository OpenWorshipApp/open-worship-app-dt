import { tran } from '../lang/langHelpers';
import {
    toggleBibleCustomStyleFloatingShowing,
    useBibleCustomStyleFloatingShowing,
} from './bibleCustomStyleFloatingHelpers';

export default function BibleCustomStyleFloatingToggleComp() {
    const isShowing = useBibleCustomStyleFloatingShowing();
    const label = tran('Bible Properties');
    return (
        <button
            type="button"
            className={`btn btn-sm btn-${isShowing ? '' : 'outline-'}info`}
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
