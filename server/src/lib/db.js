import pg from 'pg';

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Serverless functions can spin up many concurrent instances, each with its own pool --
  // keep this small so we don't blow past the DB's connection limit.
  max: isLocal ? 10 : 3,
});

export const query = (text, params) => pool.query(text, params);
export default pool;
