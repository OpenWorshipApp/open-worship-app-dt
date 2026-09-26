import { usePdfConversionProgress } from '../../helper/pdfConversionProgress';
import { tran } from '../../lang/langHelpers';

export default function PdfConversionProgressComp({
    filePath,
}: Readonly<{ filePath: string | null }>) {
    const progress = usePdfConversionProgress(filePath);
    if (progress === null) {
        return null;
    }
    const percentage =
        progress.total !== null && progress.total > 0
            ? Math.round((progress.completed / progress.total) * 100)
            : null;
    return (
        <div className="w-100 mt-3" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-2" role="status">
                {tran('Exporting PDF Images')}
                {' · '}
                {progress.total === null
                    ? tran('Preparing PDF pages...')
                    : `${progress.completed} / ${progress.total} (${percentage ?? 0}%)`}
            </div>
            <div className="progress">
                <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    aria-label={tran('Exporting PDF Images')}
                    aria-valuenow={percentage ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ width: `${percentage ?? 100}%` }}
                />
            </div>
        </div>
    );
}
