const session = require('express-session');

class PostgresSessionStore extends session.Store {
    constructor(pool) {
        super();
        this.pool = pool;
        this.writesSinceCleanup = 0;
    }

    get(sessionId, callback) {
        this.pool.query(
            'SELECT sess FROM admin_sessions WHERE sid = $1 AND expire > CURRENT_TIMESTAMP',
            [sessionId]
        ).then(({ rows }) => callback(null, rows[0] ? rows[0].sess : null))
            .catch(error => callback(error));
    }

    set(sessionId, value, callback = () => {}) {
        const expiration = value.cookie && value.cookie.expires
            ? new Date(value.cookie.expires)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        this.pool.query(
            `INSERT INTO admin_sessions (sid, sess, expire)
             VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
            [sessionId, JSON.stringify(value), expiration]
        ).then(async () => {
            this.writesSinceCleanup += 1;
            if (this.writesSinceCleanup >= 100) {
                await this.pool.query('DELETE FROM admin_sessions WHERE expire <= CURRENT_TIMESTAMP');
                this.writesSinceCleanup = 0;
            }
            callback(null);
        }).catch(error => callback(error));
    }

    touch(sessionId, value, callback = () => {}) {
        const expiration = value.cookie && value.cookie.expires
            ? new Date(value.cookie.expires)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);
        this.pool.query(
            'UPDATE admin_sessions SET expire = $1 WHERE sid = $2',
            [expiration, sessionId]
        ).then(() => callback(null))
            .catch(error => callback(error));
    }

    destroy(sessionId, callback = () => {}) {
        this.pool.query('DELETE FROM admin_sessions WHERE sid = $1', [sessionId])
            .then(() => callback(null))
            .catch(error => callback(error));
    }
}

module.exports = { PostgresSessionStore };
