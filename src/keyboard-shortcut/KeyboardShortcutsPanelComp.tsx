import './KeyboardShortcutsPanelComp.scss';

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { checkIsKeyboardLayerClaimed } from '../event/keyboardLayerHelpers';
import {
    useWindowEvent,
    type AppWidgetType,
} from '../event/WindowEventListener';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import appProvider from '../server/appProvider';
import { detectBotFocus } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import {
    formatShortcutKeys,
    getBibleLookupShortcutGroups,
    getKeyboardShortcutGroups,
    getKeyboardShortcutPageLabel,
} from './keyboardShortcutCatalog';
import type {
    KeyboardShortcutEntryType,
    KeyboardShortcutGroupType,
    KeyboardShortcutPageType,
} from './keyboardShortcutCatalog';

// The Bible Lookup popup's own keyboard layer (`ModalComp`'s
// `MODAL_KEYBOARD_LAYER`), named here rather than imported so the list does not
// pull the modal in behind it.
const BIBLE_LOOKUP_LAYER: AppWidgetType = 'bible-lookup';

type ListedEntryType = KeyboardShortcutEntryType & {
    keyTexts: string[];
    searchText: string;
};

type ListedGroupType = {
    id: string;
    title: string;
    note?: string;
    entries: ListedEntryType[];
};

function toSearchText(texts: (string | undefined)[]) {
    return texts.filter(Boolean).join(' ').toLocaleLowerCase();
}

// Built when the panel opens (and when the Bible Lookup comes or goes) and
// dropped on close: the panel unmounts with it.
function genListedGroups(groups: KeyboardShortcutGroupType[]) {
    return groups.map((group): ListedGroupType => {
        return {
            ...group,
            entries: group.entries.map((entry) => {
                const keyTexts = formatShortcutKeys(entry.keys);
                return {
                    ...entry,
                    keyTexts,
                    // The group's own words are searchable too, so "bible"
                    // finds the whole Bible Lookup group and "f5" finds the
                    // one row the key is on.
                    searchText: toSearchText([
                        entry.label,
                        entry.note,
                        group.title,
                        group.note,
                        ...keyTexts,
                    ]),
                };
            }),
        };
    });
}

function RenderShortcutRowComp({
    entry,
}: Readonly<{ entry: ListedEntryType }>) {
    return (
        <li className="app-keyboard-shortcut-row" aria-label={entry.label}>
            <span className="app-keyboard-shortcut-label">
                <span className="d-block">{entry.label}</span>
                {entry.note ? (
                    <span className="app-keyboard-shortcut-note d-block">
                        {entry.note}
                    </span>
                ) : null}
            </span>
            <span className="app-keyboard-shortcut-keys">
                {entry.keyTexts.map((keyText) => {
                    return (
                        <kbd
                            key={keyText}
                            className="app-keyboard-shortcut-key"
                        >
                            {keyText}
                        </kbd>
                    );
                })}
            </span>
        </li>
    );
}

