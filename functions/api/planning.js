/**
 * Cloudflare Pages Function : /api/planning
 * Exécuté nativement sur le réseau Edge Cloudflare Workers
 */

const LIVE_DATA_URL = "https://script.google.com/macros/s/AKfycbwaZe5N6chSdeHFo1ahqKoQj_5LRFzWm7NbrzWCiKiaOj7Qj8-Y_rpxAMEGO8hB55Eb/exec";

export async function onRequestGet(context) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(LIVE_DATA_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const rawData = await response.json();
      if (Array.isArray(rawData) && rawData.length > 0) {
        // Filtrer et nettoyer les données selon les règles
        const sanitized = sanitizePlanning(rawData);
        return new Response(JSON.stringify(sanitized), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
  } catch (e) {
    console.warn("Échec récupération live feed:", e.message);
  }

  // Secours complet si le flux distant n'est pas disponible
  const fallback = getFallbackSchedule();
  return new Response(JSON.stringify(fallback), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Fallback': 'true',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * Nettoie les données :
 * - Retire tout "Repos confirmé"
 * - Ne garde que le premier horaire
 */
function sanitizePlanning(weeks) {
  return weeks.map(w => {
    const cleanItems = (w.items || [])
      .filter(item => {
        const title = (item.title || "").toLowerCase();
        // Ne jamais afficher "repos confirmé"
        return !title.includes("repos confirmé");
      })
      .map(item => {
        let cleanTime = item.time || "";
        // Ne conserver que le premier horaire (ex: "à 17h00")
        if (cleanTime.includes(' - ')) {
          cleanTime = cleanTime.split(' - ')[0];
        }
        return {
          ...item,
          time: cleanTime
        };
      });

    return {
      ...w,
      items: cleanItems
    };
  });
}

function getFallbackSchedule() {
  return [
    {
      weekId: "W_2026_45",
      title: "Semaine 45 • 2 Novembre - 8 Novembre",
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      isConfirmed: true,
      hasAlert: false,
      items: [
        { dayShort: "VEN", dayNum: "06", title: "Je viens chercher les enfants", time: "à 17h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "08", title: "Je ramène les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" }
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
        { dayShort: "DIM", dayNum: "15", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "15", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
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
        { dayShort: "MAR", dayNum: "17", title: "Opération Nolan", time: "", hasTime: false, type: "rdv", description: "" },
        { dayShort: "MER", dayNum: "18", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "MER", dayNum: "18", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "22", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "22", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
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
        { dayShort: "MER", dayNum: "25", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "MER", dayNum: "25", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
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
        { dayShort: "MER", dayNum: "02", title: "Je viens chercher les enfants", time: "à 12h30", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "MER", dayNum: "02", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "06", title: "Je viens chercher les enfants", time: "à 11h00", hasTime: true, type: "confirmed", description: "" },
        { dayShort: "DIM", dayNum: "06", title: "Je ramène les enfants", time: "à 18h00", hasTime: true, type: "confirmed", description: "" }
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
        { dayShort: "LUN", dayNum: "21", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "MAR", dayNum: "22", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "MER", dayNum: "23", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "JEU", dayNum: "24", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "VEN", dayNum: "25", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "SAM", dayNum: "26", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" },
        { dayShort: "DIM", dayNum: "27", title: "Noël", time: "", hasTime: false, type: "holiday", description: "" }
      ]
    }
  ];
}
