import { createHash } from "crypto";
import { Request, Response } from "express";
import { db, hashPassword, isValidEmail, isValidPhone, isValidRut, MedicalRecord, NewPatient, Patient } from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { NonNullableRecord, SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { validate, ValidationResult, Validator } from "../validator";

export class PatientsEndpoint extends Endpoint {
    private readonly patientValidators: Record<keyof PatientBody, Validator>;

    public constructor() {
        super("/patients");

        this.patientValidators = {
            firstName: "required",
            secondName: "skip",
            firstLastName: "required",
            secondLastName: "skip",
            email: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "string" && isValidEmail(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid email.",
                };
            },
            phone: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "number" && isValidPhone(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid phone.",
                };
            },
            birthDate: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value
                    && typeof value === "string"
                    && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])$/.test(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid birthDate.",
                };
            },
            gender: "required",
            weight: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "number" && value > 0;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid weight.",
                };
            },
            height: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "number" && value > 0;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid height.",
                };
            },
            rhesusFactor: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "string" && ["+", "-"].includes(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid rhesusFactor.",
                };
            },
            bloodTypeId: async (value: unknown): Promise<ValidationResult> => {
                if (!(value && typeof value === "number" && value > 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Invalid bloodTypeId.",
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
                    message: "Invalid bloodTypeId.",
                };
            },
            insuranceTypeId: async (value: unknown): Promise<ValidationResult> => {
                if (!(value && typeof value === "number" && value > 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Invalid insuranceTypeId.",
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
                    message: "Invalid insuranceTypeId.",
                };
            },
            password: async (value: unknown): Promise<ValidationResult> => {
                const valid = !!value && typeof value === "string" && value.length >= 8;
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: "Invalid password.",
                };
            },
        };
    }

    @GetMethod({ path: "/:rut", requiresAuthorization: true })
    public async getPatient(request: Request<{ rut: string }>, response: Response<PatientResponse>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const patient = await db
            .selectFrom("patient as p")
            .innerJoin("blood_type as bt", "bt.id", "p.blood_type_id")
            .innerJoin("insurance_type as it", "it.id", "p.insurance_type_id")
            .leftJoin("medical_record as mr", "mr.patient_rut", "p.rut")
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
                "mr.allergies_history as allergiesHistory",
                "mr.morbidity_history as morbidityHistory",
                "mr.surgical_history as surgicalHistory",
                "mr.medications",
            ])
            .where("p.rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        this.sendOk(response, {
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
            medicalRecord: {
                ...patient.allergiesHistory && { allergiesHistory: patient.allergiesHistory },
                ...patient.morbidityHistory && { morbidityHistory: patient.morbidityHistory },
                ...patient.surgicalHistory && { surgicalHistory: patient.surgicalHistory },
                ...patient.medications && { medications: patient.medications },
            },
        });
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

        const validationResult = await validate(request.body, this.patientValidators);

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
        } = request.body;

        const registeredPatient = await db
            .selectFrom("patient")
            .select([
                "rut",
                "email",
                "phone",
            ])
            .where(eb =>
                eb("rut", "=", rut)
                    .or("email", "=", email)
                    .or("phone", "=", phone)
            )
            .executeTakeFirst();

        if (registeredPatient) {
            const conflict = registeredPatient.rut === rut ? `rut ${rut}`
                : registeredPatient.email === email ? `email ${email}`
                    : `phone ${phone}`;

            this.sendError(response, HTTPStatus.CONFLICT, `Patient with ${conflict} already exists.`);
            return;
        }

        const hashedPassword = hashPassword(password);

        await db
            .insertInto("patient")
            .values({
                rut,
                first_name: firstName,
                second_name: secondName,
                first_last_name: firstLastName,
                second_last_name: secondLastName,
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
        const token = request.headers.authorization!.slice(7);

        await revokeToken(token);

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type PatientBody = SnakeToCamelRecord<Omit<NewPatient, "birth_date" | "rut" | "salt" | "session_token">> & {
    birthDate: string;
};

type PatientResponse = SnakeToCamelRecord<Omit<Patient,
    | "birth_date"
    | "blood_type_id"
    | "insurance_type_id"
    | "password"
    | "rut"
    | "salt"
    | "second_name"
    | "second_last_name"
    | "session_token"
>> & {
    secondName?: string;
    secondLastName?: string;
    birthDate: string;
    bloodType: string;
    insuranceType: string;
    medicalRecord: Partial<NonNullableRecord<SnakeToCamelRecord<Omit<MedicalRecord, "patient_rut">>>>;
};
