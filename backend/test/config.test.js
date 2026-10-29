const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

const validEnv = {
    PORT: '3000',
    DATABASE_URL: 'postgres://charanex:local-password@localhost:5432/charanex',
    SESSION_SECRET: 'test-session-secret-with-more-than-32-characters',
    FRONTEND_ORIGIN: 'https://example.test'
};

test('configuration validates PostgreSQL URLs, port, session secret, and frontend origin', () => {
    assert.equal(loadConfig(validEnv).databaseUrl, validEnv.DATABASE_URL);
    assert.equal(loadConfig(validEnv).databaseSsl, false);
    assert.throws(() => loadConfig({ ...validEnv, DATABASE_URL: 'configured' }), /valid PostgreSQL connection URL/);
    assert.throws(() => loadConfig({ ...validEnv, SQLITE_PATH: 'data.sqlite' }), /SQLITE_PATH is no longer supported/);
    assert.throws(() => loadConfig({ ...validEnv, SESSION_SECRET: 'short' }), /at least 32 characters/);
    assert.throws(() => loadConfig({ ...validEnv, PORT: '70000' }), /PORT must be an integer/);
    assert.equal(loadConfig(validEnv).frontendOrigin, 'https://example.test');
});

test('production PostgreSQL connections require TLS unless explicitly disabled', () => {
    const productionEnv = { ...validEnv, NODE_ENV: 'production' };
    assert.equal(loadConfig(productionEnv).databaseSsl, true);
    assert.equal(loadConfig({ ...productionEnv, PGSSLMODE: 'disable' }).databaseSsl, false);
    const urlSslConfig = loadConfig({
        ...validEnv,
        DATABASE_URL: `${validEnv.DATABASE_URL}?sslmode=disable`,
        NODE_ENV: 'production'
    });
    assert.equal(urlSslConfig.databaseSsl, true);
    assert.equal(new URL(urlSslConfig.databaseUrl).searchParams.has('sslmode'), false);
    assert.throws(() => loadConfig({ ...validEnv, PGSSLMODE: 'allow' }), /PGSSLMODE must be either require or disable/);
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
