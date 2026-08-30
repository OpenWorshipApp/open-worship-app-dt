import type Note from './Note';
import BibleNoteItemRenderComp from './BibleNoteItemRenderComp';

export default function RenderNoteItemsComp({
    note,
}: Readonly<{
    note: Note;
}>) {
    const items = note.items;
    return (
        <ul className="list-group">
            {items.map((noteItem, i1) => {
                return (
                    <BibleNoteItemRenderComp
                        key={`${noteItem.id}`}
                        index={i1}
                        noteItem={noteItem}
                        filePath={note.filePath}
                        note={note}
                    />
                );
            })}
        </ul>
    );
}
