/**
 * Gestionnaire d'API et du cache local
 */
const API = {
  /**
   * Récupère le planning en utilisant une stratégie "Cache then Network" :
   * Renvoie immédiatement les données en cache si disponibles, puis rafraîchit en arrière-plan.
   */
  async getPlanning({ onCachedData, onFreshData, onError, onSyncStatus }) {
    // 1. Essayer de charger le cache local immédiatement
    const cached = this.getLocalCache();
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      if (onCachedData) onCachedData(cached.data, cached.timestamp);
    } else if (CONFIG.INITIAL_FALLBACK_DATA && CONFIG.INITIAL_FALLBACK_DATA.length > 0) {
      // Données de démarrage initiales pour affichage immédiat
      if (onCachedData) onCachedData(CONFIG.INITIAL_FALLBACK_DATA, Date.now());
    }

    // 2. Lancer la requête réseau vers Google Apps Script
    if (onSyncStatus) onSyncStatus(true);
    
    try {
      const response = await fetch(CONFIG.API_URL, { 
        method: 'GET',
        redirect: 'follow',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur réseau (${response.status})`);
      }

      const freshData = await response.json();
      
      if (!Array.isArray(freshData)) {
        throw new Error("Format de données invalide reçu du serveur");
      }

      // Sauvegarder dans le cache local
      this.saveLocalCache(freshData);

      if (onFreshData) {
        onFreshData(freshData);
      }
    } catch (err) {
      console.warn("Échec du rafraîchissement réseau :", err);
      if (onError) {
        onError(err, !!cached);
      }
    } finally {
      if (onSyncStatus) onSyncStatus(false);
    }
  },

  getLocalCache() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_DATA);
      const time = localStorage.getItem(CONFIG.STORAGE_KEY_TIMESTAMP);
      if (!raw) return null;
      return {
        data: JSON.parse(raw),
        timestamp: time ? parseInt(time, 10) : Date.now()
      };
    } catch (e) {
      console.error("Erreur lecture cache local :", e);
      return null;
    }
  },

  saveLocalCache(data) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_DATA, JSON.stringify(data));
      localStorage.setItem(CONFIG.STORAGE_KEY_TIMESTAMP, Date.now().toString());
    } catch (e) {
      console.error("Erreur écriture cache local :", e);
    }
  }
};
