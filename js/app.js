/**
 * Application Papounet
 */

let planningData = [];
let rawPlanningData = [];
let isShieldActive = false;

/**
 * Gestion automatique du mode sombre selon le lever/coucher du soleil
 */
const SolarTheme = {
  DEFAULT_LAT: 46.6,
  DEFAULT_LON: 2.2,

  init() {
    this.applyTheme();
    setInterval(() => this.applyTheme(), 60000);

    if ('geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.DEFAULT_LAT = pos.coords.latitude;
            this.DEFAULT_LON = pos.coords.longitude;
            this.applyTheme();
          },
          () => {},
          { timeout: 4000, maximumAge: 86400000 }
        );
      } catch (e) {}
    }
  },

  isNightTime() {
    const now = new Date();
    const times = this.getSunTimes(now, this.DEFAULT_LAT, this.DEFAULT_LON);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes < times.sunriseMinutes || nowMinutes >= times.sunsetMinutes;
  },

  getSunTimes(date, lat, lon) {
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date - startOfYear) / 86400000);
    const rad = Math.PI / 180;

    const decl = 23.45 * Math.sin(rad * (360 / 365) * (dayOfYear - 81));
    const zenith = 90.833;

    let cosH = (Math.cos(rad * zenith) - Math.sin(rad * lat) * Math.sin(rad * decl)) /
               (Math.cos(rad * lat) * Math.cos(rad * decl));

    if (cosH > 1) cosH = 1;
    if (cosH < -1) cosH = -1;

    const H = Math.acos(cosH) / rad;
    const tzOffsetHours = -date.getTimezoneOffset() / 60;

    const sunriseHours = 12 - (H / 15) - (lon / 15) + tzOffsetHours;
    const sunsetHours = 12 + (H / 15) - (lon / 15) + tzOffsetHours;

    return {
      sunriseMinutes: Math.round(sunriseHours * 60),
      sunsetMinutes: Math.round(sunsetHours * 60)
    };
  },

  applyTheme() {
    const isDark = this.isNightTime();
    document.documentElement.classList.toggle('dark', isDark);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#000000' : '#ffffff');
    }
  }
};

/**
 * Initialisation au chargement
 */
document.addEventListener('DOMContentLoaded', () => {
  SolarTheme.init();
  updateTodayButton();
  initServiceWorker();
  initSearch();
  initPinInput();
  loadPlanning();
});

/**
 * Met à jour le bouton Aujourd'hui (date parfaitement centrée)
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
 * Service Worker
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=8').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('Nouvelle version prête.');
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
      rawPlanningData = data;
      renderPlanning(applyShieldMode(data, isShieldActive));
    },
    onFreshData: (data) => {
      rawPlanningData = data;
      renderPlanning(applyShieldMode(data, isShieldActive));
    },
    onError: (err, hasCache) => {
      console.warn("Erreur API :", err);
      if (!hasCache) {
        const localData = PlanningEngine.compute({ showReposPerso: isShieldActive });
        rawPlanningData = localData;
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
 * Applique ou retire les jours de repos personnels (mode Bouclier)
 */
function applyShieldMode(weeks, showRepos) {
  if (!weeks || !Array.isArray(weeks)) return [];

  // Si désactivé, filtrer simplement les éventuels items de repos perso
  if (!showRepos) {
    return weeks.map(w => ({
      ...w,
      items: (w.items || []).filter(item => item.type !== 'repos-perso')
    }));
  }

  // Si activé, calculer les jours de repos du cycle de 15 semaines
  const cycle = PlanningEngine.CYCLE_REPOS;
  const anchorDate = PlanningEngine.ANCHOR_DATE;
  const cycleWeeks = PlanningEngine.CYCLE_WEEKS;
  const shortDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  return weeks.map(w => {
    // Calcul de l'index du cycle pour cette semaine
    const weekStart = parseLocalDate(w.startDate);
    let restDayIndexes = [];
    if (weekStart) {
      const diffDays = Math.round((weekStart.getTime() - anchorDate.getTime()) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const cycleIndex = ((diffWeeks % cycleWeeks) + cycleWeeks) % cycleWeeks;
      restDayIndexes = cycle[cycleIndex] || [];
    }

    // Filtrer d'abord les anciens repos perso
    const baseItems = (w.items || []).filter(item => item.type !== 'repos-perso');
    const newItems = [...baseItems];

    if (weekStart && restDayIndexes.length > 0) {
      restDayIndexes.forEach(dayIdx => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + dayIdx);
        const dayNum = PlanningEngine.pad(d.getDate());
        const dayShort = shortDays[dayIdx];

        // Ajouter l'item de repos personnel
        newItems.push({
          dayShort: dayShort,
          dayNum: dayNum,
          title: "Repos",
          time: "",
          hasTime: false,
          type: "repos-perso",
          description: ""
        });
      });
    }

    // Tri des items par jour dans la semaine (du lundi au dimanche)
    const dayOrder = { 'LUN': 0, 'MAR': 1, 'MER': 2, 'JEU': 3, 'VEN': 4, 'SAM': 5, 'DIM': 6 };
    newItems.sort((a, b) => {
      const diffDay = (dayOrder[a.dayShort] || 0) - (dayOrder[b.dayShort] || 0);
      if (diffDay !== 0) return diffDay;
      // Si même jour, mettre le repos en premier ou ordonner
      if (a.type === 'repos-perso') return -1;
      if (b.type === 'repos-perso') return 1;
      return 0;
    });

    return {
      ...w,
      items: newItems
    };
  });
}

