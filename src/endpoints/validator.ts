import { HTTPStatus } from "./base";

export type Validator = "required" | "skip" | ((value: unknown) => ValidatorResult | Promise<ValidatorResult>);

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
        if (validator === "skip") {
            continue;
        }

        const value = target[key];

        if (validator === "required") {
            if (value) {
                continue;
            }

            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Missing ${key}.`,
            };
        }

        // eslint-disable-next-line no-await-in-loop
        const validationResult = await validator(value);

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
