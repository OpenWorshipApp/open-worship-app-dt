import RenderVerseOptions from './RenderVerseOptions';
import RenderActionButtons, {
    useFoundActionKeyboard,
} from './RenderActionButtons';
import {
    BibleViewText, RenderTitleMaterial,
} from '../bible-reader/BibleViewExtra';
import { showAppContextMenu } from '../others/AppContextMenu';
import {
    genDefaultBibleItemContextMenu,
} from '../bible-list/bibleItemHelpers';
import {
    closeEventMapper, SearchBibleItemViewController,
} from '../bible-reader/BibleItemViewController';
import { useWindowMode } from '../router/routeHelpers';
import {
    fontSizeToHeightStyle, useBibleViewFontSize,
} from '../helper/bibleViewHelpers';
import { closeCurrentEditingBibleItem } from '../bible-reader/readBibleHelper';
import { toShortcutKey } from '../event/KeyboardEventListener';
import { useBibleItem } from '../bible-reader/BibleItemContext';

export default function RenderBibleDataFound({
    onVerseChange,
}: Readonly<{
    onVerseChange?: (verseStart?: number, verseEnd?: number) => void,
}>) {
    const bibleItem = useBibleItem();
    const windowMode = useWindowMode();
    const isSearching = onVerseChange !== undefined;
    useFoundActionKeyboard(bibleItem);
    const bibleItemViewController = SearchBibleItemViewController.getInstance();
    bibleItemViewController.selectedBibleItem.syncData(bibleItem);
    return (
        <div className='card border-success w-100 h-100'
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...genDefaultBibleItemContextMenu(bibleItem),
                    ...bibleItemViewController.genContextMenu(
                        bibleItemViewController.selectedBibleItem, windowMode,
                    ),
                ]);
            }}>
            <RenderBibleFoundHeader />
            <div className='card-body bg-transparent border-success p-0'>
                {!isSearching ? null : (
                    <RenderVerseOptions
                        onVersesChange={onVerseChange}
                    />
                )}
                <div className='p-2'>
                    <BibleViewText />
                </div>
            </div>
        </div>
    );
}

function RenderBibleFoundHeader() {
    const fontSize = useBibleViewFontSize();
    const viewController = SearchBibleItemViewController.getInstance();
    return (
        <div className='card-header bg-transparent border-success'
            style={fontSizeToHeightStyle(fontSize)}>
            <div className='d-flex w-100 h-100'>
                <RenderTitleMaterial
                    editingBibleItem={viewController.selectedBibleItem}
                />
                <div>
                    <RenderActionButtons />
                </div>
                <div>
                    {viewController.isAlone ? null : (
                        <button className='btn-close'
                            data-tool-tip={toShortcutKey(closeEventMapper)}
                            onClick={() => {
                                closeCurrentEditingBibleItem();
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
