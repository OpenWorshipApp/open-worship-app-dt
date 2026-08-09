import './LocationNameLookupPanelComp.scss';

import { useMemo, useRef, useState } from 'react';
import type { MentionNameType } from 'bible-note';

import { useBibleViewTextScale } from '../helper/bibleViewHelpers';
import { useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import LoadingComp from '../others/LoadingComp';
import { tran } from '../lang/langHelpers';
import {
    ALL_TYPES,
    LOCATION_ICON_CLASS,
    NAME_TYPE_LABEL,
    PAGE_SIZE,
    getNameTypeIconClass,
    getPlainReferenceText,
} from './lookupPresentationHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import { useLookupManagers } from './lookupManagersContext';
import { openDetailPanel } from './detailPanelHelpers';
import type { DetailPanelKindType } from './detailPanelHelpers';

type LookupTabType = 'name' | 'location';

// Shown in the (disabled) type filter on the location tab, where it does not
// apply. A distinct value so the select never renders an out-of-range option.
const TYPE_FILTER_NA_VALUE = '__na__';

// Long enough that holding a key down does not run a scan per character, short
// enough to still feel live.
const SEARCH_DEBOUNCE_MILLISECOND = 300;

type LookupRecordType = {
    id: string;
    name: string;
    title: string;
    iconClass: string;
};

type LookupPageType = {
    page: number;
    totalPages: number;
    totalRecords: number;
    records: LookupRecordType[];
};

function RenderLookupItemComp({
    kind,
    record,
}: Readonly<{
    kind: DetailPanelKindType;
    record: LookupRecordType;
}>) {
    return (
        <li className="list-group-item p-0 bg-transparent">
            <button
                className={
                    'btn btn-sm w-100 text-start d-flex align-items-start' +
                    ' gap-2 px-2 py-1 rounded-0'
                }
                type="button"
                title={record.title || record.name}
                onClick={() => {
                    openDetailPanel({
                        kind,
                        target: record.id,
                        name: record.name,
                    });
                }}
            >
                <i className={`${record.iconClass} mt-1 text-secondary`} />
                <span className="d-flex flex-column location-name-lookup__text">
                    <span className="fw-semibold text-truncate">
                        {record.name}
                    </span>
                    {record.title ? (
                        <span className="small text-secondary location-name-lookup__title">
                            {record.title}
                        </span>
                    ) : null}
                </span>
            </button>
        </li>
    );
}

function RenderPaginationComp({
    safePage,
    totalPages,
    totalRecords,
    setPage,
}: Readonly<{
    safePage: number;
    totalPages: number;
    totalRecords: number;
    setPage: (page: number) => void;
}>) {
    const [pageInput, setPageInput] = useState(`${safePage}`);
    const totalPagesDigitCount = `${totalPages}`.length;
    // Set when Enter/Escape already handled the value, so the programmatic blur
    // they trigger does not commit the draft a second time.
    const shouldSkipBlurCommitRef = useRef(false);
    // Mirror the committed page back into the editable field (arrows, clamping).
    useAppEffect(() => {
        setPageInput(`${safePage}`);
    }, [safePage]);
    const commitPageInput = () => {
        const parsed = Number.parseInt(pageInput, 10);
        if (Number.isNaN(parsed)) {
            setPageInput(`${safePage}`);
            return;
        }
        setPage(Math.min(totalPages, Math.max(1, parsed)));
    };
    return (
        <div
            className={
                'd-flex align-items-center justify-content-between gap-2' +
                ' px-2 py-1 border-top'
            }
        >
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Previous')}
                aria-label={tran('Previous')}
                disabled={safePage <= 1}
                onClick={() => {
                    setPage(Math.max(1, safePage - 1));
                }}
            >
                <i className="bi bi-chevron-left" />
            </button>
            <span
                className={
                    'small text-secondary text-nowrap d-inline-flex' +
                    ' align-items-center gap-1'
                }
            >
                <input
                    className="form-control form-control-sm text-center"
                    type="text"
                    inputMode="numeric"
                    aria-label={tran('Jump to page')}
                    title={tran('Type a page number and press Enter')}
                    value={pageInput}
                    style={{ width: `${totalPagesDigitCount + 3}ch` }}
                    onChange={(event) => {
                        setPageInput(event.target.value.replace(/\D/g, ''));
                    }}
                    onFocus={(event) => {
                        event.target.select();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            shouldSkipBlurCommitRef.current = true;
                            commitPageInput();
                            event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                            shouldSkipBlurCommitRef.current = true;
                            setPageInput(`${safePage}`);
                            event.currentTarget.blur();
                        }
                    }}
                    onBlur={() => {
                        if (shouldSkipBlurCommitRef.current) {
                            shouldSkipBlurCommitRef.current = false;
                            return;
                        }
                        commitPageInput();
                    }}
                />
                {`/ ${totalPages} · ${totalRecords}`}
            </span>
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Next')}
                aria-label={tran('Next')}
                disabled={safePage >= totalPages}
                onClick={() => {
                    setPage(Math.min(totalPages, safePage + 1));
                }}
            >
                <i className="bi bi-chevron-right" />
            </button>
        </div>
    );
}

