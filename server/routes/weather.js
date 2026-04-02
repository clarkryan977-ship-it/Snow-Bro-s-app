const express = require('express');
const https = require('https');
const router = express.Router();

// Cache weather data for 10 minutes to avoid hammering NWS
let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function fetchKFAR() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'forecast.weather.gov',
      path: '/data/obhistory/KFAR.html',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SnowBros/1.0; +https://snowbros.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 12000,
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&deg;/g, '°')
    .replace(/&#176;/g, '°')
    .trim();
}

function parseKFAR(html) {
  // Extract all <tr> rows
  const allTrs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  // Find observation rows: first cell is a date (1-31), second is time HH:MM
  const obsRows = allTrs.filter(tr => {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
    return cells.length >= 10 &&
      /^\d{1,2}$/.test(cells[0]) &&
      /^\d{2}:\d{2}$/.test(cells[1]);
  });

  if (obsRows.length === 0) return null;

  const parseRow = (tr) => {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
    // Fixed column layout (Imperial, from KFAR page):
    // 0:Date  1:Time  2:Wind  3:Vis  4:Weather  5:SkyCond
    // 6:AirTemp  7:Dwpt  8:6hrMax  9:6hrMin
    // 10:Humidity  11:WindChill  12:HeatIndex
    // 13:Altimeter  14:SeaLevel  15:1hrPrecip  16:3hrPrecip  17:6hrPrecip
    //
    // NOTE: 6hrMax/Min columns (8,9) are only populated in the 6-hourly synoptic obs.
    // For hourly obs they are empty strings, so column indices are consistent.

    const get = (i) => (cells[i] || '').trim();

    return {
      date:       get(0),
      time:       get(1),
      wind:       get(2),
      vis:        get(3),
      weather:    get(4),
      skyCond:    get(5),
      airTemp:    get(6),
      dwpt:       get(7),
      maxTemp:    get(8),
      minTemp:    get(9),
      humidity:   get(10),
      windChill:  get(11),
      heatIndex:  get(12),
      altimeter:  get(13),
      seaLevel:   get(14),
      precip1hr:  get(15),
      precip3hr:  get(16),
      precip6hr:  get(17),
    };
  };

  const latest = parseRow(obsRows[0]);

  // Calculate 24-hour liquid-equivalent precipitation for snow events
  let snowPrecip24h = 0;
  let totalPrecip24h = 0;
  const last24 = obsRows.slice(0, 24);
  for (const tr of last24) {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
    const weather = (cells[4] || '').toLowerCase();
    const p1 = parseFloat(cells[15] || '0') || 0;
    totalPrecip24h += p1;
    if (/snow/.test(weather)) {
      snowPrecip24h += p1;
    }
  }

  // Build recent observations (last 6 hours)
  const recent = obsRows.slice(0, 6).map(parseRow);

  // Determine weather icon based on conditions
  const getIcon = (weather) => {
    const w = (weather || '').toLowerCase();
    if (/thunder/.test(w)) return '⛈️';
    if (/freezing rain|ice|sleet/.test(w)) return '🌨️';
    if (/snow/.test(w)) return '❄️';
    if (/fog|mist/.test(w)) return '🌫️';
    if (/rain|drizzle|shower/.test(w)) return '🌧️';
    if (/overcast/.test(w)) return '☁️';
    if (/mostly cloudy|bkn/.test(w)) return '🌥️';
    if (/partly cloudy|sct/.test(w)) return '⛅';
    if (/fair|clear|clr/.test(w)) return '☀️';
    return '🌡️';
  };

  return {
    station: 'KFAR',
    stationName: 'Fargo, Hector International Airport',
    latest: {
      ...latest,
      icon: getIcon(latest.weather),
    },
    recent: recent.map(r => ({ ...r, icon: getIcon(r.weather) })),
    snowPrecip24h: snowPrecip24h > 0 ? snowPrecip24h.toFixed(2) : null,
    totalPrecip24h: totalPrecip24h > 0 ? totalPrecip24h.toFixed(2) : null,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'https://forecast.weather.gov/data/obhistory/KFAR.html',
  };
}

// GET /api/weather/current — returns the latest KFAR observation (public, no auth required)
router.get('/current', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < CACHE_TTL) {
      return res.json({ ...cache.data, cached: true });
    }

    const html = await fetchKFAR();
    const data = parseKFAR(html);

    if (!data) {
      return res.status(503).json({ error: 'Unable to parse weather data from NWS' });
    }

    cache = { data, ts: now };
    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    // Return stale cache if available
    if (cache.data) {
      return res.json({ ...cache.data, cached: true, stale: true });
    }
    res.status(503).json({ error: 'Weather data unavailable', message: err.message });
  }
});

module.exports = router;
