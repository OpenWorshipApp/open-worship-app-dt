import type { CSSProperties, ReactNode } from 'react';

/**
 * One brief line in the playlist tree. Deliberately text-only: a playlist can
 * hold a lot of entries and a thumbnail per row would mean decoding every
 * referenced image/video just to draw the list. Rich previews live in the
 * floating preview widget, which the user opens on demand.
 */
export default function PlaylistRowComp({
    depth = 0,
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
    extraChild,
    extraClassName = '',
    extraStyle = {},
}: Readonly<{
    depth?: number;
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
    isOnScreen?: boolean;
    extraChild?: ReactNode;
    extraClassName?: string;
    extraStyle?: CSSProperties;
}>) {
    return (
        <div
            className={`app-playlist-row d-flex align-items-center ${extraClassName}`}
            style={{
                paddingLeft: `${depth * 12}px`,
                // Colour-grouped rows keep their playlist order — the running
                // order IS the meaning here — so the group shows as a stripe
                // rather than by re-sorting the list.
                borderLeft: colorNote
                    ? `3px solid ${colorNote}`
                    : '3px solid transparent',
            }}
            title={title ?? label}
            draggable={onDragStart !== undefined}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            {isExpandable ? (
                <i
                    className={
                        'bi app-playlist-row-chevron app-caught-hover-pointer' +
                        ` bi-chevron-${isExpanded ? 'down' : 'right'}`
                    }
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpanding?.(event);
                    }}
                />
            ) : (
                <span className="app-playlist-row-chevron" />
            )}
            <i
                className={`bi bi-${iconName} app-playlist-row-icon`}
                style={iconColor ? { color: iconColor } : undefined}
            />
            {idLabel ? (
                <span className="app-playlist-row-id">{idLabel}</span>
            ) : null}
            <span
                className={
                    'app-ellipsis flex-fill' +
                    (isOnScreen ? ' app-on-screen' : '')
                }
                style={{ ...extraStyle }}
            >
                {label}
            </span>
            {colorNote ? (
                <i
                    className="bi bi-record-circle app-playlist-row-color-note"
                    style={{ color: colorNote }}
                />
            ) : null}
            {extraChild}
        </div>
    );
}
