// سرور پیش‌فرض (آخرین سرور موفق) و سرور پیشنهادی (بهترین وضعیت فعلی) دو مفهوم جداگانه‌اند
const FALLBACK = 'http://www.gstatic.com/generate_204';
const score = (st) => st.latency + (st.fails || 0) * 400;
const usable = (st, now = Date.now()) => st && st.status === 'ok' && !(st.badUntil && st.badUntil > now);
function rank(servers, stats) {
  return servers.filter((s) => usable(stats[s.uid])).sort((a, b) => score(stats[a.uid]) - score(stats[b.uid]));
}
const recommended = (servers, stats) => (rank(servers, stats)[0] || {}).uid || null;
function defaultServer(servers, stats, lastGood) {
  const last = servers.find((s) => s.uid === lastGood);
  if (last) { const st = stats[last.uid]; if (!st || st.status !== 'fail' || (st.fails || 0) < 2) return last.uid; }
  return recommended(servers, stats);
}
module.exports = { rank, recommended, defaultServer, FALLBACK };
