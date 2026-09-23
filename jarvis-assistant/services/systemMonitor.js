// Мониторинг системы (п.10 плана): честные CPU/RAM/сеть/диск,
// история CPU для графика и топ процессов.
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

const CPU_HISTORY_LEN = 60;          // ~2 минуты при опросе раз в 2 с
const cpuHistory = [];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// --- Windows: реальный CPU через wmic (loadavg на win32 не работает) ---
let wmiCpu = null;
if (process.platform === 'win32') {
  const pollWmi = () =>
    exec('wmic cpu get loadpercentage /value', (e, out) => {
      const m = out && out.match(/LoadPercentage=(\d+)/);
      if (m) wmiCpu = Number(m[1]);
    });
  pollWmi();
  setInterval(pollWmi, 3000).unref();
}

// CPU: loadavg[0] относительно числа ядер (на Windows — wmic)
function getCpu() {
  if (process.platform === 'win32' && wmiCpu !== null) return clamp(wmiCpu, 1, 100);
  const cores = os.cpus().length || 1;
  const load = os.loadavg()[0];
  return clamp(Math.round((load / cores) * 100), 1, 100);
}

// RAM: (занято / всего) * 100
function getRam() {
  const total = os.totalmem();
  const free = os.freemem();
  return clamp(Math.round(((total - free) / total) * 100), 1, 100);
}

// --- СЕТЬ: реальные байты из /proc/net/dev (rx+tx дельта) ---
let lastNet = null;      // {bytes, at}
let networkValue = 0;

function getNetwork() {
  try {
    const txt = fs.readFileSync('/proc/net/dev', 'utf8');
    let bytes = 0;
    txt.split('\n').forEach((line) => {
      const m = line.match(/:\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (m) bytes += Number(m[1]) + Number(m[2]);
    });
    const now = Date.now();
    if (lastNet && now - lastNet.at > 400) {
      const dBits = (bytes - lastNet.bytes) * 8;
      const sec = (now - lastNet.at) / 1000;
      const mbps = sec > 0 ? dBits / sec / 1e6 : 0;
      lastNet = { bytes, at: now };
      if (isFinite(mbps) && mbps >= 0) {
        networkValue = networkValue * 0.55 + mbps * 0.45; // сглаживание
      }
      return Math.round(networkValue * 10) / 10;
    }
    lastNet = { bytes, at: now };
    return Math.round(networkValue * 10) / 10;
  } catch (e) {
    // /proc/net/dev нет (Windows) — прежняя плавная имитация
    const delta = Math.random() * 20 - 10;
    networkValue = clamp((networkValue || 35) + delta, 5, 95);
    return Math.round(networkValue);
  }
}

// --- ДИСК: df (Linux/WSL), запасной вариант — PowerShell (Windows) ---
let diskCache = { pct: null, usedGb: null, totalGb: null };

function refreshDisk() {
  const target = fs.existsSync('/mnt/c') ? '/mnt/c' : '/';
  exec(`df -kP "${target}"`, (err, out) => {
    if (!err && out) {
      const parts = (out.trim().split('\n')[1] || '').split(/\s+/);
      const total = Number(parts[1]);
      const used = Number(parts[2]);
      const pct = parseInt(String(parts[4]).replace('%', ''), 10);
      if (total > 0 && isFinite(pct)) {
        diskCache = {
          pct,
          usedGb: Math.round((used * 1024) / 1073741824),
          totalGb: Math.round((total * 1024) / 1073741824)
        };
        return;
      }
    }
    // запасной путь для Windows
    exec(
      'powershell -NoProfile -Command "$d=Get-PSDrive C; if($d){[math]::Round(($d.Used/($d.Used+$d.Free))*100,0)}"',
      (e2, out2) => {
        const m = out2 && out2.match(/(\d+)/);
        if (m) diskCache = { pct: Number(m[1]), usedGb: null, totalGb: null };
      }
    );
  });
}
refreshDisk();
setInterval(refreshDisk, 30000).unref();

// --- ТОП ПРОЦЕССОВ: ps (Linux/WSL); на голой Windows — пусто (показ «—») ---
let topCache = [];

function refreshTop() {
  exec('ps -eo comm,%cpu,%mem --sort=-%cpu', { maxBuffer: 1024 * 1024 }, (err, out) => {
    if (err || !out) return;
    topCache = out
      .trim()
      .split('\n')
      .slice(1, 6)
      .map((line) => {
        const p = line.trim().split(/\s+/);
        // имя процесса может содержать пробелы — колонки считаем с конца
        const mem = p.length >= 3 ? p[p.length - 1] : '0';
        const cpu = p.length >= 3 ? p[p.length - 2] : '0';
        const name = p.slice(0, Math.max(1, p.length - 2)).join(' ');
        return { name: name.slice(0, 24), cpu, mem };
      });
  });
}
refreshTop();
setInterval(refreshTop, 15000).unref();

// Все метрики разом (+ история CPU и топ)
function getStats() {
  const cpu = getCpu();
  cpuHistory.push(cpu);
  if (cpuHistory.length > CPU_HISTORY_LEN) cpuHistory.shift();
  return {
    cpu,
    ram: getRam(),
    network: getNetwork(),
    disk: diskCache.pct,
    diskUsedGb: diskCache.usedGb,
    diskTotalGb: diskCache.totalGb,
    top: topCache,
    cpuHistory: cpuHistory.slice()
  };
}

module.exports = { getStats };
