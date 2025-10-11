export default function RenderSlideIndexComp({
    viewIndex,
    title,
}: Readonly<{
    viewIndex: number;
    title?: string;
}>) {
    return (
        <span
            className="badge rounded-pill text-bg-info"
            title={title ?? `Index: ${viewIndex}`}
        >
            {viewIndex}
        </span>
    );
}
