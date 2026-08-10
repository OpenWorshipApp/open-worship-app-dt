import type { CSSProperties, ReactNode } from 'react';

import { createMouseEvent } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import {
    PRESENTING_FLOW_CC_ROW_ATTR,
    PRESENTING_FLOW_ITEM_UUID_ATTR,
} from './presentingFlowCcHelpers';
import PresentingFlowRowGutterComp from './PresentingFlowRowGutterComp';

/**
 * One brief line in the presenting flow tree. Deliberately text-only: a presenting flow can
 * hold a lot of entries and a thumbnail per row would mean decoding every
 * referenced image/video just to draw the list. Rich previews live in the
 * floating preview widget, which the user opens on demand.
 */
export default function PresentingFlowRowComp({
    depth = 0,
    lineNumber = null,
    isCommand = false,
    isRunCursor = false,
    idLabel,
    iconName,
    iconColor,
    label,
    title,
    isExpandable = false,
    isExpanded = false,
    onToggleExpanding,
    onClick,
    onDragStart,
    onDragEnd,
    onContextMenu,
    colorNote,
    isOnScreen = false,
    isDisabled = false,
    isPresentingFlowDisabled = false,
    itemUuid,
    isCcRow = false,
    onDragOver,
    onDragLeave,
    onDrop,
    extraChild,
    extraClassName = '',
    extraStyle = {},
}: Readonly<{
    depth?: number;
    // WHICH line of the run sheet this is, 1-based, or null on a row that is not
    // a line of it at all — a CC riding with one, a slide a document holds, a
    // placeholder. The gutter draws its rail either way, so the column stays
    // unbroken; only the lines the run can stop on are numbered.
    lineNumber?: number | null;
    // A line that DOES something rather than one that goes to a screen. Carried
    // by the number's register, not by a colour of its own — see the gutter.
    isCommand?: boolean;
    isRunCursor?: boolean;
    idLabel?: string;
    iconName: string;
    iconColor?: string;
    label: string;
    title?: string;
    isExpandable?: boolean;
    isExpanded?: boolean;
    onToggleExpanding?: (event: any) => void;
    onClick?: (event: any) => void;
    onDragStart?: (event: any) => void;
    onDragEnd?: (event: any) => void;
    onContextMenu?: (event: any) => void;
    colorNote?: string | null;
    isDisabled?: boolean;
    // WHY it is parked, which is the one thing the operator can act on here: the
    // run sheet parked it (this presenting flow's own flag, or the document element
    // above it being parked) rather than the document itself hiding the slide.
    // Only the first kind is undone from a presenting flow, so the two must not look
    // alike — a document-hidden row is a dead end here whatever is clicked.
    isPresentingFlowDisabled?: boolean;
    isOnScreen?: boolean;
    // WHICH line of the sheet this row is, so a CC pointing at it can find it
    // with one query rather than the tree keeping a ref per row. Absent on rows
    // nothing can point at (a loading/empty placeholder, a slide of a document,
    // and a CC row itself — a CC names an element, never another CC).
    itemUuid?: string | null;
    isCcRow?: boolean;
    onDragOver?: (event: any) => void;
    onDragLeave?: (event: any) => void;
    onDrop?: (event: any) => void;
    extraChild?: ReactNode;
    extraClassName?: string;
    extraStyle?: CSSProperties;
}>) {
    // The flag alone means nothing on a row that is in play, and a caller that
    // only tracks where a park CAME from would otherwise mark a live row.
    const isParkedByPresentingFlow = isDisabled && isPresentingFlowDisabled;
    // A parked row is deliberately still reachable — right-clicking it is the way
    // back — but it fires nothing, so it is not offered as a button.
    const isActivatable = onClick !== undefined && !isDisabled;
    return (
        <div
            className={
                'app-presenting-flow-row d-flex align-items-center' +
                (isRunCursor ? ' app-presenting-flow-row-run-cursor' : '') +
                (isDisabled ? ' app-presenting-flow-row-disabled' : '') +
                // Carries no style of its own — the strike is on the label and
                // the tint on the glyph — but it is what tells the two parks
                // apart from outside the component, which is the only way a
                // test or a QA pass can check the right one was drawn.
                (isParkedByPresentingFlow
                    ? ' app-presenting-flow-row-disabled-presenting-flow'
                    : '') +
                ` ${extraClassName}`
            }
            style={{
                // NOT padded by depth any more: the gutter below is a column the
                // eye tracks straight down, and indenting the whole row would
                // step it out of line on every nested row — which is most of a
                // run sheet that lists a document. The indent is applied AFTER
                // the gutter instead.
                //
                // Colour-grouped rows keep their presenting flow order — the running
                // order IS the meaning here — so the group shows as a stripe
                // rather than by re-sorting the list.
                borderLeft: colorNote
                    ? `3px solid ${colorNote}`
                    : '3px solid transparent',
            }}
            // Says WHY the row does nothing when it is clicked — dimming alone
            // reads as "still loading" just as easily as "parked" — and WHERE
            // it was parked, since only one of the two is undone from here.
            title={
                (isDisabled
                    ? `${tran(
                          isParkedByPresentingFlow
                              ? 'This item is disabled in this presenting flow'
                              : 'This item is disabled in its document',
                      )}\n`
                    : '') + (title ?? label)
            }
            draggable={onDragStart !== undefined}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onClick}
            onContextMenu={onContextMenu}
            {...(isActivatable
                ? {
                      role: 'button',
                      tabIndex: 0,
                      // ENTER alone, deliberately not Space. Space is the run's
                      // own next-key, registered on the window and gated on focus
                      // being inside the floating preview — and CC rows are drawn
                      // in there too, so a Space handler here would fire the row
                      // AND step the run on one press. Enter is unclaimed.
                      onKeyDown: (event: any) => {
                          if (event.key !== 'Enter') {
                              return;
                          }
                          event.preventDefault();
                          // A keyboard event carries no coordinates, and what a
                          // click reaches here may still have to ask WHICH screen
                          // with a menu it positions from the event. Pointed at
                          // the row instead, exactly as the preview widget aims
                          // the same question (`toElementMouseEvent`).
                          const rect =
                              event.currentTarget.getBoundingClientRect();
                          onClick(
                              createMouseEvent(rect.left + 8, rect.top + 8),
                          );
                      },
                  }
                : {})}
            {...(itemUuid === undefined || itemUuid === null
                ? {}
                : { [PRESENTING_FLOW_ITEM_UUID_ATTR]: itemUuid })}
            {...(isCcRow ? { [PRESENTING_FLOW_CC_ROW_ATTR]: '' } : {})}
        >
            <PresentingFlowRowGutterComp
                lineNumber={lineNumber}
                isCommand={isCommand}
            />
            {depth > 0 ? (
                <span
                    className="app-presenting-flow-row-indent"
                    style={{ width: `${depth * 12}px` }}
                />
            ) : null}
            {isExpandable ? (
                <i
                    className={
                        'bi app-presenting-flow-row-chevron app-caught-hover-pointer' +
                        ` bi-chevron-${isExpanded ? 'down' : 'right'}`
                    }
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpanding?.(event);
                    }}
                />
            ) : (
                <span className="app-presenting-flow-row-chevron" />
            )}
            <i
                className={`bi bi-${iconName} app-presenting-flow-row-icon`}
                style={iconColor ? { color: iconColor } : undefined}
            />
            {idLabel ? (
                // Tinted with the icon where the icon is tinted at all, which in
                // practice means an ACTION: its badge is a glyph of the same
                // family as its icon (`⟳`, `⏱`, `⤴`, `M↑`), not an id, so the two
                // reading as one mark is the whole point. A slide's `#3` and a
                // document have no colour to take, and are left alone.
                <span
                    className="app-presenting-flow-row-id"
                    style={iconColor ? { color: iconColor } : undefined}
                >
                    {idLabel}
                </span>
            ) : null}
            <span
                className={
                    'app-ellipsis flex-fill' +
                    (isOnScreen ? ' app-on-screen' : '') +
                    (isParkedByPresentingFlow
                        ? ' app-presenting-flow-row-label-parked'
                        : '')
                }
                style={{ ...extraStyle }}
            >
                {label}
            </span>
            {/* The dimming is a hint; this is the statement. A parked row is
                still fully readable, so nothing but a mark of its own tells it
                apart from one that merely lost contrast to a colour note.

                Two marks, not one: the eye-slash keeps meaning what it does
                everywhere else in the app — the DOCUMENT hides this slide — and
                the run sheet's own park gets a glyph and a tint of its own, the
                same "crossed out of the run" the struck label says. */}
            {isDisabled ? (
                <i
                    className={
                        'bi app-presenting-flow-row-disabled-icon' +
                        (isParkedByPresentingFlow
                            ? ' bi-slash-circle' +
                              ' app-presenting-flow-row-disabled-icon-presenting-flow'
                            : ' bi-eye-slash')
                    }
                />
            ) : null}
            {colorNote ? (
                <i
                    className="bi bi-record-circle app-presenting-flow-row-color-note"
                    style={{ color: colorNote }}
                />
            ) : null}
            {extraChild}
        </div>
    );
}
