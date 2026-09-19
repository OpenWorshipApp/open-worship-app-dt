import type Note from './Note';
import BibleNoteItemRenderComp from './BibleNoteItemRenderComp';
import VerseNoteItemRenderComp from './VerseNoteItemRenderComp';

export default function RenderNoteItemsComp({
    note,
}: Readonly<{
    note: Note;
}>) {
    const items = note.items;
    return (
        <ul className="list-group">
            {items.map((noteItem, i1) => {
                // A note file holds two kinds of item: the bible notes it always
                // held, and one verse item per verse that has been marked in the
                // reader. They share the id space and the file, nothing else.
                if (noteItem.isVerseItem) {
                    return (
                        <VerseNoteItemRenderComp
                            key={`${noteItem.id}`}
                            index={i1}
                            noteItem={noteItem}
                            filePath={note.filePath}
                            note={note}
                        />
                    );
                }
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
