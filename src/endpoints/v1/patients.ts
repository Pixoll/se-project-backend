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
import { sendEmail } from "../../email/sender";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { MapNullToUndefined, SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { Validator } from "../validator";

export class PatientsEndpoint extends Endpoint {
    private readonly newPatientValidator: Validator<PatientBody>;
    private readonly patientUpdateValidator: Validator<PatientUpdateBody>;
    private readonly newAppointmentValidator: Validator<NewAppointment, [patientRut: string]>;
    private readonly appointmentUpdateValidator: Validator<AppointmentUpdate, [
        oldAppointment: Required<AppointmentUpdate>,
        patientRut: string,
    ]>;

    public constructor() {
        super("/patients");

        const days = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

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
            weight: (value, key) => {
                const valid = !value || (typeof value === "number" && value > 0);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            height: (value, key) => {
                const valid = !value || (typeof value === "number" && value > 0);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            rhesusFactor: (value, key) => {
                const valid = !value || (typeof value === "string" && ["+", "-"].includes(value));
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            bloodTypeId: async (value, key) => {
                if (!value) {
                    return {
                        ok: true,
                    };
                }

                if (typeof value !== "number" || value <= 0) {
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
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            secondName: this.newPatientValidator.validators.secondName,
            firstLastName: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            secondLastName: this.newPatientValidator.validators.secondLastName,
            email: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            phone: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            birthDate: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            gender: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            weight: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            height: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            rhesusFactor: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            bloodTypeId: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            insuranceTypeId: async (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newPatientValidator.validators[key].validate(value, key);
            },
            allergiesHistory: this.newPatientValidator.validators.allergiesHistory,
            morbidityHistory: this.newPatientValidator.validators.morbidityHistory,
            surgicalHistory: this.newPatientValidator.validators.surgicalHistory,
            medications: this.newPatientValidator.validators.medications,
        });

        this.newAppointmentValidator = new Validator<NewAppointment, [patientRut: string]>({
            date: {
                required: true,
                validate: (value, key) => {
                    const today = new Date(new Date().toLocaleDateString("es-CL").split("-").reverse().join("-")).getTime();

                    const valid = !!value
                        && typeof value === "string"
                        && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])$/.test(value)
                        && new Date(value).getTime() >= today;

                    return valid ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
            description: {
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
            timeSlotId: {
                required: true,
                validate: async (value, key) => {
                    if (!(value && typeof value === "number" && value > 0)) {
                        return {
                            ok: false,
                            status: HTTPStatus.BAD_REQUEST,
                            message: `Invalid ${key}.`,
                        };
                    }

                    const timeSlot = await db
                        .selectFrom("time_slot")
                        .select("id")
                        .where("id", "=", value)
                        .where("active", "=", true)
                        .executeTakeFirst();

                    return timeSlot ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
        }, async ({ date, timeSlotId }, patientRut) => {
            const day = days[new Date(date).getUTCDay()];

            const { start } = await db
                .selectFrom("time_slot")
                .select("start")
                .where("id", "=", timeSlotId)
                .executeTakeFirst() ?? {};

            const { doesDayMatch, hasAlreadyStarted } = await db
                .selectFrom("time_slot")
                .select(eb => [
                    eb("day", "=", day).as("doesDayMatch"),
                    eb(sql<number>`unix_timestamp(${date + " " + start})`, "<", sql<number>`unix_timestamp()`)
                        .as("hasAlreadyStarted"),
                ])
                .where("id", "=", timeSlotId)
                .executeTakeFirst() ?? {};

            if (`${doesDayMatch}` === "0") {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Appointment day and time slot day do not match.",
                };
            }

            if (`${hasAlreadyStarted}` === "1") {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Time slot has already started.",
                };
            }

            const doesOverlap = await db
                .selectFrom("appointment as a")
                .innerJoin("time_slot as t1", "t1.id", "a.time_slot_id")
                .innerJoin("time_slot as t2", (join) =>
                    join.on("t2.id", "=", timeSlotId)
                )
                .innerJoin("medic as m1", "m1.schedule_id", "t1.schedule_id")
                .innerJoin("medic as m2", "m2.schedule_id", "t2.schedule_id")
                .select("a.id")
                .where(({ eb, and, or, ref }) => and([
                    eb("a.date", "=", date),
                    or([
                        eb("a.patient_rut", "=", patientRut),
                        eb("m1.rut", "=", ref("m2.rut")),
                    ]),
                    or([
                        eb("t1.start", "=", ref("t2.start")),
                        eb("t1.end", "=", ref("t2.end")),
                        eb("t1.start", "<", ref("t2.start")).and("t2.start", "<", ref("t1.end")),
                        eb("t1.start", "<", ref("t2.end")).and("t2.end", "<", ref("t1.end")),
                        eb("t2.start", "<", ref("t1.start")).and("t1.end", "<", ref("t2.end")),
                        eb("t1.start", "<", ref("t2.start")).and("t2.end", "<", ref("t1.end")),
                    ]),
                ]))
                .executeTakeFirst();

            if (doesOverlap) {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Appointment overlaps with another.",
                };
            }

            return {
                ok: true,
            };
        });

        this.appointmentUpdateValidator = new Validator<AppointmentUpdate, [
            oldAppointment: Required<AppointmentUpdate>,
            patientRut: string,
        ]>({
            date: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newAppointmentValidator.validators[key].validate(value, key);
            },
            description: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newAppointmentValidator.validators[key].validate(value, key);
            },
            timeSlotId: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newAppointmentValidator.validators[key].validate(value, key);
            },
            confirmed: (value, key) => {
                const valid = typeof value === "undefined" || (typeof value === "boolean" && value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `Appointment ${key} status can only be changed from false to true.`,
                };
            },
        }, async (appointment, oldAppointment, patientRut) => {
            // const validationResult = await this.newAppointmentValidator.globalValidator!({
            //     ...oldAppointment,
            //     ...appointment,
            // }, patientRut);
            //
            // if (!validationResult.ok) return validationResult;

            const { timeSlotId } = appointment;

            if (!timeSlotId || timeSlotId === oldAppointment.timeSlotId) {
                return {
                    ok: true,
                };
            }

            const didMedicChange = await db
                .selectFrom("appointment as a")
                .innerJoin("time_slot as t1", "t1.id", "a.time_slot_id")
                .innerJoin("time_slot as t2", (join) =>
                    join.on("t2.id", "=", timeSlotId)
                )
                .innerJoin("medic as m1", "m1.schedule_id", "t1.schedule_id")
                .innerJoin("medic as m2", "m2.schedule_id", "t2.schedule_id")
                .select("a.id")
                .whereRef("m1.rut", "!=", "m2.rut")
                .executeTakeFirst();

            return !didMedicChange ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.CONFLICT,
                message: "Cannot change assigned medic.",
            };
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
            .leftJoin("blood_type as bt", "bt.id", "p.blood_type_id")
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
            ...patient.weight && { weight: patient.weight },
            ...patient.height && { height: patient.height },
            ...patient.rhesusFactor && { rhesusFactor: patient.rhesusFactor },
            ...patient.bloodType && { bloodType: patient.bloodType },
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
        response: Response<{ token: string }>
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

        const token = await generateToken(rut, TokenType.PATIENT);

        this.sendStatus(response, HTTPStatus.CREATED, { token });

        await sendEmail(email, "Gracias por registrarte en nuestra clínica!", "Prometemos dar el mejor servicio posible.");
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

    @PostMethod({ path: "/:rut/appointments", requiresAuthorization: true })
    public async createAppointment(
        request: Request<{ rut: string }, unknown, NewAppointment>,
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

        const patient = await db
            .selectFrom("patient")
            .select(({ ref }) => [
                "email",
                sql<string>`concat(
                    ${ref("first_name")}, " ",
                    ifnull(concat(${ref("second_name")}, " "), ""),
                    ${ref("first_last_name")},
                    ifnull(concat(" ", ${ref("second_last_name")}), "")
                )`.as("fullName"),
            ])
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.newAppointmentValidator.validate(request.body, rut);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { date, description, timeSlotId } = validationResult.value;

        const timeSlot = await db
            .selectFrom("time_slot as t")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .select(({ ref }) => [
                "e.email",
                "t.start",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("fullName"),
            ])
            .where("t.id", "=", timeSlotId)
            .executeTakeFirst();

        if (!timeSlot) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Time slot ${timeSlot} does not exist.`);
            return;
        }

        await db
            .insertInto("appointment")
            .values({
                time_slot_id: timeSlotId,
                date,
                patient_rut: rut,
                description,
            })
            .execute();

        this.sendStatus(response, HTTPStatus.CREATED);

        await sendEmail(
            patient.email,
            "Nueva cita médica registrada",
            `Tu cita médica para el ${date} a las ${timeSlot.start} con ${timeSlot.fullName} ha quedado registrada y espera `
            + "confirmación."
        );

        await sendEmail(
            timeSlot.email,
            "Nueva cita médica registrada",
            `Una nueva cita médica para el ${date} a las ${timeSlot.start} con ${patient.fullName} ha quedado registrada y `
            + "espera confirmación."
        );
    }

    @PatchMethod({ path: "/:rut/appointments/:id", requiresAuthorization: true })
    public async updateAppointment(
        request: Request<{ rut: string; id: string }, unknown, AppointmentUpdate>,
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

        const id = await new Promise<bigint | null>(resolve => {
            try {
                resolve(BigInt(request.params.id));
            } catch (_) {
                resolve(null);
            }
        });

        if (!id || id <= 0n) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid appointment id.");
            return;
        }

        const patient = await db
            .selectFrom("patient")
            .select(({ ref }) => [
                "email",
                sql<string>`concat(
                    ${ref("first_name")}, " ",
                    ifnull(concat(${ref("second_name")}, " "), ""),
                    ${ref("first_last_name")},
                    ifnull(concat(" ", ${ref("second_last_name")}), "")
                )`.as("fullName"),
            ])
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const idString = id.toString() as BigIntString;

        const appointment = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .select(({ ref }) => [
                "a.date",
                "a.time_slot_id as timeSlotId",
                "a.description",
                "a.confirmed",
                "t.start",
                "e.email as medicEmail",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("medicFullName"),
            ])
            .where("a.id", "=", idString)
            .where("a.patient_rut", "=", rut)
            .executeTakeFirst();

        if (!appointment) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Appointment ${id} for patient ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.appointmentUpdateValidator.validate(request.body, appointment, rut);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { date, timeSlotId, description, confirmed } = validationResult.value;

        const updateResult = await db
            .updateTable("appointment")
            .where("id", "=", idString)
            .set({
                date,
                time_slot_id: timeSlotId,
                description,
                confirmed,
            })
            .execute();

        if (updateResult[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);

        if (confirmed) {
            await sendEmail(
                patient.email,
                "Cita médica confirmada",
                `Tu cita médica para el ${appointment.date} a las ${appointment.start} con ${appointment.medicFullName} ha `
                + "sido confirmada."
            );

            await sendEmail(
                appointment.medicEmail,
                "Cita médica confirmada",
                `Una cita médica para el ${appointment.date} a las ${appointment.start} con ${patient.fullName} ha sido `
                + "confirmada."
            );
        }
    }

    @DeleteMethod({ path: "/:rut/appointments/:id", requiresAuthorization: true })
    public async deleteAppointment(request: Request<{ rut: string; id: string }>, response: Response): Promise<void> {
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

        const id = await new Promise<bigint | null>(resolve => {
            try {
                resolve(BigInt(request.params.id));
            } catch (_) {
                resolve(null);
            }
        });

        if (!id || id <= 0n) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid appointment id.");
            return;
        }

        const patient = await db
            .selectFrom("patient")
            .select(({ ref }) => [
                "email",
                sql<string>`concat(
                    ${ref("first_name")}, " ",
                    ifnull(concat(${ref("second_name")}, " "), ""),
                    ${ref("first_last_name")},
                    ifnull(concat(" ", ${ref("second_last_name")}), "")
                )`.as("fullName"),
            ])
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!patient) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Patient ${rut} does not exist.`);
            return;
        }

        const idString = id.toString() as BigIntString;

        const appointment = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .select(({ ref }) => [
                "a.date",
                "t.start",
                "e.email as medicEmail",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("medicFullName"),
            ])
            .where("a.id", "=", idString)
            .where("a.patient_rut", "=", rut)
            .executeTakeFirst();

        if (!appointment) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Appointment ${id} for patient ${rut} does not exist.`);
            return;
        }

        await db
            .deleteFrom("appointment")
            .where("id", "=", idString)
            .execute();

        this.sendStatus(response, HTTPStatus.NO_CONTENT);

        await sendEmail(
            patient.email,
            "Cita médica cancelada",
            `Tu cita médica para el ${appointment.date} a las ${appointment.start} con ${appointment.medicFullName} ha sido `
            + "cancelada."
        );

        await sendEmail(
            appointment.medicEmail,
            "Cita médica cancelada",
            `Una cita médica para el ${appointment.date} a las ${appointment.start} con ${patient.fullName} ha sido `
            + "cancelada."
        );
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

type NewAppointment = {
    date: string;
    timeSlotId: number;
    description: string;
};

type AppointmentUpdate = {
    date?: string;
    timeSlotId?: number;
    description?: string;
    confirmed?: boolean;
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
    bloodType?: string;
    insuranceType: string;
};
