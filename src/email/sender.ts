import { config } from "dotenv";
import { createTransport } from "nodemailer";
import logger from "../logger";

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

export async function sendEmail(email: string, subject: string, body: string): Promise<void> {
    try {
        const info = await transporter.sendMail({
            from: `"Clinic" ${process.env.EMAIL}`,
            to: email,
            subject: subject,
            text: body,
        }).catch(console.error);

        if (info?.messageId) {
            logger.log(`Sent email ${info?.messageId}`);
        } else {
            logger.error(`Failed to send email to ${email}`);
        }
    } catch (error) {
        logger.error(`Failed to send email to ${email}`, error);
    }
}
