// backend/utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 2525), // Mailtrap default is 2525
  secure: false, // STARTTLS
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: process.env.MAIL_DEBUG === "1", // set MAIL_DEBUG=1 to see SMTP logs
  debug: process.env.MAIL_DEBUG === "1",
 
});


transporter
  .verify()
  .then(() => console.log("[MAILER] SMTP verify: OK"))
  .catch((e) => console.error("[MAILER] SMTP verify FAILED:", e?.message || e));

/**
 * Send email via the shared transporter.
 
 */
async function sendMail(opts) {
  const forcedTo = process.env.MAILTRAP_FORCE_TO && process.env.MAILTRAP_FORCE_TO.trim();
  const to = forcedTo || opts.to;

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || "QuizCraft <no-reply@quizcraft.local>",
    ...opts,
    to,
  });

  console.log(
    "[MAILER] sent",
    JSON.stringify({
      to,
      messageId: info && info.messageId,
      envelope: info && info.envelope,
      accepted: info && info.accepted,
      rejected: info && info.rejected,
    })
  );

  return info;
}

module.exports = { transporter, sendMail };
