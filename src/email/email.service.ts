import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

type SendFileShareEmailParams = {
  to: string | string[];
  shareUrl: string;
  filename: string;
  logoUrl?: string; // e.g. https://vaultiva.cloud/logo.png
};

@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly logger = new Logger(EmailService.name);

  async sendFileShareEmail({ to, shareUrl, filename, logoUrl }: SendFileShareEmailParams) {
    try {
      const subject = `You've received a file: ${filename} — Vaultiva`;
      const preheader =
        'Someone shared a file with you via Vaultiva. This link may expire or be limited in downloads.';

      const html = `
        <!doctype html>
        <html>
        <head>
            <meta http-equiv="x-ua-compatible" content="ie=edge">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <title>You've received a file — Vaultiva</title>
        </head>
        <body style="margin:0;padding:0;background:#f6f7fb;color:#1f2937;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
            <!-- Preheader -->
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
                ${preheader}
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb;">
            <tr>
                <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#fff;border:1px solid #e6eaf2;border-radius:12px;">
                    <!-- Header -->
                    <tr>
                    <td style="padding:20px 24px 0 24px;">
                        <table role="presentation" width="100%">
                        <tr>
                            <td align="left">
                            <span style="display:inline-block;font-weight:700;font-size:18px;line-height:28px;color:#364d79;">Vaultiva</span>
                            </td>
                        </tr>
                        </table>
                    </td>
                    </tr>

                    <!-- Title + intro -->
                    <tr>
                    <td style="padding:8px 24px 4px 24px;">
                        <h2 style="margin:0 0 8px 0;font-size:20px;line-height:28px;color:#364d79;">
                        📁 You've received a file via Vaultiva
                        </h2>
                        <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#374151;">
                        Someone has shared a file with you:
                        </p>

                        <!-- File pill -->
                        <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin:0 0 18px 0;font-weight:700;color:#111827;word-break:break-word;">
                        ${this.escapeHtml(filename)}
                        </div>

                        <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#374151;">
                        Click the button below to download it:
                        </p>

                        <!-- Button (fluid) -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 6px 0;">
                        <tr>
                            <td align="center">
                            <a href="${shareUrl}"
                                style="background:#364d79;color:#ffffff;text-decoration:none;
                                        display:block;max-width:260px;width:100%;
                                        padding:12px 20px;border-radius:10px;
                                        font-weight:700;font-size:14px;line-height:20px;">
                                🔐 Download File
                            </a>
                            </td>
                        </tr>
                        </table>

                        <!-- Notes -->
                        <p style="margin:12px 0 6px 0;font-size:12px;line-height:18px;color:#6b7280;">
                        This link may expire or be limited in download count. Please do not forward this link to others.
                        </p>

                        <!-- Fallback URL in box -->
                        <div style="background:#f9fafb;border:1px dashed #e5e7eb;border-radius:8px;padding:10px 12px;margin:10px 0 16px 0;">
                        <div style="font-size:12px;line-height:18px;color:#6b7280;margin-bottom:4px;">
                            If the button doesn't work, copy and paste this URL into your browser:
                        </div>
                        <a href="${shareUrl}" style="font-size:12px;line-height:18px;color:#364d79;word-break:break-all;text-decoration:none;">
                            ${shareUrl}
                        </a>
                        </div>

                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0 10px 0;"/>

                        <p style="margin:0 0 8px 0;text-align:center;font-size:12px;line-height:18px;color:#6b7280;">
                        Sent via <strong style="color:#364d79;">Vaultiva</strong> — secure and simple file sharing.
                        </p>
                        <p style="margin:0 0 20px 0;text-align:center;font-size:12px;line-height:18px;color:#9ca3af;">
                        If you don’t recognize this request, you can safely ignore this email.
                        </p>
                    </td>
                    </tr>
                </table>
                <div style="height:10px;line-height:10px;">&nbsp;</div>
                </td>
            </tr>
            </table>
        </body>
        </html>
        `;

      const text = [
        `You've received a file via Vaultiva`,
        ``,
        `File: ${filename}`,
        `Download: ${shareUrl}`,
        ``,
        `Note: This link may expire or be limited in download count.`,
        `If you didn’t request this, please ignore this email.`,
      ].join('\n');

      const result = await this.resend.emails.send({
        from: 'Vaultiva <noreply@vaultiva.cloud>',
        to,
        subject,
        html,
        text
      });

      if (result.error) {
        this.logger.error(`Failed to send email to ${to}: ${result.error.message}`);
      } else {
        this.logger.log(`Email sent to ${to}: ${result.data?.id}`);
      }
      return result;
    } catch (err: any) {
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      throw err;
    }
  }

  private escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
