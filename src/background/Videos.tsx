import './Videos.scss';

import { createRef, useEffect, useState } from 'react';
import { copyToClipboard, isMac, openExplorer } from '../helper/appHelper';
import { presentEventListener } from '../event/PresentEventListener';
import { useStateSettingString } from '../helper/settingHelper';
import {
    copyFileToPath,
    FileSourceType,
    isSupportedMimetype,
    listFiles,
} from '../helper/fileHelper';
import PathSelector from '../others/PathSelector';
import { renderBGVideo } from '../helper/presentingHelpers';
import { showAppContextMenu } from '../others/AppContextMenu';
import { toastEventListener } from '../event/ToastEventListener';

export default function Videos() {
    const [dir, setDir] = useStateSettingString('video-selected-dir', '');
    const [list, setList] = useState<FileSourceType[] | null>(null);
    useEffect(() => {
        if (list === null) {
            const videos = listFiles(dir, 'video');
            setList(videos === null ? [] : videos);
        }
    }, [list, dir]);
    const applyDir = (newDir: string) => {
        setDir(newDir);
        setList(null);
    };
    return (
        <div className="background-video" draggable={dir !== null}
            onDragOver={(event) => {
                event.preventDefault();
                event.currentTarget.style.opacity = '0.5';
            }} onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.style.opacity = '1';
            }} onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.style.opacity = '1';
                Array.from(event.dataTransfer.files).forEach((file) => {

                    if (!isSupportedMimetype(file.type, 'video')) {
                        toastEventListener.showSimpleToast({
                            title: 'copy video file',
                            message: 'Unsupported video file!',
                        });
                    } else {
                        if (copyFileToPath(file.path, file.name, dir)) {
                            setList(null);
                            toastEventListener.showSimpleToast({
                                title: 'copy video file',
                                message: 'File has been copied',
                            });
                        } else {
                            toastEventListener.showSimpleToast({
                                title: 'copy video file',
                                message: 'Fail to copy file!',
                            });
                        }
                    }
                });
            }}>
            <PathSelector
                prefix='bg-video'
                dirPath={dir}
                onRefresh={() => setList(null)}
                onChangeDirPath={applyDir}
                onSelectDirPath={applyDir} />
            <div className="d-flex justify-content-start flex-wrap">
                {(list || []).map((d, i) => {
                    const vRef = createRef<HTMLVideoElement>();
                    return (
                        <div key={`${i}`} className="video-thumbnail card" title={d.filePath}
                            onContextMenu={(e) => {
                                showAppContextMenu(e, [
                                    {
                                        title: 'Copy Path to Clipboard ', onClick: () => {
                                            copyToClipboard(d.filePath);
                                        },
                                    },
                                    {
                                        title: `Reveal in ${isMac() ? 'Finder' : 'File Explorer'}`,
                                        onClick: () => {
                                            openExplorer(d.filePath);
                                        },
                                    },
                                ]);
                            }}
                            onMouseEnter={() => {
                                vRef.current?.play();
                            }}
                            onMouseLeave={() => {
                                if (vRef.current) {
                                    vRef.current.pause();
                                    vRef.current.currentTime = 0;
                                }
                            }}
                            onClick={() => {
                                renderBGVideo(d.src);
                                presentEventListener.renderBG();
                            }}>
                            <div className="card-body">
                                <video ref={vRef} loop
                                    muted src={d.src}></video>
                            </div>
                            <div className="card-footer">
                                <p className="ellipsis-left card-text">{d.fileName}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
}
