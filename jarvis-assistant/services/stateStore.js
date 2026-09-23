// Хранилище состояния и общий журнал (последние 50 записей)
const state = {
  theme: 'cyan',   // текущая тема
  rain: true,      // кибер-дождь вкл/выкл
  logs: []         // журнал событий
};
const MAX_LOGS = 50;

// Текущее время в формате HH:MM:SS
function now() {
  return new Date().toTimeString().slice(0, 8);
}

// Добавить запись в журнал, хранить не больше 50
function addLog(text) {
  state.logs.push(`${now()} — ${text}`);
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
}

// Текущее состояние
function getState() {
  return state;
}

// Человекочитаемый аптайм
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h} ч ${m} мин ${s} сек`;
}

module.exports = { state, addLog, getState, formatUptime };
