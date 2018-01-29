export const now = () => Date.now();
export const seconds = () => Math.floor(now() / 1000);
export const milliseconds = now;
export const microseconds = () => now() * 1000;
export const iso8601 = timestamp => new Date(timestamp).toISOString();
export const parse8601 = x =>
  Date.parse(x.indexOf('+') >= 0 || x.slice(-1) === 'Z' ? x : `${x}Z`);
