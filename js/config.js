/**
 * Configuration de l'application Papounet 🥰
 */
const CONFIG = {
  // Point d'accès de l'API Cloudflare Pages Functions
  API_URL: "/api/planning",
  
  // Clés de stockage local (cache)
  STORAGE_KEY_DATA: "papounet_planning_data",
  STORAGE_KEY_TIMESTAMP: "papounet_planning_timestamp",
  
  // Durée de validité du cache en millisecondes (30 minutes)
  CACHE_TTL_MS: 30 * 60 * 1000,
  
  // Horizon de calcul en mois
  MONTHS_HORIZON: 8,

  // Codes PIN autorisés pour l'affichage des jours de repos personnels
  AUTHORIZED_PINS: ["66526", "84247"],

  // Identifiant de l'agenda des jours de repos
  CALENDAR_REPOS_ID: "8u93p21a2o1jtts2ocssuqegm0@group.calendar.google.com"
};
