import { type VaryAppDocumentAudioDataType } from './backgroundHelpers';
import AudioBodyComp from './AudioBodyComp';
import { tran } from '../lang/langHelpers';
import RenderSlideIndexComp from '../app-document-presenter/items/RenderSlideIndexComp';
import { toKeyByFilePath } from '../app-document-list/appDocumentHelpers';

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
    return (
        <div className="d-flex">
            <div>
                <RenderSlideIndexComp
                    viewIndex={slideIndex + 1}
                    dataKey={toKeyByFilePath(slideFilePath, slideId)}
                    title={`${slideIndex + 1}`}
                />
            </div>
            <AudioBodyComp key={filePath} filePath={filePath} />
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
