import loading from '../assets/loading.gif';

export default function LoadingComp({
    message,
}: Readonly<{
    message?: string | null;
}>) {
    return (
        <div className="d-flex flex-wrap w-100 h-100">
            <div style={{ margin: 'auto' }}>
                <div
                    style={{
                        maxWidth: '70px',
                        overflow: 'hidden',
                        margin: 'auto',
                        padding: '5px',
                    }}
                >
                    <img width={'80%'} src={loading} alt="Loading..." />
                </div>
                {message ? (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '5px',
                        }}
                    >
                        {message}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
