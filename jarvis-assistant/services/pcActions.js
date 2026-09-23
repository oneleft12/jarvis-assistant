// П.13 плана: реальные действия с ПК (Windows через WSL-interop или нативно)
const { exec } = require('child_process');
const fs = require('fs');
const { addLog } = require('./stateStore');

// где крутимся: WSL (интероп с Windows), чистый Windows или Linux
const IS_WIN = process.platform === 'win32';
let IS_WSL = false;
try { IS_WSL = /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch (e) {}

// В WSL бинарники Windows не в PATH — резолвим полными путями
const SYS32 = !IS_WIN && fs.existsSync('/mnt/c/Windows/System32')
  ? '/mnt/c/Windows/System32'
  : '';
const HAS_WIN = IS_WIN || !!SYS32;

function winExe(name) {
  if (IS_WIN) return name;
  if (!SYS32) return name;
  if (name === 'powershell.exe') return SYS32 + '/WindowsPowerShell/v1.0/powershell.exe';
  return SYS32 + '/' + name;
}

// PowerShell через -EncodedCommand (UTF-16LE base64): нет проблем с кавычками
function psEnc(cmdText) {
  const exe = winExe('powershell.exe');
  const b64 = Buffer.from(cmdText, 'utf16le').toString('base64');
  return exe + ' -NoProfile -EncodedCommand ' + b64;
}

// скрипт: нажатие/отпускание виртуальной клавиши (громкость и т.п.)
function psKey(vkHex) {
  return (
    'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);\' -Name Key -Namespace Win;' +
    '[Win.Key]::keybd_event(' + vkHex + ',0,0,[UIntPtr]::Zero);' +
    '[Win.Key]::keybd_event(' + vkHex + ',0,2,[UIntPtr]::Zero);'
  );
}

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 8000 }, (err) => resolve(!err));
  });
}

// Реестр действий: msg — ответ Джарвиса, needWin — требует Windows
const ACTIONS = {
  open_browser: {
    msg: 'Открываю браузер, сэр.',
    run: () => run(IS_WIN ? 'start "" https://www.google.com' : winExe('cmd.exe') + ' /c start "" https://www.google.com')
  },
  screenshot: { msg: 'Скриншот выполнен, сэр (демо-режим).', demo: true },
  launch_game: { msg: 'Игра запущена. Удачи, сэр!', demo: true },
  lock: {
    msg: 'Блокирую рабочий стол, сэр.',
    needWin: true,
    run: () => run(winExe('rundll32.exe') + ' user32.dll,LockWorkStation')
  },
  volume_up: {
    msg: 'Громкость увеличена.',
    needWin: true,
    run: () => run(psEnc(psKey('0xAF'))) // VK_VOLUME_UP
  },
  volume_down: {
    msg: 'Громкость уменьшена.',
    needWin: true,
    run: () => run(psEnc(psKey('0xAE'))) // VK_VOLUME_DOWN
  },
  mute: {
    msg: 'Звук переключён (MUTE).',
    needWin: true,
    run: () => run(psEnc(psKey('0xAD'))) // VK_VOLUME_MUTE
  },
  explorer: {
    msg: 'Открываю проводник, сэр.',
    needWin: true,
    // explorer.exe живёт в C:\Windows (не в System32); код возврата 1 допустим
    run: () =>
      new Promise((resolve) => {
        const p = IS_WIN
          ? 'explorer.exe'
          : (SYS32 ? SYS32.replace(/\/System32$/, '') + '/explorer.exe' : 'explorer.exe');
        exec(p, { timeout: 8000 }, () => resolve(true));
      })
  },
  sleep_pc: {
    msg: 'Перевожу компьютер в спящий режим, сэр.',
    needWin: true,
    run: () => run(winExe('rundll32.exe') + ' powrprof.dll,SetSuspendState 0,1,0')
  }
};

// Выполнить действие → { status: 'ok'|'error', message }
async function execute(action) {
  if (action === 'shutdown') {
    addLog('Команда: shutdown — запрещена');
    return { status: 'error', message: 'Эта команда отключена соображениями безопасности.' };
  }
  const a = ACTIONS[action];
  if (!a) {
    addLog(`Команда: неизвестное действие "${action}"`);
    return { status: 'error', message: 'Неизвестная команда.' };
  }
  addLog('Команда ПК: ' + action);
  if (a.demo) return { status: 'ok', message: a.msg };
  if (a.needWin && !HAS_WIN) {
    return { status: 'error', message: 'Команда доступна только на Windows (сейчас не Windows-окружение).' };
  }
  try {
    const ok = await a.run();
    return ok
      ? { status: 'ok', message: a.msg }
      : { status: 'error', message: 'Не удалось выполнить: ' + action + '.' };
  } catch (e) {
    return { status: 'error', message: 'Ошибка: ' + e.message };
  }
}

module.exports = { execute, ACTIONS };
