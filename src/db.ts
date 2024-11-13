// noinspection JSUnusedGlobalSymbols

import { createHash, randomBytes } from "crypto";
import { ColumnType, Insertable, Kysely, MysqlDialect, Selectable, Updateable } from "kysely";
import { createPool } from "mysql2";
import { Field, Next } from "mysql2/typings/mysql/lib/parsers/typeCast";
import logger from "./logger";

let connected = false;

export let db: Kysely<DB>;

const rutValidationSequence = [2, 3, 4, 5, 6, 7] as const;
// eslint-disable-next-line no-useless-escape, max-len
const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

// `db` can't be overwritten outside of this file
// deferred initialization, must wait for env variables to be ready

export function connectDB(): void {
    if (connected) return;

    const {
        DATABASE_HOST,
        DATABASE_PORT,
        DATABASE_USERNAME,
        DATABASE_PASSWORD,
        DATABASE_NAME,
    } = process.env;

    db = new Kysely<DB>({
        dialect: new MysqlDialect({
            pool: createPool({
                host: DATABASE_HOST,
                port: DATABASE_PORT ? +DATABASE_PORT : undefined,
                user: DATABASE_USERNAME,
                password: DATABASE_PASSWORD,
                database: DATABASE_NAME,
                supportBigNumbers: true,
                bigNumberStrings: true,
                dateStrings: true,
                typeCast(field: Field, next: Next) {
                    if (field.type === "TINY" && field.length === 1) {
                        return field.string() === "1";
                    }
                    return next();
                },
            }),
        }),
    });

    connected = true;

    logger.log("Database connected.");
}

export function isValidRut(rut: string): boolean {
    if (!/^\d{7,}-[\dk]$/i.test(rut)) return false;

    const [digits, expectedVerificationDigit] = rut.split("-");
    if ((+digits) < 1e6) return false;

    const sum = digits.split("").reverse()
        .reduce((acc, d, i) => acc + (+d) * rutValidationSequence[i % rutValidationSequence.length], 0);

    const verificationNumber = 11 - sum + Math.trunc(sum / 11) * 11;
    const verificationDigit = verificationNumber === 10 ? "K" : (verificationNumber % 11).toString();
    return verificationDigit === expectedVerificationDigit.toUpperCase();
}

export function isValidEmail(email: string): boolean {
    return emailRegex.test(email);
}

export function isValidPhone(phone: number): boolean {
    return phone >= 100000000 && phone <= 999999999;
}

export function hashPassword(password: string): HashedPassword {
    const salt = randomBytes(32).toString("base64url");
    const hashedPassword = createHash("sha512").update(password + salt).digest("base64url");

    return {
        password: hashedPassword,
        salt,
    };
}

export type HashedPassword = {
    password: string;
    salt: string;
};

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

/**
 * String representation of a 64-bit integer.
 */
export type BigIntString = `${number}`;

/**
 * - Table name: `appointment`
 * - Primary key: `(id)`
 */
export type AppointmentTable = {
    /**
     * - SQL: `id bigint unsigned primary key auto_increment`
     */
    id: Generated<BigIntString>;
    /**
     * - SQL: `patient_rut varchar(11) not null`
     * - Foreign key: `patient.rut`
     */
    patient_rut: string;
    /**
     * - SQL: `medic_rut varchar(11) not null`
     * - Foreign key: `medic.rut`
     */
    medic_rut: string;
    /**
     * - SQL: `date_time datetime not null`
     */
    date_time: string;
    /**
     * - SQL: `description varchar(100) not null check (description != "")`
     */
    description: string;
    /**
     * - SQL: `confirmed boolean not null default false`
     */
    confirmed: Generated<boolean>;
};

export type Appointment = Selectable<AppointmentTable>;
export type NewAppointment = Insertable<AppointmentTable>;
export type AppointmentUpdate = Updateable<AppointmentTable>;

/**
 * - Table name: `blood_type`
 * - Primary key: `(id)`
 */
