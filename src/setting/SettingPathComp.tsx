import SettingGeneralDirectoryPathComp from './directory-setting/SettingGeneralDirectoryPathComp';

// The folder plumbing -- parent directory, recent folders, child directories
// -- grew too tall to share the General tab with language and theme, so it
// has a tab of its own. The body component keeps its old name: it is still
// the directory-path section, only mounted somewhere else.
//
// Held to a reading width and centred (the user's picture of a maximised
// window, the whole tab circled: "make content max-width and make it
// center"): stretched across a wide screen the path box ran a metre long
// and **Use This Folder** sat far from the folder it names.
const CONTENT_MAX_WIDTH = 660;

export default function SettingPathComp() {
    return (
        <div className="w-100 h-100 p-1" style={{ overflowY: 'auto' }}>
            <div
                className="mx-auto h-100"
                style={{ maxWidth: CONTENT_MAX_WIDTH }}
            >
                <SettingGeneralDirectoryPathComp />
            </div>
        </div>
    );
}
