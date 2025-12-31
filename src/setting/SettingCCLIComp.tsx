/**
 * CCLI Settings Component
 * 
 * Configuration panel for CCLI SongSelect credentials and options.
 */

import { useState } from 'react';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { CCLICredentialsType } from '../lyric-list/ccli/ccliTypes';
import { useAppEffect } from '../helper/debuggerHelpers';

const CCLI_SETTINGS_KEY = 'ccli-credentials';

export default function SettingCCLIComp() {
    const [subscriptionId, setSubscriptionId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [useMockData, setUseMockData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load saved credentials on mount
    useAppEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        try {
            const saved = await getSetting(CCLI_SETTINGS_KEY);
            if (saved) {
                const credentials: CCLICredentialsType = JSON.parse(saved);
                setSubscriptionId(credentials.subscriptionId || '');
                setApiKey(credentials.apiKey || '');
                setUseMockData(credentials.useMockData !== false); // Default to true
            }
        } catch (error) {
            handleError(error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const credentials: CCLICredentialsType = {
                subscriptionId: subscriptionId.trim(),
                apiKey: apiKey.trim(),
                useMockData,
            };

            await setSetting(CCLI_SETTINGS_KEY, JSON.stringify(credentials));
            showSimpleToast('CCLI Settings', 'Settings saved successfully');
        } catch (error) {
            handleError(error);
            showSimpleToast('Error', 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = async () => {
        try {
            await setSetting(CCLI_SETTINGS_KEY, null);
            setSubscriptionId('');
            setApiKey('');
            setUseMockData(true);
            showSimpleToast('CCLI Settings', 'Settings cleared');
        } catch (error) {
            handleError(error);
        }
    };

    return (
        <div className="p-3">
            <h5>CCLI SongSelect Integration</h5>
            <p className="text-muted">
                Configure your CCLI SongSelect credentials to search and import
                licensed worship songs.
            </p>

            <div className="alert alert-info">
                <strong>Requirements:</strong>
                <ul className="mb-0">
                    <li>Active CCLI SongSelect subscription</li>
                    <li>API access enabled on your account</li>
                    <li>Valid Subscription ID and API Key</li>
                </ul>
            </div>

            <div className="mb-3">
                <div className="form-check form-switch">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="ccli-developer-mode"
                        checked={useMockData}
                        onChange={(e) => setUseMockData(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="ccli-developer-mode">
                        <strong>Developer Mode</strong> (Use mock data for testing)
                    </label>
                </div>
                <small className="form-text text-muted">
                    {useMockData 
                        ? '✅ Using mock data - 3 sample songs available for testing'
                        : '⚠️ Live mode - Real API integration (not yet implemented)'}
                </small>
            </div>

            <div className="mb-3">
                <label htmlFor="ccli-subscription-id" className="form-label">
                    Subscription ID
                    {useMockData && <span className="text-muted"> (optional in developer mode)</span>}
                </label>
                <input
                    type="text"
                    className="form-control"
                    id="ccli-subscription-id"
                    placeholder="Enter your CCLI Subscription ID"
                    value={subscriptionId}
                    onChange={(e) => setSubscriptionId(e.target.value)}
                />
                <small className="form-text text-muted">
                    Your unique subscription identifier
                </small>
            </div>

            <div className="mb-3">
                <label htmlFor="ccli-api-key" className="form-label">
                    API Key
                    {useMockData && <span className="text-muted"> (optional in developer mode)</span>}
                </label>
                <input
                    type="password"
                    className="form-control"
                    id="ccli-api-key"
                    placeholder="Enter your CCLI API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <small className="form-text text-muted">
                    Your secure API key for accessing SongSelect
                </small>
            </div>

            <div className="d-flex gap-2">
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving || (!useMockData && !subscriptionId.trim() && !apiKey.trim())}
                >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                    className="btn btn-outline-secondary"
                    onClick={handleClear}
                    disabled={isSaving}
                >
                    Clear
                </button>
            </div>

            <hr className="my-4" />

            {useMockData && (
                <div className="alert alert-success">
                    <strong>Developer Mode Active</strong>
                    <p className="mb-2">
                        You can test the CCLI integration with 3 sample songs:
                    </p>
                    <ul className="mb-0">
                        <li>Amazing Grace (My Chains Are Gone) - CCLI# 4768151</li>
                        <li>10,000 Reasons (Bless The Lord) - CCLI# 6016351</li>
                        <li>How Great Is Our God - CCLI# 4348399</li>
                    </ul>
                </div>
            )}

            {!useMockData && (
                <div className="alert alert-info">
                    <strong>Live Mode Active</strong>
                    <p className="mb-2">
                        The CCLI API integration is ready to use. Make sure you have:
                    </p>
                    <ul className="mb-0">
                        <li>Valid CCLI SongSelect subscription</li>
                        <li>API access enabled on your account</li>
                        <li>Correct Subscription ID and API Key entered above</li>
                    </ul>
                    <p className="mt-2 mb-0">
                        Once configured, you can search and import songs from CCLI SongSelect.
                    </p>
                </div>
            )}

            <div className="mt-3">
                <h6>How to get CCLI credentials:</h6>
                <ol>
                    <li>
                        Visit{' '}
                        <a
                            href="https://songselect.ccli.com"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            songselect.ccli.com
                        </a>
                    </li>
                    <li>Log in to your account</li>
                    <li>Go to Account Settings → API Access</li>
                    <li>Request API access if not already enabled</li>
                    <li>Copy your Subscription ID and API Key</li>
                </ol>
            </div>
        </div>
    );
}
