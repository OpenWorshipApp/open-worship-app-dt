import { useCallback } from 'react';
import { notifyElementHighlight } from '../../helper/domHelpers';
import { bringDomToCenterView } from '../../helper/helpers';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentConstants';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

export default function RenderSlideIndexComp({
    viewIndex,
    dataKey,
    isInSlide = false,
    title,
}: Readonly<{
    viewIndex: number;
    dataKey: string;
    isInSlide?: boolean;
    title?: string;
}>) {
    const dataKeyRef = useAppCurrentRef(dataKey);
    const isInSlideRef = useAppCurrentRef(isInSlide);
    const handleClicking = useCallback(() => {
        if (isInSlideRef.current) {
            return;
        }
        const query = `[data-slide-badge-key="${CSS.escape(
            `slide-${dataKeyRef.current}`,
        )}"]`;
        const elementGetter = () => {
            const badgeElement = document.querySelector(query);
            if (badgeElement === null) {
                return null;
            }
            const targetElement = badgeElement.closest(
                `.${APP_DOCUMENT_ITEM_CLASS}`,
            ) as HTMLElement | null;
            return targetElement;
        };
        notifyElementHighlight(elementGetter, {
            moveToView: bringDomToCenterView,
            type: 'warning',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            onClick={handleClicking}
            className={
                'd-flex badge rounded-pill text-bg-info align-items-center' +
                (isInSlide ? '' : ' app-caught-hover-pointer')
            }
            // Not "Slide N": that is the card's own name
            // (`toSlideAccessibleName`), and a badge answering to it exactly
            // would be what a press by those words found.
            title={title ?? `${tran('Index')}: ${viewIndex}`}
            data-slide-badge-key={`${isInSlide ? 'slide-' : ''}${dataKey}`}
        >
            {viewIndex}
        </div>
    );
}
