import './MiniPresentScreen.scss';

import ShowHidePresent from './ShowHidePresent';
import PreviewThumbnail from './MiniPreviewThumbnail';
import ClearControl from './ClearControl';

export default function MiniPresentScreen() {
    return (
        <div id="mini-present-screen" className="card w-100 h-100">
            <div className="card-header d-flex justify-content-around">
                <ShowHidePresent />
                <ClearControl />
            </div>
            <div className="card-body">
                <PreviewThumbnail />
            </div>
        </div>
    );
}
