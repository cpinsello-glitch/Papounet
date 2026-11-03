/**
 * ========================================================
 * BACKEND GOOGLE APPS SCRIPT - CHEZ PAPOUNET 🥰
 * ========================================================
 * 
 * Ce script est à déployer en tant qu'Application Web dans Google Apps Script.
 * Déploiement : "Déployer" > "Nouveau déploiement" > "Application Web"
 * Exécuter en tant que : "Moi"
 * Qui a accès : "Tout le monde" (Anyone)
 */

const CALENDAR_ID = 'g4iphl07ea67cg982dvaf8s068@group.calendar.google.com';
const CALENDAR_RDV_ID = '4315aff00d85a2e1137c18d91a12d4ac4f89c3a3393f9bd540d35d2aa36d0711@group.calendar.google.com';
const ANCHOR_DATE = new Date(2026, 8, 21); // 21 septembre 2026 (mois 8 = septembre car 0-indexé)
const CYCLE_WEEKS = 15;
const MONTHS_HORIZON = 8;

// ========================================================
// 🚨 VOS ALERTES : Mettez juste le numéro des semaines ici
// Exemple pour alerter sur les semaines 40 et 42 : [40, 42]
// ========================================================
const ALERTES_SEMAINES = [40];

// ========================================================
// Cycle de repos théorique sur 15 semaines
// 0: Dimanche, 1: Lundi, 2: Mardi, 3: Mercredi, 4: Jeudi, 5: Vendredi, 6: Samedi
// ========================================================
const CYCLE_REPOS = [
  [4, 5], [1, 6], [5, 6], [0, 5], [3, 6], 
  [5, 6], [4, 5], [3, 6], [5, 6], [0, 2], 
  [1, 6], [5, 6], [4, 5], [2, 6], [5, 6]
];

// ========================================================
// Périodes de Vacances
// ========================================================
const VACANCES = [
  { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
  { title: "Noël",      start: "2026-12-21", end: "2026-12-27" }
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
    const s = new Date(partsStart[0], partsStart[1] - 1, partsStart[2]);
    s.setHours(0, 0, 0, 0);

    const partsEnd = v.end.split('-');
    const e = new Date(partsEnd[0], partsEnd[1] - 1, partsEnd[2]);
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

  let calendarEvents = [];
  let rdvEvents = [];
  try {
    const calGarde = CalendarApp.getCalendarById(CALENDAR_ID);
    if (calGarde) calendarEvents = calGarde.getEvents(startDate, confirmDeadline); 
    
    const calRdv = CalendarApp.getCalendarById(CALENDAR_RDV_ID);
    if (calRdv) rdvEvents = calRdv.getEvents(startDate, endDate); 
  } catch(e) {
    Logger.log("Erreur de récupération Google Calendar: " + e.message);
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
    const diffDays = Math.round((weekStart.getTime() - ANCHOR_DATE.getTime()) / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const cycleIndex = ((diffWeeks % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS;

    const restDayIndexes = cycle[cycleIndex] || [];
    const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

    const weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;

    const weekData = {
      weekId: `W_${weekStart.getFullYear()}_${isoWeek}`,
      title: weekTitle,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      isConfirmed: isConfirmedWeek,
      hasAlert: (ALERTES_SEMAINES.includes(isoWeek) && !isConfirmedWeek), 
      items: []
    };

    const eventsThisWeek = calendarEvents.filter(ev => {
      const evDate = ev.getStartTime();
      return evDate >= weekStart && evDate < new Date(weekEnd.getTime() + 86400000);
    });
    
    const rdvThisWeek = rdvEvents.filter(ev => {
      const evDate = ev.getStartTime();
      return evDate >= weekStart && evDate < new Date(weekEnd.getTime() + 86400000);
    });

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const currentD = new Date(weekStart);
      currentD.setDate(currentD.getDate() + dayIdx);
      const currentDTime = currentD.getTime();

      const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);
      
      const dayEvents = eventsThisWeek.filter(ev => {
        const s = ev.getStartTime();
        return s.getDate() === currentD.getDate() && s.getMonth() === currentD.getMonth();
      });
      
      const dayRdv = rdvThisWeek.filter(ev => {
        const s = ev.getStartTime();
        return s.getDate() === currentD.getDate() && s.getMonth() === currentD.getMonth();
      });

      if (dayRdv.length > 0) {
        dayRdv.forEach(ev => {
          const s = ev.getStartTime();
          const e = ev.getEndTime();
          const isMidnightToMidnight = (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0) || (s.toDateString() !== e.toDateString() && s.getHours() === 0 && e.getHours() === 0);
          let timeStr = "";
          if (!isMidnightToMidnight) timeStr = `à ${pad(s.getHours())}h${pad(s.getMinutes())}`;

          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: pad(currentD.getDate()), 
            title: ev.getTitle() || "Rendez-vous", 
            time: timeStr, 
            hasTime: !isMidnightToMidnight, 
            type: 'rdv',
            description: ev.getDescription() || "" 
          });
        });
      }

      if (isConfirmedWeek && dayEvents.length > 0) {
        dayEvents.forEach(ev => {
          const s = ev.getStartTime();
          const e = ev.getEndTime();
          const isMidnightToMidnight = (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0) || (s.toDateString() !== e.toDateString() && s.getHours() === 0 && e.getHours() === 0);
          let timeStr = "";
          if (!isMidnightToMidnight) timeStr = `à ${pad(s.getHours())}h${pad(s.getMinutes())}`;

          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: pad(currentD.getDate()), 
            title: ev.getTitle() || "Garde Enfants", 
            time: timeStr, 
            hasTime: !isMidnightToMidnight, 
            type: 'confirmed',
            description: ev.getDescription() || ""
          });
        });
      } 
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
      else if (!isConfirmedWeek && restDayIndexes.includes(dayIdx)) {
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
    weeks.push(weekData);
    iterDate.setDate(iterDate.getDate() + 7);
  }
  return weeks;
}

function pad(n) { return n < 10 ? '0' + n : n; }

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

