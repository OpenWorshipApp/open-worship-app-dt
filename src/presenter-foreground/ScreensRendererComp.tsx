import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';

export default function ScreensRendererComp<T>({
    title,
    genTitle,
    buttonText,
    showingScreenIdDataList,
    handleForegroundHiding,
    isMini = false,
}: Readonly<{
    title?: string;
    genTitle?: (data: T) => string;
    buttonText: string;
    showingScreenIdDataList: [number, T][];
    handleForegroundHiding: (screenId: number, data: T) => void;
    isMini?: boolean;
}>) {
    if (showingScreenIdDataList.length === 0) {
        return null;
    }
    return (
        <div className="d-flex mt-2 p-1 app-border-white-round" title={title}>
            {showingScreenIdDataList.map(([screenId, data], i) => {
                const itemTitle = genTitle ? genTitle(data) : undefined;
                return (
                    <div
                        className="d-flex app-caught-hover-pointer"
                        title={itemTitle}
                        key={screenId + '-' + i}
                        onClick={handleForegroundHiding.bind(
                            null,
                            screenId,
                            data,
                        )}
                    >
                        {isMini ? null : (
                            <button className="btn btn-secondary">
                                {buttonText}
                            </button>
                        )}
                        <div className="input-group-text">
                            <ShowingScreenIcon screenId={screenId} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
