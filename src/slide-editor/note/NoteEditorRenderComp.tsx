import { tran } from '../../lang/langHelpers';
import SimpleNoteEditorComp, {
    DocumentNoteStoreType,
} from '../canvas/SimpleNoteEditorComp';

export default function NoteEditorRenderComp({
    store,
    title,
    uuid,
}: Readonly<{ store: DocumentNoteStoreType; title: string; uuid?: string }>) {
    return (
        <div
            className="w-100 h-100 app-overflow-hidden"
            data-note-editor-uuid={uuid}
        >
            <div
                className="w-100 px-1 py-0 m-0 muted app-ellipsis"
                style={{
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontSize: '0.5rem',
                    height: '15px',
                }}
            >
                {title}
            </div>
            <div
                className="w-100 app-overflow-hidden"
                style={{
                    height: 'calc(100% - 15px)',
                }}
            >
                <SimpleNoteEditorComp
                    store={store}
                    placeholder={tran('Enter your note here') + '...'}
                />
            </div>
        </div>
    );
}
