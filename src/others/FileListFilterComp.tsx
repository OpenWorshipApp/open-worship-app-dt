import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type {
    FileListFilterDataType,
    SortDataType,
    SortKeyType,
} from './fileListFilterHelpers';
import {
    genFileTypeNames,
    MIN_FILTERABLE_FILE_COUNT,
    SORT_KEY_NAME,
    SORT_KEY_NONE,
    SORT_KEY_TYPE,
} from './fileListFilterHelpers';

const SORT_ICON_MAP: { [key: string]: string } = {
    [`${SORT_KEY_NONE}-true`]: 'bi-sort-down',
    [`${SORT_KEY_NONE}-false`]: 'bi-sort-down',
    [`${SORT_KEY_NAME}-true`]: 'bi-sort-alpha-down',
    [`${SORT_KEY_NAME}-false`]: 'bi-sort-alpha-up',
    [`${SORT_KEY_TYPE}-true`]: 'bi-sort-down-alt',
    [`${SORT_KEY_TYPE}-false`]: 'bi-sort-up-alt',
};

// Matches the reload/add icons this sits next to in the path title row: a bare
// icon, no button chrome, tinted only while its filter is doing something.
function RenderIconComp({
    iconClassName,
    title,
    isActive,
    onClick,
}: Readonly<{
    iconClassName: string;
    title: string;
    isActive: boolean;
    onClick: (event: MouseEvent) => void;
}>) {
    return (
        <div
            className="px-1 app-caught-hover-pointer"
            title={title}
            onClick={onClick}
            // The path title is one line in a narrow sidebar; an icon that can
            // shrink or wrap pushes the whole row to two lines.
            style={{
                flexShrink: 0,
                ...(isActive ? { color: 'var(--bs-info)' } : {}),
            }}
        >
            <i className={`bi ${iconClassName}`} />
        </div>
    );
}

function genCheckIcon(isActive: boolean) {
    return genContextMenuItemIcon('check2', {
        opacity: isActive ? 1 : 0,
    });
}

function genSortMenuItem(
    label: string,
    key: SortKeyType,
    isAscending: boolean,
    sortData: SortDataType,
    setSortData: (sortData: SortDataType) => void,
): ContextMenuItemType {
    const isActive =
        sortData.key === key &&
        (key === SORT_KEY_NONE || sortData.isAscending === isAscending);
    return {
        childBefore: genCheckIcon(isActive),
        menuElement: tran(label),
        childAfter:
            key === SORT_KEY_NONE
                ? undefined
                : genContextMenuItemIcon(
                      isAscending ? 'arrow-down' : 'arrow-up',
                  ),
        onSelect: () => {
            setSortData({ key, isAscending });
        },
    };
}