export type BloodTypeTable = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(4) not null`
     */
    name: string;
};

export type BloodType = Selectable<BloodTypeTable>;
export type NewBloodType = Insertable<BloodTypeTable>;
export type BloodTypeUpdate = Updateable<BloodTypeTable>;

/**
 * - Table name: `clinic`
 * - Primary key: `(id)`
 */
export type ClinicTable = {
    /**
     * - SQL: `id int primary key default 0 check (id = 0)`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(64) not null check (name != "")`
     */
    name: string;
    /**
     * - SQL: `email varchar(64) not null check (email regexp
     * "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-za-z\\-0-9]+\\.)+[a-za-z]{2,}))$")`
     */
    email: string;
    /**
     * - SQL: `phone int unsigned not null check (phone >= 100000000 and phone <= 999999999)`
     */
    phone: number;
    /**
     * - SQL: `address varchar(128) not null check (address != "")`
     */
    address: string;
    /**
     * - SQL: `opening_time time not null`
     */
    opening_time: string;
    /**
     * - SQL: `closing_time time not null`
     */
    closing_time: string;
};

export type Clinic = Selectable<ClinicTable>;
export type NewClinic = Insertable<ClinicTable>;
export type ClinicUpdate = Updateable<ClinicTable>;

/**
 * - Table name: `employee`
 * - Primary key: `(rut)`
 * - Indexes:
 *   - `(email)`
 *   - `(phone)`
 *   - `(session_token)`
 */
export type EmployeeTable = {
    /**
     * - SQL: `rut varchar(11) primary key`
     */
    rut: string;
    /**
     * - SQL: `type enum("admin_staff", "medic") not null`
     */
    type: "admin_staff" | "medic";
    /**
     * - SQL: `first_name varchar(32) not null check (first_name != "")`
     */
    first_name: string;
    /**
     * - SQL: `second_name varchar(32) check (second_name is null or second_name != "")`
     */
    second_name: string | null;
    /**
     * - SQL: `first_last_name varchar(32) not null check (first_last_name != "")`
     */
    first_last_name: string;
    /**
     * - SQL: `second_last_name varchar(32) check (second_last_name is null or second_last_name != "")`
     */
    second_last_name: string | null;
    /**
     * - SQL: `email varchar(64) unique not null check (email regexp
     * "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-za-z\\-0-9]+\\.)+[a-za-z]{2,}))$")`
     */
    email: string;
    /**
     * - SQL: `phone int unsigned unique not null check (phone >= 100000000 and phone <= 999999999)`
     */
    phone: number;
    /**
     * - SQL: `birth_date date not null`
     */
    birth_date: string;
    /**
     * - SQL: `gender varchar(12) not null`
     */
    gender: string;
    /**
     * - SQL: `password char(86) not null check (password != "")`
     */
    password: string;
    /**
     * - SQL: `salt char(43) not null check (salt != "")`
     */
    salt: string;
    /**
     * - SQL: `session_token char(86) unique check (session_token is null or session_token != "")`
     */
    session_token: string | null;
};

export type Employee = Selectable<EmployeeTable>;
export type NewEmployee = Insertable<EmployeeTable>;
export type EmployeeUpdate = Updateable<EmployeeTable>;

/**
 * - Table name: `insurance_type`
 * - Primary key: `(id)`
 */
