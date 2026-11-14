import { type VaryAppDocumentAudioDataType } from './backgroundHelpers';
import AudioBodyComp from './AudioBodyComp';
import { tran } from '../lang/langHelpers';
import RenderSlideIndexComp from '../app-document-presenter/items/RenderSlideIndexComp';
import { toKeyByFilePath } from '../app-document-list/appDocumentHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';

/**
 * One track a slide carries. Its menu reaches the sound file itself, which
 * lives in the document's preview folder (`<pptx>-htmls/`), not beside the
 * PowerPoint -- so it is the one path a person cannot guess.
 */
function AudioElementComp({
    slideIndex,
    slideId,
    filePath,
    slideFilePath,
}: Readonly<{
    slideIndex: number;
    slideId: number;
    filePath: string;
    slideFilePath: string;
}>) {
    const handleContextMenuOpening = (event: any) => {
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('clipboard'),
                menuElement: tran('Copy Path to Clipboard'),
                onSelect: () => {
                    copyToClipboard(filePath);
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(filePath);
                },
            },
        ]);
    };
    return (
        <div
            className="d-flex align-items-center"
            onContextMenu={handleContextMenuOpening}
        >
            <div className="align-self-start">
                <RenderSlideIndexComp
                    viewIndex={slideIndex + 1}
                    dataKey={toKeyByFilePath(slideFilePath, slideId)}
                    title={`${slideIndex + 1}`}
                />
            </div>
            <AudioBodyComp key={filePath} filePath={filePath} />
            <ContextMenuDotsButtonComp onOpening={handleContextMenuOpening} />
        </div>
    );
}

export default function VaryAppDocumentAudiosComp({
    appDocumentAudioData,
}: Readonly<{
    appDocumentAudioData: VaryAppDocumentAudioDataType;
}>) {
    return (
        <div className="card w-100 h-100 app-overflow-hidden">
            <div
                className="card-header p-0 ps-1"
                style={{
                    height: '25px',
                }}
            >
                <small>{tran('Document Audios')}</small>
            </div>
            <div className="card-body app-overflow-auto">
                {Object.entries(appDocumentAudioData).map(
                    ([varyAppDocumentName, audioSlideDataList]) => {
                        if (audioSlideDataList.length === 0) {
                            return null;
                        }
                        return (
                            <div key={varyAppDocumentName}>
                                <hr />
                                <span className="muted">
                                    {varyAppDocumentName}
                                </span>
                                {audioSlideDataList.map(
                                    ({
                                        slideIndex,
                                        filePaths,
                                        slideId,
                                        slideFilePath,
                                    }) => {
                                        return filePaths.map((filePath) => {
                                            return (
                                                <AudioElementComp
                                                    key={filePath}
                                                    slideIndex={slideIndex}
                                                    slideId={slideId}
                                                    filePath={filePath}
                                                    slideFilePath={
                                                        slideFilePath
                                                    }
                                                />
                                            );
                                        });
                                    },
                                )}
                            </div>
                        );
                    },
                )}
            </div>
        </div>
    );
}
