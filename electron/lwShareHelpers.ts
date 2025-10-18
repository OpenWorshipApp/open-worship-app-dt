import {
    init as initApp,
    httpServer,
    getRandomPort,
    getAddressesWithQR,
    AddressWithQR,
} from 'lw-share';
import lwSharePackage from 'lw-share/package.json';

export type StatusType = 'stopped' | 'starting' | 'running' | 'error';
export type StatusDataType = {
    status: StatusType;
    message?: string;
    data?: { addressesWithQRList: AddressWithQR[] };
};
export type StartServerParamsType = {
    port?: number;
    targetDir: string;
    onStatus: (status: StatusDataType) => void;
};
export async function initServer({
    port,
    targetDir,
    onStatus,
}: StartServerParamsType) {
    console.log('Starting lw-share...');
    if (port === undefined) {
        console.log('No port specified, using default port 3000');
        port = await getRandomPort();
        if (port === undefined) {
            onStatus({ status: 'error', message: 'No available port found' });
            return null;
        }
    }
    initApp(targetDir, port);
    httpServer.on('listening', async () => {
        const addressesWithQRList = await getAddressesWithQR(port);
        onStatus({ status: 'running', data: { addressesWithQRList } });
    });
    httpServer.on('error', (err) => {
        console.error('Server error:', err);
        onStatus({ status: 'error', message: err.message });
    });
    httpServer.on('close', () => {
        console.log('Server closed');
        onStatus({ status: 'stopped' });
    });
    return {
        port,
        targetDir,
        stop: () => {
            httpServer.close();
        },
        restart: () => {
            try {
                httpServer.close();
            } catch (error) {
                console.error('Error closing server:', error);
            }
            httpServer.listen(port);
        },
        getIsRunning: () => {
            return !!httpServer.listening;
        },
        getAddressesWithQRList: async () => {
            return await getAddressesWithQR(port!);
        },
    };
}

export const lwShareInfo = {
    lwSharePackage,
};
