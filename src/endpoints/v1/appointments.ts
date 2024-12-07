import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, db } from "../../db";
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
            .innerJoin("employee as e", "e.rut", "m.rut")
            .innerJoin("patient as p", "p.rut", "a.patient_rut")
            .select(({ ref }) => [
                "a.id",
                "m.rut as medicRut",
                sql<string>`concat(
                    ${ref("e.first_name")}, " ",
                    ifnull(concat(${ref("e.second_name")}, " "), ""),
                    ${ref("e.first_last_name")},
                    ifnull(concat(" ", ${ref("e.second_last_name")}), "")
                )`.as("medicFullName"),
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
                "t.id as slotId",
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
    medicFullName: string;
    patientRut: string;
    patientFullName: string;
    patientBirthDate: string;
    patientEmail: string;
    patientPhone: number;
    date: string;
    slotId: number;
    start: string;
    end: string;
    description: string;
    confirmed: boolean;
};
