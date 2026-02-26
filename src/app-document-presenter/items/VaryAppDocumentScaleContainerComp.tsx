import { useMemo, type CSSProperties, type ReactNode } from 'react';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import { useShadowingParentWidth } from '../../others/ShadowingFillParentWidthComp';

export default function VaryAppDocumentScaleContainerComp({
    slide,
    width,
    children,
    extraStyle,
}: Readonly<{
    slide: VaryAppDocumentItemType;
    width: number;
    children?: ReactNode;
    extraStyle?: CSSProperties;
}>) {
    const parentWidth = useShadowingParentWidth();
    const { scale, actualParentWidth, actualHeight } = useMemo(() => {
        const actualParentWidth = parentWidth ?? width;
        const scale = actualParentWidth / slide.width;
        const actualHeight = slide.height * scale;
        return { scale, actualParentWidth, actualHeight };
    }, [parentWidth, width, slide.width, slide.height]);
    useScreenVaryAppDocumentManagerEvents(['update']);
    return (
        <div
            style={{
                width: `${actualParentWidth}px`,
                height: `${actualHeight}px`,
                transform: `scale(${scale},${scale}) translate(50%, 50%)`,
                ...extraStyle,
            }}
        >
            <div
                style={{
                    width: `${slide.width}px`,
                    height: `${slide.height}px`,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                {children}
            </div>
        </div>
    );
}