function RenderResultListComp({
    kind,
    query,
    search,
}: Readonly<{
    kind: DetailPanelKindType;
    query: string;
    // Asks the tab's lookup manager for one page of results. Filtering, ranking
    // and clamping all happen in there.
    search: (query: string, page: number) => LookupPageType;
}>) {
    const [page, setPage] = useState(1);
    // Reading a page is a synchronous scan over thousands of records and, for an
    // empty query, a copy of the whole sorted array — so it must happen only
    // when the query, the filter or the page actually changes, never on an
    // unrelated re-render.
    const result = useMemo(() => {
        return search(query, page);
    }, [search, query, page]);
    const { totalPages, totalRecords } = result;
    // The manager clamps out-of-range pages, so its answer is authoritative.
    const safePage = result.page;
    // A new query or type filter starts again at the first page. The manager
    // only CLAMPS the page it is handed (`Math.min(totalPages, ...)`), it never
    // resets it — so without this, searching from page 12 of the unfiltered
    // list lands on page 12 of the matches and hides every best-ranked result.
    // `search` changes identity with the type filter, so it covers that too.
    useAppEffect(() => {
        setPage(1);
    }, [search, query]);
    // Clamping still has to be mirrored back: the manager reporting a different
    // page than asked means the result set shrank under the current page.
    useAppEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);
    if (totalRecords === 0) {
        return (
            <div
                className={
                    'flex-fill d-flex align-items-center' +
                    ' justify-content-center text-secondary'
                }
            >
                {tran('No matches')}
            </div>
        );
    }
    return (
        <>
            <ul
                className={
                    'list-group list-group-flush flex-fill' +
                    ' location-name-lookup__list overflow-y-auto'
                }
            >
                {result.records.map((record) => {
                    return (
                        <RenderLookupItemComp
                            key={record.id}
                            kind={kind}
                            record={record}
                        />
                    );
                })}
            </ul>
            <RenderPaginationComp
                safePage={safePage}
                totalPages={totalPages}
                totalRecords={totalRecords}
                setPage={setPage}
            />
        </>
    );
}

