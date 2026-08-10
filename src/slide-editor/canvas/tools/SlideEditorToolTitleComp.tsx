import './SlideEditorToolTitleComp.scss';

import { ExpandChevronComp, useExpandToggle } from './useExpandToggle';

export default function SlideEditorToolTitleComp({
    title,
    isCollapsible = false,
    isInitiallyExpanded = true,
    isInline = false,
    // Sections that mount something expensive (media, an iframe, a device) must
    // NOT share the default key: expanding any other collapsible title would
    // then restore them expanded on the next mount. Pass '' to not persist.
    persistingKey = 'slide-editor-tool-title',
    children,
}: Readonly<{
    title?: string;
    isCollapsible?: boolean;
    isInitiallyExpanded?: boolean;
    isInline?: boolean;
    persistingKey?: string;
    children: any;
}>) {
    const { isExpanded, headerProps } = useExpandToggle(
        isInitiallyExpanded,
        persistingKey,
    );
    if (!isCollapsible || !title) {
        return (
            <div className={'app-tool' + (isInline ? ' app-tool-inline' : '')}>
                {title && <div className="app-tool-title">{title}</div>}
                <div className="app-tool-body">{children}</div>
            </div>
        );
    }
    return (
        <div className="app-tool">
            <div
                className="app-tool-title app-tool-title-collapsible"
                {...headerProps}
            >
                <ExpandChevronComp isExpanded={isExpanded} />
                {title}
            </div>
            {isExpanded ? (
                <div className="app-tool-body">{children}</div>
            ) : null}
        </div>
    );
}
