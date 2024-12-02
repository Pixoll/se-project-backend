import { HTTPStatus } from "./base";

export class Validator<T extends Record<string, any>, ExtraGlobalArgs extends any[] = []> {
    public readonly validators: RecursiveReadonly<ValidatorObject<T, false>>;
    public readonly globalValidator?: GlobalValidatorFunction<T, ExtraGlobalArgs>;

    public constructor(validators: ValidatorObject<T>, globalValidator?: GlobalValidatorFunction<T, ExtraGlobalArgs>) {
        const parsedValidators = {} as ValidatorObject<T, false>;

        type ValidatorEntries = Array<[keyof T & string, ValidatorObject<T>[keyof ValidatorObject<T>]]>;
        for (const [key, validator] of Object.entries(validators) as ValidatorEntries) {
            // @ts-expect-error: key is never "global" at this point
            parsedValidators[key] = Object.freeze(typeof validator === "function" ? {
                required: false,
                validator: validator as ValidatorFunction<keyof T>,
            } : validator);
        }

        this.validators = Object.freeze(parsedValidators) as RecursiveReadonly<ValidatorObject<T, false>>;
        this.globalValidator = globalValidator;
    }

    public async validate(object: Record<string, any>, ...args: ExtraGlobalArgs): Promise<ValidationResult<T>> {
        const result = {} as T;

        type ValidatorEntries = Array<[keyof T & string, ValidatorEntry<keyof T>]>;
        for (const [key, validator] of Object.entries(this.validators) as ValidatorEntries) {
            const value = object[key];

            if (validator.required && !value) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Missing ${key}.`,
                };
            }

            // eslint-disable-next-line no-await-in-loop
            const validationResult = await validator.validate(value, key);

            if (!validationResult.ok) {
                return validationResult;
            }

            result[key] = value;
        }

        const validationResult = await this.globalValidator?.(object as T, ...args) ?? {
            ok: true,
        };

        return validationResult.ok ? {
            ok: true,
            value: result,
        } : validationResult;
    }
}

type ValidatorObject<T extends Record<string, any>, IncludeFunctionEntries extends boolean = true> = {
    [K in keyof T]-?: IncludeFunctionEntries extends true ? ValidatorFunction<K> | ValidatorEntry<K> : ValidatorEntry<K>;
};

type ValidatorEntry<K> = {
    required: boolean;
    validate: ValidatorFunction<K>;
};

type ValidatorFunction<K> = (value: unknown, key: K) => ValidatorResult | Promise<ValidatorResult>;

type GlobalValidatorFunction<T, ExtraGlobalArgs extends any[]> = (
    object: T,
    ...args: ExtraGlobalArgs
) => ValidatorResult | Promise<ValidatorResult>;

type ValidatorResult = ValidationError | {
    ok: true;
};

type ValidationResult<T> = ValidationError | {
    ok: true;
    value: T;
};

type ValidationError = {
    ok: false;
    status: HTTPStatus;
    message: string;
};

type RecursiveReadonly<T> = {
    readonly [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K]
        : T[K] extends Record<infer _, infer __> ? RecursiveReadonly<T[K]>
            : T[K];
};
