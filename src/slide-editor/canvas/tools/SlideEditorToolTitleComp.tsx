import './SlideEditorToolTitleComp.scss';

import { ExpandChevron, useExpandToggle } from './useExpandToggle';

export default function SlideEditorToolTitleComp({
    title,
    isCollapsible = false,
    isInitiallyExpanded = true,
    isInline = false,
    children,
}: Readonly<{
    title?: string;
    isCollapsible?: boolean;
    isInitiallyExpanded?: boolean;
    isInline?: boolean;
    children: any;
}>) {
    const { isExpanded, headerProps } = useExpandToggle(isInitiallyExpanded);
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
                <ExpandChevron isExpanded={isExpanded} />
                {title}
            </div>
            {isExpanded ? (
                <div className="app-tool-body">{children}</div>
            ) : null}
        </div>
    );
}
