import lwSharePackage from 'lw-share/package.json';
import type { AddressWithQR } from 'lw-share';

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

// lw-share holds ONE express app and ONE http server for the whole process,
// and its `init` registers every route and another socket.io server each time
// it runs. So it runs once, and the folder it was given is the one served for
// as long as this window lives. A new port only re-points the server, and
// takes the last set-up's listeners off -- left on, they went on answering
// with the OLD port's addresses and QR codes (2026-11-03).
let servedTargetDir: string | null = null;
let removeListeners: (() => void) | null = null;

export async function initServer({
    port,
    targetDir,
    onStatus,
}: StartServerParamsType) {
    const {
        app,
        init: initApp,
        httpServer,
        getRandomPort,
        getAddressesWithQR,
    } = await import('lw-share');
    console.log('Starting lw-share...');
    if (port === undefined) {
        console.log('No port specified, using default port 3000');
        port = await getRandomPort();
        if (port === undefined) {
            onStatus({ status: 'error', message: 'No available port found' });
            return null;
        }
    }
    if (servedTargetDir === null) {
        initApp(targetDir, port);
        servedTargetDir = targetDir;
    } else {
        // What lw-share's own /addresses page reads.
        app.set('port', port);
    }
    removeListeners?.();
    const handleListening = async () => {
        const addressesWithQRList = await getAddressesWithQR(port);
        onStatus({ status: 'running', data: { addressesWithQRList } });
    };
    const handleError = (err: Error) => {
        console.error('Server error:', err);
        onStatus({ status: 'error', message: err.message });
    };
    const handleClose = () => {
        console.log('Server closed');
        onStatus({ status: 'stopped' });
    };
    httpServer.on('listening', handleListening);
    httpServer.on('error', handleError);
    httpServer.on('close', handleClose);
    removeListeners = () => {
        httpServer.off('listening', handleListening);
        httpServer.off('error', handleError);
        httpServer.off('close', handleClose);
    };
    return {
        port,
        targetDir: servedTargetDir,
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
            return await getAddressesWithQR(port);
        },
    };
}

export const lwShareInfo = {
    lwSharePackage,
};
