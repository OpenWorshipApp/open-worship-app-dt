import { type BibleNote } from 'BibleNote.js';
import { useState } from 'react';

import FloatingWidgetComp from '../../app-modal/FloatingWidgetComp';
import { addBibleText, useBibleNoteControl } from './bibleNoteHelpers1';

function BibleNoteBibleLookupComp({
    bibleNote,
    setIsShowingBibleLookup,
}: Readonly<{
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
}>) {
    return (
        <FloatingWidgetComp
            onClose={() => setIsShowingBibleLookup(false)}
            options={{
                width: 500,
                height: 400,
                minWidth: 300,
                minHeight: 200,
            }}
        >
            <div
                className="card w-100 h-100 app-overflow-hidden app-focusable"
                tabIndex={0}
                ref={(ele) => {
                    if (ele === null) {
                        return;
                    }
                    // Focus to enable keyboard shortcut in the popup
                    ele.focus();
                }}
            >
                <div className="card-header">
                    <span>Bible Lookup</span>
                </div>
                <div className="card-body">
                    <button
                        onClick={async () => {
                            addBibleText(bibleNote);
                        }}
                    >
                        Add Bible (Genesis 1:1-3 KJV)
                    </button>
                </div>
                <div className="card-body">
                    <button
                        onClick={async () => {
                            bibleNote.addText('^');
                            addBibleText(bibleNote);
                        }}
                    >
                        Add Bible (^ Genesis 1:1-3 KJV)
                    </button>
                </div>
            </div>
        </FloatingWidgetComp>
    );
}

export default function NoteItemEditorPopupComp({
    bibleNote,
}: Readonly<{ bibleNote: BibleNote }>) {
    const [isShowingBibleLookup, setIsShowingBibleLookup] = useState(false);
    useBibleNoteControl({ bibleNote, setIsShowingBibleLookup });
    if (isShowingBibleLookup) {
        return (
            <BibleNoteBibleLookupComp
                bibleNote={bibleNote}
                setIsShowingBibleLookup={setIsShowingBibleLookup}
            />
        );
    }
    return null;
}
