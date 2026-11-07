import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { useAppStateAsync } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import type BibleItem from './BibleItem';
import { createBibleItemLyric } from './bibleLyricHelpers';
import { useSelectedAppDocumentSetterContext } from '../app-document-list/appDocumentHelpers';
import { previewingEventListener } from '../event/PreviewingEventListener';
import BibleKeysChooserComp from './BibleKeysChooserComp';

// Create Lyric: Generate Slides' twin for a song. The versions are picked the
// same way; the song is selected and shown once it is made.
export default function BibleLyricPopupComp({
    bibleItem,
    onClose,
}: Readonly<{
    bibleItem: BibleItem;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    const setSelectedAppDocument = useSelectedAppDocumentSetterContext();
    const [title] = useAppStateAsync(
        () => bibleItem.toTitleWithBibleKey(),
        [bibleItem],
    );
    const [bibleKeys, setBibleKeys] = useState([bibleItem.bibleKey]);
    const [isCreating, setIsCreating] = useState(false);
    const isRunning = useRef(false);
    const close = () => {
        if (!isRunning.current) {
            onClose();
        }
    };
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={tran('Create Lyric')}
                widgetName="Create Lyric"
                onClose={close}
                options={{
                    width: 480,
                    height: 440,
                    minWidth: 320,
                    minHeight: 240,
                }}
            >
                <form
                    className="p-3 d-flex flex-column h-100 gap-2 overflow-auto"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (isRunning.current) {
                            return;
                        }
                        isRunning.current = true;
                        setIsCreating(true);
                        try {
                            const file = await createBibleItemLyric(
                                bibleItem,
                                bibleKeys,
                            );
                            if (file !== null) {
                                // Dynamic: a static import of the lyric
                                // document can close a cycle through the
                                // app-document helpers.
                                const { default: LyricAppDocument } =
                                    await import('../lyric-list/LyricAppDocument');
                                const lyricAppDocument =
                                    LyricAppDocument.getInstance(file.filePath);
                                if (
                                    await setSelectedAppDocument(
                                        lyricAppDocument,
                                    )
                                ) {
                                    previewingEventListener.showVaryAppDocument(
                                        lyricAppDocument,
                                    );
                                }
                                onClose();
                            }
                        } finally {
                            isRunning.current = false;
                            setIsCreating(false);
                        }
                    }}
                >
                    <strong>{title}</strong>
                    <p className="mb-1">
                        {tran('Choose Bible versions to include on each slide')}
                    </p>
                    <BibleKeysChooserComp
                        bibleKey={bibleItem.bibleKey}
                        bibleKeys={bibleKeys}
                        setBibleKeys={setBibleKeys}
                        isDisabled={isCreating}
                    />
                    <p className="small text-muted mb-1">
                        {tran(
                            'Each Bible verse becomes a lyric verse, with one line per selected Bible version',
                        )}
                    </p>
                    <div className="d-flex justify-content-end gap-2">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isCreating}
                            onClick={close}
                        >
                            {tran('Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isCreating}
                        >
                            {isCreating && (
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    aria-hidden="true"
                                />
                            )}
                            {tran('Create Lyric')}
                        </button>
                    </div>
                </form>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
