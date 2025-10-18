import { lwShareInfo, initServer } from '../lwShareHelpers';
import { provider } from './fullProvider';
import { initProvider } from './providerHelpers';

initProvider(provider);

const lwShareController = {
    info: { lwShareInfo },
    initServer,
};

(global as any).lwShareController = (window as any).lwShareController =
    lwShareController;
