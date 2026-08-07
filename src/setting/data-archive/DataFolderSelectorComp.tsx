import { useCallback, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

export type DataFolderChoiceType = {
    key: string;
    title: string;
    iconClassName: string;
    /** Shown after the title — the folder path, or how many files it holds. */
    detail?: string;
};

/**
 * The checked list both Export Data and Import Data put in front of the user.
 * Everything starts checked: the common case is "all of it", and a folder left
 * out of a backup by an unnoticed default is a bad surprise.
 *
 * The selection is reported through `onChange` rather than kept here, because
 * the popup this renders in (`showAppInput`) resolves only a boolean — the
 * caller holds the answer and reads it when the user presses Ok.
 */
export default function DataFolderSelectorComp({
    choices,
    onChange,
    message,
}: Readonly<{
    choices: DataFolderChoiceType[];
    onChange: (selectedKeys: string[]) => void;
    message: string;
}>) {
    const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
        return choices.map((choice) => {
            return choice.key;
        });
    });
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
    const choicesRef = useAppCurrentRef(choices);
    const handleAllToggling = useCallback(() => {
        setSelectedKeys((currentKeys) => {
            return currentKeys.length === choicesRef.current.length
                ? []
                : choicesRef.current.map((choice) => {
                      return choice.key;
                  });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Reported from an effect rather than from each handler, so there is one
    // place the answer leaves this component — and the caller is told the
    // starting selection too, instead of having to assume it.
    const onChangeRef = useAppCurrentRef(onChange);
    useAppEffect(() => {
        onChangeRef.current(selectedKeys);
    }, [selectedKeys]);
    const isAllSelected = selectedKeys.length === choices.length;
    return (
        <div className="app-data-folder-selector d-flex flex-column">
            <div className="d-flex align-items-center mb-2">
                <span className="flex-grow-1">{tran(message)}</span>
                <button
                    className="btn btn-sm btn-outline-secondary"
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
                    const isSelected = selectedKeys.includes(choice.key);
                    return (
                        <li
                            key={choice.key}
                            className={
                                'list-group-item d-flex align-items-center' +
                                ' app-caught-hover-pointer'
                            }
                            onClick={() => {
                                handleToggling(choice.key);
                            }}
                        >
                            <input
                                className="form-check-input m-0 me-2"
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                            />
                            <i className={`bi ${choice.iconClassName} me-2`} />
                            <span className="flex-grow-1">
                                {tran(choice.title)}
                            </span>
                            {choice.detail ? (
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
