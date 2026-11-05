/**
 * Cloudflare Pages Function : /api/planning
 * 100% exécuté sur le réseau Edge Cloudflare Workers
 * AUCUNE DÉPENDANCE à Google Apps Script
 */

const DEFAULT_CALENDAR_REPOS_ID = '8u93p21a2o1jtts2ocssuqegm0@group.calendar.google.com';
const DEFAULT_CALENDAR_GARDE_ID = 'g4iphl07ea67cg982dvaf8s068@group.calendar.google.com';
const DEFAULT_CALENDAR_RDV_ID   = '4315aff00d85a2e1137c18d91a12d4ac4f89c3a3393f9bd540d35d2aa36d0711@group.calendar.google.com';

const MONTHS_HORIZON = 8;
const ALERTES_SEMAINES = [40];

// ========================================================
// 🏖️ VACANCES SCOLAIRES
// ========================================================
const VACANCES = [
  { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
  { title: "Noël",      start: "2026-12-21", end: "2027-01-03" },
  { title: "Hiver",     start: "2027-02-15", end: "2027-02-28" },
  { title: "Printemps", start: "2027-04-12", end: "2027-04-25" }
];

export async function onRequestGet(context) {
  try {
    const env = context.env || {};
    const urlObj = new URL(context.request.url);

    // Résolution des URLs iCal (supporte les adresses publiques et les adresses secrètes Cloudflare)
    const urlRepos = env.CALENDAR_REPOS_ICAL_URL || 
                     urlObj.searchParams.get('ical_repos') || 
                     `https://calendar.google.com/calendar/ical/${encodeURIComponent(DEFAULT_CALENDAR_REPOS_ID)}/public/basic.ics`;

    const urlGarde = env.CALENDAR_GARDE_ICAL_URL || 
                     urlObj.searchParams.get('ical_garde') || 
                     `https://calendar.google.com/calendar/ical/${encodeURIComponent(DEFAULT_CALENDAR_GARDE_ID)}/public/basic.ics`;

    const urlRdv = env.CALENDAR_RDV_ICAL_URL || 
                   urlObj.searchParams.get('ical_rdv') || 
                   `https://calendar.google.com/calendar/ical/${encodeURIComponent(DEFAULT_CALENDAR_RDV_ID)}/public/basic.ics`;

    // Récupération simultanée des 3 flux iCal avec timeout
    const [eventsRepos, eventsGarde, eventsRdv] = await Promise.all([
      fetchIcalEvents(urlRepos),
      fetchIcalEvents(urlGarde),
      fetchIcalEvents(urlRdv)
    ]);

    // Construction du planning sur 8 mois glissants
    const planning = buildPlanningFromEvents({
      repos: eventsRepos,
      garde: eventsGarde,
      rdv: eventsRdv
    });

    return new Response(JSON.stringify(planning), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.warn("Erreur chargement iCal direct:", error.message);
    const fallback = getFallbackSchedule();
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Fallback': 'true',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Télécharge et décode un flux iCalendar standard (.ics)
 */
async function fetchIcalEvents(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Papounet-Cloudflare-Worker' }
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const text = await res.text();
    return parseIcal(text);
  } catch (e) {
    return [];
  }
}

/**
 * Parser RFC 5545 iCalendar léger et optimisé Edge Worker
 */
function parseIcal(icsContent) {
  if (!icsContent || typeof icsContent !== 'string') return [];

  // Dépliage des lignes RFC 5545
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let inEvent = false;
  let current = {};

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      current = {};
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      inEvent = false;
      if (current.start && current.title) {
        events.push(current);
      }
      continue;
    }

    if (!inEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const propRaw = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1).trim();
    const propName = propRaw.split(';')[0].toUpperCase();

    if (propName === 'SUMMARY') {
      current.title = unescapeIcalText(value);
    } else if (propName === 'DESCRIPTION') {
      current.description = unescapeIcalText(value);
    } else if (propName === 'DTSTART') {
      const parsedDate = parseIcalDate(value);
      if (parsedDate) {
        current.start = parsedDate.date;
        current.isAllDay = parsedDate.isAllDay;
      }
    } else if (propName === 'DTEND') {
      const parsedDate = parseIcalDate(value);
      if (parsedDate) {
        current.end = parsedDate.date;
      }
    }
  }

  return events;
}

function parseIcalDate(val) {
  // Format DATE seule (événement sur journée entière) : 20261106
  if (/^\d{8}$/.test(val)) {
    const y = parseInt(val.substring(0, 4), 10);
    const m = parseInt(val.substring(4, 6), 10) - 1;
    const d = parseInt(val.substring(6, 8), 10);
    return { date: new Date(y, m, d, 0, 0, 0), isAllDay: true };
  }

  // Format UTC : 20261106T170000Z
  const matchUtc = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (matchUtc) {
    return {
      date: new Date(Date.UTC(
        parseInt(matchUtc[1], 10),
        parseInt(matchUtc[2], 10) - 1,
        parseInt(matchUtc[3], 10),
        parseInt(matchUtc[4], 10),
        parseInt(matchUtc[5], 10),
        parseInt(matchUtc[6], 10)
      )),
      isAllDay: false
    };
  }

  // Format local : 20261106T170000
  const matchLocal = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (matchLocal) {
    return {
      date: new Date(
        parseInt(matchLocal[1], 10),
        parseInt(matchLocal[2], 10) - 1,
        parseInt(matchLocal[3], 10),
        parseInt(matchLocal[4], 10),
        parseInt(matchLocal[5], 10),
        parseInt(matchLocal[6], 10)
      ),
      isAllDay: false
    };
  }

  return null;
}

function unescapeIcalText(str) {
  if (!str) return '';
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Construit les 8 mois de planning à partir des événements iCal réels
 */
function buildPlanningFromEvents({ repos = [], garde = [], rdv = [] }) {
  const holidays = VACANCES.map(v => {
    const pS = v.start.split('-').map(Number);
    const pE = v.end.split('-').map(Number);
    return {
      title: v.title,
      start: new Date(pS[0], pS[1] - 1, pS[2], 0, 0, 0).getTime(),
      end: new Date(pE[0], pE[1] - 1, pE[2], 23, 59, 59, 999).getTime()
    };
  });

  const now = new Date();
  const confirmDeadline = getConfirmationDeadline(now);

  const currentDay = now.getDay();
  const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + MONTHS_HORIZON);

  // Filtrer strictement tout événement "Busy" ou anonymisé
  const cleanRepos = repos.filter(ev => ev.title && ev.title.toLowerCase() !== 'busy');
  const cleanGarde = garde.filter(ev => ev.title && ev.title.toLowerCase() !== 'busy');
  const cleanRdv = rdv.filter(ev => ev.title && ev.title.toLowerCase() !== 'busy');

  // Si aucun événement valide n'a pu être chargé (ex: calendriers privés),
  // utiliser immédiatement les données de référence précises sans inventer de "Busy"
  const hasLoadedEvents = cleanRepos.length > 0 || cleanGarde.length > 0 || cleanRdv.length > 0;
  if (!hasLoadedEvents) {
    return getFallbackSchedule();
  }

  const weeks = [];
  let iterDate = new Date(startDate);
  const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  while (iterDate < endDate) {
    const weekStart = new Date(iterDate);
    const weekEnd = new Date(iterDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const isoWeek = getWeekNumber(weekStart);
    const isoYear = weekStart.getFullYear();
    const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

    const weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;

    const weekData = {
      weekId: `W_${isoYear}_${isoWeek}`,
      title: weekTitle,
      startDate: formatLocalDate(weekStart),
      endDate: formatLocalDate(weekEnd),
      isConfirmed: isConfirmedWeek,
      hasAlert: (ALERTES_SEMAINES.includes(isoWeek) && !isConfirmedWeek),
      items: []
    };

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const currentD = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayIdx);
      const currentDTime = currentD.getTime();
      const dayShort = shortDays[dayIdx];
      const dayNum = pad(currentD.getDate());
      const dateStr = formatLocalDate(currentD);

      const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);

      // 1. Repos (RC, RH, REC ?, FER...)
      const dayRepos = cleanRepos.filter(ev => isSameDay(ev.start, currentD));
      dayRepos.forEach(ev => {
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: (ev.title || "Repos").trim(),
          time: timeStr,
          hasTime: !!timeStr,
          type: 'repos-perso',
          description: ev.description || ""
        });
      });

      // 2. RV des enfants (Opération Nolan...)
      const dayRdv = cleanRdv.filter(ev => isSameDay(ev.start, currentD));
      dayRdv.forEach(ev => {
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: (ev.title || "Rendez-vous").trim(),
          time: timeStr,
          hasTime: !!timeStr,
          type: 'rdv',
          description: ev.description || ""
        });
      });

      // 3. Garde enfants (Je viens chercher..., Je ramène...)
      const dayGarde = cleanGarde.filter(ev => isSameDay(ev.start, currentD));
      dayGarde.forEach(ev => {
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: (ev.title || "Garde").trim(),
          time: timeStr,
          hasTime: !!timeStr,
          type: 'confirmed',
          description: ev.description || ""
        });
      });
    }

    weeks.push(weekData);
    iterDate.setDate(iterDate.getDate() + 7);
  }

  return weeks;
}

