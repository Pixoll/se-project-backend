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
    weight float check (weight is null or weight > 0) default null,
    height float check (height is null or height > 0) default null,
    rhesus_factor enum("+", "-") default null,
    blood_type_id int unsigned default null,
    insurance_type_id int unsigned not null,
    allergies_history varchar(1000) default null,
    morbidity_history varchar(1000) default null,
    surgical_history varchar(1000) default null,
    medications varchar(1000) default null,
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
    active boolean not null default true,
    check (start < end),
    foreign key (schedule_id) references schedule(id)
);

delimiter $$
create trigger time_slot_insert_check_trigger before insert on time_slot
for each row
begin
    declare conflict boolean;

    if not new.active then
        set new.active = true;
    end if;

    set conflict = (select true from time_slot as t
                    where t.schedule_id = new.schedule_id
                    and t.day = new.day
                    and t.active
                    and (
                        t.start = new.start
                        or t.end = new.end
                        or (t.start < new.start and new.start < t.end)
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
    time_slot_id int unsigned not null,
    date date not null,
    id bigint unsigned unique auto_increment not null,
    patient_rut varchar(11) not null,
    description varchar(1000) not null check (description != ""),
    confirmed boolean not null default false,
    primary key (time_slot_id, date),
    foreign key (patient_rut) references patient(rut),
    foreign key (time_slot_id) references time_slot(id)
);

delimiter $$
create trigger appointment_insert_check_trigger before insert on appointment
for each row
begin
    declare conflict boolean;
    declare msg varchar(100);

    if new.date < current_date() then
        signal sqlstate "45000" set message_text = "Appointment cannot be set in the past.";
    end if;

    set conflict = (select not t.active
                    from time_slot as t
                    where t.id = new.time_slot_id);

    if conflict then
        signal sqlstate "45000" set message_text = "Time slot is not active.";
    end if;

    set conflict = (select t.day != elt(weekday(new.date) + 1, "mo", "tu", "we", "th", "fr", "sa", "su")
                    from time_slot as t
                    where t.id = new.time_slot_id);

    if conflict then
        signal sqlstate "45000" set message_text = "Appointment day and time slot day do not match.";
    end if;

    set conflict = (select new.date = current_date() and current_time() > t.start
                    from time_slot as t
                    where t.id = new.time_slot_id);

    if conflict then
        signal sqlstate "45000" set message_text = "Time slot has already started.";
    end if;

    set conflict = (select true from appointment as a
                    inner join time_slot as t1 on t1.id = a.time_slot_id
                    inner join time_slot as t2 on t2.id = new.time_slot_id
                    inner join medic as m1 on m1.schedule_id = t1.schedule_id
                    inner join medic as m2 on m2.schedule_id = t2.schedule_id
                    where a.date = new.date
                    and (
                        a.patient_rut = new.patient_rut
                        or m1.rut = m2.rut
                    )
                    and (
                        t1.start = t2.start
                        or t1.end = t2.end
                        or (t1.start < t2.start and t2.start < t1.end)
                        or (t1.start < t2.end and t2.end < t1.end)
                        or (t2.start < t1.start and t1.end < t2.end)
                        or (t1.start < t2.start and t2.end < t1.end)
                    ));

    if conflict then
        signal sqlstate "45000" set message_text = "Appointment overlaps with another.";
    end if;
end; $$
delimiter ;

delimiter $$
create trigger time_slot_update_check_trigger before update on time_slot
for each row
begin
    declare conflict boolean;

    set conflict = (select true from time_slot as t
                    where t.schedule_id = new.schedule_id
                    and t.day = new.day
                    and t.active
                    and (
                        t.start = new.start
                        or t.end = new.end
                        or (t.start < new.start and new.start < t.end)
                        or (t.start < new.end and new.end < t.end)
                        or (new.start < t.start and t.end < new.end)
                        or (t.start < new.start and new.end < t.end)
                    ));

    if conflict then
        signal sqlstate "45000" set message_text = "Time slot overlaps with another.";
    end if;

    if not new.active then
        set conflict = (select true
                        from appointment as a
                        where a.time_slot_id = new.id
                        and a.confirmed
                        and a.date >= current_date());

        if conflict then
            signal sqlstate "45000" set message_text = "Time slot has confirmed appointments associated with it.";
        end if;
    end if;
end; $$
delimiter ;

delimiter $$
create trigger time_slot_delete_check_trigger before delete on time_slot
for each row
begin
    declare conflict boolean;

    set conflict = (select true
                    from appointment as a
                    where a.time_slot_id = old.id);

    if conflict then
        signal sqlstate "45000" set message_text = "Time slot has appointments associated with it.";
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
    ("1000000-9", "Name 1", "Name 2", "Surname 1", "Surname 2", "my@email.com", 923456789, "2000-01-01", "Male", 70, 180, "+", 1, 1, null, null, null, null, "EIlbPX94ABnBGXRX2pFGfbdGr_iGT6xKHa_kFmfY9T4XZpbtd441ita68T8-eTdQaFhzdGPkoSPTk-lAJ0ODaA", "AIoVry0_yskEUbR_B4QnWLBmd5pzn_f2rs-SEm9yAQs", null),
    -- password: qwertyuiop
    ("2000000-7", "Name 3", "Name 4", "Surname 3", "Surname 4", "an@email.com", 987654321, "2002-02-20", "Female", 60, 175, "-", 2, 2, null, null, null, null, "UvnSFma7X242DgRC45-qo-8_ZMR-wJxWlceflmpXa2vFxHwywMpIMSE6H7AYJw7RWJieFo5en1MDeAI6G2wMSA", "s7ujjgSgJItN6HP6wohuaPCwxyuIKRZpCfxwx5-lL2Q", null);

insert into schedule values
    (null),
    (null);

insert into time_slot (schedule_id, day, start, end) values
    (1, "mo", "08:00", "08:30"),
    (1, "mo", "08:30", "09:00"),
    (1, "tu", "09:00", "09:30"),
    (1, "tu", "09:30", "10:00"),
    (1, "we", "10:00", "10:30"),
    (1, "we", "10:30", "11:00"),
    (1, "th", "11:00", "11:30"),
    (1, "th", "11:30", "12:00"),
    (1, "fr", "12:00", "12:30"),
    (1, "fr", "12:30", "13:00"),
    (1, "sa", "13:00", "13:30"),
    (1, "sa", "13:30", "14:00"),
    (1, "su", "14:00", "14:30"),
    (1, "su", "14:30", "15:00"),
    (2, "mo", "15:00", "15:30"),
    (2, "mo", "15:30", "16:00"),
    (2, "tu", "16:00", "16:30"),
    (2, "tu", "16:30", "17:00"),
    (2, "we", "17:00", "17:30"),
    (2, "we", "17:30", "18:00"),
    (2, "th", "18:00", "18:30"),
    (2, "th", "18:30", "19:00"),
    (2, "fr", "19:00", "19:30"),
    (2, "fr", "19:30", "20:00"),
    (2, "sa", "20:00", "20:30"),
    (2, "sa", "20:30", "21:00"),
    (2, "su", "21:00", "21:30"),
    (2, "su", "21:30", "22:00"),
    (1, "mo", "13:00", "13:30");

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

insert into appointment values
    (1, (current_date() + interval 7 - weekday(current_date()) day), null, "1000000-9", "Lorem ipsum", true),
    (3, (current_date() + interval 7 - weekday(current_date()) day) + interval 1 day, null, "1000000-9", "Lorem ipsum", true),
    (5, (current_date() + interval 7 - weekday(current_date()) day) + interval 2 day, null, "1000000-9", "Lorem ipsum", true),
    (7, (current_date() + interval 7 - weekday(current_date()) day) + interval 3 day, null, "1000000-9", "Lorem ipsum", false),
    (9, (current_date() + interval 7 - weekday(current_date()) day) + interval 4 day, null, "1000000-9", "Lorem ipsum", false),
    (11, (current_date() + interval 7 - weekday(current_date()) day) + interval 5 day, null, "1000000-9", "Lorem ipsum", false),
    (13, (current_date() + interval 7 - weekday(current_date()) day) + interval 6 day, null, "1000000-9", "Lorem ipsum", false),

    (16, (current_date() + interval 7 - weekday(current_date()) day) + interval 7 day, null, "1000000-9", "Lorem ipsum", false),
    (18, (current_date() + interval 7 - weekday(current_date()) day) + interval 8 day, null, "1000000-9", "Lorem ipsum", false),
    (20, (current_date() + interval 7 - weekday(current_date()) day) + interval 9 day, null, "1000000-9", "Lorem ipsum", false),
    (22, (current_date() + interval 7 - weekday(current_date()) day) + interval 10 day, null, "1000000-9", "Lorem ipsum", false),
    (24, (current_date() + interval 7 - weekday(current_date()) day) + interval 11 day, null, "1000000-9", "Lorem ipsum", false),
    (26, (current_date() + interval 7 - weekday(current_date()) day) + interval 12 day, null, "1000000-9", "Lorem ipsum", false),
    (28, (current_date() + interval 7 - weekday(current_date()) day) + interval 13 day, null, "1000000-9", "Lorem ipsum", false),

    (2, (current_date() + interval 7 - weekday(current_date()) day), null, "2000000-7", "Lorem ipsum", true),
    (4, (current_date() + interval 7 - weekday(current_date()) day) + interval 1 day, null, "2000000-7", "Lorem ipsum", true),
    (6, (current_date() + interval 7 - weekday(current_date()) day) + interval 2 day, null, "2000000-7", "Lorem ipsum", false),
    (8, (current_date() + interval 7 - weekday(current_date()) day) + interval 3 day, null, "2000000-7", "Lorem ipsum", false),
    (10, (current_date() + interval 7 - weekday(current_date()) day) + interval 4 day, null, "2000000-7", "Lorem ipsum", false),
    (12, (current_date() + interval 7 - weekday(current_date()) day) + interval 5 day, null, "2000000-7", "Lorem ipsum", false),
    (14, (current_date() + interval 7 - weekday(current_date()) day) + interval 6 day, null, "2000000-7", "Lorem ipsum", false),

    (1, (current_date() + interval 7 - weekday(current_date()) day) + interval 7 day, null, "2000000-7", "Lorem ipsum", true),
    (3, (current_date() + interval 7 - weekday(current_date()) day) + interval 8 day, null, "2000000-7", "Lorem ipsum", false),
    (19, (current_date() + interval 7 - weekday(current_date()) day) + interval 2 day, null, "2000000-7", "Lorem ipsum", false),
    (7, (current_date() + interval 7 - weekday(current_date()) day) + interval 10 day, null, "2000000-7", "Lorem ipsum", false),
    (23, (current_date() + interval 7 - weekday(current_date()) day) + interval 11 day, null, "2000000-7", "Lorem ipsum", false);
