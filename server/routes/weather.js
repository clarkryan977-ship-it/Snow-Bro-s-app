const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

// Per-station cache: { [stationCode]: { data, ts } }
const stationCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Helper: get the configured weather station from DB ─────────────────────
async function getConfiguredStation(db) {
  try {
    const { rows } = await db.query(
      `SELECT key, value FROM app_settings WHERE key IN ('weather_station', 'weather_station_name')`
    );
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return {
      code: (map.weather_station || 'KFAR').toUpperCase().trim(),
      name: map.weather_station_name || '',
    };
  } catch (_) {
    return { code: 'KFAR', name: 'Fargo, ND' };
  }
}

// ── Helper: fetch NWS observation history page for a station ───────────────
function fetchStationHTML(stationCode) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'forecast.weather.gov',
      path: `/data/obhistory/${stationCode.toUpperCase()}.html`,
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
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseStationHTML(html, stationCode, stationName) {
  const allTrs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  const obsRows = allTrs.filter(tr => {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
    return cells.length >= 10 &&
      /^\d{1,2}$/.test(cells[0]) &&
      /^\d{2}:\d{2}$/.test(cells[1]);
  });

  if (obsRows.length === 0) return null;

  const parseRow = (tr) => {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
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

  let snowPrecip24h = 0;
  let totalPrecip24h = 0;
  const last24 = obsRows.slice(0, 24);
  for (const tr of last24) {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(td => stripTags(td));
    const weather = (cells[4] || '').toLowerCase();
    const p1 = parseFloat(cells[15] || '0') || 0;
    totalPrecip24h += p1;
    if (/snow/.test(weather)) snowPrecip24h += p1;
  }

  const recent = obsRows.slice(0, 6).map(parseRow);

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

  const code = stationCode.toUpperCase();
  return {
    station: code,
    stationName: stationName || code,
    latest: { ...latest, icon: getIcon(latest.weather) },
    recent: recent.map(r => ({ ...r, icon: getIcon(r.weather) })),
    snowPrecip24h: snowPrecip24h > 0 ? snowPrecip24h.toFixed(2) : null,
    totalPrecip24h: totalPrecip24h > 0 ? totalPrecip24h.toFixed(2) : null,
    fetchedAt: new Date().toISOString(),
    sourceUrl: `https://forecast.weather.gov/data/obhistory/${code}.html`,
  };
}

// ── GET /api/weather/current — returns latest observation for configured station ──
router.get('/current', async (req, res) => {
  try {
    const { code, name } = await getConfiguredStation(req.db);
    const now = Date.now();
    const cached = stationCache[code];
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const html = await fetchStationHTML(code);
    const data = parseStationHTML(html, code, name);

    if (!data) {
      return res.status(503).json({ error: 'Unable to parse weather data from NWS' });
    }

    stationCache[code] = { data, ts: now };
    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    // Return stale cache if available
    const { code } = await getConfiguredStation(req.db).catch(() => ({ code: 'KFAR' }));
    const cached = stationCache[code];
    if (cached) return res.json({ ...cached.data, cached: true, stale: true });
    res.status(503).json({ error: 'Weather data unavailable', message: err.message });
  }
});

// ── GET /api/weather/lookup-station?q=<city or zip> ────────────────────────
// Uses Nominatim to geocode the query, then NWS API to find nearest observation stations.
// Returns an array of { stationCode, stationName, distance } candidates.
router.get('/lookup-station', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  try {
    // Step 1: Geocode city/zip via Nominatim
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
    const geoData = await new Promise((resolve, reject) => {
      https.get(nominatimUrl, {
        headers: { 'User-Agent': 'SnowBros-WeatherLookup/1.0 (contact@snowbros.app)' },
        timeout: 8000,
      }, (geoRes) => {
        let body = '';
        geoRes.on('data', d => body += d);
        geoRes.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Failed to parse geocode response')); }
        });
      }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Geocode timeout')); });
    });

    if (!geoData || geoData.length === 0) {
      return res.status(404).json({ error: `No location found for "${q}". Try a different city name or zip code.` });
    }

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);
    const displayName = geoData[0].display_name || q;

    // Step 2: Find nearest NWS observation stations via api.weather.gov
    const nwsPointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const pointData = await new Promise((resolve, reject) => {
      https.get(nwsPointUrl, {
        headers: { 'User-Agent': 'SnowBros-WeatherLookup/1.0 (contact@snowbros.app)', 'Accept': 'application/geo+json' },
        timeout: 10000,
      }, (r) => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Failed to parse NWS point response')); }
        });
      }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('NWS API timeout')); });
    });

    // Extract the observation stations URL from the NWS point response
    const stationsUrl = pointData?.properties?.observationStations;
    if (!stationsUrl) {
      return res.status(502).json({ error: 'NWS API did not return observation stations for this location. Try a different city.' });
    }

    // Step 3: Fetch the list of nearby observation stations
    const stationsData = await new Promise((resolve, reject) => {
      https.get(stationsUrl, {
        headers: { 'User-Agent': 'SnowBros-WeatherLookup/1.0 (contact@snowbros.app)', 'Accept': 'application/geo+json' },
        timeout: 10000,
      }, (r) => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Failed to parse stations response')); }
        });
      }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Stations fetch timeout')); });
    });

    const features = stationsData?.features || [];
    if (features.length === 0) {
      return res.status(404).json({ error: 'No NWS observation stations found near this location.' });
    }

    // Return top 5 nearest stations
    const stations = features.slice(0, 5).map(f => {
      const props = f.properties || {};
      const stationId = props.stationIdentifier || '';
      const stationName = props.name || stationId;
      const [sLon, sLat] = f.geometry?.coordinates || [0, 0];
      // Rough distance in miles
      const dLat = (sLat - lat) * 69;
      const dLon = (sLon - lon) * 69 * Math.cos(lat * Math.PI / 180);
      const distMiles = Math.round(Math.sqrt(dLat * dLat + dLon * dLon));
      return { stationCode: stationId, stationName, distMiles };
    });

    res.json({
      query: q,
      geocodedAs: displayName,
      lat, lon,
      stations,
    });
  } catch (err) {
    console.error('Station lookup error:', err.message);
    res.status(503).json({ error: 'Station lookup failed: ' + err.message });
  }
});

// ── GET /api/weather/validate-station?code=KFAR ────────────────────────────
// Checks if a station code is valid by attempting to fetch its observation page.
router.get('/validate-station', async (req, res) => {
  const code = (req.query.code || '').toUpperCase().trim();
  if (!code || !/^K[A-Z0-9]{3}$/.test(code)) {
    return res.status(400).json({ valid: false, error: 'Station codes must be 4 characters starting with K (e.g. KFAR, KMSP).' });
  }
  try {
    const html = await fetchStationHTML(code);
    // Check if the page has observation rows
    const hasObs = /<tr[^>]*>[\s\S]*?\d{2}:\d{2}[\s\S]*?<\/tr>/i.test(html);
    if (!hasObs) {
      return res.json({ valid: false, error: `No observation data found for station ${code}. Check the code and try again.` });
    }
    res.json({ valid: true, stationCode: code });
  } catch (err) {
    res.json({ valid: false, error: 'Could not reach NWS for station ' + code });
  }
});

module.exports = router;
