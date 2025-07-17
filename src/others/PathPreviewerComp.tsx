import { useAppStateAsync } from '../helper/debuggerHelpers';
import { fsCheckDirExist, pathBasename } from '../server/fileHelpers';

// TODO: check direction rtl error with /*
function cleanPath(path: string) {
    if (path.startsWith('/')) {
        path = path.substring(1);
    }
    return path;
}

export function PathPreviewerComp({
    dirPath,
    isShowingNameOnly = false,
    onClick,
    shouldNotValidate = false,
}: Readonly<{
    dirPath: string;
    isShowingNameOnly?: boolean;
    onClick?: (event: any) => void;
    shouldNotValidate?: boolean;
}>) {
    const [isValidPath] = useAppStateAsync(() => {
        if (shouldNotValidate) {
            return Promise.resolve(true);
        }
        return fsCheckDirExist(dirPath);
    }, [shouldNotValidate, dirPath]);
    const cleanedDirectoryPath = cleanPath(dirPath);
    let directoryPath = cleanedDirectoryPath;
    if (isShowingNameOnly) {
        directoryPath = pathBasename(cleanedDirectoryPath);
        const index = directoryPath.indexOf('.');
        if (index > 0) {
            directoryPath = directoryPath.substring(0, index);
        }
    }
    return (
        <div
            className={
                'app-ellipsis-left app-border-white-round px-1 flex-fill' +
                ` ${onClick ? 'pointer' : ''}`
            }
            onClick={onClick}
            title={isValidPath ? cleanedDirectoryPath : '`Invalid Path'}
            style={{
                color: isValidPath ? '' : 'red',
            }}
        >
            {directoryPath}
        </div>
    );
}
