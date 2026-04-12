import { useAppDocumentAudioData } from './backgroundHelpers';
import AudioBodyComp from './AudioBodyComp';
import { tran } from '../lang/langHelpers';
import { bringDomToNearestView } from '../helper/helpers';
import { useState } from 'react';

function AudioElementComp({
    slideIndex,
    filePath,
}: Readonly<{
    slideIndex: number;
    filePath: string;
}>) {
    return (
        <div className="d-flex">
            <div>
                <small className="badge rounded-pill text-bg-info align-items-center">
                    {slideIndex + 1}
                </small>
            </div>
            <AudioBodyComp key={filePath} filePath={filePath} />
        </div>
    );
}

export default function VaryAppDocumentAudiosComp() {
    const [isShowing, setIsShowing] = useState(false);
    const appDocumentAudioData = useAppDocumentAudioData();
    if (appDocumentAudioData === null) {
        return null;
    }
    const dataEntries = Object.entries(appDocumentAudioData);
    if (
        dataEntries.every(
            ([, audioSlideDataList]) => audioSlideDataList.length === 0,
        )
    ) {
        return null;
    }
    return (
        <div
            ref={(element) => {
                if (!isShowing) {
                    return;
                }

                if (element === null) {
                    return;
                }
                bringDomToNearestView(element);
            }}
            className="w-10 app-inner-shadow p-2 mb-3 mt-5"
        >
            <div
                className="app-caught-hover-pointer"
                onClick={() => setIsShowing(!isShowing)}
            >
                <strong>{tran('Document Audios')}</strong>
                <i
                    className={`bi bi-chevron-${isShowing ? 'down' : 'right'}`}
                />
            </div>
            {isShowing &&
                Object.entries(appDocumentAudioData).map(
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
                                    ({ slideIndex, filePaths }) => {
                                        return filePaths.map((filePath) => {
                                            return (
                                                <AudioElementComp
                                                    key={filePath}
                                                    slideIndex={slideIndex}
                                                    filePath={filePath}
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
    );
}
