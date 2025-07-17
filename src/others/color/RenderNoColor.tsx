export default function RenderNoColor({
    isSelected,
    onClick,
}: Readonly<{
    isSelected: boolean;
    onClick?: (event: MouseEvent) => void;
}>) {
    return (
        <div
            title="No Color"
            className="m-1 color-item app-caught-hover-pointer"
            style={{
                width: '20px',
                height: '15px',
                backgroundColor: '#fff',
                color: 'red',
                border: isSelected ? '3px dashed #fff' : '',
            }}
            onClick={(event) => {
                onClick?.(event as any);
            }}
        >
            x
        </div>
    );
}