function RenderLookupBodyComp({
    namesLookupManager,
    locationsLookupManager,
}: Readonly<LookupManagersType>) {
    const [activeTab, setActiveTab] = useState<LookupTabType>('name');
    const [nameTypeFilter, setNameTypeFilter] = useState<string>(ALL_TYPES);
    // Each tab keeps its own query so switching back and forth preserves what
    // was typed. The `typed*` half is what the box shows (immediate); the plain
    // half is what actually runs a search (debounced).
    const [typedNameQuery, setTypedNameQuery] = useState('');
    const [nameQuery, setNameQuery] = useState('');
    const [typedLocationQuery, setTypedLocationQuery] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    // Per instance: a module-level timer would collapse every mounted panel into
    // one and leave all but the last one showing stale results. Per TAB for the
    // same reason one level down — the two tabs keep independent queries, and a
    // shared timer let a tab switch inside the debounce window `clearTimeout`
    // the other tab's pending commit, leaving its box showing text it had never
    // actually searched for.
    const attemptNameTimeout = useMemo(() => {
        return genTimeoutAttempt(SEARCH_DEBOUNCE_MILLISECOND);
    }, []);
    const attemptLocationTimeout = useMemo(() => {
        return genTimeoutAttempt(SEARCH_DEBOUNCE_MILLISECOND);
    }, []);

    const textScale = useBibleViewTextScale();
    const isOnNameTab = activeTab === 'name';
    const typedQuery = isOnNameTab ? typedNameQuery : typedLocationQuery;
    const handleQueryChange = (value: string, isImmediate = false) => {
        const setTypedQuery = isOnNameTab
            ? setTypedNameQuery
            : setTypedLocationQuery;
        const setQuery = isOnNameTab ? setNameQuery : setLocationQuery;
        const attemptTimeout = isOnNameTab
            ? attemptNameTimeout
            : attemptLocationTimeout;
        setTypedQuery(value);
        attemptTimeout(() => {
            setQuery(value);
        }, isImmediate);
    };

    // Built from the records actually present, so the dropdown only ever offers
    // types that would return results. "All types" always leads.
    const nameTypeOptions = useMemo(() => {
        return [
            { value: ALL_TYPES, label: tran('All types') },
            ...namesLookupManager.nameTypes.map(({ type }) => {
                return { value: type, label: tran(NAME_TYPE_LABEL[type]) };
            }),
        ];
    }, [namesLookupManager]);

    const searchNames = useMemo(() => {
        return (searchQuery: string, page: number): LookupPageType => {
            const result = namesLookupManager.searchNamesPagination({
                query: searchQuery,
                page,
                pageSize: PAGE_SIZE,
                type:
                    nameTypeFilter === ALL_TYPES
                        ? undefined
                        : (nameTypeFilter as MentionNameType),
            });
            return {
                page: result.page,
                totalPages: result.totalPages,
                totalRecords: result.totalRecords,
                records: result.records.map((record) => {
                    return {
                        id: record.id,
                        name: record.name,
                        title: getPlainReferenceText(record.title),
                        iconClass: getNameTypeIconClass(record.type),
                    };
                }),
            };
        };
    }, [namesLookupManager, nameTypeFilter]);

    const searchLocations = useMemo(() => {
        return (searchQuery: string, page: number): LookupPageType => {
            const result = locationsLookupManager.searchLocationsPagination({
                query: searchQuery,
                page,
                pageSize: PAGE_SIZE,
            });
            return {
                page: result.page,
                totalPages: result.totalPages,
                totalRecords: result.totalRecords,
                records: result.records.map((record) => {
                    return {
                        id: record.id,
                        name: record.name,
                        title: getPlainReferenceText(record.title),
                        iconClass: LOCATION_ICON_CLASS,
                    };
                }),
            };
        };
    }, [locationsLookupManager]);

    return (
        <div
            className="location-name-lookup d-flex flex-column w-100 h-100"
            // Tracks the bible text zoom. `zoom` rather than `transform: scale`
            // so the content keeps a real layout box and still scrolls inside
            // the widget instead of being painted outside it.
            style={{ zoom: textScale }}
        >
            <div className="input-group input-group-sm p-2 pb-1">
                <span className="input-group-text">
                    <i className="bi bi-search" />
                </span>
                <input
                    className="form-control"
                    type="text"
                    value={typedQuery}
                    placeholder={
                        isOnNameTab
                            ? `${tran('Search names')}...`
                            : `${tran('Search locations')}...`
                    }
                    onChange={(event) => {
                        handleQueryChange(event.target.value);
                    }}
                />
                {typedQuery === '' ? null : (
                    <button
                        className="btn btn-outline-secondary"
                        type="button"
                        title={tran('Clear search')}
                        aria-label={tran('Clear search')}
                        onClick={() => {
                            handleQueryChange('', true);
                        }}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                )}
            </div>
            <div className="d-flex gap-1 px-2 pb-2">
                <div className="btn-group btn-group-sm" role="tablist">
                    <button
                        className={`btn btn-${
                            isOnNameTab ? 'primary' : 'outline-secondary'
                        }`}
                        type="button"
                        role="tab"
                        aria-selected={isOnNameTab}
                        onClick={() => {
                            setActiveTab('name');
                        }}
                    >
                        <i className="bi bi-person-fill" /> {tran('Names')}
                    </button>
                    <button
                        className={`btn btn-${
                            isOnNameTab ? 'outline-secondary' : 'primary'
                        }`}
                        type="button"
                        role="tab"
                        aria-selected={!isOnNameTab}
                        onClick={() => {
                            setActiveTab('location');
                        }}
                    >
                        <i className="bi bi-geo-alt-fill" /> {tran('Locations')}
                    </button>
                </div>
                <select
                    className="form-select form-select-sm location-name-lookup__filter"
                    aria-label={tran('Filter by name type')}
                    title={
                        isOnNameTab
                            ? tran('Filter by name type')
                            : tran('Type filter applies to names only')
                    }
                    value={isOnNameTab ? nameTypeFilter : TYPE_FILTER_NA_VALUE}
                    // Names carry a type; locations do not, so the filter is
                    // inert there and shows a placeholder instead.
                    disabled={!isOnNameTab}
                    onChange={(event) => {
                        setNameTypeFilter(event.target.value);
                    }}
                >
                    {isOnNameTab ? (
                        nameTypeOptions.map((option) => {
                            return (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            );
                        })
                    ) : (
                        <option value={TYPE_FILTER_NA_VALUE}>{'----'}</option>
                    )}
                </select>
            </div>
            {/* Keyed per tab so each one keeps its own page while the other's
                state is discarded rather than bleeding across. */}
            {isOnNameTab ? (
                <RenderResultListComp
                    key="name"
                    kind="name"
                    query={nameQuery}
                    search={searchNames}
                />
            ) : (
                <RenderResultListComp
                    key="location"
                    kind="location"
                    query={locationQuery}
                    search={searchLocations}
                />
            )}
        </div>
    );
}

export default function LocationNameLookupPanelComp() {
    const lookupData = useLookupManagers();
    if (lookupData === undefined) {
        return <LoadingComp message={tran('Loading lookup data')} />;
    }
    if (lookupData === null) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex align-items-center' +
                    ' justify-content-center text-danger p-2 text-center'
                }
            >
                {tran('Failed to load lookup data')}
            </div>
        );
    }
    return (
        <RenderLookupBodyComp
            namesLookupManager={lookupData.namesLookupManager}
            locationsLookupManager={lookupData.locationsLookupManager}
        />
    );
}
