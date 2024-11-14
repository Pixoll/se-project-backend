drop schema if exists soft_eng;
create schema soft_eng;

use soft_eng;

delimiter $$
create function is_valid_rut(rut varchar(11)) returns boolean
deterministic
begin
    declare dash_pos int;
    declare digits varchar(9);
    declare i int;
    declare digit_sum int;
    declare verif_seq_digit int;
    declare verif_number int;
    declare verif_digit char(1);

    if rut not regexp '^\\d{7,}-[\\dkK]$' then
        return false;
    end if;

    set dash_pos = position("-" in rut);
    set digits = substring(rut, 1, dash_pos - 1);
    if cast(digits as unsigned int) < 1e6 then
        return false;
    end if;

    set i = dash_pos - 1;
    set digit_sum = 0;
    set verif_seq_digit = 2;

    reverse_digits: loop
        if i < 1 then
            leave reverse_digits;
        end if;

        set digit_sum = digit_sum + (cast(substring(rut, i, 1) as unsigned int) * verif_seq_digit);
        set i = i - 1;
        set verif_seq_digit = verif_seq_digit + 1;
        if verif_seq_digit >= 8 then
            set verif_seq_digit = 2;
        end if;

        iterate reverse_digits;
    end loop;

    set verif_number = 11 - digit_sum + (floor(digit_sum / 11) * 11);
    if verif_number = 10 then
        set verif_digit = "K";
    else
        set verif_digit = cast(verif_number % 11 as char);
    end if;

    return substring(rut, dash_pos + 1, 1) = verif_digit;
end; $$
delimiter ;

create table clinic (
    id int primary key default 0 check (id = 0),
    name varchar(64) not null check (name != ""),
    email varchar(64) not null check (email regexp "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"),
    phone int unsigned not null check (phone >= 100000000 and phone <= 999999999),
    address varchar(128) not null check (address != ""),
    opening_time time not null,
    closing_time time not null
);

create table blood_type (
    id int unsigned primary key auto_increment,
    name varchar(4) not null
);

create table insurance_type (
    id int unsigned primary key auto_increment,
    name varchar(8) not null
);

create table patient (
    rut varchar(11) primary key,
    first_name varchar(32) not null check (first_name != ""),
    second_name varchar(32) check (second_name is null or second_name != ""),
    first_last_name varchar(32) not null check (first_last_name != ""),
    second_last_name varchar(32) check (second_last_name is null or second_last_name != ""),
    email varchar(64) unique not null check (email regexp "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"),
    phone int unsigned unique not null check (phone >= 100000000 and phone <= 999999999),
    birth_date date not null,
    gender varchar(12) not null,
    weight float not null check (weight > 0),
    height float not null check (height > 0),
    rhesus_factor enum("+", "-") not null,
    blood_type_id int unsigned not null,
    insurance_type_id int unsigned not null,
    password char(86) not null check (password != ""),
    salt char(43) not null check (salt != ""),
    session_token char(86) unique check (session_token is null or session_token != ""),
    foreign key (blood_type_id) references blood_type(id),
    foreign key (insurance_type_id) references insurance_type(id)
);

delimiter $$
create trigger patient_insert_check_trigger before insert on patient
for each row
begin
    declare msg varchar(64);

    if not is_valid_rut(new.rut) then
        set msg = concat("Invalid rut ", new.rut);
        signal sqlstate "45000" set message_text = msg;
    end if;
end; $$
delimiter ;

create table medical_record (
    patient_rut varchar(11) primary key,
    allergies_history varchar(1000),
    morbidity_history varchar(1000),
    surgical_history varchar(1000),
    medications varchar(1000),
    foreign key (patient_rut) references patient(rut)
);

create table employee (
    rut varchar(11) primary key,
    type enum("admin_staff", "medic") not null,
    first_name varchar(32) not null check (first_name != ""),
    second_name varchar(32) check (second_name is null or second_name != ""),
    first_last_name varchar(32) not null check (first_last_name != ""),
    second_last_name varchar(32) check (second_last_name is null or second_last_name != ""),
    email varchar(64) unique not null check (email regexp "^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"),
    phone int unsigned unique not null check (phone >= 100000000 and phone <= 999999999),
    birth_date date not null,
    gender varchar(12) not null,
    password char(86) not null check (password != ""),
    salt char(43) not null check (salt != ""),
    session_token char(86) unique check (session_token is null or session_token != "")
);

