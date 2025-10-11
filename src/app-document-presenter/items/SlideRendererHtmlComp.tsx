import Slide from '../../app-document-list/Slide';
import SlideRendererComp from './SlideRendererComp';
import { useScale } from './SlideItemRenderComp';
import { useAttachedBackgroundData } from '../../helper/dragHelpers';

export default function SlideRendererHtmlComp({
    slide,
    width,
}: Readonly<{
    slide: Slide;
    width: number;
}>) {
    const { scale, parentWidth, setParentDiv } = useScale(slide, width);
    if (slide.isError) {
        return <div className="alert alert-danger">Error</div>;
    }
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
                <SlideRendererComp
                    canvasItemsJson={slide.canvasItemsJson}
                    width={`${slide.width}px`}
                    height={`${slide.height}px`}
                />
            </div>
        </div>
    );
}
