/**
 * ========================================================
 * BACKEND GOOGLE APPS SCRIPT - CHEZ PAPOUNET 🥰
 * ========================================================
 * 
 * Ce script lit en direct vos 3 agendas Google sur 8 mois glissants :
 * 1. Agenda Repos (RC, RH, REC ?, FER...) : visible uniquement en mode Admin
 * 2. Agenda Nolan & Thaïs (Garde) : 3 semaines en mode normal, 8 mois en mode Admin
 * 3. Agenda RV des enfants (💡) : 8 mois pour tous
 *
 * Déploiement :
 * 1. Ouvrez https://script.google.com
 * 2. Collez ce code dans l'éditeur
 * 3. Cliquez sur "Déployer" > "Gérer les déploiements" > Crayon (Modifier) > Version: "Nouvelle version" > "Déployer"
 */

// ========================================================
// 📅 IDENTIFIANTS DES AGENDAS GOOGLE
// ========================================================
const CALENDAR_REPOS_ID = '8u93p21a2o1jtts2ocssuqegm0@group.calendar.google.com';
const CALENDAR_GARDE_ID = 'g4iphl07ea67cg982dvaf8s068@group.calendar.google.com';
const CALENDAR_RDV_ID   = '4315aff00d85a2e1137c18d91a12d4ac4f89c3a3393f9bd540d35d2aa36d0711@group.calendar.google.com';

const MONTHS_HORIZON = 8;

// ========================================================
// 🚨 VOS ALERTES : Numéros des semaines où afficher l'alerte
// ========================================================
const ALERTES_SEMAINES = [40];

// ========================================================
// 🏖️ VOS SEMAINES DE VACANCES
// Vous pouvez ajouter ou modifier vos vacances ici :
// ========================================================
const VACANCES = [
  { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
  { title: "Noël",      start: "2026-12-21", end: "2027-01-03" },
  { title: "Hiver",     start: "2027-02-15", end: "2027-02-28" },
  { title: "Printemps", start: "2027-04-12", end: "2027-04-25" }
];

/**
 * Point d'entrée HTTP GET pour l'application Web
 */
function doGet() {
  const data = getPlanningData();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

function getPlanningData() {
  const holidays = getHolidays(); 
  const now = new Date();
  const confirmDeadline = getConfirmationDeadline(now);
  
  // Démarrer au lundi de la semaine en cours
  const currentDay = now.getDay();
  const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  // Fin à 8 mois
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + MONTHS_HORIZON);

  // 1. Récupération directe des 3 agendas Google sur les 8 mois
  let reposEvents = [];
  let gardeEvents = [];
  let rdvEvents = [];

  try {
    const calRepos = CalendarApp.getCalendarById(CALENDAR_REPOS_ID);
    if (calRepos) {
      reposEvents = calRepos.getEvents(startDate, endDate);
    }
  } catch(e) {
    Logger.log("Erreur lecture agenda Repos: " + e.message);
  }

  try {
    const calGarde = CalendarApp.getCalendarById(CALENDAR_GARDE_ID);
    if (calGarde) {
      gardeEvents = calGarde.getEvents(startDate, endDate);
    }
  } catch(e) {
    Logger.log("Erreur lecture agenda Garde: " + e.message);
  }

  try {
    const calRdv = CalendarApp.getCalendarById(CALENDAR_RDV_ID);
    if (calRdv) {
      rdvEvents = calRdv.getEvents(startDate, endDate);
    }
  } catch(e) {
    Logger.log("Erreur lecture agenda RV: " + e.message);
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

    // Filtrer les événements de la semaine en cours
    const weekStartTime = weekStart.getTime();
    const weekEndTime = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999).getTime();

    const weekRepos = reposEvents.filter(ev => {
      const t = ev.getStartTime().getTime();
      return t >= weekStartTime && t <= weekEndTime;
    });

    const weekGarde = gardeEvents.filter(ev => {
      const t = ev.getStartTime().getTime();
      return t >= weekStartTime && t <= weekEndTime;
    });

    const weekRdv = rdvEvents.filter(ev => {
      const t = ev.getStartTime().getTime();
      return t >= weekStartTime && t <= weekEndTime;
    });

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const currentD = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayIdx);
      const currentDTime = currentD.getTime();
      const dayShort = shortDays[dayIdx];
      const dayNum = pad(currentD.getDate());
      const dateStr = formatLocalDate(currentD);

      const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);

      // Événements Repos (RC, RH, REC ?, FER...)
      const dayRepos = weekRepos.filter(ev => isSameDay(ev.getStartTime(), currentD));
      dayRepos.forEach(ev => {
        const title = (ev.getTitle() || "Repos").trim();
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort: dayShort,
          dayNum: dayNum,
          title: title,
          time: timeStr,
          hasTime: !!timeStr,
          type: 'repos-perso',
          description: ev.getDescription() || ""
        });
      });

      // Événements RV des enfants (Opération Nolan...)
      const dayRdv = weekRdv.filter(ev => isSameDay(ev.getStartTime(), currentD));
      dayRdv.forEach(ev => {
        const title = (ev.getTitle() || "Rendez-vous").trim();
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort: dayShort,
          dayNum: dayNum,
          title: title,
          time: timeStr,
          hasTime: !!timeStr,
          type: 'rdv',
          description: ev.getDescription() || ""
        });
      });

      // Événements Garde enfants (Je viens chercher..., Je ramène...)
      const dayGarde = weekGarde.filter(ev => isSameDay(ev.getStartTime(), currentD));
      dayGarde.forEach(ev => {
        const title = (ev.getTitle() || "Garde Enfants").trim();
        const timeStr = formatStartTime(ev);
        weekData.items.push({
          date: dateStr,
          dayShort: dayShort,
          dayNum: dayNum,
          title: title,
          time: timeStr,
          hasTime: !!timeStr,
          type: 'confirmed',
          description: ev.getDescription() || ""
        });
      });

      // Si aucune activité mais vacances scolaires
      if (dayRepos.length === 0 && dayGarde.length === 0 && dayRdv.length === 0 && holidayMatch) {
        weekData.items.push({
          date: dateStr,
          dayShort: dayShort,
          dayNum: dayNum,
          title: holidayMatch.title,
          time: "",
          hasTime: false,
          type: 'holiday',
          description: ""
        });
      }
    }

    // Déduplication de sécurité dans la semaine
    weekData.items = deduplicateItems(weekData.items);

    weeks.push(weekData);
    iterDate.setDate(iterDate.getDate() + 7);
  }

  return weeks;
}

/**
 * Formatage de l'horaire de départ uniquement (ex: "à 17h00")
 */
function formatStartTime(ev) {
  if (ev.isAllDayEvent()) return "";

  const s = ev.getStartTime();
  const e = ev.getEndTime();
  
  // Si minuit à minuit
  if (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0) {
    return "";
  }

  return "à " + pad(s.getHours()) + "h" + pad(s.getMinutes());
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatLocalDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function deduplicateItems(items) {
  const seen = {};
  return items.filter(it => {
    const key = (it.date || "") + "|" + (it.title || "").toLowerCase() + "|" + (it.time || "") + "|" + it.type;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function pad(n) { return n < 10 ? '0' + n : n; }

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