delimiter $$
create trigger employee_insert_check_trigger before insert on employee
for each row
begin
    declare msg varchar(64);

    if not is_valid_rut(new.rut) then
        set msg = concat("Invalid rut ", new.rut);
        signal sqlstate "45000" set message_text = msg;
    end if;
end; $$
delimiter ;

create table specialty (
    id int unsigned primary key auto_increment,
    name varchar(64) not null check (name != "")
);

create table schedule (
    id int unsigned primary key auto_increment
);

create table time_slot (
    id int unsigned primary key auto_increment,
    schedule_id int unsigned not null,
    day enum("mo", "tu", "we", "th", "fr", "sa", "su") not null,
    start time not null,
    end time not null,
    check (start < end),
    foreign key (schedule_id) references schedule(id)
);

delimiter $$
create trigger time_slot_insert_check_trigger before insert on time_slot
for each row
begin
    declare conflict boolean;

    set conflict = (select true from time_slot as t
                    where t.schedule_id = new.schedule_id
                    and t.day = new.day
                    and (
                        (t.start < new.start and new.start < t.end)
                        or (t.start < new.end and new.end < t.end)
                        or (new.start < t.start and t.end < new.end)
                        or (t.start < new.start and new.end < t.end)
                    ));

    if conflict then
        signal sqlstate "45000" set message_text = "Time slot overlaps with another.";
    end if;
end; $$
delimiter ;

create table medic (
    rut varchar(11) primary key,
    specialty_id int unsigned not null,
    schedule_id int unsigned not null,
    foreign key (rut) references employee(rut),
    foreign key (specialty_id) references specialty(id),
    foreign key (schedule_id) references schedule(id)
);

delimiter $$
create trigger medic_insert_check_trigger before insert on medic
for each row
begin
    declare e_type varchar(11);
    declare msg varchar(64);

    set e_type = (select e.type from employee as e where e.rut = new.rut);

    if e_type != "medic" then
        set msg = concat("Employee type corresponds to a ", e_type, ", expected a medic.");
        signal sqlstate "45000" set message_text = msg;
    end if;
end; $$
delimiter ;

create table appointment (
    id bigint unsigned primary key auto_increment,
    patient_rut varchar(11) not null,
    time_slot_id int unsigned not null,
    description varchar(1000) not null check (description != ""),
    confirmed boolean not null default false,
    foreign key (patient_rut) references patient(rut),
    foreign key (time_slot_id) references time_slot(id)
);

delimiter $$
create trigger appointment_insert_check_trigger before insert on appointment
for each row
begin
    declare conflict boolean;
    declare msg varchar(100);

    set conflict = (select true from appointment as a where a.time_slot_id = new.time_slot_id);

    if conflict then
        set msg = concat("There's already an appointment for ", new.time_slot_id, ".");
        signal sqlstate "45000" set message_text = msg;
    end if;
end; $$
delimiter ;

insert into clinic values (
    0,
    "Clinic",
    "contact@clinic.cl",
    912345678,
    "Street 101",
    "07:00",
    "23:00"
);

insert into blood_type (name) values
    ("A"),
    ("B"),
    ("AB"),
    ("O");

insert into insurance_type (name) values
    ("Fonasa"),
    ("Isapre");

insert into specialty (name) values
    ("Allergy and Immunology"),
    ("Dermatology"),
    ("Family Medicine"),
    ("General Practitioner"),
    ("Internal Medicine"),
    ("Medical Genetics"),
    ("Neurology"),
    ("Obstetrics and Gynecology"),
    ("Ophthalmology"),
    ("Pediatrics"),
    ("Physical and Rehabilitation"),
    ("Preventive Medicine"),
    ("Psychiatry"),
    ("Oncology"),
    ("Plastic Surgeon"),
    ("Urology");