export type InsuranceTypeTable = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(8) not null`
     */
    name: string;
};

export type InsuranceType = Selectable<InsuranceTypeTable>;
export type NewInsuranceType = Insertable<InsuranceTypeTable>;
export type InsuranceTypeUpdate = Updateable<InsuranceTypeTable>;

/**
 * - Table name: `medic`
 * - Primary key: `(rut)`
 */
export type MedicTable = {
    /**
     * - SQL: `rut varchar(11) primary key`
     * - Foreign key: `employee.rut`
     */
    rut: string;
    /**
     * - SQL: `specialty_id int unsigned not null`
     * - Foreign key: `specialty.id`
     */
    specialty_id: number;
    /**
     * - SQL: `schedule_id int unsigned not null`
     * - Foreign key: `schedule.id`
     */
    schedule_id: number;
};

export type Medic = Selectable<MedicTable>;
export type NewMedic = Insertable<MedicTable>;
export type MedicUpdate = Updateable<MedicTable>;

/**
 * - Table name: `medical_record`
 * - Primary key: `(patient_rut)`
 */
export type MedicalRecordTable = {
    /**
     * - SQL: `patient_rut varchar(11) primary key`
     * - Foreign key: `patient.rut`
     */
    patient_rut: string;
    /**
     * - SQL: `allergies_history varchar(1000)`
     */
    allergies_history: string | null;
    /**
     * - SQL: `morbidity_history varchar(1000)`
     */
    morbidity_history: string | null;
    /**
     * - SQL: `surgical_history varchar(1000)`
     */
    surgical_history: string | null;
    /**
     * - SQL: `medications varchar(1000)`
     */
    medications: string | null;
};

export type MedicalRecord = Selectable<MedicalRecordTable>;
export type NewMedicalRecord = Insertable<MedicalRecordTable>;
export type MedicalRecordUpdate = Updateable<MedicalRecordTable>;

/**
 * - Table name: `patient`
 * - Primary key: `(rut)`
 * - Indexes:
 *   - `(email)`
 *   - `(phone)`
 *   - `(session_token)`
 */
export type PatientTable = {
    /**
     * - SQL: `rut varchar(11) primary key`
     */
    rut: string;
    /**
     * - SQL: `first_name varchar(32) not null check (first_name != "")`
     */
    first_name: string;
    /**
     * - SQL: `second_name varchar(32) check (second_name is null or second_name != "")`
     */
    second_name: string | null;
    /**
     * - SQL: `first_last_name varchar(32) not null check (first_last_name != "")`
     */
    first_last_name: string;
    /**
     * - SQL: `second_last_name varchar(32) check (second_last_name is null or second_last_name != "")`
     */
    second_last_name: string | null;
    /**
     * - SQL: `email varchar(64) unique not null check (email regexp
     * "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-za-z\\-0-9]+\\.)+[a-za-z]{2,}))$")`
     */
    email: string;
    /**
     * - SQL: `phone int unsigned unique not null check (phone >= 100000000 and phone <= 999999999)`
     */
    phone: number;
    /**
     * - SQL: `birth_date date not null`
     */
    birth_date: string;
    /**
     * - SQL: `gender varchar(12) not null`
     */
    gender: string;
    /**
     * - SQL: `weight int unsigned not null`
     */
    weight: number;
    /**
     * - SQL: `height int unsigned not null`
     */
    height: number;
    /**
     * - SQL: `rhesus_factor enum("+", "-") not null`
     */
    rhesus_factor: "+" | "-";
    /**
     * - SQL: `blood_type_id int unsigned not null`
     * - Foreign key: `blood_type.id`
     */
    blood_type_id: number;
    /**
     * - SQL: `insurance_type_id int unsigned not null`
     * - Foreign key: `insurance_type.id`
     */
    insurance_type_id: number;
    /**
     * - SQL: `password char(86) not null check (password != "")`
     */
    password: string;
    /**
     * - SQL: `salt char(43) not null check (salt != "")`
     */
    salt: string;
    /**
     * - SQL: `session_token char(86) unique check (session_token is null or session_token != "")`
     */
    session_token: string | null;
};

export type Patient = Selectable<PatientTable>;
export type NewPatient = Insertable<PatientTable>;
export type PatientUpdate = Updateable<PatientTable>;

/**
 * - Table name: `schedule`
 * - Primary key: `(id)`
 */
export type ScheduleTable = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
};

export type Schedule = Selectable<ScheduleTable>;
export type NewSchedule = Insertable<ScheduleTable>;
export type ScheduleUpdate = Updateable<ScheduleTable>;

/**
 * - Table name: `specialty`
 * - Primary key: `(id)`
 */
export type SpecialtyTable = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(64) not null check (name != "")`
     */
    name: string;
};

export type Specialty = Selectable<SpecialtyTable>;
export type NewSpecialty = Insertable<SpecialtyTable>;
export type SpecialtyUpdate = Updateable<SpecialtyTable>;

/**
 * - Table name: `time_slot`
 * - Primary key: `(id)`
 */
export type TimeSlotTable = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `schedule_id int unsigned not null`
     */
    schedule_id: number;
    /**
     * - SQL: `start datetime not null`
     */
    start: string;
    /**
     * - SQL: `end datetime not null`
     */
    end: string;
};

export type TimeSlot = Selectable<TimeSlotTable>;
export type NewTimeSlot = Insertable<TimeSlotTable>;
export type TimeSlotUpdate = Updateable<TimeSlotTable>;

export type DB = {
    appointment: AppointmentTable;
    blood_type: BloodTypeTable;
    clinic: ClinicTable;
    employee: EmployeeTable;
    insurance_type: InsuranceTypeTable;
    medic: MedicTable;
    medical_record: MedicalRecordTable;
    patient: PatientTable;
    schedule: ScheduleTable;
    specialty: SpecialtyTable;
    time_slot: TimeSlotTable;
};
