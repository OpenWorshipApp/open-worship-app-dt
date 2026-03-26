import { useCallback, type MouseEvent } from 'react';
import { tran } from '../lang/langHelpers';
import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from './SimpleNoteEditorComp';

export default function NoteEditorRenderComp({
    store,
    title,
    uuid,
}: Readonly<{
    store: SimpleNoteEditorStoreType;
    title: string;
    uuid?: string;
}>) {
    const handleClickingTitle = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            const target = event.currentTarget;
            const parent = target.parentElement;
            if (parent === null) {
                return;
            }
            parent.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        },
        [],
    );
    return (
        <div
            className="w-100 h-100 app-overflow-hidden app-inner-shadow"
            data-note-editor-uuid={uuid}
        >
            <div
                className="w-100 px-1 py-0 m-0 muted app-ellipsis app-caught-hover-pointer"
                title={tran('Double click to jump to top')}
                style={{
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontSize: '0.5rem',
                    height: '15px',
                }}
                onDoubleClick={handleClickingTitle}
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