insert into patient values
    -- password: 1234567890
    ("1000000-9", "Name 1", "Name 2", "Surname 1", "Surname 2", "my@email.com", 923456789, "2000-01-01", "Male", 70, 180, "+", 1, 1, "EIlbPX94ABnBGXRX2pFGfbdGr_iGT6xKHa_kFmfY9T4XZpbtd441ita68T8-eTdQaFhzdGPkoSPTk-lAJ0ODaA", "AIoVry0_yskEUbR_B4QnWLBmd5pzn_f2rs-SEm9yAQs", null),
    -- password: qwertyuiop
    ("2000000-7", "Name 3", "Name 4", "Surname 3", "Surname 4", "an@email.com", 987654321, "2002-02-20", "Female", 60, 175, "-", 2, 2, "UvnSFma7X242DgRC45-qo-8_ZMR-wJxWlceflmpXa2vFxHwywMpIMSE6H7AYJw7RWJieFo5en1MDeAI6G2wMSA", "s7ujjgSgJItN6HP6wohuaPCwxyuIKRZpCfxwx5-lL2Q", null);

insert into schedule values
    (null),
    (null);

insert into time_slot values
    (null, 1, "mo", "08:00", "08:30"),
    (null, 1, "mo", "08:30", "09:00"),
    (null, 1, "tu", "09:00", "09:30"),
    (null, 1, "tu", "09:30", "10:00"),
    (null, 1, "we", "10:00", "10:30"),
    (null, 1, "we", "10:30", "11:00"),
    (null, 1, "th", "11:00", "11:30"),
    (null, 1, "th", "11:30", "12:00"),
    (null, 1, "fr", "12:00", "12:30"),
    (null, 1, "fr", "12:30", "13:00"),
    (null, 1, "sa", "13:00", "13:30"),
    (null, 1, "sa", "13:30", "14:00"),
    (null, 1, "su", "14:00", "14:30"),
    (null, 1, "su", "14:30", "15:00"),
    (null, 2, "mo", "15:00", "15:30"),
    (null, 2, "mo", "15:30", "16:00"),
    (null, 2, "tu", "16:00", "16:30"),
    (null, 2, "tu", "16:30", "17:00"),
    (null, 2, "we", "17:00", "17:30"),
    (null, 2, "we", "17:30", "18:00"),
    (null, 2, "th", "18:00", "18:30"),
    (null, 2, "th", "18:30", "19:00"),
    (null, 2, "fr", "19:00", "19:30"),
    (null, 2, "fr", "19:30", "20:00"),
    (null, 2, "sa", "20:00", "20:30"),
    (null, 2, "sa", "20:30", "21:00"),
    (null, 2, "su", "21:00", "21:30"),
    (null, 2, "su", "21:30", "22:00");

insert into employee values
    -- password: asdfghjkl
    ("3000000-5", "medic", "Name 5", "Name 6", "Surname 5", "Surname 6", "a@clinic.cl", 934567890, "1990-12-30", "Male", "QZru3w43-AvfIa58FnuA36YS6PMhNv4d9hywyHVtBQZxmRk3R1bwX2JtWfNyTXqCpynFzqFOTY1DpIrLn2us7A", "P5p7WmOSjzA3UeYwRu9Vq52lm4dnRWpqIC5MhaMFkdk", null),
    -- password: zxcvbnm
    ("4000000-3", "medic", "Name 7", null, "Surname 7", null, "b@clinic.cl", 976543210, "1980-02-14", "Female", "RTmAdfHX30a3sm0n_uUgPCj35ODQ1FoTrMYF9S4Jou3enmVWhe74ALm2Xy4Krd8mVNH1sQijvadWIx1oTR6-cg", "ZTV5cu6TWP3hgHo8vO_KktKpVxs_Mxw3e1I4TzJaGfo", null),
    -- password: 1qaz2wsx3edc
    ("5000000-1", "admin_staff", "Name 8", null, "Surname 8", null, "c@clinic.cl", 948267513, "2004-04-04", "Male", "UpB4cBLgCjXgocQ-aJbQzuFctGkDTtwE9sctsuOyWBwHRRzPrtPftvDfcxzEqXc8DMOkAu3sJbWo4isyhNwzUQ", "2qr_MEQhXa_hPVq-YgGSMTqgopdCj96mVuhFv7o2qX4", null);

insert into medic values
    ("3000000-5", 1, 1),
    ("4000000-3", 5, 2);
