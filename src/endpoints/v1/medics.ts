import { createHash } from "crypto";
import { Request, Response } from "express";
import { sql } from "kysely";
import {
    Appointment as DBAppointment,
    BigIntString,
    db,
    Employee,
    isValidEmail,
    isValidPhone,
    isValidRut,
    TimeSlot,
} from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { Validator } from "../validator";

export class MedicsEndpoint extends Endpoint {
    private readonly medicUpdateValidator: Validator<MedicUpdate>;
    private readonly newAppointmentValidator: Validator<NewAppointment>;
    private readonly appointmentUpdateValidator: Validator<AppointmentUpdate, [
        oldAppointment: Required<AppointmentUpdate>,
        patientRut: string,
    ]>;
    private readonly newScheduleSlotValidator: Validator<NewScheduleSlot, [scheduleId: number]>;
    private readonly scheduleSlotUpdateValidator: Validator<ScheduleSlotUpdate, [timeSlot: SnakeToCamelRecord<TimeSlot>]>;

    public constructor() {
        super("/medics");

        const days = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;
        const daysSet = new Set<string>(days);

        this.medicUpdateValidator = new Validator<MedicUpdate>({
            firstName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            secondName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            firstLastName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            secondLastName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            email: async (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string" && isValidEmail(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const employee = await db
                    .selectFrom("employee")
                    .select("rut")
                    .where("email", "=", value)
                    .executeTakeFirst();

                return !employee ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `An employee with ${key} ${value} already exists.`,
                };
            },
            phone: async (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "number" && isValidPhone(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const employee = await db
                    .selectFrom("employee")
                    .select("rut")
                    .where("phone", "=", value)
                    .executeTakeFirst();

                return !employee ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `An employee with ${key} ${value} already exists.`,
                };
            },
            birthDate: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

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
            gender: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            specialtyId: async (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                if (!(value && typeof value === "number" && value > 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const specialty = await db
                    .selectFrom("specialty")
                    .select("id")
                    .where("id", "=", value)
                    .executeTakeFirst();

                return specialty ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        });

        this.newAppointmentValidator = new Validator<NewAppointment>({
            patientRut: {
                required: true,
                validate: async (value, key) => {
                    if (!value || typeof value !== "string" || !isValidRut(value)) {
                        return {
                            ok: false,
                            status: HTTPStatus.BAD_REQUEST,
                            message: `Invalid ${key}.`,
                        };
                    }

                    const patient = await db
                        .selectFrom("patient")
                        .select("rut")
                        .where("rut", "=", value)
                        .executeTakeFirst();

                    return patient ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
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
        }, async ({ patientRut, date, timeSlotId }) => {
            const day = days[(new Date(date).getUTCDay() + 1) % 7];

            const { doesDayMatch, hasAlreadyStarted } = await db
                .selectFrom("time_slot")
                .select(eb => [
                    eb("day", "=", day).as("doesDayMatch"),
                    eb(sql`current_date()`, "=", date)
                        .and("start", "<", sql<string>`current_time()`)
                        .as("hasAlreadyStarted"),
                ])
                .where("id", "=", timeSlotId)
                .executeTakeFirst() ?? {};

            if (!doesDayMatch) {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Appointment day and time slot day do not match.",
                };
            }

            if (hasAlreadyStarted) {
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
        }, (appointment, oldAppointment, patientRut) => {
            return this.newAppointmentValidator.globalValidator!({
                ...oldAppointment,
                ...appointment,
                patientRut,
            });
        });

        this.newScheduleSlotValidator = new Validator<NewScheduleSlot, [scheduleId: number]>({
            day: {
                required: true,
                validate: (value, key) => {
                    const valid = typeof value === "string" && daysSet.has(value);
                    return valid ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
            start: {
                required: true,
                validate: (value, key) => {
                    const valid = typeof value === "string" && /^(?:[0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                    return valid ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
            end: {
                required: true,
                validate: (value, key) => {
                    const valid = typeof value === "string" && /^(?:[0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                    return valid ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                },
            },
        }, async ({ day, start, end }, scheduleId) => {
            const doesOverlap = await db
                .selectFrom("time_slot")
                .select("id")
                .where(({ eb, and, or }) => and([
                    eb("schedule_id", "=", scheduleId),
                    eb("day", "=", day),
                    eb("active", "=", true),
                    or([
                        eb("start", "=", start),
                        eb("end", "=", end),
                        eb("start", "<", start).and("end", ">", start),
                        eb("start", "<", end).and("end", ">", end),
                        eb("start", ">", start).and("end", "<", end),
                        eb("start", "<", start).and("end", ">", end),
                    ]),
                ]))
                .executeTakeFirst();

            return !doesOverlap ? {
                ok: true,
            } : {
                ok: false,
                status: HTTPStatus.CONFLICT,
                message: "Time slot overlaps with another.",
            };
        });

        this.scheduleSlotUpdateValidator = new Validator<ScheduleSlotUpdate, [timeSlot: SnakeToCamelRecord<TimeSlot>]>({
            day: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newScheduleSlotValidator.validators[key].validate(value, key);
            },
            start: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newScheduleSlotValidator.validators[key].validate(value, key);
            },
            end: (value, key) => {
                return typeof value === "undefined" ? {
                    ok: true,
                } : this.newScheduleSlotValidator.validators[key].validate(value, key);
            },
        }, async (object, timeSlot) => {
            const day = object.day ?? timeSlot.day;
            const start = object.start ?? timeSlot.start;
            const end = object.end ?? timeSlot.end;

            const doesOverlap = await db
                .selectFrom("time_slot")
                .select("id")
                .where(({ eb, and, or }) => and([
                    eb("schedule_id", "=", timeSlot.scheduleId),
                    eb("day", "=", day),
                    eb("active", "=", true),
                    or([
                        eb("start", "=", start),
                        eb("end", "=", end),
                        eb("start", "<", start).and("end", ">", start),
                        eb("start", "<", end).and("end", ">", end),
                        eb("start", ">", start).and("end", "<", end),
                        eb("start", "<", start).and("end", ">", end),
                    ]),
                ]))
                .executeTakeFirst();

            if (doesOverlap) {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Time slot overlaps with another.",
                };
            }

            const hasActiveAppointments = await db
                .selectFrom("appointment")
                .select("id")
                .where("time_slot_id", "=", timeSlot.id)
                .executeTakeFirst();

            if (hasActiveAppointments) {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: "Time slot has appointments associated.",
                };
            }

            return {
                ok: true,
            };
        });
    }

    @GetMethod()
    public async getAllMedics(_request: Request, response: Response<Medic[]>): Promise<void> {
        const medics = await db
            .selectFrom("medic as m")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .innerJoin("specialty as sp", "sp.id", "m.specialty_id")
            .select(({ ref }) => [
                "e.rut",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("fullName"),
                "e.email",
                "e.phone",
                "e.birth_date as birthDate",
                "e.gender",
                "sp.name as specialty",
            ])
            .execute();

        this.sendOk(response, medics);
    }

    @GetMethod("/:rut")
    public async getMedic(request: Request<{ rut: string }>, response: Response<Medic>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const medic = await db
            .selectFrom("medic as m")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .innerJoin("specialty as sp", "sp.id", "m.specialty_id")
            .innerJoin("time_slot as ts", "ts.schedule_id", "m.schedule_id")
            .select(({ ref }) => [
                "e.rut",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("fullName"),
                "e.email",
                "e.phone",
                "e.birth_date as birthDate",
                "e.gender",
                "sp.name as specialty",
            ])
            .where("m.rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        this.sendOk(response, medic);
    }

    @PatchMethod({ path: "/:rut", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async updateMedic(request: Request<{ rut: string }, unknown, MedicUpdate>, response: Response): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.medicUpdateValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        if (Object.keys(validationResult.value).length === 0) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        const employeeUpdate = {
            first_name: validationResult.value.firstName,
            second_name: validationResult.value.secondName || undefined,
            first_last_name: validationResult.value.firstLastName,
            second_last_name: validationResult.value.secondLastName || undefined,
            email: validationResult.value.email,
            phone: validationResult.value.phone,
            birth_date: validationResult.value.birthDate,
            gender: validationResult.value.gender,
        };

        const { specialtyId } = validationResult.value;

        const employeeUpdateResult = await db
            .updateTable("employee")
            .set(employeeUpdate)
            .where("rut", "=", rut)
            .execute();

        let updated = (employeeUpdateResult[0].numChangedRows ?? 0n) > 0n;

        if (specialtyId) {
            const medicUpdateResult = await db
                .updateTable("medic")
                .set({
                    specialty_id: specialtyId,
                })
                .where("rut", "=", rut)
                .execute();

            updated = (medicUpdateResult[0].numChangedRows ?? 0n) > 0n;
        }

        if (!updated) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @GetMethod({ path: "/:rut/appointments", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async getAppointments(request: Request<{ rut: string }>, response: Response<Appointment[]>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const { scheduleId } = await db
            .selectFrom("medic")
            .select("schedule_id as scheduleId")
            .where("rut", "=", rut)
            .executeTakeFirst() ?? {};

        if (!scheduleId) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const appointments = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("patient as p", "p.rut", "a.patient_rut")
            .select(({ ref }) => [
                "a.id",
                "a.patient_rut as patientRut",
                sql<string>`concat(
                    ${ref("p.first_name")}, " ",
                    ifnull(concat(${ref("p.second_name")}, " "), ""),
                    ${ref("p.first_last_name")},
                    ifnull(concat(" ", ${ref("p.second_last_name")}), "")
                )`.as("patientFullName"),
                "p.birth_date as patientBirthDate",
                "p.email as patientEmail",
                "p.phone as patientPhone",
                "a.date",
                "t.start",
                "t.end",
                "a.description",
                "a.confirmed",
            ])
            .where(({ eb, and }) => and([
                eb("t.schedule_id", "=", scheduleId),
                eb("a.date", ">=", sql<string>`current_date()`),
                eb("t.active", "=", true),
            ]))
            .execute();

        this.sendOk(response, appointments);
    }

    @PostMethod({ path: "/:rut/appointments", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
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

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.newAppointmentValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { patientRut, date, description, timeSlotId } = validationResult.value;

        await db
            .insertInto("appointment")
            .values({
                time_slot_id: timeSlotId,
                date,
                patient_rut: patientRut,
                description,
            })
            .execute();

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @PatchMethod({ path: "/:rut/appointments/:id", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
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

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
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

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const idString = id.toString() as BigIntString;

        const appointment = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .select([
                "a.date",
                "a.time_slot_id as timeSlotId",
                "a.description",
                "a.confirmed",
            ])
            .where("id", "=", idString)
            .where("m.rut", "=", rut)
            .executeTakeFirst();

        if (!appointment) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Appointment ${id} for medic ${rut} does not exist.`);
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
    }

    @DeleteMethod({ path: "/:rut/appointments/:id", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async deleteAppointment(request: Request<{ rut: string; id: string }>, response: Response): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
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

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const idString = id.toString() as BigIntString;

        const appointment = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .select("a.id")
            .where("id", "=", idString)
            .where("m.rut", "=", rut)
            .executeTakeFirst();

        if (!appointment) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Appointment ${id} for medic ${rut} does not exist.`);
            return;
        }

        await db
            .deleteFrom("appointment")
            .where("id", "=", idString)
            .execute();

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @GetMethod({ path: "/:rut/schedule", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async getMedicSchedule(request: Request<{ rut: string }>, response: Response<ScheduleSlot[]>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const schedule = await db
            .selectFrom("medic as m")
            .innerJoin("time_slot as t", "t.schedule_id", "m.schedule_id")
            .leftJoin("appointment as a", join =>
                join.onRef("a.time_slot_id", "=", "t.id")
                    .on("a.date", ">=", sql`current_date()`)
            )
            .select(({ ref, fn }) => [
                "t.id",
                "t.day",
                "t.start",
                "t.end",
                "t.active",
                sql<ScheduleSlotAppointment[]>`if(${fn.count("a.id")} > 0, json_arrayagg(json_object(
                    "id", ${ref("a.id")},
                    "date", ${ref("a.date")},
                    "patientRut", ${ref("a.patient_rut")},
                    "description", ${ref("a.description")},
                    "confirmed", ${ref("a.confirmed")}
                )), json_array())`.as("appointments"),
            ])
            .where("m.rut", "=", rut)
            .groupBy("t.id")
            .execute();

        this.sendOk(response, schedule);
    }

    @PostMethod({ path: "/:rut/schedule/slots", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async createMedicScheduleSlot(
        request: Request<{ rut: string }, unknown, NewScheduleSlot>,
        response: Response
    ): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const { scheduleId } = await db
            .selectFrom("medic as m")
            .select("schedule_id as scheduleId")
            .where("m.rut", "=", rut)
            .executeTakeFirst() ?? {};

        if (!scheduleId) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.newScheduleSlotValidator.validate(request.body, scheduleId);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        await db
            .insertInto("time_slot")
            .values({
                "schedule_id": scheduleId,
                ...validationResult.value,
            })
            .execute();

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @PatchMethod({ path: "/:rut/schedule/slots/:id", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async updateMedicScheduleSlot(
        request: Request<{ rut: string; id: string }, unknown, ScheduleSlotUpdate>,
        response: Response
    ): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const id = +request.params.id;

        if (isNaN(id) || id <= 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid schedule slot id.");
            return;
        }

        const { scheduleId } = await db
            .selectFrom("medic")
            .select("schedule_id as scheduleId")
            .where("rut", "=", rut)
            .executeTakeFirst() ?? {};

        if (!scheduleId) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const timeSlot = await db
            .selectFrom("time_slot")
            .select([
                "id",
                "schedule_id as scheduleId",
                "day",
                "start",
                "end",
                "active",
            ])
            .where("id", "=", id)
            .executeTakeFirst();

        if (!timeSlot) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Time slot ${id} does not exist.`);
            return;
        }

        const validationResult = await this.scheduleSlotUpdateValidator.validate(request.body, timeSlot);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const updateResult = await db
            .updateTable("time_slot")
            .where("id", "=", id)
            .set(validationResult.value)
            .execute();

        if (updateResult[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @DeleteMethod({ path: "/:rut/schedule/slots/:id", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async deleteMedicScheduleSlot(
        request: Request<{ rut: string; id: string }>,
        response: Response
    ): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const id = +request.params.id;

        if (isNaN(id) || id <= 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid schedule slot id.");
            return;
        }

        const medic = await db
            .selectFrom("medic")
            .select("rut")
            .where("rut", "=", rut)
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const timeSlot = await db
            .selectFrom("time_slot")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        if (!timeSlot) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Time slot ${id} does not exist.`);
            return;
        }

        const hasActiveAppointments = await db
            .selectFrom("appointment")
            .select("id")
            .where("time_slot_id", "=", id)
            .executeTakeFirst();

        if (hasActiveAppointments) {
            this.sendError(response, HTTPStatus.CONFLICT, "Time slot has appointments associated.");
            return;
        }

        await db
            .deleteFrom("time_slot")
            .where("id", "=", id)
            .execute();

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

        const medic = await db
            .selectFrom("employee")
            .select(["password", "salt"])
            .where("rut", "=", rut)
            .where("type", "=", "medic")
            .executeTakeFirst();

        if (!medic) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Medic ${rut} does not exist.`);
            return;
        }

        const encryptedPassword = createHash("sha512").update(password + medic.salt).digest("base64url");

        if (encryptedPassword !== medic.password) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Incorrect password.");
            return;
        }

        const token = await generateToken(rut, TokenType.MEDIC);

        this.sendStatus(response, HTTPStatus.CREATED, { token });
    }

    @DeleteMethod({ path: "/:rut/session", requiresAuthorization: TokenType.MEDIC })
    public async expireSession(request: Request, response: Response): Promise<void> {
        const { token } = this.getToken(request)!;

        await revokeToken(token);

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type Medic = {
    rut: string;
    fullName: string;
    email: string;
    phone: number;
    birthDate: string;
    gender: string;
    specialty: string;
};

type MedicUpdate = Partial<SnakeToCamelRecord<Omit<Employee,
    | "rut"
    | "type"
    | "password"
    | "salt"
    | "session_token"
>>> & {
    specialtyId?: number;
};

type Appointment = {
    id: BigIntString;
    patientRut: string;
    patientFullName: string;
    patientBirthDate: string;
    patientEmail: string;
    patientPhone: number;
    date: string;
    start: string;
    end: string;
    description: string;
    confirmed: boolean;
};

type NewAppointment = {
    patientRut: string;
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

type ScheduleSlot = Omit<TimeSlot, "schedule_id"> & {
    appointments: ScheduleSlotAppointment[];
};

type ScheduleSlotAppointment = SnakeToCamelRecord<Omit<DBAppointment, "time_slot_id">>;

type NewScheduleSlot = Omit<ScheduleSlot, "active" | "appointments" | "id">;

type ScheduleSlotUpdate = Partial<NewScheduleSlot>;
