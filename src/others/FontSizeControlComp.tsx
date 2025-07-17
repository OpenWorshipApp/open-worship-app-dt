export default function FontSizeControlComp({
    fontSize,
    setFontSize,
}: Readonly<{
    fontSize: number;
    setFontSize: (fontSize: number) => void;
}>) {
    return (
        <div className="d-flex">
            <input
                className="form-control"
                type="number"
                style={{ maxWidth: '100px' }}
                value={fontSize}
                onChange={(event) => {
                    setFontSize(parseInt(event.target.value));
                }}
            />
            <select
                className="form-select form-select-sm"
                value={fontSize}
                onChange={(event) => {
                    setFontSize(parseInt(event.target.value));
                }}
            >
                <option>--</option>
                {Array.from({ length: 20 }, (_, i) => (i + 1) * 15)
                    .reverse()
                    .map((n) => {
                        return (
                            <option key={n} value={n}>
                                {n}px
                            </option>
                        );
                    })}
            </select>
        </div>
    );
}
