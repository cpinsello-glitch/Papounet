/**
 * Gestionnaire d'API Cloudflare et cache local
 */
const API = {
  /**
   * Récupère le planning depuis la fonction Cloudflare Pages (/api/planning)
   * avec secours immédiat sur le cache et le moteur local.
   */
  async getPlanning({ onCachedData, onFreshData, onError, onSyncStatus }) {
    // 1. Charger immédiatement le cache local ou calculer en local
    const cached = this.getLocalCache();
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      if (onCachedData) onCachedData(cached.data, cached.timestamp);
    } else if (typeof PlanningEngine !== 'undefined') {
      // Calcul local immédiat (0ms d'attente)
      const computed = PlanningEngine.compute();
      if (onCachedData) onCachedData(computed, Date.now());
    }

    // 2. Requête vers la fonction Cloudflare Pages
    if (onSyncStatus) onSyncStatus(true);
    
    try {
      const response = await fetch(CONFIG.API_URL, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Statut HTTP: ${response.status}`);
      }

      const freshData = await response.json();
      
      if (!Array.isArray(freshData) || freshData.length === 0) {
        throw new Error("Format de données invalide");
      }

      // Sauvegarde dans le cache local
      this.saveLocalCache(freshData);

      if (onFreshData) {
        onFreshData(freshData);
      }
    } catch (err) {
      console.info("Info API Cloudflare : utilisation des données locales/calculées.", err.message);
      
      // Si nous n'avions pas de cache, générer le planning via le moteur local
      if (!cached && typeof PlanningEngine !== 'undefined') {
        const computed = PlanningEngine.compute();
        this.saveLocalCache(computed);
        if (onFreshData) onFreshData(computed);
      } else if (onError) {
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
