import { useStateSettingString } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';

export type BackgroundViewModeType = 'thumbnail' | 'list';

// Keyed per dir source so Images/Videos/Webs keep independent view modes --
// and, since a folder session suffixes that name, so does each session: the
// folder of small logos is a list and the folder of photographs is a grid.
export function toBackgroundViewModeSettingName(dirSourceSettingName: string) {
    return `bg-view-mode-${dirSourceSettingName}`;
}

export function useBackgroundViewModeSetting(dirSourceSettingName: string) {
    return useStateSettingString<BackgroundViewModeType>(
        toBackgroundViewModeSettingName(dirSourceSettingName),
        'thumbnail',
    );
}

const viewModeList = [
    ['thumbnail', 'grid-3x3-gap-fill', 'Thumbnail View'],
    ['list', 'list-ul', 'List View'],
] as const;

export default function BackgroundViewModeComp({
    viewMode,
    setViewMode,
}: Readonly<{
    viewMode: BackgroundViewModeType;
    setViewMode: (viewMode: BackgroundViewModeType) => void;
}>) {
    return (
        <div className="btn-group btn-group-sm p-1 ms-1" role="group">
            {viewModeList.map(([mode, iconName, title]) => {
                const isActive = viewMode === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        className={
                            'btn btn-sm' +
                            ` ${isActive ? 'btn-info' : 'btn-secondary'}`
                        }
                        title={tran(title)}
                        disabled={isActive}
                        onClick={() => {
                            setViewMode(mode);
                        }}
                    >
                        <i className={`bi bi-${iconName}`} />
                    </button>
                );
            })}
        </div>
    );
}
