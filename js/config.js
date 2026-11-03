/**
 * Configuration de l'application Papounet 🥰
 * 100% hébergé sur Cloudflare (sans Google Apps Script)
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
  MONTHS_HORIZON: 8
};
