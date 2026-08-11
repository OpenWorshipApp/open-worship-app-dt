import { useCallback, useMemo, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export type ArchiveItemChoiceType = {
    key: string;
    /**
     * Rendered RAW — the caller translates it. A bible row's title is its KEY
     * (`KJV`, `GKHB`), which is user data and has no dictionary entry, and
     * `tran()` THROWS on a missing key in dev rather than falling back. So a
     * `tran(choice.title)` here would blank this popup the first time it was
     * opened in Khmer.
     */
    title: string;
    iconClassName: string;
    /** Shown after the title — the folder path, or how many files it holds. */
    detail?: string;
    /**
     * Non-empty ⇒ this row is RED, its checkbox is disabled, and it is never
     * reported through `onChange`. It is what "we cannot take this one, and
     * here is why" looks like: a bible whose key is already installed, or a
     * file whose key could not be read at all. The row is still LISTED rather
     * than filtered out — a bundle that silently came up two items short reads
     * as a broken export, not as a refused import.
     *
     * Translated by the caller too, like `title`: these ARE fixed keys, but a
     * `tran(<prop>)` sitting beside one that must never translate is a trap the
     * next reader would have to re-derive.
     */
    invalidMessage?: string;
};

/**
 * The checked list every archive flow puts in front of the user — Export/Import
 * Data picking folders, and Export/Import Bible Data picking bibles.
 *
 * Everything valid starts checked: the common case is "all of it", and an item
 * left out of a backup by an unnoticed default is a bad surprise.
 *
 * The selection is reported through `onChange` rather than kept here, because
 * the popup this renders in (`showAppInput`) resolves only a boolean — the
 * caller holds the answer and reads it when the user presses Ok.
 */
export default function ArchiveItemSelectorComp({
    choices,
    onChange,
    message,
}: Readonly<{
    choices: ArchiveItemChoiceType[];
    onChange: (selectedKeys: string[]) => void;
    message: string;
}>) {
    const selectableKeys = useMemo(() => {
        return choices
            .filter((choice) => {
                return !choice.invalidMessage;
            })
            .map((choice) => {
                return choice.key;
            });
    }, [choices]);
    const [selectedKeys, setSelectedKeys] = useState<string[]>(selectableKeys);
    // Every toggle computes from the list React hands it rather than from the
    // rendered value: two clicks in the same tick would otherwise both start
    // from the pre-click list, so the second silently undid the first.
    const handleToggling = useCallback((key: string) => {
        setSelectedKeys((currentKeys) => {
            return currentKeys.includes(key)
                ? currentKeys.filter((selectedKey) => {
                      return selectedKey !== key;
                  })
                : [...currentKeys, key];
        });
    }, []);
    const selectableKeysRef = useAppCurrentRef(selectableKeys);
    const handleAllToggling = useCallback(() => {
        setSelectedKeys((currentKeys) => {
            return currentKeys.length === selectableKeysRef.current.length
                ? []
                : [...selectableKeysRef.current];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Reported from an effect rather than from each handler, so there is one
    // place the answer leaves this component — and the caller is told the
    // starting selection too, instead of having to assume it.
    //
    // `onChange` is IN the dependency list, and must stay there. The Export
    // Data dialog re-opens itself when the password confirmation does not
    // match, handing over a fresh closure while React keeps this component and
    // its state — an effect watching only `selectedKeys` would never fire
    // again, and the second Ok would act on the default selection rather than
    // the operator's.
    useAppEffect(() => {
        onChange(selectedKeys);
    }, [onChange, selectedKeys]);
    // Guarded against an all-invalid list: with nothing selectable, "all of
    // them are selected" is vacuously true and the button would offer to
    // deselect a selection that does not exist.
    const isAllSelected =
        selectableKeys.length > 0 &&
        selectedKeys.length === selectableKeys.length;
    return (
        <div className="app-archive-item-selector d-flex flex-column">
            <div className="d-flex align-items-center mb-2">
                <span className="flex-grow-1">{tran(message)}</span>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={selectableKeys.length === 0}
                    onClick={handleAllToggling}
                >
                    {tran(isAllSelected ? 'Deselect All' : 'Select All')}
                </button>
            </div>
            <ul
                className="list-group overflow-auto"
                style={{ maxHeight: '50vh' }}
            >
                {choices.map((choice) => {
                    const { invalidMessage } = choice;
                    const isSelected = selectedKeys.includes(choice.key);
                    return (
                        <li
                            key={choice.key}
                            className={
                                'list-group-item d-flex align-items-center' +
                                (invalidMessage
                                    ? ' list-group-item-danger'
                                    : ' app-caught-hover-pointer')
                            }
                            onClick={
                                invalidMessage
                                    ? undefined
                                    : () => {
                                          handleToggling(choice.key);
                                      }
                            }
                        >
                            <input
                                className="form-check-input m-0 me-2"
                                type="checkbox"
                                checked={isSelected}
                                disabled={!!invalidMessage}
                                readOnly
                            />
                            <i className={`bi ${choice.iconClassName} me-2`} />
                            <span className="flex-grow-1">{choice.title}</span>
                            {invalidMessage ? (
                                <small
                                    className="app-ellipsis ms-2"
                                    style={{
                                        color: 'var(--bs-danger)',
                                        maxWidth: '55%',
                                    }}
                                    title={invalidMessage}
                                >
                                    <i className="bi bi-exclamation-triangle-fill me-1" />
                                    {invalidMessage}
                                </small>
                            ) : choice.detail ? (
                                <small
                                    className="app-ellipsis ms-2"
                                    style={{
                                        color: 'var(--bs-secondary-color)',
                                        maxWidth: '55%',
                                    }}
                                    title={choice.detail}
                                >
                                    {choice.detail}
                                </small>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
            {selectedKeys.length === 0 ? (
                <div className="mt-2" style={{ color: 'var(--bs-warning)' }}>
                    {tran('Nothing is selected')}
                </div>
            ) : null}
        </div>
    );
}
