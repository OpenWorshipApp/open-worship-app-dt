import LyricRenderControlBodyComp from './LyricRenderControlBodyComp';
import LyricRenderPreviewBodyComp from './LyricRenderPreviewBodyComp';

export default function LyricPreviewerComp() {
    return (
        <div className="d-flex w-100 h-100">
            <div className="card h-100">
                <div className="card-header">Control</div>
                <div className="card-body">
                    <LyricRenderControlBodyComp />
                </div>
            </div>
            <div className="card h-100 flex-grow-1">
                <div className="card-header">Preview</div>
                <div className="card-body app-overflow-hidden">
                    <LyricRenderPreviewBodyComp />
                </div>
            </div>
        </div>
    );
}
