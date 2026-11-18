// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json)
// and handled by the existing Express app. The app does not call listen() on Vercel.
import app from '../server/index.js';

export default app;
