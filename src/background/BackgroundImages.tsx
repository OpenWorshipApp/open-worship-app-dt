import './BackgroundImages.scss';

import { useState } from 'react';
import { showAppContextMenu } from '../others/AppContextMenu';
import FileListHandler from '../others/FileListHandler';
import { genCommonMenu } from '../others/FileItemHandler';
import DirSource from '../helper/DirSource';
import { usePBGMEvents } from '../_present/presentHelpers';
import PresentBGManager from '../_present/PresentBGManager';

export default function BackgroundImages() {
    const [dirSource, setDirSource] = useState(DirSource.genDirSource('image-list-selected-dir'));
    usePBGMEvents(['update']);
    return (
        <FileListHandler id='background-image' mimetype='image'
            dirSource={dirSource}
            setDirSource={setDirSource}
            body={<div className='d-flex justify-content-start flex-wrap'>
                {(dirSource.fileSources || []).map((fileSource, i) => {
                    const selectedBGSrcList = PresentBGManager.getSelectBGSrcList(fileSource, 'image');
                    const selectedCN = selectedBGSrcList.length ? 'highlight-selected' : '';
                    return (
                        <div key={`${i}`}
                            className={`image-thumbnail card ${selectedCN}`}
                            title={fileSource.filePath + '\n Show in presents:'
                                + selectedBGSrcList.map(([key]) => key).join(',')}
                            onContextMenu={(e) => {
                                showAppContextMenu(e, genCommonMenu(fileSource),);
                            }}
                            onClick={(e) => {
                                PresentBGManager.bgSrcSelect(fileSource, e, 'image');
                            }}>
                            <div className='card-body'>
                                <img src={fileSource.src}
                                    className='card-img-top' alt='...' />
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
