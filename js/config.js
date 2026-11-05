/**
 * Configuration de l'application Papounet 🥰
 */
const CONFIG = {
  // Point d'accès de l'API Cloudflare Pages Functions
  API_URL: "/api/planning",
  
  // Clés de stockage local (cache) versionné
  STORAGE_KEY_DATA: "papounet_planning_v16",
  STORAGE_KEY_TIMESTAMP: "papounet_planning_timestamp_v16",
  
  // Durée de validité du cache en millisecondes (15 minutes)
  CACHE_TTL_MS: 15 * 60 * 1000,
  
  // Horizon de visualisation en mois glissants
  MONTHS_HORIZON: 8,

  // Codes PIN autorisés pour l'accès Admin
  AUTHORIZED_PINS: ["66526", "84247"],

  // Identifiants officiels des 3 agendas Google
  CALENDARS: {
    REPOS: "8u93p21a2o1jtts2ocssuqegm0@group.calendar.google.com",
    GARDE: "g4iphl07ea67cg982dvaf8s068@group.calendar.google.com",
    RDV:   "4315aff00d85a2e1137c18d91a12d4ac4f89c3a3393f9bd540d35d2aa36d0711@group.calendar.google.com"
  },

  // ========================================================
  // 🏖️ MES SEMAINES DE VACANCES
  // Pour ajouter ou modifier des semaines de vacances dans le code,
  // ajoutez simplement une ligne ci-dessous au format :
  // { title: "Nom des vacances", start: "AAAA-MM-JJ", end: "AAAA-MM-JJ" },
  // ========================================================
  VACANCES: [
    { title: "Toussaint", start: "2026-10-19", end: "2026-10-25" },
    { title: "Noël",      start: "2026-12-21", end: "2027-01-03" },
    { title: "Hiver",     start: "2027-02-15", end: "2027-02-28" },
    { title: "Printemps", start: "2027-04-12", end: "2027-04-25" }
  ]
};
