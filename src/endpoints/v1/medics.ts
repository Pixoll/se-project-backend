import { createHash } from "crypto";
import { Request, Response } from "express";
import { sql } from "kysely";
import { Appointment as DBAppointment, db, Employee, isValidEmail, isValidPhone, isValidRut, TimeSlot } from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { validate, Validator, ValidatorResult } from "../validator";

export class MedicsEndpoint extends Endpoint {
    private static readonly DAYS = new Set(["mo", "tu", "we", "th", "fr", "sa", "su"]);

    private static readonly MEDIC_UPDATE_VALIDATORS = {
        firstName: (value, key): ValidatorResult => {
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
        secondName: (value, key): ValidatorResult => {
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
        firstLastName: (value, key): ValidatorResult => {
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
        secondLastName: (value, key): ValidatorResult => {
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
        email: async (value, key): Promise<ValidatorResult> => {
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
        phone: async (value, key): Promise<ValidatorResult> => {
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
        birthDate: (value, key): ValidatorResult => {
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
        gender: (value, key): ValidatorResult => {
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
        specialtyId: async (value, key): Promise<ValidatorResult> => {
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
    } as const satisfies Record<keyof MedicUpdate, Validator>;

    private static readonly NEW_SCHEDULE_SLOT_VALIDATORS = {
        day: {
            required: true,
            validator: (value, key): ValidatorResult => {
                const valid = typeof value === "string" && MedicsEndpoint.DAYS.has(value);
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
            validator: (value, key): ValidatorResult => {
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
            validator: (value, key): ValidatorResult => {
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
    } as const satisfies Record<keyof NewScheduleSlot, Validator>;

    private static readonly SCHEDULE_SLOT_UPDATE_VALIDATORS = {
        day: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : MedicsEndpoint.NEW_SCHEDULE_SLOT_VALIDATORS.day.validator(value, key);
        },
        start: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : MedicsEndpoint.NEW_SCHEDULE_SLOT_VALIDATORS.start.validator(value, key);
        },
        end: (value, key): ValidatorResult => {
            return typeof value === "undefined" ? {
                ok: true,
            } : MedicsEndpoint.NEW_SCHEDULE_SLOT_VALIDATORS.end.validator(value, key);
        },
    } as const satisfies Record<keyof ScheduleSlotUpdate, Validator>;

    public constructor() {
        super("/medics");
    }

    @GetMethod()
    public async getAllMedics(request: Request, response: Response<Medic[]>): Promise<void> {
        const isEmployeeSession = (this.getToken(request)?.type ?? TokenType.PATIENT) !== TokenType.PATIENT;

        const medics = await db
            .selectFrom("medic as m")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .innerJoin("specialty as sp", "sp.id", "m.specialty_id")
            .select(({ ref }) => [
                ...(isEmployeeSession ? ["e.rut"] as const : []),
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

    @GetMethod({ path: "/:rut", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async getMedic(request: Request<{ rut: string }>, response: Response<Omit<Medic, "rut">>): Promise<void> {
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

        const validationResult = await validate(request.body, MedicsEndpoint.MEDIC_UPDATE_VALIDATORS);

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
                sql<Appointment[]>`if(${fn.count("a.id")} > 0, json_arrayagg(json_object(
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

        const validationResult = await validate(request.body, MedicsEndpoint.NEW_SCHEDULE_SLOT_VALIDATORS);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { day, start, end } = validationResult.value;

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

        if (doesOverlap) {
            this.sendError(response, HTTPStatus.CONFLICT, "Time slot overlaps with another.");
            return;
        }

        await db
            .insertInto("time_slot")
            .values({
                "schedule_id": scheduleId,
                day,
                start,
                end,
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

        const validationResult = await validate(request.body, MedicsEndpoint.SCHEDULE_SLOT_UPDATE_VALIDATORS);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const day = validationResult.value.day ?? timeSlot.day;
        const start = validationResult.value.start ?? timeSlot.start;
        const end = validationResult.value.end ?? timeSlot.end;

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

        if (doesOverlap) {
            this.sendError(response, HTTPStatus.CONFLICT, "Time slot overlaps with another.");
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

        const updateResult = await db
            .updateTable("time_slot")
            .where("id", "=", id)
            .set({ day, start, end })
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
    rut?: string;
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

type ScheduleSlot = Omit<TimeSlot, "schedule_id"> & {
    appointments: Appointment[];
};

type Appointment = SnakeToCamelRecord<Omit<DBAppointment, "time_slot_id">>;

type NewScheduleSlot = Omit<ScheduleSlot, "active" |  "appointments" | "id">;

type ScheduleSlotUpdate = Partial<NewScheduleSlot>;
