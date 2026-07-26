import { getReactRoot } from '../others/rootHelpers';
import HtmlInCanvasComp from './html-in-canvas/HtmlInCanvasComp';

const root = getReactRoot();

function ExperimentComp() {
    return (
        <div
            style={{
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <HtmlInCanvasComp />
        </div>
    );
}

root.render(<ExperimentComp />);
