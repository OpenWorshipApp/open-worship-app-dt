export default function RenderSlideIndexComp({
    viewIndex,
    title,
}: Readonly<{
    viewIndex: number;
    title?: string;
}>) {
    return (
        <div
            className="d-flex badge rounded-pill text-bg-info align-items-center"
            title={title ?? `Index: ${viewIndex}`}
        >
            {viewIndex}
        </div>
    );
}
