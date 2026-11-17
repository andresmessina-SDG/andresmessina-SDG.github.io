// Evening light: after sunset where the reader is, the vellum warms as if read by a candle.
// Where is guessed from the browser's time zone alone (nothing is asked, sent or kept): a
// city for the zones most readers come from, else a longitude from the zone's offset.
// Sets --dusk on the page, from 0 by day to 1 by night, and looks again every five minutes.
// ?evening (or ?evening=0.5) on the address shows it at any hour.
(() => {
  const P = {
    'America/New_York': [40.7, -74], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105],
    'America/Phoenix': [33.4, -112], 'America/Los_Angeles': [34, -118.2], 'America/Anchorage': [61.2, -149.9],
    'Pacific/Honolulu': [21.3, -157.9], 'America/Toronto': [43.7, -79.4], 'America/Vancouver': [49.3, -123.1],
    'America/Mexico_City': [19.4, -99.1], 'America/Guatemala': [14.6, -90.5], 'America/El_Salvador': [13.7, -89.2],
    'America/Tegucigalpa': [14.1, -87.2], 'America/Managua': [12.1, -86.3], 'America/Costa_Rica': [9.9, -84.1],
    'America/Panama': [9, -79.5], 'America/Havana': [23.1, -82.4], 'America/Santo_Domingo': [18.5, -69.9],
    'America/Puerto_Rico': [18.4, -66.1], 'America/Bogota': [4.6, -74.1], 'America/Caracas': [10.5, -66.9],
    'America/Guayaquil': [-2.2, -79.9], 'America/Lima': [-12, -77], 'America/La_Paz': [-16.5, -68.1],
    'America/Santiago': [-33.4, -70.6], 'America/Asuncion': [-25.3, -57.6], 'America/Montevideo': [-34.9, -56.2],
    'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Buenos_Aires': [-34.6, -58.4],
    'America/Argentina/Cordoba': [-31.4, -64.2], 'America/Argentina/Mendoza': [-32.9, -68.8],
    'America/Sao_Paulo': [-23.5, -46.6], 'Europe/Madrid': [40.4, -3.7], 'Atlantic/Canary': [28.1, -15.4],
    'Europe/Lisbon': [38.7, -9.1], 'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3],
    'Europe/Paris': [48.9, 2.35], 'Europe/Amsterdam': [52.4, 4.9], 'Europe/Brussels': [50.8, 4.4],
    'Europe/Berlin': [52.5, 13.4], 'Europe/Zurich': [47.4, 8.5], 'Europe/Rome': [41.9, 12.5],
    'Europe/Stockholm': [59.3, 18.1], 'Europe/Warsaw': [52.2, 21], 'Europe/Kyiv': [50.5, 30.5],
    'Europe/Moscow': [55.8, 37.6], 'Africa/Johannesburg': [-26.2, 28], 'Africa/Lagos': [6.5, 3.4],
    'Africa/Nairobi': [-1.3, 36.8], 'Asia/Seoul': [37.6, 127], 'Asia/Tokyo': [35.7, 139.7],
    'Asia/Shanghai': [31.2, 121.5], 'Asia/Singapore': [1.3, 103.8], 'Asia/Manila': [14.6, 121],
    'Asia/Kolkata': [22.6, 88.4], 'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145],
    'Australia/Brisbane': [-27.5, 153], 'Australia/Perth': [-32, 115.9], 'Pacific/Auckland': [-36.8, 174.8],
  };
  const root = document.documentElement;
  const ask = new URLSearchParams(location.search).get('evening');
  const rad = Math.PI / 180;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  const now0 = new Date();
  const off = (m) => -new Date(now0.getFullYear(), m, 1).getTimezoneOffset();
  const [lat, lon] = P[zone] || [
    /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Noumea)|^America\/(Argentina|Santiago|Punta_Arenas|Montevideo|Asuncion|Sao_Paulo|La_Paz|Lima)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/.test(zone) ? -30 : 40,
    Math.min(off(0), off(6)) / 4,   // standard time: an hour of offset for each 15 degrees
  ];

  function level(now) {
    if (ask !== null) return ask === '' ? 1 : clamp(Number(ask) || 0);
    const day0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const n = (day0 - Date.UTC(now.getFullYear(), 0, 1)) / 864e5 + 1;
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365) * rad;
    const B = 2 * Math.PI * (n - 81) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // minutes
    const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
    if (cosH > 1) return 1;     // the sun does not rise today
    if (cosH < -1) return 0;    // nor set
    const noon = day0 + (720 - 4 * lon - eot) * 6e4;
    const half = Math.acos(cosH) / rad * 4 * 6e4;
    const mins = (t) => (now - t) / 6e4;
    // the light warms from half an hour before sunset and is full forty minutes after;
    // it cools from forty minutes before sunrise and is gone twenty minutes after
    return Math.max(clamp((mins(noon + half) + 30) / 70), clamp((20 - mins(noon - half)) / 60));
  }
  const set = () => {
    const v = level(new Date());
    root.style.setProperty('--dusk', v.toFixed(3));
    root.classList.toggle('evening', v > 0);
  };
  set();
  setInterval(set, 5 * 6e4);
})();
