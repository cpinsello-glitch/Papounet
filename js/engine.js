/**
 * Moteur de calcul calendrier Papounet
 */
const PlanningEngine = {
  ANCHOR_DATE: new Date(2026, 8, 21), // 21 septembre 2026 (Lundi de la Semaine 39)
  CYCLE_WEEKS: 15,
  MONTHS_HORIZON: 8,
  ALERTES_SEMAINES: [40],

  // Cycle de repos officiel sur 15 semaines
  // 0: LUN, 1: MAR, 2: MER, 3: JEU, 4: VEN, 5: SAM, 6: DIM
  CYCLE_REPOS: [
    [4, 5], // S39 (Anchor) : VEN, SAM
    [1, 6], // S40 : MAR, DIM
    [5, 6], // S41 : SAM, DIM
    [0, 5], // S42 : LUN, SAM
    [3, 6], // S43 : JEU, DIM
    [5, 6], // S44 : SAM, DIM
    [4, 5], // S45 : VEN, SAM (Vendredi 6, Samedi 7)
    [3, 6], // S46 : JEU, DIM (Jeudi 12, Dimanche 15)
    [5, 6], // S47 : SAM, DIM (Samedi 21, Dimanche 22)
    [0, 2], // S48 : LUN, MER (Lundi 23, Mercredi 25)
    [1, 6], // S49 : MAR, DIM (Mardi 01, Dimanche 06)
    [5, 6], // S50 : SAM, DIM (Samedi 12, Dimanche 13)
    [4, 5], // S51 : VEN, SAM (Vendredi 18, Samedi 19)
    [2, 6], // S52 : MER, DIM (Mercredi 23, Dimanche 27)
    [5, 6]  // S53 : SAM, DIM (Samedi 02, Dimanche 03)
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

  /**
   * Calcule le lundi de n'importe quelle semaine ISO
   */
  getMondayOfISOWeek(year, week) {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const firstMonday = new Date(year, 0, 4 - dayOfWeek + 1);
    const targetMonday = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + (week - 1) * 7);
    targetMonday.setHours(0, 0, 0, 0);
    return targetMonday;
  },

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

  /**
   * Calcul principal du planning
   * @param {Object} options
   * @param {boolean} options.showReposPerso Mode Admin actif (affiche repos en rouge et garde sur 8 mois)
   */
  compute(options = {}) {
    const showReposPerso = !!options.showReposPerso;
    const cycle = this.CYCLE_REPOS;
    const holidays = this.getHolidays(); 
    const now = new Date();
    const confirmDeadline = this.getConfirmationDeadline(now);
    
    // Déterminer la semaine ISO de départ
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
    const startMonday = new Date(now);
    startMonday.setDate(now.getDate() + diffToMonday);
    startMonday.setHours(0, 0, 0, 0);

    const endDate = new Date(startMonday);
    endDate.setMonth(endDate.getMonth() + this.MONTHS_HORIZON);

    const weeks = [];
    let iterDate = new Date(startMonday);
    const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    while (iterDate < endDate) {
      const isoWeek = this.getWeekNumber(iterDate);
      const isoYear = iterDate.getFullYear();

      // Toujours calculer le lundi exact de cette semaine
      const weekStart = this.getMondayOfISOWeek(isoYear, isoWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const diffDays = Math.round((weekStart.getTime() - this.ANCHOR_DATE.getTime()) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const cycleIndex = ((diffWeeks % this.CYCLE_WEEKS) + this.CYCLE_WEEKS) % this.CYCLE_WEEKS;

      const restDayIndexes = cycle[cycleIndex] || [];
      const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

      const weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;

      const weekData = {
        weekId: `W_${isoYear}_${isoWeek}`,
        title: weekTitle,
        startDate: `${weekStart.getFullYear()}-${this.pad(weekStart.getMonth() + 1)}-${this.pad(weekStart.getDate())}`,
        endDate: `${weekEnd.getFullYear()}-${this.pad(weekEnd.getMonth() + 1)}-${this.pad(weekEnd.getDate())}`,
        isConfirmed: isConfirmedWeek,
        hasAlert: (this.ALERTES_SEMAINES.includes(isoWeek) && !isConfirmedWeek), 
        items: []
      };

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const currentD = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayIdx);
        const currentDTime = currentD.getTime();
        const dayShort = shortDays[dayIdx];
        const dayNum = this.pad(currentD.getDate());

        const holidayMatch = holidays.find(h => currentDTime >= h.start && currentDTime <= h.end);
        const isRestDay = restDayIndexes.includes(dayIdx);

        // 1. EN MODE ADMIN : Jours de repos personnels affichés en ROUGE
        if (showReposPerso && isRestDay) {
          weekData.items.push({
            dayShort: dayShort,
            dayNum: dayNum,
            title: "Repos",
            time: "",
            hasTime: false,
            type: "repos-perso",
            description: ""
          });
        }

        // 2. Recherche d'événements enregistrés (Garde ou RV)
        const matched = this.CONFIRMED_EVENTS.filter(ev => {
          const [y, m, d] = ev.date.split('-').map(Number);
          return d === currentD.getDate() && (m - 1) === currentD.getMonth() && y === currentD.getFullYear();
        });

        if (matched.length > 0) {
          matched.forEach(ev => {
            // En mode normal, la garde n'est visible que sur les 3 semaines confirmées
            if (ev.type === 'rdv' || isConfirmedWeek || showReposPerso) {
              weekData.items.push({
                dayShort: dayShort,
                dayNum: dayNum,
                title: ev.title,
                time: ev.time || "",
                hasTime: !!ev.time,
                type: ev.type,
                description: ""
              });
            }
          });
        } 
        // 3. En Mode Admin : afficher la garde sur les 6 à 8 mois au-delà des 3 semaines
        else if (showReposPerso && !isConfirmedWeek) {
          // Si Papounet est de repos le week-end (VEN/SAM ou SAM/DIM)
          if (restDayIndexes.includes(4) && restDayIndexes.includes(5)) {
            if (dayIdx === 4) {
              weekData.items.push({ dayShort, dayNum, title: "Je viens chercher les enfants", time: "à 17h00", hasTime: true, type: "confirmed", description: "" });
            } else if (dayIdx === 6) {
              weekData.items.push({ dayShort, dayNum, title: "Je ramène les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" });
            }
          } 
          // Si Papounet est de repos le dimanche (ex: semaine JEU/DIM)
          else if (restDayIndexes.includes(6)) {
            if (dayIdx === 6) {
              weekData.items.push({ dayShort, dayNum, title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" });
              weekData.items.push({ dayShort, dayNum, title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" });
            }
          }
        }
        // 4. Vacances scolaires
        else if (holidayMatch) {
          weekData.items.push({ 
            dayShort: dayShort, 
            dayNum: dayNum, 
            title: holidayMatch.title, 
            time: "", 
            hasTime: false, 
            type: 'holiday', 
            description: "" 
          });
        } 
        // 5. En Mode Normal : "Repos théorique" uniquement au-delà des 3 semaines (sans repos perso)
        else if (!isConfirmedWeek && isRestDay && !showReposPerso) {
          weekData.items.push({ 
            dayShort: dayShort, 
            dayNum: dayNum, 
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
