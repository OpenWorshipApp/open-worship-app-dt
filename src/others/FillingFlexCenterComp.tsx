import { CSSProperties } from 'react';

export default function FillingFlexCenterComp({
    width,
    className,
    style,
}: Readonly<{
    width: number;
    className?: string;
    style?: CSSProperties;
}>) {
    return Array.from({
        length: Math.floor(document.body.clientWidth / width),
    }).map((_, i) => {
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
