import { Request, Response } from "express";
import { Clinic, db } from "../../db";
import { TokenType } from "../../tokens";
import { SnakeToCamelRecord } from "../../types";
import { Endpoint, GetMethod, HTTPStatus, PatchMethod } from "../base";

export class ClinicEndpoint extends Endpoint {
    public constructor() {
        super("/clinic");
    }

    @GetMethod()
    public async getClinic(_request: Request, response: Response<ClinicObject>): Promise<void> {
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

    @PatchMethod({ requiresAuthorization: TokenType.ADMIN })
    public async updateClinic(request: Request<unknown, unknown, Partial<ClinicObject>>, response: Response): Promise<void> {
        const {
            name,
            email,
            phone,
            address,
            openingTime,
            closingTime,
        } = request.body;

        if (!name && !email && !phone && !address && !openingTime && !closingTime) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body is empty.");
            return;
        }

        const clinic = await db
            .selectFrom("clinic")
            .select("id")
            .executeTakeFirst();

        if (!clinic) {
            throw new Error("Clinic not found.");
        }

        let update = db
            .updateTable("clinic")
            .where("id", "=", clinic.id);

        if (name) {
            update = update.set("name", name);
        }

        if (email) {
            update = update.set("email", email);
        }

        if (phone) {
            update = update.set("phone", phone);
        }

        if (address) {
            update = update.set("address", address);
        }

        if (openingTime) {
            update = update.set("opening_time", openingTime);
        }

        if (closingTime) {
            update = update.set("closing_time", closingTime);
        }

        const modified = await update.execute();

        if (modified[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type ClinicObject = SnakeToCamelRecord<Omit<Clinic, "id">>;
