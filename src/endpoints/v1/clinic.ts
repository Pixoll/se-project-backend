import { Request, Response } from "express";
import { Clinic, db } from "../../db";
import { SnakeToCamelRecord } from "../../types";
import { Endpoint, GetMethod } from "../base";

export class ClinicEndpoint extends Endpoint {
    public constructor() {
        super("/clinic");
    }

    @GetMethod()
    public async getClinic(_request: Request, response: Response<ClinicResponse>): Promise<void> {
        const clinic = await db
            .selectFrom("clinic")
            .select([
                "name",
                "email",
                "phone",
                "address",
                "opening_time as openingTime",
                "closing_time as closingTime",
            ])
            .executeTakeFirst();

        if (!clinic) {
            throw new Error("Clinic not found.");
        }

        this.sendOk(response, clinic);
    }
}

type ClinicResponse = SnakeToCamelRecord<Omit<Clinic, "id">>;
