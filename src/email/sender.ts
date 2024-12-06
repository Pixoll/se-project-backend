import { config } from "dotenv";
import { createTransport } from "nodemailer";

config();

const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export async function sendEmail(email: string, subject: string, body: string): Promise<boolean> {
    const info = await transporter.sendMail({
        from: `"Clinic" ${process.env.EMAIL}`,
        to: email,
        subject: subject,
        text: body,
    }).catch(console.error);

    return !!info?.messageId;
}
