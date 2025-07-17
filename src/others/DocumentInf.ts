import { OptionalPromise } from '../helper/typeHelpers';

export default interface DocumentInf {
    save(): OptionalPromise<boolean>;
}
