import { tran } from '../lang/langHelpers';
import { type LyricNoteType } from './lyricNoteHelpers';

/**
 * A song's `Note` sections, read-only, in ONE note box under its slides —
 * each fence its own division, the way a slide document's Document Note sits
 * under its slides and a PowerPoint's slide notes under its own. Plain markup
 * rather than `SimpleNoteEditorComp`: the note lives in the song's text, which
 * the Lyric Editor changes, so there is nothing here to type into or save.
 */
export default function LyricNotesComp({
    noteList,
}: Readonly<{
    noteList: LyricNoteType[];
}>) {
    return (
        <div className="w-100 h-100 app-overflow-hidden app-inner-shadow">
            <div
                className="w-100 px-1 py-0 m-0 muted app-ellipsis"
                style={{
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontSize: '0.5rem',
                    height: '15px',
                }}
            >
                {tran('Document Note')}
            </div>
            <div
                className="w-100 px-2"
                style={{
                    height: 'calc(100% - 15px)',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}
            >
                {noteList.map((note, i) => {
                    return (
                        <section
                            key={`${i}-${note.partName}`}
                            className="lyric-note py-1"
                            style={{
                                borderTop:
                                    i === 0
                                        ? undefined
                                        : '1px solid var(--bs-border-color)',
                            }}
                        >
                            <div
                                className="lyric-note-title text-muted"
                                style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                }}
                            >
                                {note.partName}
                            </div>
                            <div
                                className="lyric-note-text"
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    userSelect: 'text',
                                }}
                            >
                                {note.text}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
