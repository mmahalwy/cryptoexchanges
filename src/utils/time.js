export const now = () => Date.now();
export const seconds = () => Math.floor(now() / 1000);
export const milliseconds = now;
export const microseconds = () => now() * 1000;
export const iso8601 = timestamp => new Date(timestamp).toISOString();
export const parse8601 = x => Date.parse(x.indexOf('+') >= 0 || x.slice(-1) === 'Z' ? x : `${x}Z`);

export const ymdhms = (timestamp, infix = ' ') => {
  const date = new Date(timestamp);
  const Y = date.getUTCFullYear();
  let m = date.getUTCMonth() + 1;
  let d = date.getUTCDate();
  let H = date.getUTCHours();
  let M = date.getUTCMinutes();
  let S = date.getUTCSeconds();
  m = m < 10 ? `0${m}` : m;
  d = d < 10 ? `0${d}` : d;
  H = H < 10 ? `0${H}` : H;
  M = M < 10 ? `0${M}` : M;
  S = S < 10 ? `0${S}` : S;

  return `${Y}-${m}-${d}${infix}${H}:${M}:${S}`;
};
