import { Request, Response } from "express";
import { db, InsuranceType } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class InsuranceTypesEndpoint extends Endpoint {
    public constructor() {
        super("/insurance_types");
    }

    @GetMethod()
    public async getAllInsuranceTypes(_request: Request, response: Response<InsuranceType[]>): Promise<void> {
        const insuranceTypes = await db
            .selectFrom("insurance_type")
            .selectAll()
            .execute();

        this.sendOk(response, insuranceTypes);
    }
}
