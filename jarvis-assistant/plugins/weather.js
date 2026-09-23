// Плагин погоды: «погода Алматы», «погода Астана» (Open-Meteo, без ключей)
const { getJson } = require('../services/httpGet');

// Крупные города РК/мира — чтобы не ходить в геокодинг каждый раз
const CITIES = {
  'астана': [51.1694, 71.4491],
  'алматы': [43.238, 76.8895],
  'шымкент': [42.3167, 69.6],
  'караганда': [49.8028, 73.0947],
  'актау': [43.65, 51.2],
  'атырау': [47.1167, 51.9333],
  'кокшетау': [53.2833, 69.4],
  'октябрьское': [50.0833, 72.7],
  'москва': [55.7558, 37.6173],
  'санкт-петербург': [59.9391, 30.3159]
};

const WMO = {
  0: 'ясно', 1: 'малооблачно', 2: 'переменная облачность', 3: 'пасмурно',
  45: 'туман', 48: 'изморозь', 51: 'морось', 53: 'морось', 55: 'сильная морось',
  56: 'ледяная морось', 57: 'ледяная морось', 61: 'дождь', 63: 'дождь',
  65: 'сильный дождь', 66: 'ледяной дождь', 67: 'сильный ледяной дождь',
  71: 'снег', 73: 'снег', 75: 'сильный снег', 77: 'снежинки',
  80: 'ливень', 81: 'сильный ливень', 82: 'очень сильный ливень',
  85: 'снегопад', 86: 'сильный снегопад', 95: 'гроза', 96: 'гроза с градом', 99: 'сильная гроза'
};

async function geo(city) {
  const key = city.toLowerCase();
  if (CITIES[key]) return { name: city, lat: CITIES[key][0], lon: CITIES[key][1] };
  const d = await getJson(
    'https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=' +
      encodeURIComponent(city)
  );
  if (!d.results || !d.results.length) return null;
  const r = d.results[0];
  return { name: r.name + (r.country ? ', ' + r.country : ''), lat: r.latitude, lon: r.longitude };
}

module.exports = {
  name: 'weather',
  commands: [{ cmd: 'погода', desc: 'погода в городе: погода Алматы' }],
  async run(cmd, args) {
    const city = (args || 'Астана').trim() || 'Астана';
    const g = await geo(city);
    if (!g) return `Город «${city}» не найден, сэр. Попробуйте иначе.`;
    const d = await getJson(
      'https://api.open-meteo.com/v1/forecast?latitude=' + g.lat + '&longitude=' + g.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto'
    );
    const c = d.current;
    if (!c) return 'Сервис погоды не ответил, сэр.';
    const w = WMO[c.weather_code] || 'неизвестно';
    return (
      'Погода — ' + g.name + ': ' + Math.round(c.temperature_2m) + '°C' +
      ' (ощущается ' + Math.round(c.apparent_temperature) + '°C), ' + w +
      ', ветер ' + Math.round(c.wind_speed_10m) + ' м/с.'
    );
  }
};
