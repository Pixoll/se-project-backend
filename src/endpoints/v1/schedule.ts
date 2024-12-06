import { Request, Response } from "express";
import { sql } from "kysely";
import { db, TimeSlot } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class ScheduleEndpoint extends Endpoint {
    public constructor() {
        super("/schedule");
    }

    @GetMethod()
    public async getEntireSchedule(
        request: Request<unknown, unknown, unknown, { medics?: string | string[]; specialties?: string | string[] }>,
        response: Response<GroupedTimeSlots[]>
    ): Promise<void> {
        const { query } = request;

        if (!Array.isArray(query.medics)) {
            query.medics = query.medics ? [query.medics] : [];
        }
        if (!Array.isArray(query.specialties)) {
            query.specialties = query.specialties ? [query.specialties] : [];
        }

        const { medics, specialties } = query;

        const specialtiesIds = specialties.map(id => +id);

        if (specialtiesIds.includes(NaN)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Specialties query contains invalid id.");
            return;
        }

        let dbQuery = db
            .selectFrom("time_slot as t")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .innerJoin("specialty as s", "s.id", "m.specialty_id")
            .innerJoin("employee as e", "e.rut", "m.rut")
            .select(({ selectFrom }) => [
                "t.id",
                "t.day",
                "t.start",
                "t.end",
                "m.rut",
                sql<string>`concat(
                    e.first_name,
                    " ",
                    ifnull(concat(e.second_name, " "), ""),
                    e.first_last_name,
                    ifnull(concat(" ", e.second_last_name, " "), "")
                )`.as("fullName"),
                "s.name as specialty",
                sql<string[]>`ifnull((${selectFrom("appointment as a")
                    .select(sql`json_arrayagg(a.date)`.as("_"))
                    .whereRef("a.time_slot_id", "=", "t.id")
                    .where("a.date" ,">=", sql<string>`current_date()`)
                }), cast("[]" as json))`.as("appointmentDates"),
            ])
            .orderBy("t.start", "asc")
            .where("t.active", "=", true);

        if (medics.length > 0) {
            dbQuery = dbQuery.where("m.rut", "in", medics);
        }

        if (specialtiesIds.length > 0) {
            dbQuery = dbQuery.where("s.id", "in", specialtiesIds);
        }

        const timeSlots = await dbQuery.execute();
        const groupedTimeSlots = new Map<string, GroupedTimeSlots>();

        for (const { id, day, start, end, rut, fullName, specialty, appointmentDates } of timeSlots) {
            const timeSlot = {
                id,
                day,
                start: start.substring(0, 5),
                end: end.substring(0, 5),
                appointmentDates,
            };

            if (!groupedTimeSlots.has(rut)) {
                groupedTimeSlots.set(rut, {
                    rut,
                    fullName,
                    specialty,
                    slots: [timeSlot],
                });
                continue;
            }

            groupedTimeSlots.get(rut)!.slots.push(timeSlot);
        }

        this.sendOk(response, [...groupedTimeSlots.values()]);
    }
}

type GroupedTimeSlots = {
    rut: string;
    fullName: string;
    specialty: string;
    slots: Array<Omit<TimeSlot, "active" | "schedule_id"> & {
        appointmentDates: string[];
    }>;
};
