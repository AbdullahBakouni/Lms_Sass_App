import nodemailer from 'nodemailer';
import config from '../config/config';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.EMAIL_USER!,
    pass: config.EMAIL_PASSWORD!,
  },
});

const html = `
                      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
                        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
    
                           <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);">
      <tr>
        <td style="padding: 20px 30px;">
          <h2 style="color: #333333;">Hello 👋</h2>
          <p style="color: #555555; font-size: 16px;">
            Your verification code is:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background-color: #f0f4ff; color: #2b55d4; font-size: 24px; font-weight: bold; padding: 12px 24px; border-radius: 6px; letter-spacing: 3px;">
              {{OTP}}
            </span>
          </div>
          <p style="color: #777777; font-size: 14px;">
            This code is valid for <strong>1 minute</strong>. If you didn’t request this code, please ignore this message.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eeeeee;" />
          <p style="color: #aaaaaa; font-size: 12px; text-align: center;">
            &copy; 2025 MyApp. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
                        </div>
                      </div>
                    `;

export async function sendOtpEmail(to: string, otp: string) {
  console.log('sendOtpEmail called with:', { to, otp });

  if (!otp) {
    throw new Error('OTP is empty!');
  }
  const htmlWithOtp = html.replace('{{OTP}}', otp);
  await transporter.sendMail({
    from: `"LMS App" <${process.env.EMAIL_USER!}>`,
    to,
    subject: 'Your OTP Code',
    text: `Your verification code is ${otp}. It's valid for 1 minute.`,
    html: htmlWithOtp,
  });
}
