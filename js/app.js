/**
 * Application Papounet 🥰
 */

let planningData = [];

/**
 * Initialisation
 */
document.addEventListener('DOMContentLoaded', () => {
  updateTodayButton();
  initServiceWorker();
  initSearch();
  loadPlanning();
});

/**
 * Met à jour le bouton Aujourd'hui (situé à droite de Go dans la barre du bas)
 */
function updateTodayButton() {
  const today = new Date();
  const options = { day: 'numeric', month: 'short' };
  const formatted = today.toLocaleDateString('fr-FR', options).replace('.', '');
  const btn = document.getElementById('todayBtn');
  if (btn) {
    btn.innerHTML = `<span class="sync-dot" id="syncDot"></span><span id="todayText">${formatted}</span>`;
  }
}

/**
 * Service Worker avec mise à jour automatique
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=3').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('Nouvelle version active.');
          }
        });
      });
    }).catch((err) => console.log('Erreur SW:', err));
  }
}

/**
 * Chargement et synchronisation du planning
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
        const localData = PlanningEngine.compute();
        renderPlanning(localData);
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
 * Rendu du planning dans le DOM
 */
function renderPlanning(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return;
  planningData = data;

  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  data.forEach((week) => {
    const header = document.createElement('div');
    header.className = 'week-header';
    header.innerText = week.title;
    fragment.appendChild(header);

    const card = document.createElement('div');
    card.className = 'week-card';
    card.id = week.weekId;

    if (!week.items || week.items.length === 0) {
      card.innerHTML = `<div class="empty-state">Semaine de travail (aucun repos partagé)</div>`;
    } else {
      let cardHtml = '';

      if (week.hasAlert) {
        cardHtml += `
          <div class="week-alert-banner">
            <span class="week-alert-icon">🚨</span>
            <span>Il peut y avoir un changement pour cette semaine.</span>
          </div>
        `;
      }

      week.items.forEach((item) => {
        const timeHtml = (item.hasTime && item.time) 
          ? `<div class="event-time">${escapeHtml(item.time)}</div>` 
          : '';

        // Icône ampoule pour les RDV des enfants
        let iconHtml = '';
        if (item.type === 'rdv') {
          iconHtml = `<div class="event-emoji">💡</div>`;
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
 * Initialisation de la recherche par date
 */
function initSearch() {
  const searchInput = document.getElementById('searchDate');
  if (searchInput) {
    searchInput.addEventListener('click', () => {
      if (typeof searchInput.showPicker === 'function') {
        try { searchInput.showPicker(); } catch (e) {}
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchDate();
      }
    });
  }
}

/**
 * Parser une date locale YYYY-MM-DD sans décalage UTC
 */
function parseLocalDate(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length < 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/**
 * Recherche d'une date et défilement
 */
function searchDate() {
  const inputEl = document.getElementById('searchDate');
  if (!inputEl || !inputEl.value) return;

  const targetDate = parseLocalDate(inputEl.value);
  inputEl.blur();

  if (!targetDate || isNaN(targetDate.getTime())) return;

  const found = planningData.find((w) => {
    const s = parseLocalDate(w.startDate);
    const e = parseLocalDate(w.endDate);
    if (!s || !e) return false;
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
 * Défilement fluide vers une semaine (sans décalage de header fixe)
 */
function scrollToTarget(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  document.querySelectorAll('.week-card').forEach((c) => c.classList.remove('highlight'));
  el.classList.add('highlight');

  const headerEl = el.previousElementSibling;
  const targetEl = (headerEl && headerEl.classList.contains('week-header')) ? headerEl : el;
  const offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - 16;

  window.scrollTo({
    top: Math.max(0, offsetPosition),
    behavior: 'smooth'
  });

  setTimeout(() => {
    el.classList.remove('highlight');
  }, 2500);
}

/**
 * Défilement vers la date du jour
 */
function scrollToCurrentWeek() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const currentWeek = planningData.find((w) => {
    const s = parseLocalDate(w.startDate);
    const e = parseLocalDate(w.endDate);
    if (!s || !e) return false;
    e.setHours(23, 59, 59, 999);
    return now >= s && now <= e;
  });

  if (currentWeek) {
    scrollToTarget(currentWeek.weekId);
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
