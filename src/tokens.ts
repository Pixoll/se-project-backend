import { randomBytes } from "crypto";
import { sql } from "kysely";
import { db } from "./db";

// noinspection JSUnusedGlobalSymbols
export enum TokenType {
    PATIENT,
    MEDIC,
    ADMIN,
}

const tokens = new Map<string, TokenType>();

export async function loadTokens(): Promise<void> {
    const patientTokens = await db
        .selectFrom("patient")
        .select("session_token as token")
        .execute();

    for (const { token } of patientTokens) {
        if (token) {
            tokens.set(token, TokenType.PATIENT);
        }
    }

    const employeeTokens = await db
        .selectFrom("employee")
        .select([
            "session_token as token",
            sql<TokenType>`(
                case
                    when e.type = "medic" then ${TokenType.MEDIC}
                    else ${TokenType.ADMIN}
                end
            )`.as("type"),
        ])
        .execute();

    for (const { token, type } of employeeTokens) {
        if (token) {
            tokens.set(token, type);
        }
    }
}

export async function generateToken(rut: string, type: TokenType): Promise<string> {
    let token: string;
    do {
        token = randomBytes(64).toString("base64url");
    } while (tokens.has(token));

    await db
        .updateTable(type === TokenType.PATIENT ? "patient" : "employee")
        .where("rut", "=", rut)
        .set("session_token", token)
        .execute();

    tokens.set(token, type);

    return token;
}

export function doesTokenExist(token: string): boolean {
    return tokens.has(token);
}

export function getTokenType(token: string): TokenType | undefined {
    return tokens.get(token);
}

export async function revokeToken(token: string): Promise<void> {
    const type = tokens.get(token);

    if (type !== null) {
        await db
            .updateTable(type === TokenType.PATIENT ? "patient" : "employee")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();

        tokens.delete(token);
    }
}
