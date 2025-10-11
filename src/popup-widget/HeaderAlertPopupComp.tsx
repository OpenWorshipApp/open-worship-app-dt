export default function HeaderAlertPopupComp({
    header,
    onClose,
}: Readonly<{
    header: React.ReactNode;
    onClose: () => void;
}>) {
    return (
        <div className="card-header text-center w-100">
            <div>{header}</div>
            <button
                className="btn-close float-end"
                type="button"
                onClick={() => {
                    onClose();
                }}
                style={{
                    transform: 'translate(0, -90%)',
                }}
            />
        </div>
    );
}
