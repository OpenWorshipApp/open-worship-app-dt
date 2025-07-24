export default function SlideEditorToolTitleComp({
    title,
    children,
}: Readonly<{
    title?: string;
    children: any;
}>) {
    return (
        <div
            className="app-tool m-1"
            style={{
                borderTop: '1px solid #cccccc2f',
            }}
        >
            {title && (
                <div
                    style={{
                        borderBottom: '1px dashed #cccccc17',
                    }}
                >
                    {title}
                </div>
            )}
            <div className="p-1">{children}</div>
        </div>
    );
}
