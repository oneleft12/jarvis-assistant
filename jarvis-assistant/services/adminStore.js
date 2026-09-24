// Хранилище админ-настроек: data/admin.json (в .gitignore — PIN-ы не попадут в репозиторий)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'admin.json');

const DEFAULTS = {
  sitePin: process.env.JARVIS_PIN || '1212',          // PIN сайта — для всех посетителей
  adminPin: process.env.JARVIS_ADMIN_PIN || '9111',   // админ-PIN — вход в панель
  siteEnabled: true,                                  // сайт включён?
  maintenanceMsg: 'Сайт временно отключён администратором. Проверьте позже.',
  guestsAllowed: true,                                // пускать гостей через домен?
  blockedIPs: []                                      // заблокированные IP (бан из панели)
};

let cfg = Object.assign({}, DEFAULTS);

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw && typeof raw === 'object') cfg = Object.assign({}, DEFAULTS, raw);
  } catch (e) { /* файла нет — работаем на дефолтах */ }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  } catch (e) { /* нет прав — настройки живут в памяти до рестарта */ }
}

load();

// Живые админ-токены (выдаются при входе, сгорают при перезапуске сервера)
const tokens = new Set();

module.exports = {
  tokens,
  get: () => cfg,
  set(patch) { Object.assign(cfg, patch); save(); return cfg; }
};
