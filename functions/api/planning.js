/**
 * Cloudflare Pages Function : /api/planning
 * Exécuté nativement sur le réseau Edge Cloudflare Workers (100% autonome)
 */

const ANCHOR_DATE = new Date(2026, 8, 21); // Lundi 21 septembre 2026 (Semaine 39)
const CYCLE_WEEKS = 15;
const MONTHS_HORIZON = 8;
const ALERTES_SEMAINES = [40];

// Roulement officiel de 15 semaines
const CYCLE_REPOS = [
  [4, 5],    // S39 : VEN, SAM
  [1, 6],    // S40 : MAR, DIM
  [5, 6],    // S41 : SAM, DIM
  [0, 5],    // S42 : LUN, SAM
  [3, 6],    // S43 : JEU, DIM
  [5, 6],    // S44 : SAM, DIM
  [4, 5],    // S45 : VEN, SAM (RC le 6, RH le 7)
  [3, 6],    // S46 : JEU, DIM (RH le 12, RC le 15)
  [2, 3, 6], // S47 : MER 18 (RC), JEU 19 (REC ?), DIM 22 (RH) (Samedi 21 travaillé)
  [0, 2],    // S48 : LUN 23 (RH), MER 25 (RH)
  [2, 6],    // S49 : MER 02 (RH), DIM 06 (RC) (Mardi 1er travaillé)
  [5, 6],    // S50 : SAM, DIM
  [4, 5],    // S51 : VEN, SAM
  [2, 6],    // S52 : MER, DIM
  [5, 6]     // S53 : SAM, DIM
];

const VACANCES = [
  { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
  { title: "Noël",      start: "2026-12-21", end: "2027-01-03" },
  { title: "Hiver",     start: "2027-02-15", end: "2027-02-28" },
  { title: "Printemps", start: "2027-04-12", end: "2027-04-25" }
];

const REPOS_EVENTS = [
  { date: "2026-10-28", title: "RC" },
  { date: "2026-11-01", title: "RH" },
  { date: "2026-11-06", title: "RC" },
  { date: "2026-11-07", title: "RH" },
  { date: "2026-11-12", title: "RH" },
  { date: "2026-11-15", title: "RC" },
  { date: "2026-11-18", title: "RC" },
  { date: "2026-11-19", title: "REC ?" },
  { date: "2026-11-22", title: "RH" },
  { date: "2026-11-23", title: "RH" },
  { date: "2026-11-25", title: "RH" },
  { date: "2026-12-02", title: "RH" },
  { date: "2026-12-06", title: "RC" },
  { date: "2027-01-01", title: "FER" }
];

const CONFIRMED_EVENTS = [
  { date: "2026-11-06", title: "Je viens chercher les enfants", time: "à 17h00", type: "confirmed" },
  { date: "2026-11-08", title: "Je ramène les enfants", time: "à 11h00", type: "confirmed" },
  { date: "2026-11-15", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
  { date: "2026-11-15", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
  { date: "2026-11-17", title: "Opération Nolan", time: "", type: "rdv" },
  { date: "2026-11-18", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
  { date: "2026-11-18", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
  { date: "2026-11-22", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
  { date: "2026-11-22", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
  { date: "2026-11-25", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
  { date: "2026-11-25", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
  { date: "2026-12-02", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
  { date: "2026-12-02", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
  { date: "2026-12-06", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
  { date: "2026-12-06", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" }
];

export async function onRequestGet() {
  const schedule = generateSchedule();
  return new Response(JSON.stringify(schedule), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function generateSchedule() {
  const now = new Date();
  const confirmDeadline = getConfirmationDeadline(now);

  const currentDay = now.getDay();
  const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
  const startMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);

  const endDate = new Date(startMonday.getFullYear(), startMonday.getMonth() + MONTHS_HORIZON, startMonday.getDate());

  const weeks = [];
  let iterDate = new Date(startMonday);
  const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  while (iterDate < endDate) {
    const weekStart = new Date(iterDate);
    const weekEnd = new Date(iterDate.getFullYear(), iterDate.getMonth(), iterDate.getDate() + 6);

    const isoWeek = getWeekNumber(weekStart);
    const isoYear = weekStart.getFullYear();

    const diffDays = Math.round((weekStart.getTime() - ANCHOR_DATE.getTime()) / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const cycleIndex = ((diffWeeks % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS;
    const restDayIndexes = CYCLE_REPOS[cycleIndex] || [];

    const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

    // Vérifier les vacances pour le titre
    const weekMidTime = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 3).getTime();
    const holidayMatch = VACANCES.find(v => {
      const pS = v.start.split('-').map(Number);
      const pE = v.end.split('-').map(Number);
      const s = new Date(pS[0], pS[1] - 1, pS[2], 0, 0, 0).getTime();
      const e = new Date(pE[0], pE[1] - 1, pE[2], 23, 59, 59, 999).getTime();
      return weekMidTime >= s && weekMidTime <= e;
    });

    let weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;
    if (holidayMatch) {
      weekTitle += ` (Vacances ${holidayMatch.title})`;
    }

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
      const dayShort = shortDays[dayIdx];
      const dayNum = pad(currentD.getDate());
      const dateStr = formatLocalDate(currentD);

      const reposMatch = REPOS_EVENTS.find(r => r.date === dateStr);
      const isRestFromCycle = restDayIndexes.includes(dayIdx);

      // Repos (pour synchronisation Admin / complet)
      if (reposMatch) {
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: reposMatch.title,
          time: "",
          hasTime: false,
          type: 'repos-perso',
          description: ""
        });
      } else if (isRestFromCycle) {
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: "Repos",
          time: "",
          hasTime: false,
          type: 'repos-perso',
          description: ""
        });
      }

      // Garde et RV
      const matchedEvents = CONFIRMED_EVENTS.filter(ev => ev.date === dateStr);
      matchedEvents.forEach(ev => {
        weekData.items.push({
          date: dateStr,
          dayShort,
          dayNum,
          title: ev.title,
          time: ev.time || "",
          hasTime: !!ev.time,
          type: ev.type,
          description: ""
        });
      });
    }

    // Tri chronologique
    weekData.items.sort((a, b) => {
      const dA = (a.date || "") + (a.time || "");
      const dB = (b.date || "") + (b.time || "");
      return dA.localeCompare(dB);
    });

    weeks.push(weekData);
    iterDate.setDate(iterDate.getDate() + 7);
  }

  return weeks;
}

function getConfirmationDeadline(now) {
  const current = new Date(now);
  const day = current.getDay();
  const diffToCurrentSunday = (day === 0) ? 0 : (7 - day);

  const currentSunday = new Date(current.getFullYear(), current.getMonth(), current.getDate() + diffToCurrentSunday, 22, 0, 0, 0);

  let targetWeeksAhead = 3;
  if (current.getTime() >= currentSunday.getTime()) {
    targetWeeksAhead = 4;
  }

  const deadlineSunday = new Date(current.getFullYear(), current.getMonth(), current.getDate() + diffToCurrentSunday + (targetWeeksAhead - 1) * 7, 23, 59, 59, 999);
  return deadlineSunday;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return n < 10 ? '0' + n : n; }
