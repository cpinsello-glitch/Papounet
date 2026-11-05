/**
 * Moteur de calendrier Papounet
 * Basé 100% sur la lecture réelle des 3 agendas Google (zéro cycle théorique)
 */
const PlanningEngine = {
  MONTHS_HORIZON: 8,
  ALERTES_SEMAINES: [40],

  /**
   * Filtre les semaines selon le mode de visualisation :
   * - Mode Normal (enfants et maman) :
   *     - RV des enfants (💡) : visible sur les 8 mois
   *     - Garde Nolan & Thaïs : visible uniquement sur les semaines confirmées (3 semaines)
   *     - Vacances : visible
   *     - Agenda Repos : JAMAIS visible
   * - Mode Admin (Papounet après code PIN) :
   *     - RV des enfants (💡) : visible sur les 8 mois
   *     - Garde Nolan & Thaïs : visible sur tous les 8 mois
   *     - Agenda Repos (RC, RH, REC ?, FER...) : visible sur tous les 8 mois avec fond rouge
   *     - Vacances : visible
   *
   * @param {Array} rawWeeks Données complètes issues des 3 agendas
   * @param {boolean} isAdmin Indique si le mode admin est actif
   * @returns {Array} Semaines filtrées
   */
  filterWeeks(rawWeeks, isAdmin) {
    if (!rawWeeks || !Array.isArray(rawWeeks)) return [];

    return rawWeeks.map(week => {
      const isConfirmed = !!week.isConfirmed;

      const filteredItems = (week.items || []).filter(item => {
        // 1. Les RV des enfants (💡) sont toujours visibles pour tous
        if (item.type === 'rdv') return true;

        // 2. Les vacances scolaires sont toujours visibles
        if (item.type === 'holiday') return true;

        // 3. Les repos personnels (RC, RH, REC ?, FER...) sont UNIQUEMENT visibles en mode admin
        if (item.type === 'repos-perso') {
          return !!isAdmin;
        }

        // 4. Les événements de garde (Nolan & Thaïs)
        if (item.type === 'confirmed') {
          // En mode admin : visible sur les 8 mois
          if (isAdmin) return true;
          // En mode normal : visible uniquement sur les semaines confirmées (~3 semaines)
          return isConfirmed;
        }

        // Ignorer tout résidu théorique
        if (item.type === 'theory') return false;

        return false;
      });

      // Tri chronologique des événements dans la semaine
      filteredItems.sort((a, b) => {
        const dA = (a.date || "") + (a.time || "");
        const dB = (b.date || "") + (b.time || "");
        return dA.localeCompare(dB);
      });

      return {
        ...week,
        items: filteredItems
      };
    });
  },

  /**
   * Données initiales locales de secours (sans aucun repos inventé)
   */
  getInitialData() {
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
  },

  pad(n) { return n < 10 ? '0' + n : n; }
};
