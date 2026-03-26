import type PptxSlide from '../../app-document-list/PptxSlide';
import PptxSlideNoteEditorComp from './PptxSlideNoteEditorComp';

export default function PptxSlidesNoteEditorComp({
    pptxSlides,
}: Readonly<{
    pptxSlides: PptxSlide[];
}>) {
    return (
        <div
            className="w-100 app-inner-shadow p-1"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            {pptxSlides.map((pptxSlide) => {
                return (
                    <div
                        className="w-100"
                        key={pptxSlide.id}
                        style={{
                            height: '200px',
                            borderBottom: '1px solid #ccc',
                        }}
                    >
                        <PptxSlideNoteEditorComp
                            pptxSlide={pptxSlide}
                            title={`PowerPoint Slide: ${pptxSlide.name}`}
                        />
                    </div>
                );
            })}
        </div>
    );
}
