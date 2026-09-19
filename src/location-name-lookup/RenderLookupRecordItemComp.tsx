import './LocationNameLookupPanelComp.scss';

import type { MouseEvent } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { showGraphPreviewContextMenu } from '../graph-view/graphContextMenuHelpers';
import type { DetailPanelKindType } from './detailPanelHelpers';
import { openDetailPanel } from './detailPanelHelpers';
import { getRecordDisplayName } from './lookupPresentationHelpers';

/**
 * One record row — icon, name, one-line description — shared by the floating
 * lookup panel and the reading-verses tab so a record looks the same wherever it
 * is listed and only one place owns the truncation rules.
 *
 * Styling is scoped under `.location-name-lookup`, so a host must carry that
 * class on the element the rows live in.
 */

export type LookupRecordItemType = {
    id: string;
    name: string;
    // The record's English (KJV) name when the lookup language is not English,
    // shown beside the translated one the way a bible book reads
    // `លោកុប្បត្តិ (Genesis)`. Empty whenever there is nothing to add.
    kjvName: string;
    title: string;
    iconClass: string;
};

export default function RenderLookupRecordItemComp({
    kind,
    record,
    extraLabel,
}: Readonly<{
    kind: DetailPanelKindType;
    record: LookupRecordItemType;
    // Where the record was found, e.g. the verses of the passage attesting it.
    extraLabel?: string;
}>) {
    const showContextMenu = (event: MouseEvent) => {
        showGraphPreviewContextMenu(event.nativeEvent, {
            kind,
            recordId: record.id,
            name: record.name,
        });
    };
    return (
        // The row is a flex ROW of two siblings rather than one button with the
        // menu nested inside it: a button inside a button is invalid markup and
        // the inner one's clicks would still open the detail panel behind the
        // menu.
        <li
            className={
                'list-group-item p-0 bg-transparent d-flex align-items-start' +
                ' location-name-lookup__record-row'
            }
        >
            <button
                className={
                    'btn btn-sm text-start d-flex align-items-start' +
                    ' gap-2 px-2 py-1 rounded-0' +
                    ' location-name-lookup__record-button'
                }
                type="button"
                title={record.title || getRecordDisplayName(record)}
                onClick={() => {
                    openDetailPanel({
                        kind,
                        target: record.id,
                        name: record.name,
                    });
                }}
                onContextMenu={showContextMenu}
            >
                <i className={`${record.iconClass} mt-1 text-secondary`} />
                <span className="d-flex flex-column location-name-lookup__text">
                    <span className="fw-semibold text-truncate">
                        {record.name}
                        {record.kjvName ? (
                            <span
                                className={
                                    'ms-1 fw-normal' +
                                    ' location-name-lookup__kjv-name'
                                }
                            >
                                ({record.kjvName})
                            </span>
                        ) : null}
                        {extraLabel ? (
                            <span className="ms-2 small fw-normal text-secondary">
                                {extraLabel}
                            </span>
                        ) : null}
                    </span>
                    {record.title ? (
                        <span className="small text-secondary location-name-lookup__title">
                            <span>{record.title}</span>
                        </span>
                    ) : null}
                </span>
            </button>
            {/* Right-clicking the row opens the same menu; this makes it
                reachable without a right button — and visible at all, which a
                context menu on a plain-looking list row is not. */}
            <ContextMenuDotsButtonComp
                className="location-name-lookup__record-menu"
                onOpening={showContextMenu}
            />
        </li>
    );
}
