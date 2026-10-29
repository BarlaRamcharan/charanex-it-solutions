const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadConfig } = require('../src/config');

const validEnv = {
    PORT: '3000',
    SESSION_SECRET: 'test-session-secret-with-more-than-32-characters',
    FRONTEND_ORIGIN: 'https://example.test'
};

test('configuration selects the default or configured SQLite database path and validates session secret', () => {
    assert.match(loadConfig(validEnv).databasePath, /backend[\\/]data[\\/]charanex\.sqlite$/);
    assert.equal(loadConfig({ ...validEnv, SQLITE_PATH: 'var/app.sqlite' }).databasePath,
        path.resolve(__dirname, '..', 'var', 'app.sqlite'));
    assert.throws(() => loadConfig({ ...validEnv, DATABASE_URL: 'configured' }), /Back up and migrate existing records/);
    assert.throws(() => loadConfig({ ...validEnv, SESSION_SECRET: 'short' }), /at least 32 characters/);
    assert.equal(loadConfig(validEnv).frontendOrigin, 'https://example.test');
});

test('SMTP notifications are disabled unless all settings are present', () => {
    assert.equal(loadConfig(validEnv).smtp, null);
    assert.throws(() => loadConfig({ ...validEnv, SMTP_HOST: 'mail.example.test' }), /Configure all SMTP/);
    const configured = loadConfig({
        ...validEnv,
        SMTP_HOST: 'mail.example.test',
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: 'secret-value',
        NOTIFICATION_FROM: 'website@example.test',
        NOTIFICATION_TO: 'team@example.test'
    });
    assert.equal(configured.smtp.host, 'mail.example.test');
});
