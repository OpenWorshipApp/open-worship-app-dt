import { useCallback, useRef, type MouseEvent } from 'react';

import { getCurrentLocale, tran } from '../lang/langHelpers';
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
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genBibleImportLanguageAsk } from '../helper/ai/bibleImportAskHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { handleError } from '../helper/errorHelpers';

/**
 * Write the KJV Bible the app carries inside itself — the Settings button's
 * own `initKJVBible`, with the progress bar and the failure said out loud.
 *
 * Everything it needs is `import()`ed at the press: the bible reader brings
 * the file helpers and the bible database with it, and the card must not put
 * them in a window's static graph for the one press that may never come (the
 * 4.8 MB of verses behind them stay lazy inside `initKJVBible` too).
 * `initKJVBible` answers without a word when `<dir>/KJV.xml` is already there;
 * the broadcast is sent anyway, because the card is only up because nothing
 * answered for the key.
 */
export async function createProvidedKJVBible() {
    const progressKey = tran('Creating the provided KJV Bible');
    showProgressBar(progressKey);
    try {
        const [{ bibleDataReader }, { notifyBibleListChanged }] =
            await Promise.all([
                import('../helper/bible-helpers/BibleDataReader'),
                import('../helper/bible-helpers/bibleListChangeHelpers'),
            ]);
        await bibleDataReader.initKJVBible();
        notifyBibleListChanged();
        return true;
    } catch (error) {
        handleError(error);
        // The failure is the only path that needs a toast: a done creation
        // takes the card away by itself.
        const { showSimpleToast } = await import('../toast/toastHelpers');
        showSimpleToast(
            tran('Create the provided KJV'),
            tran('Failed to create the KJV Bible. Please try again.'),
        );
        return false;
    } finally {
        hideProgressBar(progressKey);
    }
}

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
    const isKJV = bibleKey === BIBLE_KJV_KEY;
    // One ask per card. StrictMode runs an effect twice, and a second confirm
    // would land on top of the first.
    const hasAskedToCreateKJVRef = useRef(false);
    useAppEffect(() => {
        if (!isKJV || hasAskedToCreateKJVRef.current) {
            return;
        }
        hasAskedToCreateKJVRef.current = true;
        (async () => {
            // The KJV is the one Bible the app can build by itself, so a
            // window showing "KJV is not available" can offer the way out
            // before sending a volunteer to the Settings form. A window with
            // no popup host answers `false` (memory `confirm-needs-a-popup-host`)
            // and the card's own button below is still there.
            // Loaded at the mount: a window whose KJV is installed never shows
            // this card and never pays for the popup helper.
            const { showAppConfirm } =
                await import('../popup-widget/popupWidgetHelpers');
            const isOk = await showAppConfirm(
                tran('Create the KJV Bible?'),
                tran(
                    'The KJV Bible is not available. Open Worship provides' +
                        ' it, and creating it needs no internet and no' +
                        ' separate download: the app already holds the' +
                        ' whole KJV.',
                ),
                {
                    escToCancel: true,
                    confirmButtonLabel: 'Create the provided KJV',
                    cancelButtonLabel: 'Cancel',
                },
            );
            if (isOk) {
                await createProvidedKJVBible();
            }
        })();
    }, [bibleKey, isKJV]);
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
    // assistant opens already looking for a Bible in the language this
    // window is shown in -- the one the person can read -- rather than for
    // the key that happens to be missing. The 2.0 import offers the KJV
    // Open Worship provides first, so a new computer still gets it.
    const handleAssistantAsking = useCallback(async () => {
        // Loaded at the press: the caution and the window opener are
        // nothing this card needs until somebody asks for the assistant.
        const { openChatbotAsking } =
            await import('../helper/ai/chatbotHandoffHelpers');
        await openChatbotAsking(genBibleImportLanguageAsk(getCurrentLocale()));
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
                {isKJV ? (
                    // The confirm above is asked once. This is the way back
                    // for somebody who cancelled it, or for a window with no
                    // popup host to draw it in.
                    <div className="mb-2">
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={createProvidedKJVBible}
                        >
                            <i className="bi bi-download me-2" />
                            {tran('Create the provided KJV')}
                        </button>
                    </div>
                ) : null}
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
                    {tran(
                        'Or let the assistant import a Bible in your language for you:',
                    )}
                    <ol className="mb-2">
                        <li>
                            {tran(
                                'Press the button below. The assistant opens and looks for a Bible in your language in a free collection online.',
                            )}
                        </li>
                        <li>
                            {tran(
                                'Press the Bible you want in its list, or type its language when it asks.',
                            )}
                        </li>
                        <li>
                            {tran(
                                'Keep the short name it suggests, answer its other questions, then press Install it. Then choose it in the list above; this card goes away.',
                            )}
                        </li>
                    </ol>
                    {/* A press by label wants the exact words
                        (`isPressSafe` in `domMatch.mjs`). */}
                    <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleAssistantAsking}
                    >
                        <i className="bi bi-robot me-2" />
                        {tran('Let the assistant import a Bible for me')}
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
