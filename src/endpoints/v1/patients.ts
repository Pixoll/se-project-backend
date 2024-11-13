import { Request, Response } from "express";
import { db, hashPassword, isValidEmail, isValidPhone, isValidRut, MedicalRecord, NewPatient, Patient } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";

export class PatientsEndpoint extends Endpoint {
    public constructor() {
        super("/patients");
    }

    @GetMethod("/:rut")
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
            secondName: patient.secondName,
            firstLastName: patient.firstLastName,
            secondLastName: patient.secondLastName,
            email: patient.email,
            phone: patient.phone,
            birthDate: patient.birthDate.toLocaleDateString("es-CL"),
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

        const isValid = await isValidPatient(request.body);

        if (!isValid.ok) {
            this.sendError(response, isValid.status, isValid.message);
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
                birth_date: new Date(birthDate),
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
}

const patientValidators: Record<keyof PatientBody, Validator> = {
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
        const valid = !!value && typeof value === "string" && /^\d{2}-\d{2}-\d{4}$/.test(value);
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
                message: "Invalid rhesusFactor.",
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
            message: "Invalid rhesusFactor.",
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

async function isValidPatient(patient: PatientBody): Promise<ValidationResult> {
    for (const [key, validator] of Object.entries(patientValidators) as ObjectEntries<typeof patientValidators>) {
        if (validator === "skip") {
            continue;
        }

        const value = patient[key];

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

type Validator = "required" | "skip" | ((value: unknown) => Promise<ValidationResult>);

type ValidationResult = {
    ok: true;
} | {
    ok: false;
    status: HTTPStatus;
    message: string;
};

type PatientBody = SnakeToCamelRecord<Omit<NewPatient, "birth_date" | "rut" | "salt" | "session_token">> & {
    birthDate: string;
};

type PatientResponse = SnakeToCamelRecord<Omit<
    Patient,
    "birth_date" | "blood_type_id" | "insurance_type_id" | "password" | "rut" | "salt" | "session_token"
>> & {
    birthDate: string;
    bloodType: string;
    insuranceType: string;
    medicalRecord: Partial<NonNullableRecord<SnakeToCamelRecord<Omit<MedicalRecord, "patient_rut">>>>;
};

type NonNullableRecord<T> = {
    [K in keyof T]: NonNullable<T[K]>;
};

type SnakeToCamelRecord<T> = {
    [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K];
};

type SnakeToCamelCase<S extends string> = S extends `${infer A}_${infer B}`
    ? `${A}${Capitalize<SnakeToCamelCase<B>>}`
    : S;

type ObjectEntries<T> = Array<[keyof T, T[keyof T]]>;
