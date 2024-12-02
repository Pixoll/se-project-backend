import { HTTPStatus } from "./base";

export class Validator<T extends Record<string, any>> {
    public readonly validators: RecursiveReadonly<ValidatorObject<T, false>>;

    public constructor(validators: ValidatorObject<T>) {
        const parsedValidators = {
            ...validators.global && { global: validators.global },
        } as ValidatorObject<T, false>;

        type ValidatorEntries = Array<[(keyof T & string) | "global", ValidatorObject<T>[keyof ValidatorObject<T>]]>;
        for (const [key, validator] of Object.entries(validators) as ValidatorEntries) {
            if (key === "global") {
                continue;
            }

            // @ts-expect-error: key is never "global" at this point
            parsedValidators[key] = Object.freeze(typeof validator === "function" ? {
                required: false,
                validator: validator as ValidatorFunction,
            } : validator);
        }

        this.validators = Object.freeze(parsedValidators) as RecursiveReadonly<ValidatorObject<T, false>>;
    }

    public async validate(object: Record<string, any>): Promise<ValidationResult<T>> {
        const result = {} as T;

        type ValidatorEntries = Array<[(keyof T & string) | "global", ValidatorEntry]>;
        for (const [key, validator] of Object.entries(this.validators) as ValidatorEntries) {
            if (key === "global") {
                continue;
            }

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

        const globalValidator = this.validators.global as GlobalValidatorFunction<T> | undefined;

        const validationResult = await globalValidator?.(object as T) ?? {
            ok: true,
        };

        return validationResult.ok ? {
            ok: true,
            value: result,
        } : validationResult;
    }
}

type ValidatorObject<T extends Record<string, any>, IncludeFunctionEntries extends boolean = true> = {
    [K in keyof T]: IncludeFunctionEntries extends true ? ValidatorFunction | ValidatorEntry : ValidatorEntry;
} & {
    global?: GlobalValidatorFunction<T>;
};

type ValidatorEntry = {
    required: boolean;
    validate: ValidatorFunction;
};

type ValidatorFunction = (value: unknown, key: string) => ValidatorResult | Promise<ValidatorResult>;

type GlobalValidatorFunction<T> = (object: T) => ValidatorResult | Promise<ValidatorResult>;

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
    readonly [K in keyof T]: T extends Record<infer _, infer __> ? RecursiveReadonly<T[K]> : T[K];
};
