import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { mapInYieldingBatches } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import { openDetailPanel } from './detailPanelHelpers';
import { useLookupManagersContext } from './lookupManagersContext';
import {
    checkHasDetailValue,
    getFormattedDetailValue,
    getFormattedLinkType,
    resolveLocationReference,
} from './lookupRecordHelpers';
import { getPlainReferenceText } from './lookupPresentationHelpers';
import { shortToVerseTitle } from './bibleVerseHelpers';

// Same tokens as `getPlainReferenceText` strips, but with the scheme and target
// captured so each one becomes a button that opens the referenced record.
const REFERENCE_TOKEN_PARSE_REGEX =
    /\[([^\]]+)\]\((name-id|location-id|verse-key):\/\/([^)]*)\)/g;

type ReferenceSegmentType =
    | { kind: 'text'; text: string }
    | { kind: 'name' | 'location' | 'verse'; label: string; target: string };

function parseReferenceSegments(value: string): ReferenceSegmentType[] {
    const segments: ReferenceSegmentType[] = [];
    const regex = new RegExp(REFERENCE_TOKEN_PARSE_REGEX);
    let lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(value);
    while (match !== null) {
        if (match.index > lastIndex) {
            segments.push({
                kind: 'text',
                text: value.slice(lastIndex, match.index),
            });
        }
        const [, label, scheme, rawTarget] = match;
        const target = rawTarget.trim();
        if (target === '') {
            segments.push({ kind: 'text', text: label });
        } else if (scheme === 'name-id') {
            segments.push({ kind: 'name', label, target });
        } else if (scheme === 'location-id') {
            segments.push({ kind: 'location', label, target });
        } else {
            segments.push({ kind: 'verse', label, target });
        }
        lastIndex = regex.lastIndex;
        match = regex.exec(value);
    }
    if (lastIndex < value.length) {
        segments.push({ kind: 'text', text: value.slice(lastIndex) });
    }
    return segments;
}

/**
 * Renders a title/description, turning its inline reference tokens — e.g.
 * `[Moses](name-id://<id>)` — into buttons that open the referenced record.
 */
export function ReferenceTextComp({ value }: Readonly<{ value: string }>) {
    const { namesLookupManager, locationsLookupManager } =
        useLookupManagersContext();
    const segments = useMemo(() => {
        return parseReferenceSegments(value);
    }, [value]);
    // The label is what the author typed into the token; the canonical record
    // name is preferred whenever the id still resolves.
    const resolveName = (segment: ReferenceSegmentType) => {
        if (segment.kind === 'name') {
            return (
                namesLookupManager.getRecordById(segment.target)?.name ??
                segment.label
            );
        }
        if (segment.kind === 'location') {
            return (
                locationsLookupManager.getRecordById(segment.target)?.name ??
                segment.label
            );
        }
        return segment.kind === 'text' ? '' : segment.label;
    };
    return (
        <>
            {segments.map((segment, index) => {
                const key = `${index}:${segment.kind}`;
                if (segment.kind === 'text') {
                    return <Fragment key={key}>{segment.text}</Fragment>;
                }
                return (
                    <button
                        key={key}
                        className="location-name-lookup__ref-link"
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openDetailPanel({
                                kind: segment.kind,
                                target: segment.target,
                                name: resolveName(segment),
                            });
                        }}
                    >
                        {segment.label}
                    </button>
                );
            })}
        </>
    );
}

