import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';

type SettingValidatorType = (value: string) => boolean;
type SettingSerializeType = (value: any) => string;
type SettingDeserializeType = (value: string) => any;
export default class SettingManager<T> {
    settingName: string;
    validate: SettingValidatorType;
    serialize: SettingSerializeType;
    deserialize: SettingDeserializeType;
    defaultValue: T;
    isErrorToDefault: boolean;
    constructor({
        settingName,
        defaultValue,
        isErrorToDefault,
        validate,
        serialize,
        deserialize,
    }: {
        settingName: string;
        defaultValue: T;
        isErrorToDefault?: boolean;
        validate?: SettingValidatorType;
        serialize?: SettingSerializeType;
        deserialize?: SettingDeserializeType;
    }) {
        this.settingName = settingName;
        this.defaultValue = defaultValue;
        this.isErrorToDefault = isErrorToDefault ?? false;
        this.validate = validate ?? (() => true);
        this.serialize = serialize ?? ((value) => value);
        this.deserialize = deserialize ?? ((value) => value);
    }
    getSetting(defaultValue?: T): T {
        defaultValue = defaultValue ?? this.defaultValue;
        const value =
            appLocalStorage.getItem(this.settingName) ??
            this.serialize(defaultValue);
        if (!this.validate(value)) {
            if (this.isErrorToDefault) {
                return defaultValue;
            }
            throw new Error(`Invalid setting value: ${value}`);
        }
        return this.deserialize(value);
    }
    setSetting(value: T) {
        if (!this.validate(this.serialize(value))) {
            throw new Error(`Invalid setting value: ${value}`);
        }
        appLocalStorage.setItem(this.settingName, this.serialize(value));
    }
}

/**
 * A `string[]` setting, the shape four settings independently hand-rolled
 * before this existed (lookup history, bible-find book selection, the clock
 * widget id list, the Excalidraw library list).
 *
 * Non-string entries are dropped rather than failing the whole read: a single
 * bad element must not throw away a list the user built up.
 */
export function genStringListSettingManager(settingName: string) {
    return new SettingManager<string[]>({
        settingName,
        defaultValue: [],
        isErrorToDefault: true,
        validate: (jsonString) => {
            try {
                return Array.isArray(JSON.parse(jsonString));
            } catch (_error) {
                return false;
            }
        },
        serialize: (itemList) => JSON.stringify(itemList),
        deserialize: (jsonString) => {
            return (JSON.parse(jsonString) as unknown[]).filter(
                (item): item is string => {
                    return typeof item === 'string';
                },
            );
        },
    });
}
