import DirSource from '../helper/DirSource';
import { PathPreviewerComp } from './PathPreviewerComp';

export default function RenderPathTitleComp({
    dirSource,
    addItems,
}: Readonly<{
    dirSource: DirSource;
    addItems?: (event: any) => void;
}>) {
    if (!dirSource.dirPath) {
        return null;
    }
    return (
        <>
            <PathPreviewerComp dirPath={dirSource.dirPath} />
            <div
                className="ps-2"
                title="Reload"
                onClick={(event) => {
                    event.stopPropagation();
                    dirSource.fireReloadEvent();
                }}
            >
                <i className="bi bi-arrow-clockwise" />
            </div>
            {addItems !== undefined ? (
                <div
                    className="app-add-items-button px-1"
                    title="Add items"
                    onClick={(event) => {
                        event.stopPropagation();
                        addItems(event);
                    }}
                >
                    <i className="bi bi-plus-lg" />
                </div>
            ) : null}
        </>
    );
}
