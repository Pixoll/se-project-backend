import { Request, Response } from "express";
import { BloodType, db } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class BloodTypesEndpoint extends Endpoint {
    public constructor() {
        super("/blood_types");
    }

    @GetMethod()
    public async getAllBloodTypes(_request: Request, response: Response<BloodType[]>): Promise<void> {
        const bloodTypes = await db
            .selectFrom("blood_type")
            .selectAll()
            .execute();

        this.sendOk(response, bloodTypes);
    }
}
