import { useCallback, type MouseEvent } from 'react';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function RenderNoColor({
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
    return (
        <div
            title="No Color"
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
