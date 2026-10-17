const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
let S = null, view = 'home', sortBy = 'ping', prev = [];
const STATUS = { idle: 'متصل نیست', checking: 'در حال بررسی سرورها', connecting: 'در حال اتصال', connected: 'متصل', reconnecting: 'در حال اتصال مجدد', switching: 'در حال تغییر سرور', error: 'خطا در اتصال' };
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function show(v) { if (v !== view) { prev.push(view); } view = v; $$('.view').forEach((e) => e.classList.add('hidden')); $('#v-' + v).classList.remove('hidden'); }
const goBack = () => show(prev.pop() || 'home');
const pingText = (s) => !s ? 'نامشخص' : s.status === 'testing' ? 'در حال بررسی' : s.status === 'ok' ? fa(s.latency) + ' ms' : s.status === 'unverified' ? 'نامشخص' : s.status === 'fail' ? 'غیرقابل‌دسترسی' : 'نامشخص';
const pingCls = (s) => (s && s.status === 'ok' ? 'ok' : s && s.status === 'fail' ? 'fail' : '');
const byId = (id) => S.servers.find((x) => x.id === id);

function render() {
  if (!S) return; document.documentElement.dataset.theme = S.settings.theme;
  if (!S.subscription) { if (view !== 'welcome') { prev = []; show('welcome'); } return; }
  if (view === 'welcome') show('home');
  const c = S.conn, st = c.status, busy = ['connecting', 'reconnecting', 'switching', 'checking'].includes(st);
  $('#statusText').textContent = S.testing && st === 'idle' ? STATUS.checking : STATUS[st];
  $('#statusMsg').textContent = c.message || '';
  $('#statusDot').className = 'dot ' + (st === 'connected' ? 'connected' : busy ? 'busy' : st === 'error' ? 'error' : '');
  const btn = $('#mainBtn'); btn.disabled = st === 'connecting'; btn.className = 'power' + (st === 'connected' ? ' on' : '');
  btn.textContent = st === 'connected' ? 'قطع اتصال' : st === 'connecting' ? 'در حال اتصال' : busy || st === 'error' && c.currentId ? 'قطع اتصال' : 'اتصال';
  const cur = byId(c.currentId) || byId(S.defaultId), rec = byId(S.recommendedId);
  $('#curName').textContent = cur ? cur.name : '—'; $('#curPing').textContent = cur ? pingText(cur) : '—';
  $('#curState').textContent = cur ? (st === 'connected' ? 'متصل' : cur.id === S.defaultId ? 'آخرین سرور انتخابی' : '') : '';
  $('#recName').textContent = rec ? rec.name : S.testing ? 'در حال بررسی…' : 'سرور سالمی پیدا نشد'; $('#recPing').textContent = rec ? pingText(rec) : '—';
  $('#recNote').textContent = rec && cur && rec.id === cur.id ? 'همان سرور فعلی' : '';
  const live = st === 'connected'; $('#down').textContent = live ? speed(c.down) : '—'; $('#up').textContent = live ? speed(c.up) : '—';
  renderList(); renderSettings();
}
function renderList() {
  const arr = [...S.servers]; const key = (s) => (s.status === 'ok' ? s.latency : 1e9);
  if (sortBy === 'ping') arr.sort((a, b) => key(a) - key(b));
  $('#sortBtn').textContent = 'مرتب‌سازی: ' + (sortBy === 'ping' ? 'پینگ' : 'اشتراک');
  const t = S.lastCheckAt ? new Date(S.lastCheckAt).toLocaleTimeString('fa-IR') : 'هنوز بررسی نشده';
  const u = S.subscription ? new Date(S.subscription.updatedAt).toLocaleString('fa-IR') : '';
  $('#meta').textContent = `${fa(S.servers.length)} سرور · آخرین بررسی پینگ: ${t} · آخرین به‌روزرسانی اشتراک: ${u}` + (S.subscription?.error ? ` · خطا: ${S.subscription.error}` : '');
  $('#retest').disabled = S.testing;
  $('#list').innerHTML = '';
  for (const s of arr) {
    const d = document.createElement('div'); d.className = 'srv' + (s.id === S.conn.currentId && S.conn.status === 'connected' ? ' cur' : '');
    const nm = document.createElement('div'); nm.className = 'nm';
    const b = document.createElement('b'); b.textContent = s.name; nm.append(b);
    const sub = document.createElement('small'); sub.className = 'muted';
    if (s.id === S.conn.currentId && S.conn.status === 'connected') sub.append(badge('فعلی'));
    if (s.id === S.recommendedId) sub.append(badge('پیشنهادی'));
    sub.append(s.protocol); nm.append(sub);
    const p = document.createElement('div'); p.className = 'ping ' + pingCls(s); p.textContent = pingText(s);
    const c = document.createElement('button'); c.className = 'btn small'; c.textContent = 'اتصال'; c.onclick = () => window.nova.connect(s.id);
    d.append(nm, p, c); $('#list').append(d);
  }
}
function badge(t) { const e = document.createElement('span'); e.className = 'badge'; e.textContent = t; return e; }
function renderSettings() {
  $$('[data-k]').forEach((el) => { const v = S.settings[el.dataset.k]; if (document.activeElement === el) return; el.type === 'checkbox' ? (el.checked = v) : (el.value = v); });
  $('#ver').textContent = 'v' + S.version;
}
const speed = (b) => (b == null ? '—' : b >= 1048576 ? fa((b / 1048576).toFixed(1)) + ' MB/s' : fa(Math.round(b / 1024)) + ' KB/s');
setInterval(() => { const s = S && S.conn.since; $('#dur').textContent = s && S.conn.status === 'connected' ? new Date(Date.now() - s).toISOString().substr(11, 8) : '—'; }, 1000);

