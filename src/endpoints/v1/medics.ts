import { Request, Response } from "express";
import { sql } from "kysely";
import { db, isValidRut, TimeSlot } from "../../db";
import { TokenType } from "../../tokens";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { validate, Validator, ValidatorResult } from "../validator";

export class MedicsEndpoint extends Endpoint {
    private static readonly DAYS = new Set(["mo", "tu", "we", "th", "fr", "sa", "su"]);

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

        const token = this.getToken(request)!;

        if (token.type === TokenType.MEDIC && token.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
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
            .innerJoin("time_slot as ts", "ts.schedule_id", "m.schedule_id")
            .select([
                "ts.id",
                "ts.day",
                "ts.start",
                "ts.end",
                "ts.active",
            ])
            .where("m.rut", "=", rut)
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

type ScheduleSlot = Omit<TimeSlot, "schedule_id">;

type NewScheduleSlot = Omit<ScheduleSlot, "active" | "id">;

type ScheduleSlotUpdate = Partial<Omit<ScheduleSlot, "active" | "id">>;
