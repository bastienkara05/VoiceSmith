const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendVerificationEmail(email, verificationUrl) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@voicesmith.app',
    to: email,
    subject: 'Verify your VoiceSmith email',
    html: `
      <h2>Welcome to VoiceSmith!</h2>
      <p>Please verify your email address to unlock your free credits.</p>
      <p>
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
      </p>
      <p>Or copy this link: ${verificationUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't sign up for VoiceSmith, you can safely ignore this email.</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
