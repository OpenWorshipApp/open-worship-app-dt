import './AboutComp.scss';

import appProvider from '../server/appProvider';
import { getDocxToHtmlsVersion } from '../server/docxHelpers';
import { getPptxToHtmlsVersion } from '../server/pptxHelpers';
import { useAppStateAsync } from '../helper/appHooks';
import { useThemeSource } from './themeHelpers';
import { getBibleNoteConstructor } from '../bible-list/note/bibleNoteHelpers';

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

function renderVersion(version: string | null | undefined) {
    if (version === undefined) {
        return 'Loading...';
    }
    return version ?? 'N/A';
}

async function getBibleNoteVersion() {
    const AppBibleNote = await getBibleNoteConstructor();
    return AppBibleNote.VERSION;
}

// need width: '700px', height: '410px'
export default function AboutComp() {
    const { theme } = useThemeSource();
    const [docxToHtmlsVersion] = useAppStateAsync(getDocxToHtmlsVersion);
    const [pptxToHtmlsVersion] = useAppStateAsync(getPptxToHtmlsVersion);
    const [bibleNoteVersion] = useAppStateAsync(
        getBibleNoteVersion,
        [],
        'Unknown',
    );
    const commitHash = appProvider.systemUtils.commitHash;
    return (
        <div
            id="app"
            data-bs-theme={theme}
            className="app-about d-flex flex-wrap justify-content-center p-1 app-selectable-text"
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
                        version:{' '}
                        <a
                            target="_blank"
                            href={`https://github.com/OpenWorshipApp/open-worship-app-dt/releases/tag/release-${appInfo.version}`}
                        >
                            {appInfo.version}
                        </a>
                        , commit ID:{' '}
                        <a
                            target="_blank"
                            href={`https://github.com/OpenWorshipApp/open-worship-app-dt/commit/${commitHash}`}
                        >
                            {commitHash?.substring(0, 7) ?? 'N/A'}
                        </a>
                    </strong>
                </div>
                <div className="card-body p-2">
                    <div>{appInfo.description}</div>
                    <div className="small mt-2 d-flex flex-wrap">
                        <div className="m-1 module-version">
                            Pptx2Html ({renderVersion(pptxToHtmlsVersion)})
                        </div>
                        <div className="m-1 module-version">
                            Docx2Html ({renderVersion(docxToHtmlsVersion)})
                        </div>
                        <div className="m-1 module-version">
                            Bible Note ({renderVersion(bibleNoteVersion)})
                        </div>
                    </div>
                    <div className="my-2">
                        <button
                            className="btn btn-success"
                            title={GITHUB_URL}
                            onClick={handleForkingOnGithub}
                        >
                            <i className="bi bi-github" /> Fork me on GitHub
                        </button>
                        <a
                            href={appInfo.homepage}
                            className="ms-3"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {appInfo.homepage}
                            <i className="bi bi-box-arrow-up-right ms-1" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
