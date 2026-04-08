// @ts-check

const state = {
  payload: null,
  search: "",
  favoritesOnly: false,
  selectedDate: "",
  activeFilters: new Set(),
  favorites: loadFavorites()
};

const REGION_LABELS = {
  bariloche: "Bariloche",
  tronador: "Tronador",
  bolson: "El Bolsón",
  angostura: "Villa La Angostura",
  "buenos-aires": "Buenos Aires"
};

const els = {
  overviewStrip: document.querySelector("#overview-strip"),
  cardsGrid: document.querySelector("#cards-grid"),
  planList: document.querySelector("#plan-list"),
  longrangePlan: document.querySelector("#longrange-plan"),
  longrangeGrid: document.querySelector("#longrange-grid"),
  filterGroups: document.querySelector("#filter-groups"),
  errorBanner: document.querySelector("#error-banner"),
  lastUpdated: document.querySelector("#last-updated"),
  sourceMode: document.querySelector("#source-mode"),
  timezoneLabel: document.querySelector("#timezone-label"),
  cacheNote: document.querySelector("#cache-note"),
  searchInput: document.querySelector("#search-input"),
  dateSelect: document.querySelector("#date-select"),
  favoritesOnly: document.querySelector("#favorites-only"),
  refreshButton: document.querySelector("#refresh-button"),
  detailDialog: document.querySelector("#detail-dialog"),
  detailContent: document.querySelector("#detail-content"),
  rulesButton: document.querySelector("#rules-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  rulesContent: document.querySelector("#rules-content")
};

function loadFavorites() {
  try {
    const raw = localStorage.getItem("clima-brc-favorites");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistFavorites() {
  localStorage.setItem("clima-brc-favorites", JSON.stringify([...state.favorites]));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const boards = asArray(payload?.boards).map((board) => ({
    ...board,
    availableDates: asArray(board?.availableDates),
    supplements: asArray(board?.supplements),
    providerNotes: asArray(board?.providerNotes),
    longRange: asArray(board?.longRange),
    hourly: asArray(board?.hourly),
    sourceMatrix: asArray(board?.sourceMatrix),
    models: {
      windguru: asArray(board?.models?.windguru),
      openMeteo: asArray(board?.models?.openMeteo),
      primaryFamily: board?.models?.primaryFamily ?? "open-meteo"
    },
    summary: {
      ...board?.summary,
      bestWindows: asArray(board?.summary?.bestWindows),
      consensus: board?.summary?.consensus ?? { score: null, note: "Sin suficientes modelos comparables" },
      clouds: board?.summary?.clouds ?? { lowAvgPct: null, midAvgPct: null, highAvgPct: null }
    }
  }));

  return {
    ...payload,
    boards,
    plan: asArray(payload?.plan),
    longRangePlan: asArray(payload?.longRangePlan),
    sources: payload?.sources ?? { windguru: { enabled: false }, openMeteo: { enabled: true } },
    rules: payload?.rules ?? {
      cache: { ttlSeconds: null, note: "" },
      sourcePolicy: {},
      planScoring: { label: "Reglas", formula: [] }
    }
  };
}

function formatNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(value);
}

function formatMoment(iso) {
  return new Date(iso).toLocaleString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  });
}

function shortHour(iso) {
  return iso.slice(11, 13) + "h";
}

function scoreClass(score) {
  if (score >= 75) return "score-high";
  if (score >= 55) return "score-mid";
  return "score-low";
}

function gradeClass(condition) {
  return `grade-${condition}`;
}

function conditionLabel(condition) {
  if (condition === "estable") return "Estable";
  if (condition === "atento") return "Atento";
  return "Complicado";
}

function formatDay(date) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function shortDay(date) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit"
  });
}

function dayKind(day) {
  if ((day.precipTotalMm ?? 0) >= 4 && ((day.freezingLevelMinM ?? 9999) < 1600 || (day.tempMaxC ?? 99) <= 1)) return "snow";
  if ((day.precipTotalMm ?? 0) >= 1.2 || (day.precipProbabilityMaxPct ?? 0) >= 65) return "rain";
  if ((day.windMaxKmh ?? 0) >= 45) return "wind";
  if (((day.clouds?.lowAvgPct ?? 0) + (day.clouds?.midAvgPct ?? 0)) / 2 >= 70) return "cloud";
  if (((day.clouds?.lowAvgPct ?? 0) + (day.clouds?.midAvgPct ?? 0)) / 2 >= 35) return "partly";
  return "clear";
}

