import ShowingScreenIconComp from '../_screen/preview/ShowingScreenIcon';
import { tran } from '../lang/langHelpers';

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
        <div className="d-flex p-1 app-border-white-round" title={title}>
            {showingScreenIdDataList.map(([screenId, data], i) => {
                const itemTitle = genTitle ? genTitle(data) : undefined;
                const onClick = handleForegroundHiding.bind(
                    null,
                    screenId,
                    data,
                );
                return (
                    <div
                        className="d-flex app-caught-hover-pointer"
                        title={itemTitle}
                        key={screenId + '-' + i}
                        onClick={onClick}
                    >
                        {isMini ? null : (
                            <button className="btn btn-secondary">
                                {buttonText}
                            </button>
                        )}
                        <ShowingScreenIconComp
                            screenId={screenId}
                            onClick={onClick}
                            title={tran('Remove from screen ') + screenId}
                        />
                    </div>
                );
            })}
        </div>
    );
}
