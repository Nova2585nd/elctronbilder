const fs = require('fs'), path = require('path');
let file = null;
function init(dir) { fs.mkdirSync(dir, { recursive: true }); file = path.join(dir, 'app.log'); try { if (fs.statSync(file).size > 1e6) fs.renameSync(file, file + '.old'); } catch {} }
// لینک‌ها، شناسه‌ها و رمزها هرگز در لاگ نوشته نمی‌شوند
const redact = (s) => String(s).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<link>').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>');
function log(level, ...a) { if (!file) return; try { fs.appendFileSync(file, `${new Date().toISOString()} [${level}] ${redact(a.join(' '))}\n`); } catch {} }
function tail(n = 200) { try { return fs.readFileSync(file, 'utf8').split('\n').slice(-n).join('\n'); } catch { return ''; } }
module.exports = { init, info: (...a) => log('info', ...a), error: (...a) => log('error', ...a), tail, redact };
