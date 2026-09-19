import { useCallback, type MouseEvent } from 'react';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';
import { pressElementLikeButton } from '../../helper/helpers';

export default function RenderNoColorComp({
    isSelected,
    onClick,
}: Readonly<{
    isSelected: boolean;
    onClick?: (event: MouseEvent) => void;
}>) {
    const onClickRef = useAppCurrentRef(onClick);
    const handleClick = useCallback((event: MouseEvent) => {
        onClickRef.current?.(event as any);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Button semantics by hand, for the reason the coloured swatches beside
    // it need them: a styled div is not a control to the accessibility tree.
    const handleKeyDown = useCallback((event: any) => {
        pressElementLikeButton(event);
    }, []);
    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={tran('No Color')}
            aria-pressed={isSelected}
            title={tran('No Color')}
            onKeyDown={handleKeyDown}
            className="m-1 color-item app-caught-hover-pointer"
            style={{
                width: '20px',
                height: '15px',
                backgroundColor: '#fff',
                color: 'red',
                border: isSelected ? '3px dashed #fff' : '',
            }}
            onClick={handleClick}
        >
            x
        </div>
    );
}
