// П.12 плана: система плагинов.
// Контракт плагина (plugins/*.js):
//   module.exports = {
//     name: 'weather',
//     commands: [{ cmd: 'погода', desc: 'погода в городе' }],
//     async run(cmd, args) { return 'текст ответа'; }
//   }
const fs = require('fs');
const path = require('path');
const { addLog } = require('./stateStore');

const DIR = path.join(__dirname, '..', 'plugins');
let plugins = [];

function load() {
  plugins = [];
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
  } catch (e) {
    return;
  }
  files.forEach((f) => {
    try {
      const p = require(path.join(DIR, f));
      if (p && Array.isArray(p.commands) && p.commands.length && typeof p.run === 'function') {
        plugins.push(p);
        addLog(`Плагин загружен: ${p.name || f}`);
      }
    } catch (e) {
      addLog(`Плагин ${f} не загрузился: ${e.message}`);
    }
  });
}
load();

// Реестр команд для справки: [{cmd, desc, plugin}]
function registry() {
  const out = [];
  plugins.forEach((p) =>
    p.commands.forEach((c) =>
      out.push({ cmd: c.cmd, desc: c.desc || '', plugin: p.name || '?' })
    )
  );
  return out;
}

// Найти плагин по первому слову команды
function find(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const first = t.split(/\s+/)[0].toLowerCase();
  for (const p of plugins) {
    for (const c of p.commands) {
      if (String(c.cmd).toLowerCase() === first) {
        const args = t.slice(String(c.cmd).length).trim();
        return { plugin: p, cmd: c.cmd, args };
      }
    }
  }
  return null;
}

// Выполнить; null — это не плагинная команда
async function execute(text) {
  const m = find(text);
  if (!m) return null;
  try {
    const out = await m.plugin.run(m.cmd, m.args);
    if (out && typeof out === 'object' && out.reply) return out.reply;
    return typeof out === 'string' ? out : '';
  } catch (e) {
    return `Плагин «${m.plugin.name}» ошибся: ${e.message}`;
  }
}

module.exports = { registry, execute, load };
