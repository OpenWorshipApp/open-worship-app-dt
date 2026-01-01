import { applyDarkModeToApp } from '../others/initHelpers';
import appProvider from '../server/appProvider';

const { appInfo } = appProvider;
const GITHUB_URL = appInfo.gitRepository;

function RenderVerseComp() {
    return (
        <div className="card w-100 m-1">
            <div className="card-body p-2">
                Let every thing that hath breath praise the LORD. Praise ye the
                LORD.
                <br />
                <strong>(KJV) PSA 150:6</strong>
            </div>
        </div>
    );
}
const handleForkingOnGithub = () => {
    appProvider.browserUtils.openExternalURL(GITHUB_URL);
};
// need width: '700px', height: '410px'
export default function AboutComp() {
    return (
        <div
            id="app"
            ref={applyDarkModeToApp}
            className="d-flex flex-wrap justify-content-center p-1 app-selectable-text"
        >
            <RenderVerseComp />
            <div className="card w-100 m-1">
                <div
                    className="card-header"
                    style={{ textAlign: 'center', height: '220px' }}
                >
                    <div>
                        <img
                            src="/logo512.png"
                            alt="Open Worship"
                            width={150}
                        />
                    </div>
                    <strong>
                        {appInfo.titleFull}
                        <br />
                        {appInfo.version}
                    </strong>
                </div>
                <div className="card-body p-2">
                    <div>{appInfo.description}</div>
                    <div className="my-2">
                        <button
                            className="btn btn-success"
                            title={GITHUB_URL}
                            onClick={handleForkingOnGithub}
                        >
                            <i className="bi bi-github" /> Fork me on GitHub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
