import { createHash } from "crypto";
import { Request, Response } from "express";
import { db, hashPassword, isValidEmail, isValidPhone, isValidRut, NewPatient, Patient } from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { MapNullToUndefined, SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { validate, Validator, ValidatorResult } from "../validator";

export class PatientsEndpoint extends Endpoint {
    private static readonly NEW_PATIENT_VALIDATORS = {
        firstName: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        secondName: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        firstLastName: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        secondLastName: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        email: {
            required: true,
            validator: async (value, key): Promise<ValidatorResult> => {
                const valid = !!value && typeof value === "string" && isValidEmail(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const patient = await db
                    .selectFrom("patient")
                    .select("rut")
                    .where("email", "=", value)
                    .executeTakeFirst();

                return !patient ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `A patient with ${key} ${value} already exists.`,
                };
            },
        },
        phone: {
            required: true,
            validator: async (value, key): Promise<ValidatorResult> => {
                const valid = !!value && typeof value === "number" && isValidPhone(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const patient = await db
                    .selectFrom("patient")
                    .select("rut")
                    .where("phone", "=", value)
                    .executeTakeFirst();

                return !patient ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `A patient with ${key} ${value} already exists.`,
                };
            },
        },
        birthDate: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value
                    && typeof value === "string"
                    && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])$/.test(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        gender: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        weight: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "number" && value > 0;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        height: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "number" && value > 0;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        rhesusFactor: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "string" && ["+", "-"].includes(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        bloodTypeId: {
            required: true,
            validator: async (value, key): Promise<ValidatorResult> => {
                if (!(value && typeof value === "number" && value > 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const bloodType = await db
                    .selectFrom("blood_type")
                    .select("id")
                    .where("id", "=", value)
                    .executeTakeFirst();

                return bloodType ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        insuranceTypeId: {
            required: true,
            validator: async (value, key): Promise<ValidatorResult> => {
                if (!(value && typeof value === "number" && value > 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const insuranceType = await db
                    .selectFrom("insurance_type")
                    .select("id")
                    .where("id", "=", value)
                    .executeTakeFirst();

                return insuranceType ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
        allergiesHistory: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        morbidityHistory: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        surgicalHistory: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        medications: (value, key): ValidatorResult => {
            const valid = !value || typeof value === "string";
            return valid ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid ${key}.`,
            };
        },
        password: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = !!value && typeof value === "string" && value.length >= 8;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        },
    } as const satisfies Record<keyof PatientBody, Validator>;

    private static readonly PATIENT_UPDATE_VALIDATORS = {
        firstName: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.firstName.validator(value, key);
        },
        secondName: PatientsEndpoint.NEW_PATIENT_VALIDATORS.secondName,
        firstLastName: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.firstLastName.validator(value, key);
        },
        secondLastName: PatientsEndpoint.NEW_PATIENT_VALIDATORS.secondLastName,
        email: async (value, key): Promise<ValidatorResult> => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.email.validator(value, key);
        },
        phone: async (value, key): Promise<ValidatorResult> => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.phone.validator(value, key);
        },
        birthDate: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.birthDate.validator(value, key);
        },
        gender: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.gender.validator(value, key);
        },
        weight: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.weight.validator(value, key);
        },
        height: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.height.validator(value, key);
        },
        rhesusFactor: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.rhesusFactor.validator(value, key);
        },
        bloodTypeId: async (value, key): Promise<ValidatorResult> => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.bloodTypeId.validator(value, key);
        },
        insuranceTypeId: async (value, key): Promise<ValidatorResult> => {
            return typeof value === "undefined" ? {
                ok: true,
            } : PatientsEndpoint.NEW_PATIENT_VALIDATORS.insuranceTypeId.validator(value, key);
        },
        allergiesHistory: PatientsEndpoint.NEW_PATIENT_VALIDATORS.allergiesHistory,
        morbidityHistory: PatientsEndpoint.NEW_PATIENT_VALIDATORS.morbidityHistory,
        surgicalHistory: PatientsEndpoint.NEW_PATIENT_VALIDATORS.surgicalHistory,
        medications: PatientsEndpoint.NEW_PATIENT_VALIDATORS.medications,
    } as const satisfies Record<keyof PatientUpdateBody, Validator>;

    public constructor() {
        super("/patients");
    }

    @GetMethod({ path: "/:rut", requiresAuthorization: true })
    public async getPatient(request: Request<{ rut: string }>, response: Response<PatientResponse>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.PATIENT && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const patient = await db
            .selectFrom("patient as p")
            .innerJoin("blood_type as bt", "bt.id", "p.blood_type_id")
            .innerJoin("insurance_type as it", "it.id", "p.insurance_type_id")
            .select([
                "p.first_name as firstName",
                "p.second_name as secondName",
                "p.first_last_name as firstLastName",
                "p.second_last_name as secondLastName",
                "p.email",
                "p.phone",
                "p.birth_date as birthDate",
                "p.gender",
                "p.weight",
                "p.height",
                "p.rhesus_factor as rhesusFactor",
                "bt.name as bloodType",
                "it.name as insuranceType",
                "p.allergies_history as allergiesHistory",
                "p.morbidity_history as morbidityHistory",
                "p.surgical_history as surgicalHistory",
                "p.medications",
            ])
            .where("p.rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const result: PatientResponse = {
            firstName: patient.firstName,
            ...patient.secondName && { secondName: patient.secondName },
            firstLastName: patient.firstLastName,
            ...patient.secondLastName && { secondLastName: patient.secondLastName },
            email: patient.email,
            phone: patient.phone,
            birthDate: patient.birthDate,
            gender: patient.gender,
            weight: patient.weight,
            height: patient.height,
            rhesusFactor: patient.rhesusFactor,
            bloodType: patient.bloodType,
            insuranceType: patient.insuranceType,
            ...patient.allergiesHistory && { allergiesHistory: patient.allergiesHistory },
            ...patient.morbidityHistory && { morbidityHistory: patient.morbidityHistory },
            ...patient.surgicalHistory && { surgicalHistory: patient.surgicalHistory },
            ...patient.medications && { medications: patient.medications },
        };

        this.sendOk(response, result);
    }

    @PostMethod("/:rut")
    public async createPatient(
        request: Request<{ rut: string }, unknown, PatientBody>,
        response: Response
    ): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const registeredPatient = await db
            .selectFrom("patient")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (registeredPatient) {
            this.sendError(response, HTTPStatus.CONFLICT, `Patient with rut ${rut} already exists.`);
            return;
        }

        const validationResult = await validate(request.body, PatientsEndpoint.NEW_PATIENT_VALIDATORS);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const {
            firstName,
            secondName,
            firstLastName,
            secondLastName,
            email,
            phone,
            birthDate,
            gender,
            weight,
            height,
            rhesusFactor,
            bloodTypeId,
            insuranceTypeId,
            password,
        } = validationResult.value;

        const hashedPassword = hashPassword(password);

        await db
            .insertInto("patient")
            .values({
                rut,
                first_name: firstName,
                second_name: secondName || undefined,
                first_last_name: firstLastName,
                second_last_name: secondLastName || undefined,
                email,
                phone,
                birth_date: birthDate,
                gender,
                weight,
                height,
                rhesus_factor: rhesusFactor,
                blood_type_id: bloodTypeId,
                insurance_type_id: insuranceTypeId,
                ...hashedPassword,
            })
            .execute();

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @PatchMethod({ path: "/:rut", requiresAuthorization: true })
    public async updatePatient(
        request: Request<{ rut: string }, unknown, PatientUpdateBody>,
        response: Response
    ): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.PATIENT && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const registeredPatient = await db
            .selectFrom("patient")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!registeredPatient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const validationResult = await validate(request.body, PatientsEndpoint.PATIENT_UPDATE_VALIDATORS);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        if (Object.keys(validationResult.value).length === 0) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        const {
            firstName,
            secondName,
            firstLastName,
            secondLastName,
            email,
            phone,
            birthDate,
            gender,
            weight,
            height,
            rhesusFactor,
            bloodTypeId,
            insuranceTypeId,
        } = validationResult.value;

        const updateResult = await db
            .updateTable("patient")
            .set({
                first_name: firstName,
                second_name: secondName || undefined,
                first_last_name: firstLastName,
                second_last_name: secondLastName || undefined,
                email,
                phone,
                birth_date: birthDate,
                gender,
                weight,
                height,
                rhesus_factor: rhesusFactor,
                blood_type_id: bloodTypeId,
                insurance_type_id: insuranceTypeId,
            })
            .where("rut", "=", rut)
            .execute();

        if (updateResult[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @PostMethod("/:rut/session")
    public async createSession(
        request: Request<{ rut: string }, unknown, { password?: string }>,
        response: Response<{ token: string }>
    ): Promise<void> {
        const { rut } = request.params;
        const { password } = request.body;

        if (!password) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }

        const patient = await db
            .selectFrom("patient")
            .select(["password", "salt"])
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const encryptedPassword = createHash("sha512").update(password + patient.salt).digest("base64url");

        if (encryptedPassword !== patient.password) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Incorrect password.");
            return;
        }

        const token = await generateToken(rut, TokenType.PATIENT);

        this.sendStatus(response, HTTPStatus.CREATED, { token });
    }

    @DeleteMethod({ path: "/:rut/session", requiresAuthorization: TokenType.PATIENT })
    public async expireSession(request: Request, response: Response): Promise<void> {
        const { token } = this.getToken(request)!;

        await revokeToken(token);

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type PatientBody = SnakeToCamelRecord<Omit<NewPatient, "rut" | "salt" | "session_token">>;

type PatientUpdateBody = Partial<Omit<PatientBody, "password">>;

type PatientResponse = SnakeToCamelRecord<Omit<MapNullToUndefined<Patient>,
    | "blood_type_id"
    | "insurance_type_id"
    | "password"
    | "rut"
    | "salt"
    | "session_token"
>> & {
    bloodType: string;
    insuranceType: string;
};
