import { tran } from '../../lang/langHelpers';
import DocumentNoteEditorComp, {
    DocumentNoteStoreType,
} from '../canvas/DocumentNoteEditorComp';

export default function NoteEditorRenderComp({
    store,
    title,
}: Readonly<{ store: DocumentNoteStoreType; title: string }>) {
    return (
        <div className="w-100 h-100 app-overflow-hidden">
            <div
                className="w-100 px-1 py-0 m-0 muted app-ellipsis"
                style={{
                    textAlign: 'center',
                    fontSize: '0.5rem',
                }}
            >
                {title}
            </div>
            <DocumentNoteEditorComp
                store={store}
                placeholder={tran('Enter your note here') + '...'}
            />
        </div>
    );
}