export default function KeyboardShortcutsPanelComp({
    raiseToken,
    onClose,
}: Readonly<{
    raiseToken: number;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    const page = detectBotFocus(
        appProvider.currentHomePage,
    ) as KeyboardShortcutPageType | null;
    // While the Bible Lookup popup is open it holds the keyboard, so what the
    // panel lists -- and the name in its title -- follow it there and back.
    // The Reader shows its lookup inline, with no popup, so it never switches.
    const [isBibleLookupOpen, setIsBibleLookupOpen] = useState(() => {
        return checkIsKeyboardLayerClaimed(BIBLE_LOOKUP_LAYER);
    });
    useWindowEvent({ widget: BIBLE_LOOKUP_LAYER, state: 'open' }, () => {
        setIsBibleLookupOpen(true);
    });
    useWindowEvent({ widget: BIBLE_LOOKUP_LAYER, state: 'close' }, () => {
        setIsBibleLookupOpen(false);
    });
    const isForBibleLookup = isBibleLookupOpen && page !== 'reader';
    const contextLabel = isForBibleLookup
        ? tran('Bible Lookup')
        : getKeyboardShortcutPageLabel(page);
    const groups = useMemo(() => {
        return genListedGroups(
            isForBibleLookup
                ? getBibleLookupShortcutGroups(page)
                : getKeyboardShortcutGroups(page),
        );
    }, [isForBibleLookup, page]);
    const totalCount = useMemo(() => {
        return groups.reduce((count, group) => {
            return count + group.entries.length;
        }, 0);
    }, [groups]);
    const [searchText, setSearchText] = useState('');
    const filteredGroups = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        if (query === '') {
            return groups;
        }
        return groups
            .map((group) => {
                return {
                    ...group,
                    entries: group.entries.filter((entry) => {
                        return entry.searchText.includes(query);
                    }),
                };
            })
            .filter((group) => {
                return group.entries.length > 0;
            });
    }, [groups, searchText]);
    const matchedCount = filteredGroups.reduce((count, group) => {
        return count + group.entries.length;
    }, 0);

    // Escape belongs to the box first: it empties the search, and only an
    // empty box closes the panel. Taken from the app either way, so the
    // Bible Lookup's own Escape does not also clear its reference behind it.
    //
    // Every other plain key typed here is the search's too: the Bible Lookup
    // binds Enter, Tab and the arrows for as long as it is open, and they
    // would otherwise act on its reference while the caret is in this box.
    // A function key or a Ctrl / Alt / ⌘ chord is not typing, so it still
    // reaches the app -- F5 works with the caret here.
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (searchText !== '') {
                setSearchText('');
                return;
            }
            onClose();
            return;
        }
        const isChord = event.ctrlKey || event.altKey || event.metaKey;
        const isFunctionKey = /^F\d{1,2}$/.test(event.key);
        if (!isChord && !isFunctionKey) {
            event.stopPropagation();
        }
    };

    const title = tran('Keyboard Shortcuts');
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={
                    <span className="app-keyboard-shortcuts-title">
                        <i className="bi bi-keyboard" aria-hidden="true" />
                        {contextLabel === null
                            ? title
                            : `${title} · ${contextLabel}`}
                    </span>
                }
                widgetName="Keyboard Shortcuts"
                persistKey={`keyboard-shortcuts-panel-rect-${page ?? 'other'}`}
                raiseToken={raiseToken}
                onClose={onClose}
                options={{
                    width: 380,
                    height: 480,
                    minWidth: 280,
                    minHeight: 200,
                    // Over the Bible Lookup popup, whose keys it is listing.
                    // A window-level host mounted outside every modal, so the
                    // modal-layer context cannot say so for it.
                    isAboveModal: true,
                }}
            >
                <div className="app-keyboard-shortcuts app-selectable-text">
                    <div className="input-group input-group-sm">
                        <span className="input-group-text">
                            <i className="bi bi-search" aria-hidden="true" />
                        </span>
                        <input
                            type="search"
                            className="form-control"
                            value={searchText}
                            placeholder={tran('Search shortcuts')}
                            aria-label={tran('Search shortcuts')}
                            // Opened from the menu to look something up: the
                            // first key pressed should already be searching.
                            autoFocus
                            onKeyDown={handleKeyDown}
                            onChange={(event) => {
                                setSearchText(event.target.value);
                            }}
                        />
                        <span className="input-group-text app-data">
                            {matchedCount}/{totalCount}
                        </span>
                    </div>
                    <div className="app-keyboard-shortcuts-list">
                        {filteredGroups.map((group) => {
                            return (
                                <section
                                    key={group.id}
                                    className="app-keyboard-shortcuts-group"
                                    aria-label={group.title}
                                >
                                    <h6 className="app-keyboard-shortcuts-group-title">
                                        {group.title}
                                    </h6>
                                    {group.note ? (
                                        <div className="app-keyboard-shortcut-note">
                                            {group.note}
                                        </div>
                                    ) : null}
                                    <ul>
                                        {group.entries.map((entry) => {
                                            return (
                                                <RenderShortcutRowComp
                                                    key={entry.id}
                                                    entry={entry}
                                                />
                                            );
                                        })}
                                    </ul>
                                </section>
                            );
                        })}
                        {filteredGroups.length === 0 ? (
                            <div className="app-keyboard-shortcut-note p-2">
                                {tran('No shortcuts found')}
                            </div>
                        ) : null}
                    </div>
                </div>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
