import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, otp: str, full_name: str) -> bool:
    """Send a 6-digit OTP email. Returns True on success, False on failure."""
    subject = "Verify your SkillDipz account"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#111111;border:1px solid #222;border-radius:16px;overflow:hidden;">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                    SkillDipz
                  </h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">
                    Verify your email address
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 40px;">
                  <p style="color:#d1d5db;font-size:15px;margin:0 0 8px;">
                    Hi <strong style="color:#fff;">{full_name}</strong>,
                  </p>
                  <p style="color:#9ca3af;font-size:14px;margin:0 0 28px;line-height:1.6;">
                    Use the code below to verify your account. It expires in <strong style="color:#fff;">10 minutes</strong>.
                  </p>

                  <!-- OTP Box -->
                  <div style="background:#1a1a2e;border:2px solid #7c3aed;border-radius:12px;
                              padding:24px;text-align:center;margin-bottom:28px;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:12px;
                                 color:#a78bfa;font-family:monospace;">
                      {otp}
                    </span>
                  </div>

                  <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.6;">
                    If you didn't create a SkillDipz account, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#0d0d0d;padding:16px 40px;border-top:1px solid #222;">
                  <p style="color:#4b5563;font-size:11px;margin:0;text-align:center;">
                    © 2025 SkillDipz. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"SkillDipz <{settings.SMTP_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_EMAIL, to_email, msg.as_string())

        logger.info(f"✅ OTP email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send OTP email to {to_email}: {e}")
        return False
