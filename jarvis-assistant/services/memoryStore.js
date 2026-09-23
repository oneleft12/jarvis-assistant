// П.8 плана: модуль памяти Джарвиса — заметки/факты о пользователе
const fs = require('fs');
const path = require('path');
const { addLog } = require('./stateStore');

const FILE = path.join(__dirname, '..', 'data', 'memory.json');
let notes = [];
let seq = 0;

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ seq, notes }, null, 2));
  } catch (e) {}
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    notes = Array.isArray(d.notes) ? d.notes : [];
    seq = d.seq || notes.reduce((m, n) => Math.max(m, n.id), 0);
  } catch (e) {}
}
load();

function list() {
  return notes.slice();
}

function add(text) {
  text = String(text || '').trim().slice(0, 300);
  if (!text) return null;
  const n = { id: ++seq, text, addedAt: Date.now() };
  notes.push(n);
  if (notes.length > 100) notes.shift(); // не разрастается бесконечно
  addLog(`Память: записано «${text}»`);
  persist();
  return n;
}

function remove(id) {
  const before = notes.length;
  notes = notes.filter((n) => n.id !== id);
  if (notes.length !== before) {
    addLog(`Память: удалена запись #${id}`);
    persist();
    return true;
  }
  return false;
}

module.exports = { list, add, remove };
