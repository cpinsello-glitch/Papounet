/**
 * Moteur de calendrier Papounet 🥰
 * 
 * Règles :
 * - Mode Normal (enfants et maman) :
 *     - Semaines confirmées (~3 semaines) : Garde Nolan & Thaïs + RV enfants (💡). AUCUN repos.
 *     - Au-delà de 3 semaines (sur 8 mois glissants) : Repos théorique en GRIS selon le roulement de 15 semaines + RV enfants (💡).
 * - Mode Admin (Papounet avec code 66526 ou 84247) :
 *     - Tous les 8 mois : RV enfants (💡).
 *     - Tous les 8 mois : Garde Nolan & Thaïs.
 *     - Tous les 8 mois : Jours de repos en ROUGE avec le titre exact (RC, RH, REC ?, FER, ou Repos).
 */
const PlanningEngine = {
  ANCHOR_DATE: new Date(2026, 8, 21), // Lundi 21 septembre 2026 (Semaine 39)
  CYCLE_WEEKS: 15,
  MONTHS_HORIZON: 8,
  ALERTES_SEMAINES: [40],

  // Roulement officiel de 15 semaines
  // 0: LUN, 1: MAR, 2: MER, 3: JEU, 4: VEN, 5: SAM, 6: DIM
  CYCLE_REPOS: [
    [4, 5],    // S39 (Anchor) : VEN, SAM
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
  ],

  // Événements réels de repos connus (RC, RH, REC ?, FER...)
  REPOS_EVENTS: [
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
  ],

  // Événements confirmés de garde et rendez-vous
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
    { date: "2026-11-22", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },

    // Semaine 48
    { date: "2026-11-25", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
    { date: "2026-11-25", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },

    // Semaine 49
    { date: "2026-12-02", title: "Je viens chercher les enfants", time: "à 12h30", type: "confirmed" },
    { date: "2026-12-02", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" },
    { date: "2026-12-06", title: "Je viens chercher les enfants", time: "à 11h00", type: "confirmed" },
    { date: "2026-12-06", title: "Je ramène les enfants", time: "à 18h00", type: "confirmed" }
  ],

  getConfirmationDeadline(now) {
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
  },

  getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  },

  pad(n) { return n < 10 ? '0' + n : n; },

  /**
   * Calcul principal du planning sur 8 mois glissants
   * @param {Object} options
   * @param {boolean} options.isAdmin Mode Admin actif
   */
  compute(options = {}) {
    const isAdmin = !!options.isAdmin;
    const now = new Date();
    const confirmDeadline = this.getConfirmationDeadline(now);

    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
    const startMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);

    const endDate = new Date(startMonday.getFullYear(), startMonday.getMonth() + this.MONTHS_HORIZON, startMonday.getDate());

    const weeks = [];
    let iterDate = new Date(startMonday);
    const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    while (iterDate < endDate) {
      const weekStart = new Date(iterDate);
      const weekEnd = new Date(iterDate.getFullYear(), iterDate.getMonth(), iterDate.getDate() + 6);

      const isoWeek = this.getWeekNumber(weekStart);
      const isoYear = weekStart.getFullYear();

      // Calcul du roulement de 15 semaines
      const diffDays = Math.round((weekStart.getTime() - this.ANCHOR_DATE.getTime()) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const cycleIndex = ((diffWeeks % this.CYCLE_WEEKS) + this.CYCLE_WEEKS) % this.CYCLE_WEEKS;
      const restDayIndexes = this.CYCLE_REPOS[cycleIndex] || [];

      // Semaine confirmée (~3 semaines)
      const isConfirmedWeek = (weekEnd.getTime() <= confirmDeadline.getTime());

      // Vérifier si la semaine contient des vacances
      const holidays = (CONFIG.VACANCES || []).map(v => {
        const pS = v.start.split('-').map(Number);
        const pE = v.end.split('-').map(Number);
        return {
          title: v.title,
          start: new Date(pS[0], pS[1] - 1, pS[2], 0, 0, 0).getTime(),
          end: new Date(pE[0], pE[1] - 1, pE[2], 23, 59, 59, 999).getTime()
        };
      });

      const weekMidTime = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 3).getTime();
      const holidayForWeek = holidays.find(h => weekMidTime >= h.start && weekMidTime <= h.end);

      let weekTitle = `Semaine ${isoWeek} • ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;
      if (holidayForWeek) {
        weekTitle += ` (Vacances ${holidayForWeek.title})`;
      }

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
        const dayShort = shortDays[dayIdx];
        const dayNum = this.pad(currentD.getDate());
        const dateStr = `${currentD.getFullYear()}-${this.pad(currentD.getMonth() + 1)}-${this.pad(currentD.getDate())}`;

        // 1. Détection des jours de repos
        const reposMatch = this.REPOS_EVENTS.find(r => r.date === dateStr);
        const isRestFromCycle = restDayIndexes.includes(dayIdx);

        // A. MODE ADMIN : Jours de repos en ROUGE sur tous les 8 mois
        if (isAdmin) {
          if (reposMatch) {
            weekData.items.push({
              date: dateStr,
              dayShort,
              dayNum,
              title: reposMatch.title,
              time: "",
              hasTime: false,
              type: "repos-perso",
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
              type: "repos-perso",
              description: ""
            });
          }
        }
        // B. MODE NORMAL : Repos théorique en GRIS uniquement APRÈS les 3 semaines confirmées (sur 8 mois glissants)
        else if (!isConfirmedWeek) {
          if (reposMatch || isRestFromCycle) {
            weekData.items.push({
              date: dateStr,
              dayShort,
              dayNum,
              title: "Repos théorique",
              time: "À confirmer à S -14 jours",
              hasTime: true,
              type: "theory",
              description: ""
            });
          }
        }

        // 2. Événements de garde et rendez-vous
        const matchedEvents = this.CONFIRMED_EVENTS.filter(ev => ev.date === dateStr);
        matchedEvents.forEach(ev => {
          // - RV enfants (💡) : toujours visible
          // - Garde enfants : toujours visible en Admin, visible uniquement sur ~3 semaines en Normal
          if (ev.type === 'rdv' || isConfirmedWeek || isAdmin) {
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
          }
        });
      }

      // Tri chronologique des événements de la journée
      weekData.items.sort((a, b) => {
        const dA = (a.date || "") + (a.time || "");
        const dB = (b.date || "") + (b.time || "");
        return dA.localeCompare(dB);
      });

      weeks.push(weekData);
      iterDate.setDate(iterDate.getDate() + 7);
    }

    return weeks;
  },

  getInitialData() {
    return this.compute({ isAdmin: false });
  },

  /**
   * Intègre des événements externes distants sans doublons et sans "Busy"
   */
  mergeExternalEvents(rawWeeks) {
    if (!rawWeeks || !Array.isArray(rawWeeks)) return;

    rawWeeks.forEach(w => {
      (w.items || []).forEach(item => {
        const title = (item.title || "").trim();
        // Éliminer strictement tout événement "Busy" ou vide
        if (!title || title.toLowerCase() === 'busy') return;

        // Ne pas fusionner les repos théoriques dans la liste des événements réels
        if (item.type === 'theory' || title.toLowerCase().includes('théorique')) return;

        const dateStr = item.date;
        if (!dateStr) return;

        const upperTitle = title.toUpperCase();
        const isRepos = item.type === 'repos-perso' || upperTitle === 'RC' || upperTitle === 'RH' || upperTitle.startsWith('REC') || upperTitle === 'FER' || upperTitle === 'REPOS';

        if (isRepos) {
          const exists = this.REPOS_EVENTS.some(r => r.date === dateStr);
          if (!exists) {
            this.REPOS_EVENTS.push({ date: dateStr, title: title });
          }
        } else {
          const exists = this.CONFIRMED_EVENTS.some(ev => ev.date === dateStr && ev.title.toLowerCase() === title.toLowerCase());
          if (!exists) {
            this.CONFIRMED_EVENTS.push({
              date: dateStr,
              title: title,
              time: item.time || "",
              type: item.type || 'confirmed'
            });
          }
        }
      });
    });
  }
};
