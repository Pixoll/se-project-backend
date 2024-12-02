import { createHash } from "crypto";
import { Request, Response } from "express";
import { sql } from "kysely";
import {
    BigIntString,
    db,
    hashPassword,
    isValidEmail,
    isValidPhone,
    isValidRut,
    NewPatient,
    Patient,
    TimeSlot,
} from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { MapNullToUndefined, SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { Validator } from "../validator";

export class PatientsEndpoint extends Endpoint {
    private newPatientValidator: Validator<PatientBody>;
    private patientUpdateValidator: Validator<PatientUpdateBody>;

    public constructor() {
        super("/patients");

        this.newPatientValidator = new Validator<PatientBody>({
            firstName: {
                required: true,
                validate: (value, key) => {
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
            secondName: (value, key) => {
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
                validate: (value, key) => {
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
            secondLastName: (value, key) => {
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
                validate: async (value, key) => {
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
                validate: async (value, key) => {
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
                validate: (value, key) => {
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
                validate: (value, key) => {
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
                validate: (value, key) => {
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
                validate: (value, key) => {
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
                validate: (value, key) => {
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
                validate: async (value, key) => {
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
                validate: async (value, key) => {
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
            allergiesHistory: (value, key) => {
                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            morbidityHistory: (value, key) => {
                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            surgicalHistory: (value, key) => {
                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            medications: (value, key) => {
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
                validate: (value, key) => {
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
        });

        this.patientUpdateValidator = new Validator<PatientUpdateBody>({
            firstName: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.firstName.validate(value, key);
            },
            secondName: this.newPatientValidator.validators.secondName,
            firstLastName: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.firstLastName.validate(value, key);
            },
            secondLastName: this.newPatientValidator.validators.secondLastName,
            email: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.email.validate(value, key);
            },
            phone: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.phone.validate(value, key);
            },
            birthDate: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.birthDate.validate(value, key);
            },
            gender: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.gender.validate(value, key);
            },
            weight: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.weight.validate(value, key);
            },
            height: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.height.validate(value, key);
            },
            rhesusFactor: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.rhesusFactor.validate(value, key);
            },
            bloodTypeId: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.bloodTypeId.validate(value, key);
            },
            insuranceTypeId: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators.insuranceTypeId.validate(value, key);
            },
            allergiesHistory: this.newPatientValidator.validators.allergiesHistory,
            morbidityHistory: this.newPatientValidator.validators.morbidityHistory,
            surgicalHistory: this.newPatientValidator.validators.surgicalHistory,
            medications: this.newPatientValidator.validators.medications,
        });
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

        const validationResult = await this.newPatientValidator.validate(request.body);

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

        const validationResult = await this.patientUpdateValidator.validate(request.body);

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

    @GetMethod({ path: "/:rut/appointments", requiresAuthorization: true })
    public async getAppointments(request: Request<{ rut: string }>, response: Response<Appointment[]>): Promise<void> {
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
            .selectFrom("patient")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const appointments = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .select([
                "a.id",
                "m.rut as medicRut",
                "a.date",
                "t.day",
                "t.start",
                "t.end",
                "a.description",
                "a.confirmed",
            ])
            .where(({ eb, and }) => and([
                eb("a.patient_rut", "=", rut),
                eb("a.date", ">=", sql<string>`current_date()`),
                eb("t.active", "=", true),
            ]))
            .execute();

        this.sendOk(response, appointments);
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

type Appointment = {
    id: BigIntString;
    medicRut: string;
    date: string;
    day: TimeSlot["day"];
    start: string;
    end: string;
    description: string;
    confirmed: boolean;
};

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
