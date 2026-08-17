import 'dotenv/config';
import app from '../server/src/app.js';

// Express apps already implement Node's (req, res) request-listener signature,
// which is exactly what Vercel's Node.js functions expect -- no Lambda-style
// event/context wrapper needed (serverless-http assumes AWS Lambda's shape and
// silently hangs when Vercel invokes it the native way instead).
export default app;