export function DetailRowComp({
    isInline = false,
    label,
    value,
}: Readonly<{ isInline?: boolean; label: string; value: ReactNode }>) {
    return (
        <div
            className={
                'location-name-lookup__row' +
                (isInline ? ' location-name-lookup__row--inline' : '')
            }
        >
            <dt>{isInline ? `${label}:` : label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

/**
 * A labelled section that can be folded away, showing how many entries it holds
 * while closed.
 *
 * Its children are UNMOUNTED while closed, not merely hidden, so a section is
 * free until it is opened — that is what keeps a record like Egypt, whose Verses
 * section lists 558 references, from doing any work nobody asked for. `onExpand`
 * fires on the first open so a section can start loading only then.
 */
export function CollapsibleRowComp({
    children,
    count,
    isDefaultOpen = true,
    label,
    onExpand,
}: Readonly<{
    children: ReactNode;
    count: number;
    isDefaultOpen?: boolean;
    label: string;
    onExpand?: () => void;
}>) {
    const [isOpen, setIsOpen] = useState(isDefaultOpen);
    return (
        <div
            className={
                'location-name-lookup__row' +
                ' location-name-lookup__row--collapsible'
            }
        >
            <dt>
                <button
                    className="location-name-lookup__section-toggle"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                        const nextIsOpen = !isOpen;
                        setIsOpen(nextIsOpen);
                        if (nextIsOpen) {
                            onExpand?.();
                        }
                    }}
                >
                    <i
                        className={`bi bi-chevron-${isOpen ? 'down' : 'right'}`}
                        aria-hidden="true"
                    />
                    <span>{label}</span>
                    {count > 0 ? (
                        <span className="location-name-lookup__section-count">
                            {count}
                        </span>
                    ) : null}
                </button>
            </dt>
            {isOpen ? <dd>{children}</dd> : null}
        </div>
    );
}

export function OptionalTextRowComp({
    label,
    value,
}: Readonly<{ label: string; value: string | null }>) {
    if (!checkHasDetailValue(value)) {
        return null;
    }
    return (
        <DetailRowComp
            isInline
            label={label}
            value={getFormattedDetailValue(value)}
        />
    );
}

export function OptionalTextListRowComp({
    label,
    values,
}: Readonly<{ label: string; values: string[] }>) {
    if (values.length === 0) {
        return null;
    }
    return (
        <CollapsibleRowComp label={label} count={values.length}>
            <ul className="location-name-lookup__detail-list">
                {values.map((value) => {
                    return <li key={value}>{value}</li>;
                })}
            </ul>
        </CollapsibleRowComp>
    );
}

export function OptionalLinkRowComp({
    links,
}: Readonly<{ links: { type: string; url: string }[] }>) {
    if (links.length === 0) {
        return null;
    }
    return (
        <CollapsibleRowComp label={tran('Links')} count={links.length}>
            <ul className="location-name-lookup__detail-list">
                {links.map((link) => {
                    return (
                        <li key={`${link.type}:${link.url}`}>
                            <a href={link.url} rel="noreferrer" target="_blank">
                                {getFormattedLinkType(link.type)}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </CollapsibleRowComp>
    );
}

/**
 * A list of name-record ids rendered as buttons opening each referenced person.
 * Ids that no longer resolve fall back to inert text rather than a dead button.
 */
export function OptionalNameListRowComp({
    ids,
    label,
}: Readonly<{ ids: string[]; label: string }>) {
    const { namesLookupManager } = useLookupManagersContext();
    if (ids.length === 0) {
        return null;
    }
    return (
        <CollapsibleRowComp label={label} count={ids.length}>
            <ul className="location-name-lookup__detail-list">
                {ids.map((id) => {
                    const record = namesLookupManager.getRecordById(id);
                    if (record === null) {
                        return <li key={id}>{id}</li>;
                    }
                    return (
                        <li key={id}>
                            <button
                                className="location-name-lookup__ref-link"
                                type="button"
                                title={
                                    getPlainReferenceText(record.title) ||
                                    undefined
                                }
                                onClick={() => {
                                    openDetailPanel({
                                        kind: 'name',
                                        target: record.id,
                                        name: record.name,
                                    });
                                }}
                            >
                                {record.name}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </CollapsibleRowComp>
    );
}

export function OptionalLocationListRowComp({
    label,
    values,
}: Readonly<{ label: string; values: string[] }>) {
    const { locationsLookupManager } = useLookupManagersContext();
    if (values.length === 0) {
        return null;
    }
    return (
        <CollapsibleRowComp label={label} count={values.length}>
            <ul className="location-name-lookup__detail-list">
                {values.map((idOrName) => {
                    const record = resolveLocationReference(
                        locationsLookupManager,
                        idOrName,
                    );
                    if (record === null) {
                        return <li key={idOrName}>{idOrName}</li>;
                    }
                    return (
                        <li key={idOrName}>
                            <button
                                className="location-name-lookup__ref-link"
                                type="button"
                                title={
                                    getPlainReferenceText(record.title) ||
                                    undefined
                                }
                                onClick={() => {
                                    openDetailPanel({
                                        kind: 'location',
                                        target: record.id,
                                        name: record.name,
                                    });
                                }}
                            >
                                {record.name}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </CollapsibleRowComp>
    );
}

// One commit of ~700 rows is a stall in its own right, separate from the reads,
// and nobody scrolls a 700-row list inside a 360px widget. A page at a time
// keeps the section instant to open; the reads below still resolve EVERY title,
// so what Copy puts on the clipboard is unaffected by how far the user paged.
const VERSE_PAGE_SIZE = 50;

/**
 * The Verses section: collapsed by default, and resolved only once opened.
 *
 * Turning a short reference into a readable title costs one bible read each, and
 * records carry far more of them than anything else here — Egypt lists 558,
 * Jerusalem 712. So nothing is read until the user opens the section, and even
 * then the list renders immediately with the raw references while the titles
 * fill in behind it.
 *
 * The reads go through `mapInYieldingBatches` rather than one `Promise.all`:
 * each title ends in synchronous work, so resolving them all in a single chain
 * drained the microtask queue for 4.2 seconds without ever letting the renderer
 * paint or answer a click.
 */
export function OptionalVerseListRowComp({
    values,
    onResolved,
}: Readonly<{
    values: string[];
    onResolved?: (titles: string[]) => void;
}>) {
    const [hasBeenExpanded, setHasBeenExpanded] = useState(false);
    const [shownCount, setShownCount] = useState(VERSE_PAGE_SIZE);
    const [titleMap] = useAppStateAsync(async () => {
        if (!hasBeenExpanded) {
            return null;
        }
        const entries = await mapInYieldingBatches(
            values,
            async (shortVerse) => {
                try {
                    const title = await shortToVerseTitle(shortVerse);
                    return [shortVerse, title ?? shortVerse] as const;
                } catch {
                    return [shortVerse, shortVerse] as const;
                }
            },
        );
        return Object.fromEntries(entries) as { [key: string]: string };
    }, [hasBeenExpanded, values]);
    const onResolvedRef = useAppCurrentRef(onResolved);
    useAppEffect(() => {
        if (titleMap != null) {
            onResolvedRef.current?.(
                values.map((shortVerse) => {
                    return titleMap[shortVerse] ?? shortVerse;
                }),
            );
        }
    }, [titleMap]);
    if (values.length === 0) {
        return null;
    }
    const remainingCount = values.length - shownCount;
    return (
        <CollapsibleRowComp
            label={tran('Verses')}
            count={values.length}
            isDefaultOpen={false}
            onExpand={() => {
                setHasBeenExpanded(true);
            }}
        >
            <ul className="location-name-lookup__detail-list">
                {values.slice(0, shownCount).map((shortVerse) => {
                    const verseTitle = titleMap?.[shortVerse] ?? shortVerse;
                    return (
                        <li key={shortVerse}>
                            <button
                                className="location-name-lookup__ref-link"
                                type="button"
                                onClick={() => {
                                    openDetailPanel({
                                        kind: 'verse',
                                        target: shortVerse,
                                        name: verseTitle,
                                    });
                                }}
                            >
                                {verseTitle}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {remainingCount > 0 ? (
                <button
                    className="location-name-lookup__show-more"
                    type="button"
                    onClick={() => {
                        setShownCount((oldCount) => {
                            return oldCount + VERSE_PAGE_SIZE;
                        });
                    }}
                >
                    {`${tran('Show more')} (${remainingCount})`}
                </button>
            ) : null}
        </CollapsibleRowComp>
    );
}

/**
 * The outer `Details` disclosure. Its content is unmounted while closed, not
 * merely hidden, so the sections inside it cost nothing until it is opened.
 */
export function DetailsSectionComp({
    children,
}: Readonly<{ children: ReactNode }>) {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="location-name-lookup__details">
            <button
                className="location-name-lookup__details-summary"
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                    setIsOpen(!isOpen);
                }}
            >
                <i
                    className={`bi bi-chevron-${isOpen ? 'down' : 'right'}`}
                    aria-hidden="true"
                />
                <span>{tran('Details')}</span>
            </button>
            {isOpen ? <div>{children}</div> : null}
        </div>
    );
}

export function BasicInfoComp({
    description,
    facts,
    title,
}: Readonly<{ description: string; facts: string[]; title: string }>) {
    return (
        <div className="location-name-lookup__basic-info">
            {title ? (
                <div className="location-name-lookup__basic-title">
                    <ReferenceTextComp value={title} />
                </div>
            ) : null}
            {description ? (
                <p className="location-name-lookup__basic-description">
                    <ReferenceTextComp value={description} />
                </p>
            ) : null}
            {facts.length > 0 ? (
                <div className="location-name-lookup__facts">
                    {facts.map((fact) => {
                        return <span key={fact}>{fact}</span>;
                    })}
                </div>
            ) : null}
        </div>
    );
}
