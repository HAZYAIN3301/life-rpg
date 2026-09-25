// Shared settings for the synthetic QA scripts (not part of the unit test suite).
// QA_BROWSER=chromium|webkit|firefox  QA_BASE=http://127.0.0.1:51900  QA_ACCOUNTS=<dir with *.json cookies>
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
export const BASE = (process.env.QA_BASE || 'http://127.0.0.1:51900').replace(/\/$/, '');
export const HOST = new URL(BASE).hostname;
export const ACCOUNTS = process.env.QA_ACCOUNTS || path.join(process.cwd(), 'qa-accounts');
export const BROWSER = process.env.QA_BROWSER || 'chromium';
export const accountFile = (name) => path.join(ACCOUNTS, `${name}.json`);
export function launch(options = {}) { return pw[BROWSER].launch(options); }
export { pw };
