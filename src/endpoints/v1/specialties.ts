import { Request, Response } from "express";
import { db, Specialty } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class SpecialtiesEndpoint extends Endpoint {
    public constructor() {
        super("/specialties");
    }

    @GetMethod()
    public async getAllSpecialties(_request: Request, response: Response<Specialty[]>): Promise<void> {
        const specialties = await db
            .selectFrom("specialty")
            .selectAll()
            .execute();

        this.sendOk(response, specialties);
    }
}
