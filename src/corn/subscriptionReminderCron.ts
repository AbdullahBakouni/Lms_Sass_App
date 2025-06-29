import cron from "node-cron";
import {redis} from "../config/upstash";
import nodemailer from "nodemailer";
import config from "../config/config";
import {db} from "../db";
import {userSubscriptions} from "../db/schema";
import {eq, lt , and} from "drizzle-orm";
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: config.EMAIL_USER!,
        pass: config.EMAIL_PASSWORD!,
    },
});


export const startSubscriptionReminderCron = () => {

    cron.schedule("0 8 * * 0", async () => {
        console.log("⏰ Weekly subscription job started...");

        const now = Date.now();

        try {

            const jobs = await redis.zrange("subscription_reminders", 0, now, { byScore: true });

            for (const jobStr of jobs as string[]) {
                const job = typeof jobStr === "string" ? JSON.parse(jobStr) : jobStr;

                if (job.type === "subscriptionReminder") {
                    const { userEmail, userName, subscription } = job.payload;


                    const expirationDate = new Date(subscription.expiresAt).toLocaleDateString();

                    const html = `
                      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
                        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                          <h2 style="color: #007bff;">⏰ Subscription Expiring Soon</h2>
                          <p>Hello <strong>${userName}</strong>,</p>
                          <p style="margin-bottom: 20px;">We're reminding you that your current subscription will expire in <strong>3 days</strong>. Here are the details of your subscription:</p>
                          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <tr>
                              <td style="padding: 8px 0;"><strong>Plan Name:</strong></td>
                              <td style="padding: 8px 0;">${subscription.planName}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;"><strong>Price:</strong></td>
                              <td style="padding: 8px 0;">${subscription.price} ${subscription.currency}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;"><strong>Expires On:</strong></td>
                              <td style="padding: 8px 0;">${expirationDate}</td>
                            </tr>
                          </table>
                          <a href="http://localhost:3000/subscribtion" 
                             style="display: inline-block; background: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Renew Now
                          </a>
                          <p style="margin-top: 30px; font-size: 13px; color: #888;">
                            If you’ve already renewed, you can safely ignore this message.
                          </p>
                        </div>
                      </div>
                    `;

                    await transporter.sendMail({
                        from: `"LMS App" <${process.env.EMAIL_USER!}>`,
                        to: userEmail,
                        subject: "Your subscription expires in 3 days",
                        html,
                    });


                    await redis.zrem("subscription_reminders", jobStr);
                    // console.log(`✅ Reminder sent to ${userEmail}`);
                }
            }
            const expiredSubs = await db
                .select()
                .from(userSubscriptions)
                .where(
                   and(
                       lt(userSubscriptions.expiresAt, new Date()),
                       eq(userSubscriptions.status, "active")
                   )
                );

            for (const sub of expiredSubs) {
                await db.update(userSubscriptions)
                    .set({ status: "expired" })
                    .where(eq(userSubscriptions.id, sub.id));

                console.log(`🔒 Subscription ${sub.id} expired.`);
            }

        } catch (error) {
            console.error("❌ Error while checking subscription reminders:", error);
        }
    });
};
