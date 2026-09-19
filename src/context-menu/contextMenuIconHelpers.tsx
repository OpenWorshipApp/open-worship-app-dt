import type { CSSProperties } from 'react';

// Deliberately a leaf module: nearly every menu-building helper in the app now
// wants an icon, and importing it from `AppContextMenuComp` would drag the whole
// context-menu UI (plus KeyboardEventListener, appHooks and the SCSS) into data
// helpers that never render a menu themselves.
export function genContextMenuItemIcon(name: string, style?: CSSProperties) {
    return (
        <i
            className={`bi bi-${name}`}
            style={{
                color: 'var(--bs-info-text-emphasis)',
                marginRight: '2px',
                // A fixed-width, centered slot keeps every label starting at the
                // same x no matter how wide the glyph is. Labels are translated
                // (and Khmer runs much longer than English), so the icon column
                // is what makes an item recognizable at a glance.
                display: 'inline-block',
                flexShrink: 0,
                width: '1.25em',
                textAlign: 'center',
                ...style,
            }}
        />
    );
}
