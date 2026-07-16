import type AppDocument from '../../app-document-list/AppDocument';
import VarySlideNoteEditorComp from './VarySlideNoteEditorComp';
import { type VarySlideWithNoteType } from '../../app-document-list/appDocumentTypeHelpers';

export default function SlidesNoteEditorComp({
    appDocument,
    slides,
}: Readonly<{
    appDocument: AppDocument;
    slides: VarySlideWithNoteType[];
}>) {
    return (
        <div
            className="w-100 app-inner-shadow p-1"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            {slides.map((slide, index) => {
                return (
                    <div
                        className="w-100"
                        key={slide.id}
                        style={{
                            height: '200px',
                            borderBottom: '1px solid #ccc',
                        }}
                    >
                        <VarySlideNoteEditorComp
                            appDocument={appDocument}
                            slide={slide}
                            title={`Slide Note: ${slide.name || index + 1}`}
                        />
                    </div>
                );
            })}
        </div>
    );
}
