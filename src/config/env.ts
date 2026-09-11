export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const APP_ENV = import.meta.env.VITE_ENV || import.meta.env.MODE || 'development';
export const ENABLE_DEMO_LOGIN = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';
export const DASHBOARD_REPORT_URL = import.meta.env.VITE_DASHBOARD_REPORT_URL || 'about:blank';

const pollSeconds = Number(import.meta.env.VITE_NOTIFICATIONS_POLL_INTERVAL_SECONDS || 5);
export const NOTIFICATIONS_POLL_INTERVAL_MS = Math.max(1, pollSeconds) * 1000;
