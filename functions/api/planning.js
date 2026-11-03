/**
 * Cloudflare Pages Function : /api/planning
 * Exécuté nativement sur le réseau Edge Cloudflare Workers (sans Google Apps Script)
 */

const DEFAULT_CALENDAR_ID = 'g4iphl07ea67cg982dvaf8s068@group.calendar.google.com';
const DEFAULT_CALENDAR_RDV_ID = '4315aff00d85a2e1137c18d91a12d4ac4f89c3a3393f9bd540d35d2aa36d0711@group.calendar.google.com';

const ANCHOR_DATE = new Date(2026, 8, 21); // 21 septembre 2026
const CYCLE_WEEKS = 15;
const MONTHS_HORIZON = 8;
const ALERTES_SEMAINES = [40];

const CYCLE_REPOS = [
  [4, 5], [1, 6], [5, 6], [0, 5], [3, 6], 
  [5, 6], [4, 5], [3, 6], [5, 6], [0, 2], 
  [1, 6], [5, 6], [4, 5], [2, 6], [5, 6]
];

const VACANCES = [
  { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
  { title: "Noël",      start: "2026-12-21", end: "2026-12-27" }
];

// Événements fixes ou de référence (comme Opération Nolan)
const FIXED_RDV = [
  { date: "2026-11-17", title: "Opération Nolan", time: "", type: "rdv", description: "" }
];

export async function onRequestGet(context) {
  try {
    const env = context.env || {};
    const urlObj = new URL(context.request.url);
    
    // Support de l'URL iCal secrète passée en paramètre ou variable d'environnement
    const icalGarde = env.CALENDAR_SECRET_ICAL_URL || 
                      urlObj.searchParams.get('ical_garde') || 
                      env.CALENDAR_ICAL_URL;

    const icalRdv = env.CALENDAR_RDV_SECRET_ICAL_URL || 
                    urlObj.searchParams.get('ical_rdv') || 
                    env.CALENDAR_RDV_ICAL_URL;

    let eventsGarde = [];
    let eventsRdv = [];

    // Récupération si des URLs iCal valides sont fournies
    if (icalGarde || icalRdv) {
      const promises = [];
      if (icalGarde) promises.push(fetchIcalEvents(icalGarde).then(ev => { eventsGarde = ev; }));
      if (icalRdv) promises.push(fetchIcalEvents(icalRdv).then(ev => { eventsRdv = ev; }));
      await Promise.all(promises);
    }

    // Calcul du planning complet
    const planning = computePlanning({
      calendarEvents: eventsGarde,
      rdvEvents: [...eventsRdv, ...FIXED_RDV]
    });

    return new Response(JSON.stringify(planning), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    const fallback = computePlanning({ calendarEvents: [], rdvEvents: FIXED_RDV });
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
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
 * Parser RFC 5545 iCalendar
 */
function parseIcal(icsContent) {
  if (!icsContent || typeof icsContent !== 'string') return [];

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
      if (parsedDate) current.start = parsedDate;
    } else if (propName === 'DTEND') {
      const parsedDate = parseIcalDate(value);
      if (parsedDate) current.end = parsedDate;
    }
  }

  return events;
}

function parseIcalDate(val) {
  if (/^\d{8}$/.test(val)) {
    const y = parseInt(val.substring(0, 4), 10);
    const m = parseInt(val.substring(4, 6), 10) - 1;
    const d = parseInt(val.substring(6, 8), 10);
    return new Date(y, m, d, 0, 0, 0);
  }

  const matchUtc = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (matchUtc) {
    return new Date(Date.UTC(
      parseInt(matchUtc[1], 10),
      parseInt(matchUtc[2], 10) - 1,
      parseInt(matchUtc[3], 10),
      parseInt(matchUtc[4], 10),
      parseInt(matchUtc[5], 10),
      parseInt(matchUtc[6], 10)
    ));
  }

  const matchLocal = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (matchLocal) {
    return new Date(
      parseInt(matchLocal[1], 10),
      parseInt(matchLocal[2], 10) - 1,
      parseInt(matchLocal[3], 10),
      parseInt(matchLocal[4], 10),
      parseInt(matchLocal[5], 10),
      parseInt(matchLocal[6], 10)
    );
  }

  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function unescapeIcalText(text) {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
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

function getHolidays() {
  return VACANCES.map(v => {
    const partsStart = v.start.split('-');
    const s = new Date(parseInt(partsStart[0], 10), parseInt(partsStart[1], 10) - 1, parseInt(partsStart[2], 10));
    s.setHours(0, 0, 0, 0);

    const partsEnd = v.end.split('-');
    const e = new Date(parseInt(partsEnd[0], 10), parseInt(partsEnd[1], 10) - 1, parseInt(partsEnd[2], 10));
    e.setHours(23, 59, 59, 999);

    return { title: v.title, start: s.getTime(), end: e.getTime() };
  });
}

function computePlanning({ calendarEvents = [], rdvEvents = [] }) {
  const cycle = CYCLE_REPOS;
  const holidays = getHolidays(); 
  const now = new Date();
  const confirmDeadline = getConfirmationDeadline(now);
  
  const currentDay = now.getDay();
  const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + MONTHS_HORIZON);

  const weeks = [];
  let iterDate = new Date(startDate);
  const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  while (iterDate < endDate) {
    const weekStart = new Date(iterDate);
    const weekEnd = new Date(iterDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const isoWeek = getWeekNumber(weekStart);
    const diffDays = Math.round((weekStart.getTime() - ANCHOR_DATE.getTime()) / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const cycleIndex = ((diffWeeks % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS;

    const restDayIndexes = cycle[cycleIndex] || [];
    const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

    const weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;

    const weekData = {
      weekId: `W_${weekStart.getFullYear()}_${isoWeek}`,
      title: weekTitle,
      startDate: `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`,
      endDate: `${weekEnd.getFullYear()}-${pad(weekEnd.getMonth() + 1)}-${pad(weekEnd.getDate())}`,
      isConfirmed: isConfirmedWeek,
      hasAlert: (ALERTES_SEMAINES.includes(isoWeek) && !isConfirmedWeek), 
      items: []
    };

    const eventsThisWeek = calendarEvents.filter(ev => {
      const evDate = new Date(ev.start);
      return evDate >= weekStart && evDate < new Date(weekEnd.getTime() + 86400000);
    });
    
    const rdvThisWeek = rdvEvents.filter(ev => {
      let evDate;
      if (ev.start) evDate = new Date(ev.start);
      else if (ev.date) {
        const [y, m, d] = ev.date.split('-').map(Number);
        evDate = new Date(y, m - 1, d);
      }
      return evDate && evDate >= weekStart && evDate < new Date(weekEnd.getTime() + 86400000);
    });

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const currentD = new Date(weekStart);
      currentD.setDate(currentD.getDate() + dayIdx);
      const currentDTime = currentD.getTime();

      const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);
      
      const dayEvents = eventsThisWeek.filter(ev => {
        const s = new Date(ev.start);
        return s.getDate() === currentD.getDate() && s.getMonth() === currentD.getMonth() && s.getFullYear() === currentD.getFullYear();
      });
      
      const dayRdv = rdvThisWeek.filter(ev => {
        let s;
        if (ev.start) s = new Date(ev.start);
        else if (ev.date) {
          const [y, m, d] = ev.date.split('-').map(Number);
          s = new Date(y, m - 1, d);
        }
        return s && s.getDate() === currentD.getDate() && s.getMonth() === currentD.getMonth() && s.getFullYear() === currentD.getFullYear();
      });

      // 1. RDV (Opération, consultations, etc.)
      if (dayRdv.length > 0) {
        dayRdv.forEach(ev => {
          let timeStr = ev.time || "";
          let hasTime = !!ev.time;
          if (ev.start) {
            const s = new Date(ev.start);
            const e = ev.end ? new Date(ev.end) : s;
            const isMidnightToMidnight = (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0) || (s.toDateString() !== e.toDateString() && s.getHours() === 0 && e.getHours() === 0);
            if (!isMidnightToMidnight) {
              timeStr = `à ${pad(s.getHours())}h${pad(s.getMinutes())}`;
              hasTime = true;
            }
          }

          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: pad(currentD.getDate()), 
            title: ev.title || "Rendez-vous", 
            time: timeStr, 
            hasTime: hasTime, 
            type: 'rdv',
            description: ev.description || "" 
          });
        });
      }

      // 2. Événements confirmés de l'agenda
      if (isConfirmedWeek && dayEvents.length > 0) {
        dayEvents.forEach(ev => {
          const s = new Date(ev.start);
          const e = ev.end ? new Date(ev.end) : s;
          const isMidnightToMidnight = (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0) || (s.toDateString() !== e.toDateString() && s.getHours() === 0 && e.getHours() === 0);
          let timeStr = "";
          if (!isMidnightToMidnight) timeStr = `à ${pad(s.getHours())}h${pad(s.getMinutes())}`;

          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: pad(currentD.getDate()), 
            title: ev.title || "Garde Enfants", 
            time: timeStr, 
            hasTime: !isMidnightToMidnight, 
            type: 'confirmed',
            description: ev.description || ""
          });
        });
      } 
      // 3. Vacances
      else if (holidayMatch) {
        weekData.items.push({ 
          dayShort: shortDays[dayIdx], 
          dayNum: pad(currentD.getDate()), 
          title: holidayMatch.title, 
          time: "", 
          hasTime: false, 
          type: 'holiday', 
          description: "" 
        });
      } 
      // 4. Repos théorique (uniquement pour les semaines non confirmées)
      else if (restDayIndexes.includes(dayIdx)) {
        if (isConfirmedWeek && calendarEvents.length === 0) {
          // Semaine confirmée par défaut (sans repos confirmé textuel) :
          if (dayIdx === 4) { // Vendredi
            weekData.items.push({ 
              dayShort: shortDays[dayIdx], 
              dayNum: pad(currentD.getDate()), 
              title: "Je viens chercher les enfants", 
              time: "à 17h00", 
              hasTime: true, 
              type: 'confirmed', 
              description: "" 
            });
          } else if (dayIdx === 6) { // Dimanche
            weekData.items.push({ 
              dayShort: shortDays[dayIdx], 
              dayNum: pad(currentD.getDate()), 
              title: "Je ramène les enfants", 
              time: "à 11h00", 
              hasTime: true, 
              type: 'confirmed', 
              description: "" 
            });
          }
          // Aucun "Repos confirmé" n'est ajouté
        } else if (!isConfirmedWeek) {
          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: pad(currentD.getDate()), 
            title: "Repos théorique", 
            time: "À confirmer à S -14 jours", 
            hasTime: true, 
            type: 'theory', 
            description: "" 
          });
        }
      }
    }
    weeks.push(weekData);
    iterDate.setDate(iterDate.getDate() + 7);
  }
  return weeks;
}

function pad(n) { return n < 10 ? '0' + n : n; }

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
