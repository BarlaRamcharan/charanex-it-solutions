const nodemailer = require('nodemailer');

async function sendNotification(smtp, { subject, text }) {
    if (!smtp) return;
    const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password }
    });
    await transport.sendMail({
        from: smtp.from,
        to: smtp.to,
        subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200),
        text
    });
}

module.exports = { sendNotification };
