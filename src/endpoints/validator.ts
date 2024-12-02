import { HTTPStatus } from "./base";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidatorObject<T extends Record<string, any>> = {
    [K in keyof T]: Validator;
} & {
    global?: (object: T) => ValidatorResult | Promise<ValidatorResult>;
};

type Validator = ValidatorFunction | {
    required: true;
    validator: ValidatorFunction;
};

type ValidatorFunction = (value: unknown, key: string) => ValidatorResult | Promise<ValidatorResult>;

export type ValidatorResult = ValidationError | {
    ok: true;
};

export type ValidationResult<T> = ValidationError | {
    ok: true;
    value: T;
};

type ValidationError = {
    ok: false;
    status: HTTPStatus;
    message: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function validate<T extends Record<string, any>>(
    target: T,
    validators: ValidatorObject<T>
): Promise<ValidationResult<T>> {
    // @ts-expect-error: if it's valid, it will be of type T
    const result: T = {};

    for (const [key, validator] of Object.entries(validators) as Array<[keyof T & string, Validator]>) {
        const isValidatorFunction = typeof validator === "function";

        const value = target[key];

        if (!isValidatorFunction && validator.required && !value) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Missing ${key}.`,
            };
        }

        const validatorFunction = isValidatorFunction ? validator : validator.validator;

        // eslint-disable-next-line no-await-in-loop
        const validationResult = await validatorFunction(value, key);

        if (!validationResult.ok) {
            return validationResult;
        }

        result[key] = value;
    }

    return {
        ok: true,
        value: result,
    };
}
