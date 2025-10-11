import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { useScale } from './SlideItemRenderComp';
import { useAttachedBackgroundData } from '../../helper/dragHelpers';
import { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';

export default function SlideScaleContainerComp({
    slide,
    width,
    children,
    extraStyle,
}: Readonly<{
    slide: VaryAppDocumentItemType;
    width: number;
    children?: React.ReactNode;
    extraStyle?: React.CSSProperties;
}>) {
    const { scale, parentWidth, setParentDiv } = useScale(slide, width);
    useScreenVaryAppDocumentManagerEvents(['update']);
    const attachedBackgroundData = useAttachedBackgroundData(
        slide.filePath,
        slide.id,
    );
    return (
        <div
            ref={setParentDiv}
            style={{
                width: `${parentWidth}px`,
                height: `${Math.round(slide.height * scale)}px`,
                transform: `scale(${scale},${scale}) translate(50%, 50%)`,
                ...extraStyle,
            }}
        >
            <div
                className={!attachedBackgroundData ? 'app-blank-bg' : ''}
                style={{
                    pointerEvents: 'none',
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
