import './BackgroundVideos.scss';

import { createRef, useState } from 'react';
import { showAppContextMenu } from '../others/AppContextMenu';
import FileListHandler from '../others/FileListHandler';
import { genCommonMenu } from '../others/FileItemHandler';
import DirSource from '../helper/DirSource';
import { usePBGMEvents } from '../_present/presentHelpers';
import PresentBGManager from '../_present/PresentBGManager';
import { RenderPresentIds } from './Background';

export default function BackgroundVideos() {
    const [dirSource, setDirSource] = useState(DirSource.genDirSource('video-list-selected-dir'));
    usePBGMEvents(['update']);
    return (
        <FileListHandler id='background-video' mimetype='video'
            dirSource={dirSource}
            setDirSource={setDirSource}
            body={<div className='d-flex justify-content-start flex-wrap'>
                {(dirSource.fileSources || []).map((fileSource, i) => {
                    const vRef = createRef<HTMLVideoElement>();
                    const selectedBGSrcList = PresentBGManager.getSelectBGSrcList(
                        fileSource.src, 'video');
                    const selectedCN = selectedBGSrcList.length ? 'highlight-selected' : '';
                    return (
                        <div key={`${i}`}
                            className={`video-thumbnail card ${selectedCN}`}
                            title={fileSource.filePath + '\n Show in presents:'
                                + selectedBGSrcList.map(([key]) => key).join(',')}
                            onContextMenu={(e) => {
                                showAppContextMenu(e, genCommonMenu(fileSource));
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
                            onClick={(e) => {
                                PresentBGManager.bgSrcSelect(fileSource.src, e, 'video');
                            }}>
                            <div className='card-body'>
                                <RenderPresentIds
                                    ids={selectedBGSrcList.map(([key]) => +key)} />
                                <video ref={vRef} loop
                                    muted src={fileSource.src}></video>
                            </div>
                            <div className='card-footer'>
                                <p className='ellipsis-left card-text'>
                                    {fileSource.fileName}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>} />
    );
}