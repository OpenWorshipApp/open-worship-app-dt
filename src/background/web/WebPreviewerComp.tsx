import { useState } from 'react';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import { useSelectedWebContext } from './webEditorHelpers';
import FileSource from '../../helper/FileSource';

export default function WebPreviewerComp() {
    const filePath = useSelectedWebContext();
    const fileSource = FileSource.getInstance(filePath);
    const [src, setSrc] = useState<string>(fileSource.src);
    useFileSourceEvents(
        ['update'],
        () => {
            setSrc(fileSource.src + '?t=' + Date.now());
        },
        [filePath],
        filePath,
    );
    return (
        <div className="d-flex w-100 h-100">
            <iframe
                src={src}
                title={filePath}
                className="w-100 h-100 app-zero-border-radius"
                style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
}
