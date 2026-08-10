import './LocationNameLookupPanelComp.scss';

import type { DetailPanelKindType } from './detailPanelHelpers';
import { openDetailPanel } from './detailPanelHelpers';

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
        </li>
    );
}
