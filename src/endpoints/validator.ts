import { HTTPStatus } from "./base";

export type Validator = ValidatorFunction | {
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

export async function validate<T>(target: T, validators: Record<keyof T & string, Validator>): Promise<ValidationResult<T>> {
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
