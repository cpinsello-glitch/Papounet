/**
 * Application Papounet 🥰
 */

let planningData = [];

// Panneau de danger routier SVG (silhouette écoliers / enfants traversant) pour les RDV / Opération
const ROAD_SIGN_SVG = `
<svg class="road-sign-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Attention">
  <!-- Panneau losange jaune avec bordure noire -->
  <rect x="50" y="5" width="62" height="62" rx="8" transform="rotate(45 50 5)" fill="#FFD54F" stroke="#212121" stroke-width="5" />
  <!-- Silhouette deux enfants traversant -->
  <g fill="#212121">
    <!-- Grand enfant -->
    <circle cx="58" cy="40" r="5" />
    <path d="M54 47 L62 47 L64 62 L60 62 L59 55 L57 65 L53 65 L55 52 L52 50 Z" />
    <!-- Petit enfant tenant la main -->
    <circle cx="42" cy="46" r="4" />
    <path d="M38 52 L45 52 L46 64 L43 64 L42 58 L41 65 L37 65 L39 56 L36 54 Z" />
    <!-- Ligne de sol / passage piéton -->
    <rect x="30" y="69" width="40" height="3" rx="1.5" />
  </g>
</svg>
`;

/**
 * Initialisation au chargement de la page
 */
document.addEventListener('DOMContentLoaded', () => {
  updateTodayButton();
  initServiceWorker();
  initSearch();
  loadPlanning();
});

/**
 * Met à jour le texte du bouton Aujourd'hui dans le header (ex: "3 nov")
 */
function updateTodayButton() {
  const today = new Date();
  const options = { day: 'numeric', month: 'short' };
  const formatted = today.toLocaleDateString('fr-FR', options).replace('.', '');
  const btn = document.getElementById('todayBtn');
  if (btn) {
    btn.innerHTML = `<span class="sync-dot" id="syncDot"></span><span>${formatted}</span>`;
  }
}

/**
 * Enregistrement du Service Worker pour le mode hors-ligne et PWA
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker enregistré avec succès:', reg.scope))
        .catch((err) => console.log('Échec enregistrement Service Worker:', err));
    });
  }
}

/**
 * Chargement des données avec affichage immédiat du cache + mise à jour réseau
 */
function loadPlanning() {
  const container = document.getElementById('timeline');
  const syncDot = document.getElementById('syncDot');

  API.getPlanning({
    onCachedData: (data) => {
      renderPlanning(data);
    },
    onFreshData: (data) => {
      renderPlanning(data);
    },
    onError: (err, hasCache) => {
      console.warn("Erreur API :", err);
      if (!hasCache) {
        container.innerHTML = `
          <div class="empty-state">
            <p>Impossible de joindre le calendrier.</p>
            <p style="margin-top: 8px; font-size: 0.8rem;">Vérifiez votre connexion internet ou réessayez dans un instant.</p>
            <button onclick="loadPlanning()" style="margin-top: 14px; background: var(--badge-cyan-bg); color: var(--badge-cyan-text); border: none; padding: 8px 16px; border-radius: 12px; font-weight: 700; cursor: pointer;">Réessayer</button>
          </div>
        `;
      }
    },
    onSyncStatus: (isSyncing) => {
      if (syncDot) {
        if (isSyncing) syncDot.classList.add('active');
        else syncDot.classList.remove('active');
      }
    }
  });
}

/**
 * Génère le DOM pour toutes les semaines
 */
function renderPlanning(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return;
  planningData = data;

  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  data.forEach((week) => {
    // En-tête de la semaine
    const header = document.createElement('div');
    header.className = 'week-header';
    header.innerText = week.title;
    fragment.appendChild(header);

    // Carte de la semaine
    const card = document.createElement('div');
    card.className = 'week-card';
    card.id = week.weekId;

    if (!week.items || week.items.length === 0) {
      card.innerHTML = `<div class="empty-state">Semaine de travail (aucun repos partagé)</div>`;
    } else {
      let cardHtml = '';

      // Alerte éventuelle
      if (week.hasAlert) {
        cardHtml += `
          <div class="week-alert-banner">
            <span class="week-alert-icon">🚨</span>
            <span>Il peut y avoir un changement pour cette semaine.</span>
          </div>
        `;
      }

      // Événements de la semaine
      week.items.forEach((item) => {
        const timeHtml = (item.hasTime && item.time) 
          ? `<div class="event-time">${escapeHtml(item.time)}</div>` 
          : '';

        let iconHtml = '';
        if (item.type === 'rdv') {
          // Si c'est un RDV, afficher l'icône de signalisation routière
          iconHtml = `<div class="event-emoji">${ROAD_SIGN_SVG}</div>`;
        }

        const descHtml = item.description 
          ? `<div class="event-desc">${escapeHtml(item.description).replace(/\n/g, '<br>')}</div>` 
          : '';

        cardHtml += `
          <div class="event-row">
            <div class="date-block">
              <span class="date-short">${escapeHtml(item.dayShort)}</span>
              <span class="date-num">${escapeHtml(item.dayNum)}</span>
            </div>
            <div class="event-content type-${escapeHtml(item.type)}">
              ${iconHtml}
              <div class="event-text-container">
                <div class="event-title">${escapeHtml(item.title)}</div>
                ${timeHtml}
                ${descHtml}
              </div>
            </div>
          </div>
        `;
      });

      card.innerHTML = cardHtml;
    }

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Initialise la recherche par date
 */
function initSearch() {
  const searchInput = document.getElementById('searchDate');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchDate();
    });
  }
}

/**
 * Rechercher une date dans le calendrier et défiler jusqu'à la semaine
 */
function searchDate() {
  const inputEl = document.getElementById('searchDate');
  if (!inputEl || !inputEl.value) return;

  const input = inputEl.value;
  inputEl.value = '';
  inputEl.blur();

  const targetDate = new Date(input);
  if (isNaN(targetDate.getTime())) return;

  const found = planningData.find((w) => {
    const s = new Date(w.startDate);
    const e = new Date(w.endDate);
    e.setHours(23, 59, 59, 999);
    return targetDate >= s && targetDate <= e;
  });

  if (found) {
    scrollToTarget(found.weekId);
  } else {
    alert("Date hors de la période calculée (8 mois).");
  }
}

/**
 * Défilement fluide vers un élément donné avec animation de focus
 */
function scrollToTarget(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  document.querySelectorAll('.week-card').forEach((c) => c.classList.remove('highlight'));
  el.classList.add('highlight');

  const headerEl = el.previousElementSibling;
  const targetEl = (headerEl && headerEl.classList.contains('week-header')) ? headerEl : el;
  const headerHeight = document.querySelector('header').offsetHeight;
  const offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;

  window.scrollTo({
    top: Math.max(0, offsetPosition),
    behavior: 'smooth'
  });

  setTimeout(() => {
    el.classList.remove('highlight');
  }, 2500);
}

/**
 * Défilement vers la semaine en cours
 */
function scrollToCurrentWeek() {
  const now = new Date();
  const currentWeek = planningData.find((w) => {
    const s = new Date(w.startDate);
    const e = new Date(w.endDate);
    e.setHours(23, 59, 59, 999);
    return now >= s && now <= e;
  });

  if (currentWeek) {
    scrollToTarget(currentWeek.weekId);
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Utilitaire pour échapper le HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
