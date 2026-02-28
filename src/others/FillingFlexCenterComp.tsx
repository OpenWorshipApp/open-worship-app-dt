import { CSSProperties, useMemo } from 'react';

export default function FillingFlexCenterComp({
    width,
    className,
    style,
}: Readonly<{
    width: number;
    className?: string;
    style?: CSSProperties;
}>) {
    const list = useMemo(() => {
        const bodyWidth = document.body.clientWidth;
        const length = Math.floor(bodyWidth / (width || bodyWidth)) + 1;
        return Array.from({ length });
    }, [width]);
    return list.map((_, i) => {
        return (
            <div
                key={i}
                className={className}
                style={{
                    width: `${width}px`,
                    pointerEvents: 'none',
                    height: 0,
                    visibility: 'hidden',
                    ...style,
                }}
            />
        );
    });
}
