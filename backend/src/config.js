const path = require('node:path');

function loadConfig(env = process.env) {
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer from 1 to 65535.');
    }

    if (env.DATABASE_URL) {
        throw new Error('DATABASE_URL is still configured. Back up and migrate existing records before switching to SQLite.');
    }

    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must contain at least 32 characters.');
    }

    let frontendOrigin;
    try {
        frontendOrigin = new URL(env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500').origin;
    } catch {
        throw new Error('FRONTEND_ORIGIN must be a valid origin URL.');
    }

    const smtpValues = [
        env.SMTP_HOST,
        env.SMTP_USER,
        env.SMTP_PASSWORD,
        env.NOTIFICATION_FROM,
        env.NOTIFICATION_TO
    ];
    const smtpEnabled = smtpValues.every(Boolean);
    if (smtpValues.some(Boolean) && !smtpEnabled) {
        throw new Error('Configure all SMTP and notification variables, or leave them all blank.');
    }

    const smtpPort = Number(env.SMTP_PORT || 587);
    if (smtpEnabled && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
        throw new Error('SMTP_PORT must be an integer from 1 to 65535.');
    }

    return {
        port,
        databasePath: path.isAbsolute(env.SQLITE_PATH || '')
            ? env.SQLITE_PATH
            : path.resolve(__dirname, '..', env.SQLITE_PATH || 'data/charanex.sqlite'),
        sessionSecret: env.SESSION_SECRET,
        frontendOrigin,
        production: env.NODE_ENV === 'production',
        smtp: smtpEnabled ? {
            host: env.SMTP_HOST,
            port: smtpPort,
            secure: env.SMTP_SECURE === 'true',
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
            from: env.NOTIFICATION_FROM,
            to: env.NOTIFICATION_TO
        } : null
    };
}

module.exports = { loadConfig };
