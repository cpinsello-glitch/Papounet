/**
 * Configuration de l'application Papounet 🥰
 */
const CONFIG = {
  // URL de l'API Google Apps Script
  API_URL: "https://script.google.com/macros/s/AKfycbwaZe5N6chSdeHFo1ahqKoQj_5LRFzWm7NbrzWCiKiaOj7Qj8-Y_rpxAMEGO8hB55Eb/exec",
  
  // Clés de stockage local (cache)
  STORAGE_KEY_DATA: "papounet_planning_data",
  STORAGE_KEY_TIMESTAMP: "papounet_planning_timestamp",
  
  // Durée de validité du cache en millisecondes (ex: 1 heure)
  CACHE_TTL_MS: 60 * 60 * 1000,
  
  // Horizon de visualisation
  MONTHS_HORIZON: 8,

  // Données de secours initiales (pour affichage instantané dès la toute première ouverture)
  INITIAL_FALLBACK_DATA: [
    {
      "weekId": "W_2026_45",
      "title": "SEMAINE 45 • 2 NOVEMBRE - 8 NOVEMBRE",
      "startDate": "2026-11-02",
      "endDate": "2026-11-08",
      "isConfirmed": true,
      "hasAlert": false,
      "items": [
        { "dayShort": "VEN", "dayNum": "06", "title": "Je viens chercher les enfants", "time": "à 17h00", "hasTime": true, "type": "confirmed", "description": "" },
        { "dayShort": "DIM", "dayNum": "08", "title": "Je ramène les enfants", "time": "à 11h00", "hasTime": true, "type": "confirmed", "description": "" }
      ]
    },
    {
      "weekId": "W_2026_46",
      "title": "SEMAINE 46 • 9 NOVEMBRE - 15 NOVEMBRE",
      "startDate": "2026-11-09",
      "endDate": "2026-11-15",
      "isConfirmed": true,
      "hasAlert": false,
      "items": [
        { "dayShort": "DIM", "dayNum": "15", "title": "Je viens chercher les enfants", "time": "à 11h00", "hasTime": true, "type": "confirmed", "description": "" },
        { "dayShort": "DIM", "dayNum": "15", "title": "Je ramène les enfants", "time": "à 18h00", "hasTime": true, "type": "confirmed", "description": "" }
      ]
    },
    {
      "weekId": "W_2026_47",
      "title": "SEMAINE 47 • 16 NOVEMBRE - 22 NOVEMBRE",
      "startDate": "2026-11-16",
      "endDate": "2026-11-22",
      "isConfirmed": true,
      "hasAlert": false,
      "items": [
        { "dayShort": "MAR", "dayNum": "17", "title": "Opération Nolan", "time": "", "hasTime": false, "type": "rdv", "description": "" },
        { "dayShort": "DIM", "dayNum": "22", "title": "Je viens chercher les enfants", "time": "à 11h00", "hasTime": true, "type": "confirmed", "description": "" },
        { "dayShort": "DIM", "dayNum": "22", "title": "Je ramène les enfants", "time": "à 18h00", "hasTime": true, "type": "confirmed", "description": "" }
      ]
    },
    {
      "weekId": "W_2026_48",
      "title": "SEMAINE 48 • 23 NOVEMBRE - 29 NOVEMBRE",
      "startDate": "2026-11-23",
      "endDate": "2026-11-29",
      "isConfirmed": false,
      "hasAlert": false,
      "items": [
        { "dayShort": "LUN", "dayNum": "23", "title": "Repos théorique", "time": "À confirmer à S -14 jours", "hasTime": true, "type": "theory", "description": "" },
        { "dayShort": "MER", "dayNum": "25", "title": "Repos théorique", "time": "À confirmer à S -14 jours", "hasTime": true, "type": "theory", "description": "" }
      ]
    },
    {
      "weekId": "W_2026_49",
      "title": "SEMAINE 49 • 30 NOVEMBRE - 6 DÉCEMBRE",
      "startDate": "2026-11-30",
      "endDate": "2026-12-06",
      "isConfirmed": false,
      "hasAlert": false,
      "items": [
        { "dayShort": "MAR", "dayNum": "01", "title": "Repos théorique", "time": "À confirmer à S -14 jours", "hasTime": true, "type": "theory", "description": "" },
        { "dayShort": "DIM", "dayNum": "06", "title": "Repos théorique", "time": "À confirmer à S -14 jours", "hasTime": true, "type": "theory", "description": "" }
      ]
    },
    {
      "weekId": "W_2026_52",
      "title": "SEMAINE 52 • 21 DÉCEMBRE - 27 DÉCEMBRE",
      "startDate": "2026-12-21",
      "endDate": "2026-12-27",
      "isConfirmed": false,
      "hasAlert": false,
      "items": [
        { "dayShort": "LUN", "dayNum": "21", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "MAR", "dayNum": "22", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "MER", "dayNum": "23", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "JEU", "dayNum": "24", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "VEN", "dayNum": "25", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "SAM", "dayNum": "26", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" },
        { "dayShort": "DIM", "dayNum": "27", "title": "Noël", "time": "", "hasTime": false, "type": "holiday", "description": "" }
      ]
    }
  ]
};
