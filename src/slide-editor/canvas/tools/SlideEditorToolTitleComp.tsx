import './SlideEditorToolTitleComp.scss';

export default function SlideEditorToolTitleComp({
    title,
    children,
}: Readonly<{
    title?: string;
    children: any;
}>) {
    return (
        <div className="app-tool">
            {title && <div className="app-tool-title">{title}</div>}
            <div className="app-tool-body">{children}</div>
        </div>
    );
}
