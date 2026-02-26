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
            onMouseOver={(event) => {
                setIsPlaying(true);
                const { clientWidth, clientHeight } = event.currentTarget;
                setDim({
                    width: clientWidth,
                    height: clientHeight,
                });
            }}
            onMouseOut={() => {
                setIsPlaying(false);
            }}
            style={{
                width: '100%',
                height: '100%',
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
