import './SlidePresentingController.scss';

import SlideItemThumbList from './SlideItemThumbList';
import { renderFG } from '../helper/presentingHelpers';
import { useSlideItemThumbSelecting, useThumbSizing } from '../event/SlideListEventListener';
import { presentEventListener } from '../event/PresentEventListener';
import { DEFAULT_THUMB_SIZE, THUMB_WIDTH_SETTING_NAME } from './SlideThumbsController';

export default function SlidePresentingController() {
    const [thumbSize, setThumbSize] = useThumbSizing(THUMB_WIDTH_SETTING_NAME, DEFAULT_THUMB_SIZE);
    useSlideItemThumbSelecting((item) => {
        if (item !== null) {
            renderFG(item.html);
            presentEventListener.renderFG();
        } else {
            presentEventListener.clearFG();
        }
    });
    return (
        <div id="slide-presenting-controller" className="card w-100 h-100">
            <div className="card-body w-100 h-100">
                <SlideItemThumbList />
            </div>
            <Footer thumbSize={thumbSize}
                setThumbSize={(s) => setThumbSize(s)} />
        </div>
    );
}

function Footer({ thumbSize, setThumbSize }: {
    thumbSize: number, setThumbSize: (size: number) => void,
}) {
    let v = (thumbSize / DEFAULT_THUMB_SIZE);
    return (
        <div className="card-footer">
            <div className="d-flex justify-content-end h-100">
                <div className='size d-flex'>
                    <label className="form-label">Size:{v.toFixed(1)}</label>
                    <input type="range" className="form-range" min={1} max={3} step={0.2}
                        value={v.toFixed(1)} onChange={(e) => {
                            setThumbSize((+e.target.value) * DEFAULT_THUMB_SIZE);
                        }} onWheel={(e) => {
                            const isUp = e.deltaY > 0;
                            let newScale = v += (isUp ? -1 : 1) * 0.2;
                            if (newScale < 1) {
                                newScale = 1;
                            }
                            if (newScale > 3) {
                                newScale = 3;
                            }
                            setThumbSize(newScale * DEFAULT_THUMB_SIZE);
                        }} />
                </div>
            </div>
        </div>
    );
}
