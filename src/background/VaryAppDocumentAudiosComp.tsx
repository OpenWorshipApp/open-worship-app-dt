import { useAppDocumentAudioData } from './backgroundHelpers';
import AudioBodyComp from './AudioBodyComp';
import { tran } from '../lang/langHelpers';

export default function VaryAppDocumentAudiosComp() {
    const appDocumentAudioData = useAppDocumentAudioData();
    if (appDocumentAudioData === null) {
        return null;
    }
    return (
        <div className="w-10 app-inner-shadow p-2 mb-3 mt-5">
            <strong>{tran('Document Audios')}</strong>
            {Object.entries(appDocumentAudioData).map(
                ([varyAppDocumentName, audioFilePaths]) => {
                    if (audioFilePaths.length === 0) {
                        return null;
                    }
                    return (
                        <div key={varyAppDocumentName}>
                            <hr />
                            <span className="muted">{varyAppDocumentName}</span>
                            {audioFilePaths.map((filePath) => {
                                return (
                                    <AudioBodyComp
                                        key={filePath}
                                        filePath={filePath}
                                    />
                                );
                            })}
                        </div>
                    );
                },
            )}
        </div>
    );
}
