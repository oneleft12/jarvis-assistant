// П.14 плана: таблица рекордов игр (персистентная)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'scores.json');
const CAP = 300; // максимум записей на игру

let scores = { runner: [], memory: [], snake: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (raw && typeof raw === 'object') {
        Object.keys(scores).forEach((g) => {
          if (Array.isArray(raw[g])) scores[g] = raw[g];
        });
      }
    }
  } catch (e) {
    console.log('Таблица рекордов не читается, начинаем заново.');
  }
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(scores, null, 2));
  } catch (e) {
    console.log('Ошибка записи рекордов:', e.message);
  }
}
load();

// Добавить рекорд → отсортированный топ
function add(game, score, name) {
  if (!scores[game]) scores[game] = [];
  scores[game].push({
    score: Math.max(0, Math.round(Number(score) || 0)),
    name: String(name || 'Аноним').slice(0, 20),
    at: Date.now()
  });
  scores[game].sort((a, b) => b.score - a.score);
  if (scores[game].length > CAP) scores[game] = scores[game].slice(0, CAP);
  save();
}

// Топ-N для игры
function top(game, n) {
  const list = scores[game] || [];
  return list.slice(0, n || 10);
}

module.exports = { add, top };
