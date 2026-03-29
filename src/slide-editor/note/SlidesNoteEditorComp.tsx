import type AppDocument from '../../app-document-list/AppDocument';
import SlideNoteEditorComp from './SlideNoteEditorComp';
import type Slide from '../../app-document-list/Slide';

export default function SlidesNoteEditorComp({
    appDocument,
    slides,
}: Readonly<{
    appDocument: AppDocument;
    slides: Slide[];
}>) {
    return (
        <div
            className="w-100 app-inner-shadow p-1"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            {slides.map((slide) => {
                return (
                    <div
                        className="w-100"
                        key={slide.id}
                        style={{
                            height: '200px',
                            borderBottom: '1px solid #ccc',
                        }}
                    >
                        <SlideNoteEditorComp
                            appDocument={appDocument}
                            slide={slide}
                            title={`Slide Note: ${slide.name || slide.id + 1}`}
                        />
                    </div>
                );
            })}
        </div>
    );
}
