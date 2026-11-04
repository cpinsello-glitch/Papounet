/**
 * Moteur de calcul et données de base du planning
 */
const PlanningEngine = {
  ANCHOR_DATE: new Date(2026, 8, 21),
  CYCLE_WEEKS: 15,
  MONTHS_HORIZON: 8,
  ALERTES_SEMAINES: [40],

  CYCLE_REPOS: [
    [4, 5], [1, 6], [5, 6], [0, 5], [3, 6], 
    [5, 6], [4, 5], [3, 6], [5, 6], [0, 2], 
    [1, 6], [5, 6], [4, 5], [2, 6], [5, 6]
  ],

  VACANCES: [
    { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
    { title: "Noël",      start: "2026-12-21", end: "2026-12-27" }
  ],

  // Événements confirmés connus pour les premières semaines
  CONFIRMED_EVENTS: [
    // Semaine 45
    { date: "2026-11-06", title: "Je viens chercher les enfants", time: "à 17h00", type: "confirmed" },
    { date: "2026-11-08", title: "Je ramène les enfants", time: "à 11h00", type: "confirmed" },

    // Semaine 46
    { date: "2026-11-15", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
    { date: "2026-11-15", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },

    // Semaine 47
    { date: "2026-11-17", title: "Opération Nolan", time: "", type: "rdv" },
    { date: "2026-11-18", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
    { date: "2026-11-18", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
    { date: "2026-11-22", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
    { date: "2026-11-22", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" }
  ],

  getConfirmationDeadline(now) {
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
  },

  getHolidays() {
    return this.VACANCES.map(v => {
      const partsStart = v.start.split('-');
      const s = new Date(parseInt(partsStart[0], 10), parseInt(partsStart[1], 10) - 1, parseInt(partsStart[2], 10));
      s.setHours(0, 0, 0, 0);

      const partsEnd = v.end.split('-');
      const e = new Date(parseInt(partsEnd[0], 10), parseInt(partsEnd[1], 10) - 1, parseInt(partsEnd[2], 10));
      e.setHours(23, 59, 59, 999);

      return { title: v.title, start: s.getTime(), end: e.getTime() };
    });
  },

  compute(options = {}) {
    const showReposPerso = !!options.showReposPerso;
    const cycle = this.CYCLE_REPOS;
    const holidays = this.getHolidays(); 
    const now = new Date();
    const confirmDeadline = this.getConfirmationDeadline(now);
    
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() + diffToMonday);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + this.MONTHS_HORIZON);

    const weeks = [];
    let iterDate = new Date(startDate);
    const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    while (iterDate < endDate) {
      const weekStart = new Date(iterDate);
      const weekEnd = new Date(iterDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const isoWeek = this.getWeekNumber(weekStart);
      const diffDays = Math.round((weekStart.getTime() - this.ANCHOR_DATE.getTime()) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const cycleIndex = ((diffWeeks % this.CYCLE_WEEKS) + this.CYCLE_WEEKS) % this.CYCLE_WEEKS;

      const restDayIndexes = cycle[cycleIndex] || [];
      const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

      const weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;

      const weekData = {
        weekId: `W_${weekStart.getFullYear()}_${isoWeek}`,
        title: weekTitle,
        startDate: `${weekStart.getFullYear()}-${this.pad(weekStart.getMonth() + 1)}-${this.pad(weekStart.getDate())}`,
        endDate: `${weekEnd.getFullYear()}-${this.pad(weekEnd.getMonth() + 1)}-${this.pad(weekEnd.getDate())}`,
        isConfirmed: isConfirmedWeek,
        hasAlert: (this.ALERTES_SEMAINES.includes(isoWeek) && !isConfirmedWeek), 
        items: []
      };

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const currentD = new Date(weekStart);
        currentD.setDate(currentD.getDate() + dayIdx);
        const currentDTime = currentD.getTime();

        const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);

        // Si le mode repos personnel est activé et que Papounet est de repos ce jour-là
        const isPersonalRestDay = restDayIndexes.includes(dayIdx);

        if (showReposPerso && isPersonalRestDay) {
          weekData.items.push({
            dayShort: shortDays[dayIdx],
            dayNum: this.pad(currentD.getDate()),
            title: "Repos",
            time: "",
            hasTime: false,
            type: "repos-perso",
            description: ""
          });
        }

        // Recherche des événements confirmés de garde / RV
        const matched = this.CONFIRMED_EVENTS.filter(ev => {
          const [y, m, d] = ev.date.split('-').map(Number);
          return d === currentD.getDate() && (m - 1) === currentD.getMonth() && y === currentD.getFullYear();
        });

        if (matched.length > 0) {
          matched.forEach(ev => {
            weekData.items.push({
              dayShort: shortDays[dayIdx],
              dayNum: this.pad(currentD.getDate()),
              title: ev.title,
              time: ev.time || "",
              hasTime: !!ev.time,
              type: ev.type,
              description: ""
            });
          });
        } else if (holidayMatch) {
          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: this.pad(currentD.getDate()), 
            title: holidayMatch.title, 
            time: "", 
            hasTime: false, 
            type: 'holiday', 
            description: "" 
          });
        } else if (!isConfirmedWeek && restDayIndexes.includes(dayIdx) && !showReposPerso) {
          weekData.items.push({ 
            dayShort: shortDays[dayIdx], 
            dayNum: this.pad(currentD.getDate()), 
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
  },

  pad(n) { return n < 10 ? '0' + n : n; },

  getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }
};
