const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async ({ to, username, resetUrl }) => {
  await resend.emails.send({
    from: `${process.env.EMAIL_FROM_NAME || 'Reddit Clone'} <${process.env.EMAIL_FROM_ADDRESS}>`,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:44px;height:44px;background:#6366f1;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="color:#fff;font-size:22px;">🔒</span>
            </div>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#1e293b;">Reset your password</h1>
          </div>

          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hi <strong style="color:#1e293b;">${username}</strong>, we received a request to reset your password.
            Click the button below to choose a new one.
          </p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}"
               style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              Reset Password
            </a>
          </div>

          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 8px;">
            This link expires in <strong>10 minutes</strong>. If you didn't request a password reset,
            you can safely ignore this email.
          </p>

          <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;word-break:break-all;">
            Or copy this link: ${resetUrl}
          </p>
        </div>
      </div>
    `,
  });
};

module.exports = { sendPasswordResetEmail };
