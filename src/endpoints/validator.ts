import { HTTPStatus } from "./base";

export type Validator = "required" | "skip" | ((value: unknown) => Promise<ValidationResult>);

export type ValidationResult = {
    ok: true;
} | {
    ok: false;
    status: HTTPStatus;
    message: string;
};

export async function validate<T>(target: T, validators: Record<keyof T & string, Validator>): Promise<ValidationResult> {
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
    }

    return {
        ok: true,
    };
}
