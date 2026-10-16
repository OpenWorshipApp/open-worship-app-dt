import './bibleChapterDivider.scss';

import { tran } from '../../lang/langHelpers';

/**
 * `...` below the chapters shown of a passage longer than
 * `BIBLE_SHOWN_CHAPTER_COUNT`: each press reads and shows ONE more chapter,
 * so a passage spanning a whole book is never read at once.
 */
export default function RenderShowNextChapterButtonComp({
    onClick,
    isLoading = false,
}: Readonly<{
    onClick: () => void;
    isLoading?: boolean;
}>) {
    const label = tran('Show the next chapter');
    return (
        <button
            type="button"
            className="btn btn-sm btn-outline-secondary bible-show-next-chapter"
            title={label}
            aria-label={label}
            disabled={isLoading}
            onClick={onClick}
        >
            ...
        </button>
    );
}
