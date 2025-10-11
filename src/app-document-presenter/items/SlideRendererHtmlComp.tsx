import Slide from '../../app-document-list/Slide';
import SlideRendererComp from './SlideRendererComp';
import SlideScaleContainerComp from './SlideScaleContainerComp';

export default function SlideRendererHtmlComp({
    slide,
    width,
}: Readonly<{
    slide: Slide;
    width: number;
}>) {
    if (slide.isError) {
        return <div className="alert alert-danger">Error</div>;
    }
    return (
        <SlideScaleContainerComp slide={slide} width={width}>
            <SlideRendererComp
                canvasItemsJson={slide.canvasItemsJson}
                width={`${slide.width}px`}
                height={`${slide.height}px`}
            />
        </SlideScaleContainerComp>
    );
}
