import './LWShareAppComp.scss';

import { handleForkingOnGithub, lwSharePackage } from './lwShareHelpers';
import ServerControllerComp from './ServerControllerComp';

export default function LWShareAppComp() {
    return (
        <div
            id="app"
            data-bs-theme="dark"
            className="lw-share-container w-100 h-100 d-flex overflow-hidden"
        >
            <div className="card w-100 h-100">
                <div className="card-header p-2">
                    <strong>Local Web Share ({lwSharePackage.version})</strong>
                </div>
                <div className="card-body p-2 overflow-hidden d-flex flex-column">
                    <div>
                        <button
                            className="btn btn-secondary"
                            title={lwSharePackage.homepage}
                            onClick={handleForkingOnGithub}
                        >
                            <i className="bi bi-github" /> Fork me on GitHub
                        </button>
                        <hr />
                    </div>
                    <ServerControllerComp />
                </div>
            </div>
        </div>
    );
}
