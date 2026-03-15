import { useCallback, type MouseEvent } from 'react';

export default function RenderNoColor({
    isSelected,
    onClick,
}: Readonly<{
    isSelected: boolean;
    onClick?: (event: MouseEvent) => void;
}>) {
    const handleClick = useCallback(
        (event: MouseEvent) => {
            onClick?.(event as any);
        },
        [onClick],
    );
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