async function addSub() {
  const url = $('#subUrl').value.trim(); $('#welcomeErr').textContent = '';
  const b = $('#addBtn'); b.disabled = true; b.textContent = 'در حال دریافت…';
  const r = await window.nova.addSubscription(url); b.disabled = false; b.textContent = 'افزودن و دریافت سرورها';
  if (!r.ok) $('#welcomeErr').textContent = r.error; else { $('#subUrl').value = ''; if (r.unsupported) toast(fa(r.unsupported) + ' مورد پشتیبانی‌نشده نادیده گرفته شد'); }
}
$('#addBtn').onclick = addSub; $('#subUrl').onkeydown = (e) => e.key === 'Enter' && addSub();
$('#mainBtn').onclick = () => { const st = S.conn.status; (st === 'idle' || (st === 'error' && !S.conn.currentId)) ? window.nova.connect() : st === 'error' ? window.nova.connect(S.conn.currentId) : window.nova.disconnect(); };
$('#toServers').onclick = () => show('servers'); $('#toSettings').onclick = () => show('settings'); $$('[data-back]').forEach((b) => (b.onclick = goBack));
$('#retest').onclick = () => window.nova.testAll();
$('#sortBtn').onclick = () => { sortBy = sortBy === 'ping' ? 'sub' : 'ping'; renderList(); };
$('#refreshSub').onclick = async () => { const r = await window.nova.refreshSubscription(); toast(r.ok ? 'اشتراک به‌روزرسانی شد' : r.error); };
$$('[data-k]').forEach((el) => (el.onchange = () => { const v = el.type === 'checkbox' ? el.checked : el.dataset.num !== undefined ? +el.value : el.value; window.nova.setSettings({ [el.dataset.k]: v }); }));
$('#showLogs').onclick = async () => { const l = $('#logs'); l.textContent = (await window.nova.getLogs()) || 'لاگی ثبت نشده است.'; l.classList.toggle('hidden'); };
$('#rmSub').onclick = async () => { if (confirm('اشتراک و سرورهای ذخیره‌شده حذف شوند؟')) { await window.nova.removeSubscription(); } };
$('#quitBtn').onclick = () => window.nova.quit();
window.nova.onState((s) => { S = s; render(); });
window.nova.getState().then((s) => { S = s; show(s.subscription ? 'home' : 'welcome'); prev = []; render(); });
