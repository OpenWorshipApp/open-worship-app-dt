import type { CSSProperties, ReactNode } from 'react';

import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';

const CLAMPED_STYLE: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    cursor: 'pointer',
};

// A long note in the sharing settings reads as one line until it is opened
// (asked for 2026-10-08 with a picture of the Virtual Displays tab: "make
// those verbose message collapsed, expandable"): the internet warning and the
// tunnel and router explanations had pushed the switches a volunteer looks
// for off the panel. Folded, a note keeps its colour and its first words, so
// a warning still reads as one; the chevron (or a click on the line) opens
// it, and each note remembers being opened.
export default function CollapsibleNoteComp({
    settingName,
    className,
    children,
}: Readonly<{
    settingName: string;
    className?: string;
    children: ReactNode;
}>) {
    const [isExpanded, setIsExpanded] = useStateSettingBoolean(
        settingName,
        false,
    );
    const label = isExpanded ? tran('Collapse') : tran('Expand');
    const toggle = () => {
        setIsExpanded((value) => {
            return !value;
        });
    };
    return (
        <div className={`d-flex align-items-start gap-1 ${className ?? ''}`}>
            <button
                type="button"
                className="btn btn-link p-0 border-0 lh-base"
                style={{ color: 'inherit', textDecoration: 'none' }}
                aria-expanded={isExpanded}
                aria-label={label}
                title={label}
                onClick={toggle}
            >
                <i
                    className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}
                    aria-hidden
                />
            </button>
            <div
                className="flex-fill"
                style={isExpanded ? undefined : CLAMPED_STYLE}
                onClick={isExpanded ? undefined : toggle}
            >
                {children}
            </div>
        </div>
    );
}
