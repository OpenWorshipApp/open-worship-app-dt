import './AppContextMenuComp.scss';

import { EventMapper, toShortcutKey } from '../event/KeyboardEventListener';
import {
    ContextMenuItemType,
    setPositionMenu,
    contextControl,
    useAppContextMenuData,
    APP_CONTEXT_MENU_ITEM_CLASS,
    APP_CONTEXT_MENU_ID,
} from './appContextMenuHelpers';

export const elementDivider = (
    <hr className="w-100" style={{ padding: 0, margin: 0 }} />
);

function ContextMenuItemComp({
    item,
}: Readonly<{
    item: ContextMenuItemType;
}>) {
    if (item.menuElement === elementDivider) {
        return item.menuElement;
    }
    return (
        <div
            className={
                `${APP_CONTEXT_MENU_ITEM_CLASS} d-flex w-100 overflow-hidden` +
                `${item.disabled ? ' disabled' : ''}`
            }
            style={item.style ?? {}}
            title={
                item.title ??
                (typeof item.menuElement === 'string' ? item.menuElement : '')
            }
            onClick={(event) => {
                if (item.disabled) {
                    return;
                }
                setTimeout(() => {
                    item.onSelect?.(event as any);
                }, 0);
            }}
        >
            {item.childBefore || null}
            <div className="app-ellipsis flex-fill">{item.menuElement}</div>
            {item.childAfter || null}
        </div>
    );
}

export default function AppContextMenuComp() {
    const data = useAppContextMenuData();
    if (data === null) {
        return null;
    }
    return (
        <div
            id={APP_CONTEXT_MENU_ID}
            onClick={() => {
                contextControl.setDataDelegator?.(null);
            }}
            onContextMenu={() => {
                contextControl.setDataDelegator?.(null);
            }}
        >
            <div
                tabIndex={0}
                ref={(div) => {
                    if (div === null) {
                        return;
                    }
                    setPositionMenu(div, data.event, data.options);
                }}
                className="app-context-menu app-focusable"
            >
                {data.items.map((item, i) => {
                    return <ContextMenuItemComp key={i} item={item} />;
                })}
            </div>
        </div>
    );
}

export function genContextMenuItemShortcutKey(eventMapper: EventMapper) {
    return (
        <div className="align-self-end">
            <span className="text-muted badge text-bg-primary">
                {toShortcutKey(eventMapper)}
            </span>
        </div>
    );
}

export function genContextMenuItemIcon(
    name: string,
    style?: React.CSSProperties,
) {
    return (
        <i
            className={`bi bi-${name}`}
            style={{
                color: 'var(--bs-info-text-emphasis)',
                marginRight: '2px',
                ...style,
            }}
        />
    );
}