function formatStartTime(ev) {
  if (ev.isAllDay) return "";
  const s = new Date(ev.start);
  if (isNaN(s.getTime())) return "";
  if (s.getHours() === 0 && s.getMinutes() === 0) return "";
  return `à ${pad(s.getHours())}h${pad(s.getMinutes())}`;
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return n < 10 ? '0' + n : n; }

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getConfirmationDeadline(now) {
  const current = new Date(now);
  const day = current.getDay();
  const diffToCurrentSunday = (day === 0) ? 0 : (7 - day);

  const currentSunday = new Date(current);
  currentSunday.setDate(current.getDate() + diffToCurrentSunday);
  currentSunday.setHours(22, 0, 0, 0);

  let targetWeeksAhead = 3;
  if (current.getTime() >= currentSunday.getTime()) {
    targetWeeksAhead = 4;
  }

  const deadlineSunday = new Date(current);
  deadlineSunday.setDate(current.getDate() + diffToCurrentSunday + (targetWeeksAhead - 1) * 7);
  deadlineSunday.setHours(23, 59, 59, 999);
  return deadlineSunday;
}

function getFallbackSchedule() {
  return [
    {
      weekId: "W_2026_45",
      title: "Semaine 45 • 2 Novembre - 8 Novembre",
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      isConfirmed: true,
      hasAlert: false,
      items: [
        { date: "2026-11-06", dayShort: "VEN", dayNum: "06", title: "RC", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-06", dayShort: "VEN", dayNum: "06", title: "Je viens chercher les enfants", time: "à 17h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-07", dayShort: "SAM", dayNum: "07", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-08", dayShort: "DIM", dayNum: "08", title: "Je ramène les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" }
      ]
    },
    {
      weekId: "W_2026_46",
      title: "Semaine 46 • 9 Novembre - 15 Novembre",
      startDate: "2026-11-09",
      endDate: "2026-11-15",
      isConfirmed: true,
      hasAlert: false,
      items: [
        { date: "2026-11-12", dayShort: "JEU", dayNum: "12", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-15", dayShort: "DIM", dayNum: "15", title: "RC", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-15", dayShort: "DIM", dayNum: "15", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-15", dayShort: "DIM", dayNum: "15", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
      ]
    },
    {
      weekId: "W_2026_47",
      title: "Semaine 47 • 16 Novembre - 22 Novembre",
      startDate: "2026-11-16",
      endDate: "2026-11-22",
      isConfirmed: true,
      hasAlert: false,
      items: [
        { date: "2026-11-17", dayShort: "MAR", dayNum: "17", title: "Opération Nolan", time: "", hasTime: false, type: "rdv", description: "" },
        { date: "2026-11-18", dayShort: "MER", dayNum: "18", title: "RC", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-18", dayShort: "MER", dayNum: "18", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-18", dayShort: "MER", dayNum: "18", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-19", dayShort: "JEU", dayNum: "19", title: "REC ?", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-22", dayShort: "DIM", dayNum: "22", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-22", dayShort: "DIM", dayNum: "22", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-22", dayShort: "DIM", dayNum: "22", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
      ]
    },
    {
      weekId: "W_2026_48",
      title: "Semaine 48 • 23 Novembre - 29 Novembre",
      startDate: "2026-11-23",
      endDate: "2026-11-29",
      isConfirmed: false,
      hasAlert: false,
      items: [
        { date: "2026-11-23", dayShort: "LUN", dayNum: "23", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-25", dayShort: "MER", dayNum: "25", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-11-25", dayShort: "MER", dayNum: "25", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-11-25", dayShort: "MER", dayNum: "25", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
      ]
    },
    {
      weekId: "W_2026_49",
      title: "Semaine 49 • 30 Novembre - 6 Décembre",
      startDate: "2026-11-30",
      endDate: "2026-12-06",
      isConfirmed: false,
      hasAlert: false,
      items: [
        { date: "2026-12-02", dayShort: "MER", dayNum: "02", title: "RH", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-12-02", dayShort: "MER", dayNum: "02", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-12-02", dayShort: "MER", dayNum: "02", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-12-06", dayShort: "DIM", dayNum: "06", title: "RC", time: "", hasTime: false, type: "repos-perso", description: "" },
        { date: "2026-12-06", dayShort: "DIM", dayNum: "06", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { date: "2026-12-06", dayShort: "DIM", dayNum: "06", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
      ]
    },
    {
      weekId: "W_2026_52",
      title: "Semaine 52 • 21 Décembre - 27 Décembre",
      startDate: "2026-12-21",
      endDate: "2026-12-27",
      isConfirmed: false,
      hasAlert: false,
      items: [
        { date: "2026-12-25", dayShort: "VEN", dayNum: "25", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" }
      ]
    },
    {
      weekId: "W_2026_53",
      title: "Semaine 53 • 28 Décembre - 3 Janvier",
      startDate: "2026-12-28",
      endDate: "2027-01-03",
      isConfirmed: false,
      hasAlert: false,
      items: [
        { date: "2027-01-01", dayShort: "VEN", dayNum: "01", title: "FER", time: "", hasTime: false, type: "repos-perso", description: "" }
      ]
    }
  ];
}
