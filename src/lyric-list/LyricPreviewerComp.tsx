import LyricRenderControlBodyComp from './LyricRenderControlBodyComp';
import LyricRenderPreviewBodyComp from './LyricRenderPreviewBodyComp';

export default function LyricPreviewerComp() {
    return (
        <div className="card w-100 h-100">
            <div className="card-body w-100 h-100">
                <LyricRenderControlBodyComp />
                <LyricRenderPreviewBodyComp />
            </div>
        </div>
    );
}
