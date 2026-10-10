import { useCallback, useMemo, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export type ArchiveTreeChoiceType = {
    key: string;
    /**
     * Rendered RAW -- the caller translates it, as with
     * `ArchiveItemChoiceType.title`: a title can be user data, and `tran()`
     * THROWS in dev on a key it does not know.
     */
    title: string;
    iconClassName: string;
    /** Shown after the title, raw: a count, a warning. */
    detail?: string;
    /**
     * A LEAF only. Non-empty ⇒ the row is red, its checkbox disabled, and it is
     * never reported -- with the reason beside it, raw. Listed rather than
     * hidden, so a section that cannot be taken says why instead of missing.
     */
    invalidMessage?: string;
    /** A LEAF only: starts unticked. Everything else starts ticked. */
    isDefaultUnchecked?: boolean;
    /** Present ⇒ this is a parent row; its children are the leaves. */
    children?: ArchiveTreeChoiceType[];
};

function checkIsParent(choice: ArchiveTreeChoiceType) {
    return (choice.children?.length ?? 0) > 0;
}

function listLeaves(choices: ArchiveTreeChoiceType[]): ArchiveTreeChoiceType[] {
    return choices.flatMap((choice) => {
        return checkIsParent(choice)
            ? listLeaves(choice.children ?? [])
            : [choice];
    });
}

function toEnabledLeafKeys(choices: ArchiveTreeChoiceType[]) {
    return listLeaves(choices)
        .filter((leaf) => {
            return !leaf.invalidMessage;
        })
        .map((leaf) => {
            return leaf.key;
        });
}

function TreeCheckboxComp({
    isChecked,
    isIndeterminate = false,
    isDisabled,
    onToggle,
}: Readonly<{
    isChecked: boolean;
    isIndeterminate?: boolean;
    isDisabled: boolean;
    onToggle: () => void;
}>) {
    return (
        <input
            className="form-check-input m-0 me-2 flex-shrink-0"
            type="checkbox"
            checked={isChecked}
            // A DOM property with no attribute; React cannot render it.
            ref={(element) => {
                if (element) {
                    element.indeterminate = isIndeterminate;
                }
            }}
            disabled={isDisabled}
            onChange={onToggle}
        />
    );
}

function TreeRowDetailComp({
    choice,
}: Readonly<{ choice: ArchiveTreeChoiceType }>) {
    const { invalidMessage, detail } = choice;
    const text = invalidMessage || detail;
    if (!text) {
        return null;
    }
    return (
        <small
            className="app-ellipsis ms-2"
            style={{
                color: invalidMessage
                    ? 'var(--bs-danger)'
                    : 'var(--bs-secondary-color)',
                maxWidth: '55%',
            }}
            title={text}
        >
            {invalidMessage ? (
                <i className="bi bi-exclamation-triangle-fill me-1" />
            ) : null}
            {text}
        </small>
    );
}

/**
 * The checked TREE an archive flow puts in front of the user when what it
 * carries is grouped -- Export/Import Settings: sections of leaves. The flat
 * sibling is `ArchiveItemSelectorComp`, and this follows its rules:
 *
 * - every valid leaf starts ticked unless it asks not to be;
 * - only LEAF keys are reported, through `onChange`, from an effect -- the
 *   popup it renders in (`showAppInput`) resolves only a boolean;
 * - `onChange` stays in that effect's dependencies, so a dialog re-opened
 *   with a fresh closure (a password that did not match) is told the
 *   selection the operator made, not the default.
 *
 * A parent's box is ticked when all its usable leaves are, half-ticked when
 * some are, and ticks or unticks all of them. Parents start collapsed, so a
 * long tree opens as one screen of sections.
 *
 * `choices` may change while it is open (Export Settings enables the
 * credentials once a password is typed): a leaf that becomes unusable is
 * dropped from the selection, so it comes back UNTICKED if it is enabled
 * again rather than silently re-joining.
 */
export default function ArchiveTreeSelectorComp({
    choices,
    onChange,
    message,
}: Readonly<{
    choices: ArchiveTreeChoiceType[];
    onChange: (selectedLeafKeys: string[]) => void;
    /** A `tran()` key. */
    message: string;
}>) {
    const leafKeys = useMemo(() => {
        return listLeaves(choices).map((leaf) => {
            return leaf.key;
        });
    }, [choices]);
    const enabledKeys = useMemo(() => {
        return toEnabledLeafKeys(choices);
    }, [choices]);
    const [selectedKeySet, setSelectedKeySet] = useState(() => {
        return new Set(
            listLeaves(choices)
                .filter((leaf) => {
                    return !leaf.invalidMessage && !leaf.isDefaultUnchecked;
                })
                .map((leaf) => {
                    return leaf.key;
                }),
        );
    });
    const [expandedKeySet, setExpandedKeySet] = useState(
        () => new Set<string>(),
    );
    useAppEffect(() => {
        const enabledKeySet = new Set(enabledKeys);
        setSelectedKeySet((currentKeySet) => {
            const keptKeys = Array.from(currentKeySet).filter((key) => {
                return enabledKeySet.has(key);
            });
            return keptKeys.length === currentKeySet.size
                ? currentKeySet
                : new Set(keptKeys);
        });
    }, [enabledKeys]);
    // Memoised: a caller that keeps the answer in its own state re-renders
    // on every report, and a fresh array each time would report forever.
    const reportedKeys = useMemo(() => {
        const enabledKeySet = new Set(enabledKeys);
        return leafKeys.filter((key) => {
            return selectedKeySet.has(key) && enabledKeySet.has(key);
        });
    }, [leafKeys, enabledKeys, selectedKeySet]);
    useAppEffect(() => {
        onChange(reportedKeys);
    }, [onChange, reportedKeys]);

    // Every toggle computes from the set React hands it, never from the
    // rendered one: two clicks in one tick would otherwise both start from
    // the pre-click selection.
    const handleKeysToggling = useCallback((keys: string[]) => {
        setSelectedKeySet((currentKeySet) => {
            const isAllSelected = keys.every((key) => {
                return currentKeySet.has(key);
            });
            const newKeySet = new Set(currentKeySet);
            for (const key of keys) {
                if (isAllSelected) {
                    newKeySet.delete(key);
                } else {
                    newKeySet.add(key);
                }
            }
            return newKeySet;
        });
    }, []);
    const handleExpandingToggling = useCallback((key: string) => {
        setExpandedKeySet((currentKeySet) => {
            const newKeySet = new Set(currentKeySet);
            if (newKeySet.has(key)) {
                newKeySet.delete(key);
            } else {
                newKeySet.add(key);
            }
            return newKeySet;
        });
    }, []);
    const enabledKeysRef = useAppCurrentRef(enabledKeys);
    const handleAllToggling = useCallback(() => {
        handleKeysToggling(enabledKeysRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isAllSelected =
        enabledKeys.length > 0 && reportedKeys.length === enabledKeys.length;

    const renderLeaf = (leaf: ArchiveTreeChoiceType, isChild: boolean) => {
        const isDisabled = !!leaf.invalidMessage;
        return (
            <li
                key={leaf.key}
                className={
                    'list-group-item d-flex align-items-center' +
                    (isDisabled ? ' list-group-item-danger' : '')
                }
                style={isChild ? { paddingLeft: '2.75rem' } : undefined}
            >
                <label
                    className={
                        'd-flex align-items-center flex-grow-1 m-0' +
                        (isDisabled ? '' : ' app-caught-hover-pointer')
                    }
                >
                    <TreeCheckboxComp
                        isChecked={!isDisabled && selectedKeySet.has(leaf.key)}
                        isDisabled={isDisabled}
                        onToggle={() => {
                            handleKeysToggling([leaf.key]);
                        }}
                    />
                    <i className={`bi ${leaf.iconClassName} me-2`} />
                    <span className="flex-grow-1">{leaf.title}</span>
                </label>
                <TreeRowDetailComp choice={leaf} />
            </li>
        );
    };

    const renderParent = (parent: ArchiveTreeChoiceType) => {
        const children = parent.children ?? [];
        const childEnabledKeys = toEnabledLeafKeys(children);
        const selectedCount = childEnabledKeys.filter((key) => {
            return selectedKeySet.has(key);
        }).length;
        const isParentAllSelected =
            childEnabledKeys.length > 0 &&
            selectedCount === childEnabledKeys.length;
        const isExpanded = expandedKeySet.has(parent.key);
        return [
            <li
                key={parent.key}
                className="list-group-item d-flex align-items-center"
            >
                <button
                    className="btn btn-sm btn-link p-0 me-2 flex-shrink-0"
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={tran(isExpanded ? 'Collapse' : 'Expand')}
                    title={tran(isExpanded ? 'Collapse' : 'Expand')}
                    onClick={() => {
                        handleExpandingToggling(parent.key);
                    }}
                >
                    <i
                        className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}
                    />
                </button>
                <label className="d-flex align-items-center flex-grow-1 m-0 app-caught-hover-pointer">
                    <TreeCheckboxComp
                        isChecked={isParentAllSelected}
                        isIndeterminate={
                            selectedCount > 0 && !isParentAllSelected
                        }
                        isDisabled={childEnabledKeys.length === 0}
                        onToggle={() => {
                            handleKeysToggling(childEnabledKeys);
                        }}
                    />
                    <i className={`bi ${parent.iconClassName} me-2`} />
                    <span className="flex-grow-1">{parent.title}</span>
                </label>
                <TreeRowDetailComp choice={parent} />
            </li>,
            ...(isExpanded
                ? children.map((child) => {
                      return renderLeaf(child, true);
                  })
                : []),
        ];
    };

    return (
        <div className="app-archive-tree-selector d-flex flex-column">
            <div className="d-flex align-items-center mb-2">
                <span className="flex-grow-1">{tran(message)}</span>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={enabledKeys.length === 0}
                    onClick={handleAllToggling}
                >
                    {tran(isAllSelected ? 'Deselect All' : 'Select All')}
                </button>
            </div>
            <ul
                className="list-group overflow-auto"
                style={{ maxHeight: '50vh' }}
            >
                {choices.flatMap((choice) => {
                    return checkIsParent(choice)
                        ? renderParent(choice)
                        : [renderLeaf(choice, false)];
                })}
            </ul>
            {reportedKeys.length === 0 ? (
                <div className="mt-2" style={{ color: 'var(--bs-warning)' }}>
                    {tran('Nothing is selected')}
                </div>
            ) : null}
        </div>
    );
}
