import { useCallback } from 'react';
import { notifyElementHighlight } from '../../helper/domHelpers';
import { bringDomToCenterView } from '../../helper/helpers';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentConstants';

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
    const handleClicking = useCallback(() => {
        if (isInSlide) {
            return;
        }
        const query = `[data-slide-badge-key="${CSS.escape(`slide-${dataKey}`)}"]`;
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
    }, [dataKey, isInSlide]);
    return (
        <div
            onClick={handleClicking}
            className={
                'd-flex badge rounded-pill text-bg-info align-items-center' +
                (isInSlide ? '' : ' app-caught-hover-pointer')
            }
            title={title ?? `Index: ${viewIndex}`}
            data-slide-badge-key={`${isInSlide ? 'slide-' : ''}${dataKey}`}
        >
            {viewIndex}
        </div>
    );
}
