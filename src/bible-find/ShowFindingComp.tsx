import LoadingComp from '../others/LoadingComp';
import { bringDomToTopView } from '../helper/helpers';

export function ShowFindingComp() {
    return (
        <div
            className="d-flex justify-content-center"
            ref={(element) => {
                if (element === null) {
                    return;
                }
                bringDomToTopView(element);
            }}
        >
            <LoadingComp />
        </div>
    );
}