/**
 * Gestion du clic sur le bouton Bouclier
 */
function onShieldClick() {
  if (isShieldActive) {
    // Si déjà actif, le fermer et revenir à l'affichage de base
    isShieldActive = false;
    document.getElementById('shieldBtn').classList.remove('active');
    renderPlanning(applyShieldMode(rawPlanningData, false));
  } else {
    // Ouvrir la modale de saisie du code PIN
    openPinModal();
  }
}

/**
 * Modale Code PIN
 */
function openPinModal() {
  const modal = document.getElementById('pinModal');
  const input = document.getElementById('pinInput');
  const error = document.getElementById('pinError');
  const card = document.getElementById('pinCard');

  if (modal && input) {
    input.value = '';
    if (error) error.innerText = '';
    if (card) card.classList.remove('shake');
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 150);
  }
}

function closePinModal() {
  const modal = document.getElementById('pinModal');
  const input = document.getElementById('pinInput');
  if (modal) modal.style.display = 'none';
  if (input) input.blur();
}

function onPinOverlayClick(event) {
  if (event.target && event.target.id === 'pinModal') {
    closePinModal();
  }
}

function initPinInput() {
  const input = document.getElementById('pinInput');
  if (input) {
    input.addEventListener('input', () => {
      // Validation automatique dès que 5 chiffres sont entrés
      if (input.value.length === 5) {
        submitPin();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitPin();
      }
    });
  }
}

function submitPin() {
  const input = document.getElementById('pinInput');
  const error = document.getElementById('pinError');
  const card = document.getElementById('pinCard');
  if (!input) return;

  const entered = input.value.trim();

  // Vérification avec les 2 codes autorisés : 66526 ou 84247
  if (CONFIG.AUTHORIZED_PINS.includes(entered)) {
    isShieldActive = true;
    closePinModal();
    const btn = document.getElementById('shieldBtn');
    if (btn) btn.classList.add('active');
    renderPlanning(applyShieldMode(rawPlanningData, true));
  } else {
    if (error) error.innerText = "Code incorrect";
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth; // Déclenchement du reflow
      card.classList.add('shake');
    }
    input.value = '';
    input.focus();
  }
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

      week.items.forEach((item, index) => {
        const nextItem = week.items[index + 1];
        const prevItem = week.items[index - 1];

        // Vérifier si 2 événements ont lieu le même jour (suppression du trait)
        const isSameDayAsNext = nextItem && nextItem.dayNum === item.dayNum && nextItem.dayShort === item.dayShort;
        const isSameDayAsPrev = prevItem && prevItem.dayNum === item.dayNum && prevItem.dayShort === item.dayShort;

        let rowClasses = 'event-row';
        if (isSameDayAsNext) {
          rowClasses += ' no-divider';
        }
        if (isSameDayAsPrev) {
          rowClasses += ' is-same-day-follow';
        }

        const timeHtml = (item.hasTime && item.time) 
          ? `<div class="event-time">${escapeHtml(item.time)}</div>` 
          : '';

        let iconHtml = '';
        if (item.type === 'rdv') {
          iconHtml = `<div class="event-emoji">💡</div>`;
        }

        const descHtml = item.description 
          ? `<div class="event-desc">${escapeHtml(item.description).replace(/\n/g, '<br>')}</div>` 
          : '';

        cardHtml += `
          <div class="${rowClasses}">
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
 * Parser une date locale
 */
function parseLocalDate(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length < 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/**
 * Recherche d'une date (avec vidage immédiat lors du clic sur Go)
 */
function searchDate() {
  const inputEl = document.getElementById('searchDate');
  if (!inputEl || !inputEl.value) return;

  const rawValue = inputEl.value;

  inputEl.value = '';
  inputEl.blur();

  const targetDate = parseLocalDate(rawValue);
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
 * Défilement fluide vers une semaine (dégagement de 92px sous la barre d'état)
 */
function scrollToTarget(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  document.querySelectorAll('.week-card').forEach((c) => c.classList.remove('highlight'));
  el.classList.add('highlight');

  const headerEl = el.previousElementSibling;
  const targetEl = (headerEl && headerEl.classList.contains('week-header')) ? headerEl : el;
  
  // Dégagement net pour que le titre de la semaine soit parfaitement visible sous la barre d'état
  const topClearance = 92;
  const offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - topClearance;

  window.scrollTo({
    top: Math.max(0, offsetPosition),
    behavior: 'smooth'
  });

  setTimeout(() => {
    el.classList.remove('highlight');
  }, 2500);
}

/**
 * Défilement vers aujourd'hui
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
