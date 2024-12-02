import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, db, TimeSlot } from "../../db";
import { TokenType } from "../../tokens";
import { Endpoint, GetMethod } from "../base";

export class AppointmentsEndpoint extends Endpoint {
    public constructor() {
        super("/appointments");
    }

    @GetMethod({ requiresAuthorization: TokenType.ADMIN })
    public async getAllAppointments(_request: Request, response: Response<Appointment[]>): Promise<void> {
        const appointments = await db
            .selectFrom("appointment as a")
            .innerJoin("time_slot as t", "t.id", "a.time_slot_id")
            .innerJoin("medic as m", "m.schedule_id", "t.schedule_id")
            .select([
                "a.id",
                "m.rut as medicRut",
                "a.patient_rut as patientRut",
                "a.date",
                "t.day",
                "t.start",
                "t.end",
                "a.description",
                "a.confirmed",
            ])
            .where(({ eb, and }) => and([
                eb("a.date", ">=", sql<string>`current_date()`),
                eb("t.active", "=", true),
            ]))
            .execute();

        this.sendOk(response, appointments);
    }
}

type Appointment = {
    id: BigIntString;
    medicRut: string;
    patientRut: string;
    date: string;
    day: TimeSlot["day"];
    start: string;
    end: string;
    description: string;
    confirmed: boolean;
};
