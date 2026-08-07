import SettingOthersAIComp from './SettingOthersAIComp';

export default function SettingOthersComp() {
    return (
        <div
            className="w-100 h-100 d-flex flex-wrap justify-content-center p-1"
            style={{
                overflowY: 'auto',
            }}
        >
            <div
                className="app-border-white-round m-1 align-self-start"
                style={{ minWidth: '320px', maxWidth: '600px' }}
            >
                <SettingOthersAIComp />
            </div>
        </div>
    );
}
