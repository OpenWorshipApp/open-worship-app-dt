import { useCallback, type MouseEvent } from 'react';

import { tran } from '../lang/langHelpers';
import RenderChapterOptionsComp from './RenderChapterOptionsComp';
import { BibleKeySelectionMiniComp } from './BibleKeySelectionComp';
import { RENDER_FOUND_CLASS } from './selectionHelpers';
import {
    useEditingResult,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import RenderVerseOptionsComp from './RenderVerseOptionsComp';
import { openBibleSetting } from '../setting/settingHelpers';
import RenderBookOptionsComp from './RenderBookOptionsComp';
import { useAppCurrentRef } from '../helper/appHooks';
import { genBibleImportAsk } from '../helper/ai/bibleImportAskHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

export default function RenderLookupSuggestionComp({
    applyChapterSelection,
    applyBookSelection,
}: Readonly<{
    applyChapterSelection: (newChapter: number) => void;
    applyBookSelection: (newBookKey: string, newBook: string) => void;
}>) {
    const editingResult = useEditingResult();
    const handleFocusing = useCallback((event: MouseEvent<HTMLDivElement>) => {
        event.currentTarget.focus();
    }, []);
    if (editingResult === null) {
        return <div>{tran('Loading')}...</div>;
    }
    const {
        bookKey,
        guessingBook,
        chapter,
        guessingChapter,
        bibleItem: foundBibleItem,
    } = editingResult.result;

    if (foundBibleItem !== null) {
        // The passage itself is drawn by the bible view, right after this,
        // at the position it holds when the view is not being edited too.
        return <RenderVerseOptionsComp bibleItem={foundBibleItem} />;
    }
    return (
        <div
            className={`app-render-found w-100 h-100 app-focusable ${RENDER_FOUND_CLASS}`}
            style={{ overflowY: 'auto' }}
            tabIndex={0}
            onClick={handleFocusing}
        >
            <div
                className="w-100 d-flex flex-wrap align-items-center"
                // `safe`: a row wider than the pane starts at its left edge
                // instead of overflowing both ways. Plain `center` hung a book
                // option off the LEFT edge in a narrow pane, where no scroll
                // reaches -- four panes side by side read 'enesis', 'xodus'.
                style={{ justifyContent: 'safe center' }}
            >
                {bookKey === null ? (
                    <RenderBookOptionsComp
                        onSelect={applyBookSelection}
                        guessingBook={guessingBook ?? ''}
                    />
                ) : null}
                {bookKey === null || chapter !== null ? null : (
                    <RenderChapterOptionsComp
                        bookKey={bookKey}
                        guessingChapter={guessingChapter}
                        onSelect={applyChapterSelection}
                    />
                )}
            </div>
        </div>
    );
}

export function BibleNotAvailableComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const handleBibleKeyChanging = useCallback(
        (
            _isContextMenu: boolean,
            _oldBibleKey: string,
            newBibleKey: string,
        ) => {
            viewControllerRef.current.applyTargetOrBibleKey(
                viewControllerRef.current.selectedBibleItem,
                {
                    bibleKey: newBibleKey,
                },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleBibleSettingOpening = useCallback(() => {
        openBibleSetting();
    }, []);
    // The way forward for somebody the Settings form is too much for: the
    // assistant opens already looking for THIS Bible, and offers the name
    // this card is waiting for as its short name -- installed under it, the
    // card goes away by itself (`useSelectedBibleKey`).
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const handleAssistantAsking = useCallback(async () => {
        // Loaded at the press: the caution and the window opener are
        // nothing this card needs until somebody asks for the assistant.
        const { openChatbotAsking } =
            await import('../helper/ai/chatbotHandoffHelpers');
        await openChatbotAsking(genBibleImportAsk(bibleKeyRef.current));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            id="bible-lookup-container"
            className="card card app-zero-border-radius"
        >
            <div className="body card-body w-100 p-3">
                <h2>
                    {tran('Bible key ')}
                    <span style={{ fontFamily }}>"{bibleKey}"</span>{' '}
                    {tran('is not available!')}
                </h2>
                <div className="d-flex">
                    <h4
                        style={{
                            color: 'var(--bs-warning-text-emphasis)',
                        }}
                    >
                        {tran('Please change bible key here')} 👉
                    </h4>
                    <div>
                        <BibleKeySelectionMiniComp
                            bibleKey={bibleKey}
                            onBibleKeyChange={handleBibleKeyChanging}
                        />
                    </div>
                </div>
                <hr />
                <div>
                    {tran('Or let the assistant import this Bible for you:')}
                    <ol className="mb-2">
                        <li>
                            {tran(
                                'Press the button below. The assistant opens and looks for this Bible in a free collection online.',
                            )}
                        </li>
                        <li>
                            {tran(
                                'Press the Bible you want in its list, or type its language when it asks.',
                            )}
                        </li>
                        <li>
                            {tran(
                                'Keep the short name it suggests, answer its other questions, then press Install it. The Bible shows here by itself.',
                            )}
                        </li>
                    </ol>
                    {/* Its text is its name and nothing more: the heading says
                        which Bible, and a press by label wants the exact
                        words (`isPressSafe` in `domMatch.mjs`). */}
                    <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleAssistantAsking}
                    >
                        <i className="bi bi-robot me-2" />
                        {tran('Let the assistant import this Bible for me')}
                    </button>
                </div>
                <hr />
                {tran('Or add bible ')}
                <button
                    className="btn btn-primary"
                    onClick={handleBibleSettingOpening}
                >
                    <span>{tran('Go to Bible Setting ')}</span>
                    <i className="bi bi-gear-wide-connected" />
                </button>
            </div>
        </div>
    );
}
