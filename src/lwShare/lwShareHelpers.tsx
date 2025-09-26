import appProvider from '../server/appProvider';

export type StatusType = 'stopped' | 'starting' | 'running' | 'error';
export type AddressWithQRType = { address: string; qrCode: string };
export type SuccessDataType = { addressesWithQRList: AddressWithQRType[] };
export type StatusDataType = {
    status: StatusType;
    message?: string;
    data?: SuccessDataType;
};
export type InitServerParamsType = {
    port?: number;
    targetDir: string;
    onStatus: (status: StatusDataType) => void;
};
export type ServerDataType = {
    port: number;
    targetDir: string;
    stop: () => void;
    restart: () => void;
    getIsRunning: () => boolean;
    getAddressesWithQRList: () => Promise<AddressWithQRType[]>;
};
type ControllerType = {
    info: {
        lwShareInfo: { lwSharePackage: { version: string; homepage: string } };
    };
    initServer: (
        params: InitServerParamsType,
    ) => Promise<ServerDataType | null>;
};
export const controller: ControllerType = (window as any).lwShareController;

export const lwSharePackage = controller.info.lwShareInfo.lwSharePackage;
export const handleForkingOnGithub = () => {
    appProvider.browserUtils.openExternalURL(lwSharePackage.homepage);
};
