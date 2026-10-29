const session = require('express-session');

class SQLiteSessionStore extends session.Store {
    constructor(database) {
        super();
        this.database = database;
        this.getSession = database.prepare(
            'SELECT sess FROM admin_sessions WHERE sid = ? AND expire > ?'
        );
        this.saveSession = database.prepare(`
            INSERT INTO admin_sessions (sid, sess, expire)
            VALUES (?, ?, ?)
            ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire
        `);
        this.deleteSession = database.prepare('DELETE FROM admin_sessions WHERE sid = ?');
        this.touchSession = database.prepare('UPDATE admin_sessions SET expire = ? WHERE sid = ?');
        this.deleteExpiredSessions = database.prepare('DELETE FROM admin_sessions WHERE expire <= ?');
        this.writesSinceCleanup = 0;
        this.deleteExpiredSessions.run(Date.now());
    }

    get(sessionId, callback) {
        try {
            const row = this.getSession.get(sessionId, Date.now());
            callback(null, row ? JSON.parse(row.sess) : null);
        } catch (error) {
            callback(error);
        }
    }

    set(sessionId, value, callback = () => {}) {
        try {
            const expires = value.cookie && value.cookie.expires
                ? new Date(value.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;
            this.saveSession.run(sessionId, JSON.stringify(value), expires);
            this.cleanupExpiredSessions();
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    touch(sessionId, value, callback = () => {}) {
        try {
            const expires = value.cookie && value.cookie.expires
                ? new Date(value.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;
            this.touchSession.run(expires, sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    destroy(sessionId, callback = () => {}) {
        try {
            this.deleteSession.run(sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    cleanupExpiredSessions() {
        this.writesSinceCleanup += 1;
        if (this.writesSinceCleanup >= 100) {
            this.deleteExpiredSessions.run(Date.now());
            this.writesSinceCleanup = 0;
        }
    }
}

module.exports = { SQLiteSessionStore };
