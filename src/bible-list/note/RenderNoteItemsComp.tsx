import Note from './Note';
import NoteItemRenderComp from './NoteItemRenderComp';

export default function RenderNoteItemsComp({
    note,
}: Readonly<{
    note: Note;
}>) {
    const items = note.items;
    return (
        <ul
            className="list-group"
            style={{
                minWidth: '220px',
                maxWidth: '420px',
            }}
        >
            {items.map((noteItem, i1) => {
                return (
                    <NoteItemRenderComp
                        key={`${noteItem.id}`}
                        index={i1}
                        noteItem={noteItem}
                        filePath={note.filePath}
                    />
                );
            })}
        </ul>
    );
}
