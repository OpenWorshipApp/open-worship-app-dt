import type { ReactNode } from 'react';
import { useState } from 'react';

export default function BackgroundRenderOnHoverComp({
    genChildren,
    src,
}: Readonly<{
    src: string;
    genChildren: (dim: { width: number; height: number }) => ReactNode;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [dim, setDim] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });
    return (
        <div
            className="w-100 h-100"
            onMouseEnter={(event) => {
                setIsPlaying(true);
                setDim({
                    width: event.currentTarget.clientWidth,
                    height: event.currentTarget.clientHeight,
                });
            }}
            onMouseLeave={() => {
                setIsPlaying(false);
            }}
            style={{
                opacity: isPlaying ? 1 : 0.3,
                backgroundImage: `url(${src})`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center center',
            }}
        >
            {isPlaying ? genChildren({ ...dim }) : null}
        </div>
    );
}