export default function FileListFilterIconsComp({
    filePaths,
    filterData,
}: Readonly<{
    filePaths: string[];
    filterData: FileListFilterDataType;
}>) {
    const {
        setFilterText,
        isSearchShowing,
        setIsSearchShowing,
        sortData,
        setSortData,
        filterTypeName,
        setFilterTypeName,
    } = filterData;
    const typeNames = useMemo(() => {
        return genFileTypeNames(filePaths);
    }, [filePaths]);

    // Hiding the input also drops the filter: a short list with no visible
    // reason for being short is the worst state this feature could leave
    // behind, so "input hidden" always means "no name filter".
    const isSearchShowingRef = useAppCurrentRef(isSearchShowing);
    const setIsSearchShowingRef = useAppCurrentRef(setIsSearchShowing);
    const setFilterTextRef = useAppCurrentRef(setFilterText);
    const handleSearchToggling = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        const isShowing = !isSearchShowingRef.current;
        setIsSearchShowingRef.current(isShowing);
        if (!isShowing) {
            setFilterTextRef.current('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sortDataRef = useAppCurrentRef(sortData);
    const setSortDataRef = useAppCurrentRef(setSortData);
    const typeNamesRef = useAppCurrentRef(typeNames);
    const handleSortMenuOpening = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        const currentSortData = sortDataRef.current;
        const setter = setSortDataRef.current;
        const menuItems: ContextMenuItemType[] = [
            genSortMenuItem(
                'Default',
                SORT_KEY_NONE,
                true,
                currentSortData,
                setter,
            ),
            genSortMenuItem(
                'Name',
                SORT_KEY_NAME,
                true,
                currentSortData,
                setter,
            ),
            genSortMenuItem(
                'Name',
                SORT_KEY_NAME,
                false,
                currentSortData,
                setter,
            ),
        ];
        if (typeNamesRef.current.length > 1) {
            menuItems.push(
                genSortMenuItem(
                    'Type',
                    SORT_KEY_TYPE,
                    true,
                    currentSortData,
                    setter,
                ),
                genSortMenuItem(
                    'Type',
                    SORT_KEY_TYPE,
                    false,
                    currentSortData,
                    setter,
                ),
            );
        }
        showAppContextMenu(event as any, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filterTypeNameRef = useAppCurrentRef(filterTypeName);
    const setFilterTypeNameRef = useAppCurrentRef(setFilterTypeName);
    const handleTypeMenuOpening = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        const currentTypeName = filterTypeNameRef.current;
        const setter = setFilterTypeNameRef.current;
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genCheckIcon(currentTypeName === ''),
                menuElement: tran('All Types'),
                onSelect: () => {
                    setter('');
                },
            },
            ...typeNamesRef.current.map((typeName) => {
                return {
                    childBefore: genCheckIcon(currentTypeName === typeName),
                    menuElement: typeName,
                    onSelect: () => {
                        setter(typeName);
                    },
                };
            }),
        ];
        showAppContextMenu(event as any, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (filePaths.length < MIN_FILTERABLE_FILE_COUNT) {
        return null;
    }
    return (
        <>
            <RenderIconComp
                iconClassName="bi-search"
                title={tran('Filter by name')}
                isActive={isSearchShowing}
                onClick={handleSearchToggling}
            />
            <RenderIconComp
                iconClassName={
                    SORT_ICON_MAP[`${sortData.key}-${sortData.isAscending}`]
                }
                title={tran('Sort')}
                isActive={sortData.key !== SORT_KEY_NONE}
                onClick={handleSortMenuOpening}
            />
            {typeNames.length > 1 ? (
                <RenderIconComp
                    iconClassName={
                        filterTypeName === '' ? 'bi-funnel' : 'bi-funnel-fill'
                    }
                    title={
                        filterTypeName === ''
                            ? tran('Filter by Type')
                            : `${tran('Filter by Type')}: ${filterTypeName}`
                    }
                    isActive={filterTypeName !== ''}
                    onClick={handleTypeMenuOpening}
                />
            ) : null}
        </>
    );
}

export function FileListFilterInputComp({
    filterData,
}: Readonly<{ filterData: FileListFilterDataType }>) {
    const { filterText, setFilterText, setIsSearchShowing } = filterData;
    // Typing must not re-render the whole list on every keystroke, so the input
    // keeps its own state and only the trailing value is pushed to the list.
    const [text, setText] = useState(filterText);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(300);
    }, []);
    const setFilterTextRef = useAppCurrentRef(setFilterText);
    const handleTextChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const newText = event.target.value;
            setText(newText);
            attemptTimeout(() => {
                setFilterTextRef.current(newText);
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setIsSearchShowingRef = useAppCurrentRef(setIsSearchShowing);
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setIsSearchShowingRef.current(false);
                setFilterTextRef.current('');
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleSelfClicking = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);
    return (
        <input
            type="text"
            className="form-control form-control-sm w-100 mb-1"
            placeholder={tran('Filter by name')}
            title={tran('Filter by name')}
            aria-label={tran('Filter by name')}
            value={text}
            autoFocus
            onClick={handleSelfClicking}
            onChange={handleTextChanging}
            onKeyDown={handleKeyDown}
        />
    );
}
