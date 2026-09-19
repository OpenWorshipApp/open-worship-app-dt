import { useMemo, type CSSProperties, type ReactNode } from 'react';

import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { useShadowingParentWidth } from '../../others/ShadowingFillParentWidthComp';

export default function VaryAppDocumentScaleContainerComp({
    varySlide,
    width,
    children,
    extraStyle,
}: Readonly<{
    varySlide: VarySlideType;
    width: number;
    children?: ReactNode;
    extraStyle?: CSSProperties;
}>) {
    const parentWidth = useShadowingParentWidth();
    const { scale, actualParentWidth, actualHeight } = useMemo(() => {
        const actualParentWidth = parentWidth ?? width;
        const scale = actualParentWidth / varySlide.width;
        const actualHeight = varySlide.height * scale;
        return { scale, actualParentWidth, actualHeight };
    }, [parentWidth, width, varySlide.width, varySlide.height]);
    // Pure geometry: nothing here reads screen state, and there are TWO of
    // these per slide preview, so the subscription that used to sit here cost
    // two extra re-renders per slide on every screen change for nothing.
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
                    width: `${varySlide.width}px`,
                    height: `${varySlide.height}px`,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                {children}
            </div>
        </div>
    );
}
