const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('production PostgreSQL connections require TLS and a readable root CA certificate', t => {
    const productionEnv = { ...validEnv, NODE_ENV: 'production' };
    assert.throws(() => loadConfig(productionEnv), /PGSSLROOTCERT must point to the Supabase root CA/);
    assert.throws(() => loadConfig({
        ...productionEnv,
        PGSSLMODE: 'disable',
        PGSSLROOTCERT: 'root-ca.pem'
    }), /Production PostgreSQL connections must use TLS/);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'charanex-postgres-ca-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const caPath = path.join(directory, 'root-ca.pem');
    const ca = '-----BEGIN CERTIFICATE-----\ntrusted-root\n-----END CERTIFICATE-----';
    fs.writeFileSync(caPath, ca);
    const productionConfig = loadConfig({
        ...productionEnv,
        PGSSLROOTCERT: caPath
    });
    assert.equal(productionConfig.databaseSsl, true);
    assert.equal(productionConfig.databaseCa, ca);
    assert.throws(() => loadConfig({
        ...productionEnv,
        PGSSLROOTCERT: path.join(directory, 'missing.pem')
    }), /PGSSLROOTCERT must point to a readable/);

    const urlSslConfig = loadConfig({
        ...validEnv,
        DATABASE_URL: `${validEnv.DATABASE_URL}?sslmode=require`,
        NODE_ENV: 'production',
        PGSSLROOTCERT: caPath
    });
    assert.equal(urlSslConfig.databaseSsl, true);
    assert.equal(urlSslConfig.databaseCa, ca);
    assert.equal(new URL(urlSslConfig.databaseUrl).searchParams.has('sslmode'), false);
    assert.throws(() => loadConfig({
        ...validEnv,
        PGSSLMODE: 'allow',
        PGSSLROOTCERT: caPath
    }), /PGSSLMODE must be either require or disable/);
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