function weatherIcon(kind) {
  const icons = {
    clear: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"></circle><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M12 2.5v3"/><path d="M12 18.5v3"/><path d="M2.5 12h3"/><path d="M18.5 12h3"/><path d="M5.4 5.4l2.2 2.2"/><path d="M16.4 16.4l2.2 2.2"/><path d="M18.6 5.4l-2.2 2.2"/><path d="M7.6 16.4l-2.2 2.2"/></g></svg>`,
    partly: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="currentColor" opacity="0.9"></circle><path d="M8 18h8.5a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 8 18Z" fill="currentColor"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10.4a4.1 4.1 0 0 0 .2-8.2 5.7 5.7 0 0 0-10.9-1.3A4.6 4.6 0 0 0 7 18Z" fill="currentColor"></path></svg>`,
    rain: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14.5h10.4a4.1 4.1 0 0 0 .2-8.2 5.7 5.7 0 0 0-10.9-1.3A4.6 4.6 0 0 0 7 14.5Z" fill="currentColor"></path><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 17.5 8 20"/><path d="M13 17.5 12 20"/><path d="M17 17.5 16 20"/></g></svg>`,
    snow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13.5h10.4a4.1 4.1 0 0 0 .2-8.2 5.7 5.7 0 0 0-10.9-1.3A4.6 4.6 0 0 0 7 13.5Z" fill="currentColor"></path><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 17v4"/><path d="M7.5 18.5h3"/><path d="M7.8 17.4l2.4 2.2"/><path d="M10.2 17.4l-2.4 2.2"/><path d="M15 17v4"/><path d="M13.5 18.5h3"/><path d="M13.8 17.4l2.4 2.2"/><path d="M16.2 17.4l-2.4 2.2"/></g></svg>`,
    wind: `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M3 9h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h14a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h8"/></g></svg>`
  };
  return icons[kind] ?? icons.cloud;
}

function matchesFilters(pointBoard) {
  const searchable = [
    pointBoard.point.name,
    pointBoard.point.zone,
    pointBoard.point.region,
    ...pointBoard.point.aliases
  ]
    .join(" ")
    .toLowerCase();

  if (state.search && !searchable.includes(state.search.toLowerCase())) return false;
  if (state.favoritesOnly && !state.favorites.has(pointBoard.point.id)) return false;
  if (!state.activeFilters.size) return true;

  const tags = new Set([
    pointBoard.point.region,
    pointBoard.point.type,
    pointBoard.point.zone,
    ...pointBoard.point.outingTags,
    ...pointBoard.point.exposureTags
  ]);
  return [...state.activeFilters].every((filter) => tags.has(filter));
}

function buildFilterButtons() {
  if (!state.payload) return;
  const candidates = [
    ["Refugios", "refugio"],
    ["Bariloche", "bariloche"],
    ["Bolsón", "bolson"],
    ["Buenos Aires", "buenos-aires"],
    ["Ciudad", "ciudad"],
    ["Montaña", "montana"],
    ["Tronador", "tronador"],
    ["Alta montaña", "alta-montana"],
    ["Bosque", "bosque"],
    ["Viento", "viento"]
  ];

  els.filterGroups.innerHTML = "";
  for (const [label, value] of candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip ${state.activeFilters.has(value) ? "active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      if (state.activeFilters.has(value)) state.activeFilters.delete(value);
      else state.activeFilters.add(value);
      buildFilterButtons();
      render();
    });
    els.filterGroups.append(button);
  }
}

function cloudBar(label, value, color) {
  return `
    <div>
      <div class="metric-row">
        <span class="metric-label">${label}</span>
        <span class="muted">${formatNumber(value)}%</span>
      </div>
      <div class="cloud-bar"><span class="cloud-fill" style="width:${value ?? 0}%; background:${color}"></span></div>
    </div>
  `;
}

