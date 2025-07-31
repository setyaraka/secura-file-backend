import { Injectable, Logger } from '@nestjs/common';
import { error } from 'console';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly resend = new Resend(process.env.RESEND_API_KEY);
    private readonly logger = new Logger(EmailService.name);

    async sendFileShareEmail({ to, shareUrl, filename}) {
        try {
            const subject = `You've received a file via Vaultiva`;
            const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9; color: #333; border: 1px solid #ddd; border-radius: 8px;">
                                <h2 style="color: #2f855a;">📁 You've received a file via Vaultiva</h2>
                                
                                <p>Someone has shared a file with you:</p>

                                <p style="font-size: 16px; font-weight: bold; background: #edf2f7; padding: 10px; border-radius: 4px;">
                                ${filename}
                                </p>

                                <p>Click the button below to download it:</p>

                                <p style="text-align: center; margin: 24px 0;">
                                <a href="${shareUrl}" style="background-color: #2f855a; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                                    🔐 Download File
                                </a>
                                </p>

                                <p style="font-size: 14px; color: #555;">
                                This link may expire or be limited in download count.
                                </p>

                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;" />

                                <p style="font-size: 12px; color: #888; text-align: center;">
                                Sent via <strong>Vaultiva</strong> – secure and simple file sharing.<br/>
                                If you don’t recognize this request, you can safely ignore this email.
                                </p>
                            </div>`
            
            const result = await this.resend.emails.send({
                from: 'noreply@vaultiva.cloud',
                to,
                subject,
                html,
            });
    
            if (result.error) {
                this.logger.error(result.error, 'sa')
                this.logger.error(`Failed to send email to ${to}: ${result.error.message}`);
              } else {
                this.logger.log(`Email sent to ${to}: ${result.data?.id}`);
              }
            return result;
        } catch (err) {
            this.logger.error(`Failed to send email: ${err.message}`, err.stack);
            throw err;
        }
    }
}