function renderCard(item) {
  const isFavorite = state.favorites.has(item.point.id);
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title">
        <span class="muted">${item.point.zone}</span>
        <strong>${item.point.name}</strong>
        <div class="card-meta">
          <span class="pill">${item.point.type}</span>
          <span class="pill alt">${item.primary.modelLabel}</span>
          <span class="pill">${item.primary.sourceLabel}</span>
          <span class="pill">${item.summary.gradeScore}/100</span>
        </div>
      </div>
      <div class="grade ${gradeClass(item.summary.condition)}">${conditionLabel(item.summary.condition)}</div>
    </div>
    <div class="metrics">
      <div class="metric">
        <span class="metric-label">Lluvia</span>
        <span class="metric-value">${formatNumber(item.summary.precipTotalMm, 1)} mm</span>
        <span class="muted">prob. máx ${formatNumber(item.summary.precipProbabilityMaxPct)}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">Temperatura</span>
        <span class="metric-value">${formatNumber(item.summary.tempMinC, 1)}° / ${formatNumber(item.summary.tempMaxC, 1)}°</span>
        <span class="muted">sens. ${formatNumber(item.summary.apparentMinC, 1)}° a ${formatNumber(item.summary.apparentMaxC, 1)}°</span>
      </div>
      <div class="metric">
        <span class="metric-label">Viento</span>
        <span class="metric-value">${formatNumber(item.summary.windMaxKmh, 1)} km/h</span>
        <span class="muted">ráfaga ${formatNumber(item.summary.gustMaxKmh, 1)} km/h</span>
      </div>
      <div class="metric">
        <span class="metric-label">Confianza</span>
        <span class="metric-value">${formatNumber(item.summary.consensus.score)} / 100</span>
        <span class="muted">${item.summary.consensus.note}</span>
      </div>
    </div>
    <div class="cloud-stack">
      <div class="metric-row"><strong>Nubosidad por capas</strong></div>
      ${cloudBar("Baja", item.summary.clouds.lowAvgPct, "#4e7b82")}
      ${cloudBar("Media", item.summary.clouds.midAvgPct, "#75916f")}
      ${cloudBar("Alta", item.summary.clouds.highAvgPct, "#a0adb4")}
    </div>
    <div class="window-list">
      ${item.summary.bestWindows
        .map(
          (window) => `
            <div class="window-card">
              <strong>${shortHour(window.start)}–${shortHour(window.end)}</strong>
              <div class="muted">${window.reasons.join(" · ")}</div>
              <div class="muted">score ${window.score}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="card-foot">
      <div class="pill-list">
        <span class="pill">Actualizado ${formatMoment(item.primary.issuedAt)}</span>
        <span class="pill">${item.primary.precision}</span>
      </div>
      <div class="card-meta">
        <button class="favorite-button ${isFavorite ? "active" : ""}" type="button" data-favorite="${item.point.id}">
          ${isFavorite ? "★" : "☆"}
        </button>
        <button class="ghost-button" type="button" data-detail="${item.point.id}">Detalle</button>
      </div>
    </div>
  `;
  return card;
}

function renderOverview(visible) {
  if (!state.payload) return;
  const bestWindow = asArray(state.payload.plan).find((row) => visible.some((item) => item.point.id === row.pointId));
  const bestDay = asArray(state.payload.longRangePlan).find((row) => visible.some((item) => item.point.id === row.pointId));
  const lowestRain = [...visible]
    .sort((a, b) => (a.summary.precipTotalMm ?? 999) - (b.summary.precipTotalMm ?? 999))[0];
  const calmestWind = [...visible]
    .sort((a, b) => (a.summary.windMaxKmh ?? 999) - (b.summary.windMaxKmh ?? 999))[0];

  const cards = [
    {
      label: "Mejor ventana hoy",
      value: bestWindow ? `${bestWindow.pointName}` : "Sin ventana clara",
      meta: bestWindow ? `${shortHour(bestWindow.start)}–${shortHour(bestWindow.end)} · score ${bestWindow.score}` : "Sin datos"
    },
    {
      label: "Mejor día del rango",
      value: bestDay ? `${bestDay.pointName}` : "Sin ranking",
      meta: bestDay ? `${formatDay(bestDay.date)} · score ${bestDay.score}` : "Sin datos"
    },
    {
      label: "Menos lluvia hoy",
      value: lowestRain ? lowestRain.point.name : "Sin datos",
      meta: lowestRain ? `${formatNumber(lowestRain.summary.precipTotalMm, 1)} mm · ${lowestRain.point.zone}` : "Sin datos"
    },
    {
      label: "Viento más amable",
      value: calmestWind ? calmestWind.point.name : "Sin datos",
      meta: calmestWind ? `${formatNumber(calmestWind.summary.windMaxKmh, 1)} km/h · ${calmestWind.point.zone}` : "Sin datos"
    }
  ];

  els.overviewStrip.innerHTML = cards
    .map(
      (card) => `
        <article class="overview-card">
          <span class="overview-label">${card.label}</span>
          <strong class="overview-value">${card.value}</strong>
          <span class="muted">${card.meta}</span>
        </article>
      `
    )
    .join("");
}

function renderPlan() {
  if (!state.payload) return;
  const visibleIds = new Set(
    asArray(state.payload.boards).filter((item) => !item.error && matchesFilters(item)).map((item) => item.point.id)
  );

  const rows = asArray(state.payload.plan).filter((item) => visibleIds.has(item.pointId));
  els.planList.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <div class="plan-row">
              <div class="plan-score ${scoreClass(row.score)}">${row.score}</div>
              <div>
                <strong>${row.pointName}</strong>
                <div class="muted">${row.zone}</div>
                <div class="muted">${shortHour(row.start)}–${shortHour(row.end)} · ${row.reasons.join(" · ")}</div>
              </div>
              <div class="muted">${row.condition}</div>
            </div>
          `
        )
        .join("")
    : `<div class="muted">No hay ventanas visibles con los filtros actuales.</div>`;
}

function dayTone(score) {
  if (score >= 75) return "";
  if (score >= 55) return "mid";
  return "low";
}

function renderLongRange() {
  if (!state.payload) return;
  const visible = asArray(state.payload.boards).filter((item) => !item.error && matchesFilters(item));
  const headerSource = visible.find((item) => asArray(item.longRange).length) ?? null;
  const headerDates = headerSource
    ? asArray(headerSource.longRange).map((day) => day.date).slice(0, 14)
    : asArray(asArray(state.payload.boards).find((item) => asArray(item.availableDates).length)?.availableDates).slice(0, 14);
  const columnTemplate = `240px repeat(${Math.max(headerDates.length, 1)}, minmax(104px, 1fr))`;

  els.longrangePlan.innerHTML = asArray(state.payload.longRangePlan)
    .filter((row) => visible.some((item) => item.point.id === row.pointId))
    .slice(0, 10)
    .map(
      (row) => `
        <div class="plan-row">
          <div class="plan-score ${scoreClass(row.score)}">${row.score}</div>
          <div>
            <strong>${row.pointName}</strong>
            <div class="muted">${row.zone}</div>
            <div class="muted">${formatDay(row.date)} · lluvia ${formatNumber(row.rainMm, 1)} mm · viento ${formatNumber(row.windKmh, 1)} km/h</div>
          </div>
          <button class="ghost-button" type="button" data-day-jump="${row.date}">Ver día</button>
        </div>
      `
    )
    .join("");

  const grouped = visible.reduce((acc, item) => {
    const key = item.point.region ?? "otros";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());

  if (!visible.length || !headerDates.length) {
    els.longrangeGrid.innerHTML = `<div class="muted">No hay datos visibles para construir la matriz de 14 días.</div>`;
    return;
  }

  els.longrangeGrid.innerHTML = `
    <div class="calendar-shell">
      <div class="calendar-header" style="grid-template-columns:${columnTemplate}">
        <div class="calendar-corner">Punto</div>
        ${headerDates
          .map(
            (date) => `
              <div class="calendar-date ${date === state.selectedDate ? "active" : ""}">
                <strong>${shortDay(date)}</strong>
                <span>${formatDay(date).split(" ").slice(-1)[0]}</span>
              </div>
            `
          )
          .join("")}
      </div>
      ${[...grouped.entries()]
    .map(
      ([region, items]) => `
        <section class="region-group">
          <div class="region-heading">
            <span class="pill alt">${REGION_LABELS[region] ?? region}</span>
            <strong>${items.length} punto(s)</strong>
          </div>
          ${items
            .map(
              (item) => `
                <div class="calendar-row" style="grid-template-columns:${columnTemplate}">
                  <button class="longrange-head" type="button" data-detail="${item.point.id}">
                    <div class="muted">${item.point.zone}</div>
                    <strong>${item.point.name}</strong>
                    <div class="muted">${item.point.type} · ${item.primary.modelLabel}</div>
                    <div class="muted">score hoy ${item.summary.gradeScore}</div>
                  </button>
                    ${asArray(item.longRange)
                      .map(
                        (day) => `
                          <button class="day-cell ${dayTone(day.gradeScore)} ${day.date === state.selectedDate ? "active" : ""}" type="button" data-day-jump="${day.date}" title="${item.point.name} · ${formatDay(day.date)}">
                            <div class="day-icon kind-${dayKind(day)}">${weatherIcon(dayKind(day))}</div>
                            <div class="topline">
                              <span class="day-score">${day.gradeScore}</span>
                              <span class="day-condition">${conditionLabel(day.condition)}</span>
                            </div>
                            <div class="day-meta">
                              <div class="day-temp">${formatNumber(day.tempMinC, 0)}° / ${formatNumber(day.tempMaxC, 0)}°</div>
                              <div class="day-rain">${formatNumber(day.precipTotalMm, 1)} mm</div>
                              <div class="day-wind">${formatNumber(day.windMaxKmh, 0)} km/h</div>
                            </div>
                          </button>
                        `
                      )
                      .join("")}
                </div>
              `
            )
            .join("")}
        </section>
      `
    )
    .join("")}
    </div>
  `;

  document.querySelectorAll("[data-day-jump]").forEach((button) => {
    button.addEventListener("click", async () => {
      const date = button.getAttribute("data-day-jump");
      if (!date || date === state.selectedDate) return;
      state.selectedDate = date;
      state.payload = null;
      await loadBoard(true);
    });
  });
}

function render() {
  if (!state.payload) return;
  const visible = asArray(state.payload.boards)
    .filter((item) => !item.error && matchesFilters(item))
    .sort((a, b) => (b.summary.gradeScore ?? 0) - (a.summary.gradeScore ?? 0));
  const failed = asArray(state.payload.boards).filter((item) => item.error);

  els.cardsGrid.innerHTML = "";
  for (const item of visible) els.cardsGrid.append(renderCard(item));

  els.errorBanner.classList.toggle("hidden", failed.length === 0);
  els.errorBanner.textContent = failed.length
    ? `${failed.length} punto(s) sin datos completos: ${failed.map((item) => `${item.point.name}: ${item.error}`).join(" | ")}`
    : "";

  renderOverview(visible);
  renderLongRange();
  renderPlan();
  attachCardEvents();
}

function attachCardEvents() {
  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-detail");
      const item = state.payload?.boards.find((entry) => !entry.error && entry.point.id === id);
      if (item) openDetail(item);
    });
  });

  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-favorite");
      if (!id) return;
      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      persistFavorites();
      render();
    });
  });
}

function openDetail(item) {
  const timelineRows = [
    ["Hora", (entry) => entry.label],
    ["Temp", (entry) => `${formatNumber(entry.temperatureC, 1)}°`],
    ["Sensación", (entry) => `${formatNumber(entry.apparentTemperatureC, 1)}°`],
    ["Lluvia", (entry) => `${formatNumber(entry.precipitationMm, 1)} mm`],
    ["Prob lluvia", (entry) => `${formatNumber(entry.precipitationProbabilityPct)}%`],
    ["Viento", (entry) => `${formatNumber(entry.windSpeedKmh, 1)}`],
    ["Ráfagas", (entry) => `${formatNumber(entry.windGustKmh, 1)}`],
    ["Nub. baja", (entry) => `${formatNumber(entry.lowCloudPct)}%`],
    ["Nub. media", (entry) => `${formatNumber(entry.midCloudPct)}%`],
    ["Nub. alta", (entry) => `${formatNumber(entry.highCloudPct)}%`],
    ["Humedad", (entry) => `${formatNumber(entry.humidityPct)}%`],
    ["Visibilidad", (entry) => entry.visibilityM == null ? "—" : `${formatNumber(entry.visibilityM / 1000, 1)} km`],
    ["Freezing", (entry) => entry.freezingLevelM == null ? "—" : `${formatNumber(entry.freezingLevelM)} m`]
  ];

  els.detailContent.innerHTML = `
    <div class="detail-card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">${item.point.zone}</p>
          <h2>${item.point.name}</h2>
          <p class="muted">${item.point.type} · ${item.point.aliases.join(" · ")}</p>
        </div>
        <div class="pill-list">
          <span class="pill">${item.primary.sourceLabel}</span>
          <span class="pill alt">${item.primary.modelLabel}</span>
          <span class="pill">${item.primary.precision}</span>
        </div>
      </div>
      <div class="detail-grid">
        <div class="timeline-wrap">
          <div class="timeline-table">
            ${timelineRows
              .map(
                ([label, formatter]) => `
                  <div class="timeline-row">
                    <div class="timeline-label">${label}</div>
                    ${item.hourly.map((entry) => `<div class="timeline-cell">${formatter(entry)}</div>`).join("")}
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="detail-side">
          <div class="detail-block">
            <strong>Fuente y estrategia</strong>
            <p class="muted">Primario: ${item.primary.sourceLabel} · ${item.primary.modelLabel}</p>
            <p class="muted">Última actualización: ${formatMoment(item.primary.issuedAt)}</p>
            <p class="muted">Notas: ${item.providerNotes.join(" · ")}</p>
          </div>
          <div class="detail-block">
            <strong>Modelos disponibles</strong>
            <div class="pill-list">
              ${item.models.windguru.map((model) => `<span class="pill">${model.modelLabel}</span>`).join("")}
              ${item.models.openMeteo.map((model) => `<span class="pill alt">${model.modelLabel}</span>`).join("")}
            </div>
          </div>
          <div class="detail-block">
            <strong>Mejores ventanas del día</strong>
            ${item.summary.bestWindows
              .map(
                (window) => `
                  <div class="window-card">
                    <strong>${shortHour(window.start)}–${shortHour(window.end)}</strong>
                    <div class="muted">${window.reasons.join(" · ")}</div>
                    <div class="muted">score ${window.score}</div>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="detail-block">
            <strong>Trazabilidad por métrica</strong>
            ${item.sourceMatrix.map((row) => `<p class="muted"><strong>${row.metric}:</strong> ${row.source ?? "—"}</p>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
  els.detailDialog.showModal();
}

function renderRules() {
  if (!state.payload) return;
  const rules = state.payload.rules;
  els.rulesContent.innerHTML = `
    <div class="detail-card">
      <h2>Reglas y límites</h2>
      <div class="detail-grid">
        <div class="detail-side">
          <div class="detail-block">
            <strong>Cache técnico</strong>
            <p class="muted">${rules.cache.note}</p>
            <p class="muted">TTL: ${rules.cache.ttlSeconds} segundos.</p>
          </div>
          <div class="detail-block">
            <strong>Estrategia de fuentes</strong>
            ${Object.values(rules.sourcePolicy).map((line) => `<p class="muted">${line}</p>`).join("")}
          </div>
        </div>
        <div class="detail-block">
          <strong>${rules.planScoring.label}</strong>
          ${rules.planScoring.formula.map((line) => `<p class="muted">${line}</p>`).join("")}
        </div>
      </div>
    </div>
  `;
  els.rulesDialog.showModal();
}

function populateDates() {
  if (!state.payload) return;
  const firstBoard = asArray(state.payload.boards).find((item) => !item.error);
  if (!firstBoard) return;
  const dates = firstBoard.availableDates;
  if (!state.selectedDate) state.selectedDate = firstBoard.selectedDate;
  els.dateSelect.innerHTML = dates
    .map((date) => `<option value="${date}" ${date === state.selectedDate ? "selected" : ""}>${date}</option>`)
    .join("");
}

async function loadBoard(force = false) {
  if (!force && state.payload) {
    render();
    return;
  }

  els.refreshButton.disabled = true;
  els.refreshButton.textContent = "Actualizando…";
  try {
    const query = state.selectedDate ? `?date=${encodeURIComponent(state.selectedDate)}` : "";
    const response = await fetch(`/api/board${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("La API no respondió bien");
    state.payload = normalizePayload(await response.json());
    populateDates();
    els.lastUpdated.textContent = formatMoment(state.payload.requestedAt);
    els.sourceMode.textContent = state.payload.sources.windguru.enabled
      ? "Open-Meteo principal · Windguru público como referencia puntual"
      : "Open-Meteo principal";
    els.timezoneLabel.textContent = state.payload.timezone;
    els.cacheNote.textContent = `TTL técnico ${state.payload.cacheTtlSeconds}s`;
    buildFilterButtons();
    render();
  } catch (error) {
    els.errorBanner.classList.remove("hidden");
    els.errorBanner.textContent = error instanceof Error ? error.message : "No se pudo cargar la app";
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.textContent = "Actualizar ahora";
  }
}

els.searchInput?.addEventListener("input", (event) => {
  state.search = event.currentTarget.value;
  render();
});

els.favoritesOnly?.addEventListener("change", (event) => {
  state.favoritesOnly = event.currentTarget.checked;
  render();
});

els.dateSelect?.addEventListener("change", async (event) => {
  state.selectedDate = event.currentTarget.value;
  state.payload = null;
  await loadBoard(true);
});

els.refreshButton?.addEventListener("click", async () => {
  state.payload = null;
  await loadBoard(true);
});

els.rulesButton?.addEventListener("click", () => renderRules());

loadBoard(true);
