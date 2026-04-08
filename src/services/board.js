// @ts-check

import { points, timezone } from "../config/points.js";
import { MemoryCache } from "../lib/cache.js";
import { average, clamp, csv, formatHour, getHour, getLocalDateKey, max, min, round, sum } from "../lib/utils.js";
import { fetchOpenMeteoModel } from "../providers/openMeteo.js";
import { fetchWindguruModel } from "../providers/windguru.js";

const cache = new MemoryCache();

/**
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} iteratee
 */
async function mapSeries(items, iteratee) {
  /** @type {R[]} */
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    results.push(await iteratee(items[index], index));
  }
  return results;
}

/**
 * @param {number} ttlMs
 */
function getRules(ttlMs) {
  return {
    cache: {
      kind: "short-technical-cache",
      ttlSeconds: Math.round(ttlMs / 1000),
      note: "La app vuelve a pedir pronóstico al entrar. Si la misma consulta se repite dentro de este TTL, puede salir del cache técnico."
    },
    planScoring: {
      label: "Ventanas recomendadas",
      formula: [
        "Se evalúan ventanas de 3 horas entre 06:00 y 19:00.",
        "Penaliza viento, ráfagas, precipitación, probabilidad de lluvia y nubosidad baja/media.",
        "La nubosidad alta pesa menos.",
        "Temperaturas bajo cero restan un poco por riesgo de hielo/frío."
      ]
    },
    sourcePolicy: {
      primary: "En modo gratis, Open-Meteo exacto por coordenadas es la base principal para todos los puntos.",
      fallback: "Windguru público queda como referencia secundaria opcional donde existe un spot curado razonable.",
      noMixing: "Las métricas suplementadas se etiquetan por proveedor/modelo y la precisión del punto se muestra explícitamente."
    }
  };
}

/**
 * @param {string[]} availableDates
 * @param {string | null | undefined} selectedDate
 */
function resolveTargetDate(availableDates, selectedDate) {
  if (selectedDate && availableDates.includes(selectedDate)) return selectedDate;
  return availableDates[0];
}

/**
 * @param {any[]} hourly
 */
function listAvailableDates(hourly) {
  return [...new Set(hourly.map((entry) => getLocalDateKey(entry.time)))];
}

/**
 * @param {any[]} hourly
 * @param {string} dateKey
 */
function filterDay(hourly, dateKey) {
  return hourly.filter((entry) => getLocalDateKey(entry.time) === dateKey);
}

/**
 * @param {any[]} hourly
 * @param {(entry: any) => number | null | undefined} pick
 */
function numericSeries(hourly, pick) {
  return hourly
    .map(pick)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
}

/**
 * @param {any[]} primaryDay
 * @param {any[]} supplementDay
 */
function buildHourlyCombined(primaryDay, supplementDay) {
  const supplementByTime = new Map(supplementDay.map((entry) => [entry.time, entry]));
  return primaryDay.map((entry) => {
    const supplement = supplementByTime.get(entry.time) ?? {};
    return {
      time: entry.time,
      temperatureC: entry.temperatureC ?? supplement.temperatureC ?? null,
      apparentTemperatureC: entry.apparentTemperatureC ?? supplement.apparentTemperatureC ?? null,
      precipitationMm: entry.precipitationMm ?? supplement.precipitationMm ?? null,
      precipitationProbabilityPct: entry.precipitationProbabilityPct ?? supplement.precipitationProbabilityPct ?? null,
      humidityPct: entry.humidityPct ?? supplement.humidityPct ?? null,
      visibilityM: entry.visibilityM ?? supplement.visibilityM ?? null,
      freezingLevelM: entry.freezingLevelM ?? supplement.freezingLevelM ?? null,
      windSpeedKmh: entry.windSpeedKmh ?? supplement.windSpeedKmh ?? null,
      windGustKmh: entry.windGustKmh ?? supplement.windGustKmh ?? null,
      windDirectionDeg: entry.windDirectionDeg ?? supplement.windDirectionDeg ?? null,
      lowCloudPct: entry.lowCloudPct ?? supplement.lowCloudPct ?? null,
      midCloudPct: entry.midCloudPct ?? supplement.midCloudPct ?? null,
      highCloudPct: entry.highCloudPct ?? supplement.highCloudPct ?? null,
      sourceTags: {
        temperatureC: entry.sourceTags?.temperatureC ?? supplement.sourceTags?.temperatureC ?? null,
        apparentTemperatureC: entry.sourceTags?.apparentTemperatureC ?? supplement.sourceTags?.apparentTemperatureC ?? null,
        precipitationMm: entry.sourceTags?.precipitationMm ?? supplement.sourceTags?.precipitationMm ?? null,
        precipitationProbabilityPct:
          entry.sourceTags?.precipitationProbabilityPct ?? supplement.sourceTags?.precipitationProbabilityPct ?? null,
        humidityPct: entry.sourceTags?.humidityPct ?? supplement.sourceTags?.humidityPct ?? null,
        visibilityM: entry.sourceTags?.visibilityM ?? supplement.sourceTags?.visibilityM ?? null,
        freezingLevelM: entry.sourceTags?.freezingLevelM ?? supplement.sourceTags?.freezingLevelM ?? null,
        windSpeedKmh: entry.sourceTags?.windSpeedKmh ?? supplement.sourceTags?.windSpeedKmh ?? null,
        windGustKmh: entry.sourceTags?.windGustKmh ?? supplement.sourceTags?.windGustKmh ?? null,
        windDirectionDeg: entry.sourceTags?.windDirectionDeg ?? supplement.sourceTags?.windDirectionDeg ?? null,
        lowCloudPct: entry.sourceTags?.lowCloudPct ?? supplement.sourceTags?.lowCloudPct ?? null,
        midCloudPct: entry.sourceTags?.midCloudPct ?? supplement.sourceTags?.midCloudPct ?? null,
        highCloudPct: entry.sourceTags?.highCloudPct ?? supplement.sourceTags?.highCloudPct ?? null
      }
    };
  });
}

/**
 * @param {any[]} models
 * @param {string} dateKey
 */
function buildConsensus(models, dateKey) {
  const daySeries = models
    .map((model) => filterDay(model.hourly, dateKey))
    .filter((series) => series.length);
  if (daySeries.length < 2) {
    return { score: null, note: "Sin suficientes modelos comparables" };
  }

  const totalRainSpread = (max(daySeries.map((series) => sum(numericSeries(series, (entry) => entry.precipitationMm)) ?? 0)) ?? 0) -
    (min(daySeries.map((series) => sum(numericSeries(series, (entry) => entry.precipitationMm)) ?? 0)) ?? 0);
  const windSpread = (max(daySeries.map((series) => max(numericSeries(series, (entry) => entry.windSpeedKmh)) ?? 0)) ?? 0) -
    (min(daySeries.map((series) => max(numericSeries(series, (entry) => entry.windSpeedKmh)) ?? 0)) ?? 0);
  const cloudSpread = (max(daySeries.map((series) => average(numericSeries(series, (entry) => entry.lowCloudPct)) ?? 0)) ?? 0) -
    (min(daySeries.map((series) => average(numericSeries(series, (entry) => entry.lowCloudPct)) ?? 0)) ?? 0);

  const rainPenalty = clamp(totalRainSpread / 10, 0, 1);
  const windPenalty = clamp(windSpread / 35, 0, 1);
  const cloudPenalty = clamp(cloudSpread / 60, 0, 1);
  const score = Math.round((1 - (rainPenalty * 0.4 + windPenalty * 0.4 + cloudPenalty * 0.2)) * 100);

  let note = "Buen acuerdo entre modelos";
  if (score < 55) note = "Modelos bastante divergentes";
  else if (score < 75) note = "Hay diferencias moderadas entre modelos";

  return { score, note };
}

/**
 * @param {any[]} hourly
 */
function buildWindows(hourly) {
  const daytime = hourly.filter((entry) => {
    const hour = getHour(entry.time);
    return hour >= 6 && hour <= 19;
  });

  /** @type {any[]} */
  const windows = [];
  for (let index = 0; index <= daytime.length - 3; index += 1) {
    const chunk = daytime.slice(index, index + 3);
    const avgWind = average(numericSeries(chunk, (entry) => entry.windSpeedKmh)) ?? 0;
    const maxGust = max(numericSeries(chunk, (entry) => entry.windGustKmh)) ?? 0;
    const totalRain = sum(numericSeries(chunk, (entry) => entry.precipitationMm)) ?? 0;
    const maxRainProbability = max(numericSeries(chunk, (entry) => entry.precipitationProbabilityPct)) ?? 0;
    const lowCloud = average(numericSeries(chunk, (entry) => entry.lowCloudPct)) ?? 0;
    const midCloud = average(numericSeries(chunk, (entry) => entry.midCloudPct)) ?? 0;
    const highCloud = average(numericSeries(chunk, (entry) => entry.highCloudPct)) ?? 0;
    const minTemp = min(numericSeries(chunk, (entry) => entry.temperatureC)) ?? 0;

    const penalty =
      clamp(avgWind / 35, 0, 1) * 30 +
      clamp(maxGust / 65, 0, 1) * 18 +
      clamp(totalRain / 4, 0, 1) * 24 +
      clamp(maxRainProbability / 80, 0, 1) * 14 +
      clamp(lowCloud / 100, 0, 1) * 8 +
      clamp(midCloud / 100, 0, 1) * 4 +
      clamp(highCloud / 100, 0, 1) * 2 +
      (minTemp < 0 ? 6 : 0);

    const score = Math.round(clamp(100 - penalty, 0, 100));
    /** @type {string[]} */
    const reasons = [];
    if (avgWind <= 15) reasons.push("viento bajo");
    if (totalRain <= 0.4) reasons.push("lluvia baja");
    if (maxRainProbability <= 30) reasons.push("baja chance de precipitación");
    if (lowCloud <= 35) reasons.push("nubosidad baja controlada");
    if (reasons.length === 0) reasons.push("sin ventaja clara");

    windows.push({
      start: chunk[0].time,
      end: chunk[chunk.length - 1].time,
      score,
      reasons,
      metrics: {
        avgWindKmh: round(avgWind, 1),
        maxGustKmh: round(maxGust, 1),
        totalRainMm: round(totalRain, 1),
        maxRainProbabilityPct: round(maxRainProbability, 0),
        lowCloudPct: round(lowCloud, 0),
        midCloudPct: round(midCloud, 0),
        highCloudPct: round(highCloud, 0)
      }
    });
  }

  return windows.sort((left, right) => right.score - left.score).slice(0, 3);
}

/**
 * @param {any[]} hourly
 */
function buildSnowSignal(hourly) {
  const coldWetHours = hourly.filter((entry) => {
    const precip = entry.precipitationMm ?? 0;
    const temp = entry.temperatureC ?? 99;
    const freezing = entry.freezingLevelM ?? 9999;
    return precip >= 0.8 && (temp <= 1.5 || freezing <= 1700);
  });

  if (!coldWetHours.length) {
    return {
      possible: false,
      level: "none",
      label: "Sin señal clara",
      hours: []
    };
  }

  const level = coldWetHours.length >= 4 ? "high" : coldWetHours.length >= 2 ? "medium" : "low";
  return {
    possible: true,
    level,
    label: level === "high" ? "Posible nieve" : level === "medium" ? "Señal de nieve" : "Chance baja de nieve",
    hours: coldWetHours.map((entry) => entry.time)
  };
}

/**
 * @param {any[]} hourly
 * @param {string} dateKey
 */
function buildSummary(hourly, dateKey) {
  const day = filterDay(hourly, dateKey);
  const snowSignal = buildSnowSignal(day);
  const summary = {
    date: dateKey,
    tempMinC: round(min(numericSeries(day, (entry) => entry.temperatureC)), 1),
    tempMaxC: round(max(numericSeries(day, (entry) => entry.temperatureC)), 1),
    apparentMinC: round(min(numericSeries(day, (entry) => entry.apparentTemperatureC)), 1),
    apparentMaxC: round(max(numericSeries(day, (entry) => entry.apparentTemperatureC)), 1),
    precipTotalMm: round(sum(numericSeries(day, (entry) => entry.precipitationMm)), 1),
    precipProbabilityMaxPct: round(max(numericSeries(day, (entry) => entry.precipitationProbabilityPct)), 0),
    humidityAvgPct: round(average(numericSeries(day, (entry) => entry.humidityPct)), 0),
    windMaxKmh: round(max(numericSeries(day, (entry) => entry.windSpeedKmh)), 1),
    gustMaxKmh: round(max(numericSeries(day, (entry) => entry.windGustKmh)), 1),
    visibilityMinM: round(min(numericSeries(day, (entry) => entry.visibilityM)), 0),
    freezingLevelMinM: round(min(numericSeries(day, (entry) => entry.freezingLevelM)), 0),
    clouds: {
      lowAvgPct: round(average(numericSeries(day, (entry) => entry.lowCloudPct)), 0),
      midAvgPct: round(average(numericSeries(day, (entry) => entry.midCloudPct)), 0),
      highAvgPct: round(average(numericSeries(day, (entry) => entry.highCloudPct)), 0)
    },
    snowSignal
  };

  const windows = buildWindows(day);
  const gradeScore =
    100 -
    (summary.gustMaxKmh ? clamp(summary.gustMaxKmh / 70, 0, 1) * 30 : 0) -
    (summary.precipTotalMm ? clamp(summary.precipTotalMm / 8, 0, 1) * 30 : 0) -
    (summary.precipProbabilityMaxPct ? clamp(summary.precipProbabilityMaxPct / 90, 0, 1) * 15 : 0) -
    (summary.clouds.lowAvgPct ? clamp(summary.clouds.lowAvgPct / 100, 0, 1) * 15 : 0) -
    (summary.freezingLevelMinM && summary.freezingLevelMinM < 1700 ? 10 : 0);

  let condition = "estable";
  if (gradeScore < 45) condition = "complicado";
  else if (gradeScore < 70) condition = "atento";

  return {
    ...summary,
    condition,
    gradeScore: Math.round(clamp(gradeScore, 0, 100)),
    bestWindows: windows
  };
}

/**
 * @param {any[]} hourly
 * @param {string[]} availableDates
 */
function buildLongRange(hourly, availableDates) {
  return availableDates.slice(0, 14).map((dateKey) => {
    const summary = buildSummary(hourly, dateKey);
    return {
      ...summary,
      shortLabel: new Date(`${dateKey}T12:00:00-03:00`).toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit"
      })
    };
  });
}

/**
 * @param {import("../config/points.js").PointConfig} point
 * @param {{ targetDate?: string }} options
 */
async function buildPointBoard(point, options) {
  const openMeteoModels = csv(process.env.OPEN_METEO_MODELS, ["ecmwf", "dwd-icon", "gfs"]);
  const windguruModels = csv(process.env.WINDGURU_PREFERRED_MODELS, ["ifs", "icon", "swrfar", "wrfarg"]);
  /** @type {any[]} */
  const openMeteoModelsOk = [];
  /** @type {string[]} */
  const openMeteoErrors = [];
  for (const model of openMeteoModels) {
    try {
      const payload = await fetchOpenMeteoModel(point, {
        model: /** @type {any} */ (model),
        timezone
      });
      openMeteoModelsOk.push(payload);
      if (openMeteoModelsOk.length >= 2) break;
    } catch (error) {
      openMeteoErrors.push(error instanceof Error ? error.message : "Open-Meteo falló");
      if (!(error instanceof Error) || !error.message.includes("429")) {
        continue;
      }
    }
  }

  if (!openMeteoModelsOk.length) {
    throw new Error(openMeteoErrors[0] ?? "Open-Meteo sin datos");
  }

  const shouldTryWindguru = Boolean(point.windguru?.spotId);
  /** @type {any[]} */
  const windguruModelsOk = [];
  if (shouldTryWindguru) {
    for (const model of windguruModels) {
      try {
        const payload = await fetchWindguruModel(point, {
          model: /** @type {any} */ (model),
          username: undefined,
          password: undefined,
          timezone
        });
        windguruModelsOk.push(payload);
        if (windguruModelsOk.length >= 1) break;
      } catch {
        // Windguru público es sólo referencia secundaria
      }
    }
  }

  const availableDates = listAvailableDates(openMeteoModelsOk[0].hourly);
  const dateKey = resolveTargetDate(availableDates, options.targetDate);
  const defaultPrimary = openMeteoModelsOk[0];
  const supplementModel = openMeteoModelsOk[0];
  const combinedDay = buildHourlyCombined(
    filterDay(defaultPrimary.hourly, dateKey),
    filterDay(supplementModel.hourly, dateKey)
  ).map((entry) => ({
    ...entry,
    snowSignal:
      (entry.precipitationMm ?? 0) >= 0.8 && (((entry.temperatureC ?? 99) <= 1.5) || ((entry.freezingLevelM ?? 9999) <= 1700))
  }));
  const summary = buildSummary(combinedDay, dateKey);
  const consensus = buildConsensus(openMeteoModelsOk, dateKey);

  return {
    point,
    selectedDate: dateKey,
    availableDates,
    primary: {
      provider: defaultPrimary.provider,
      sourceLabel: defaultPrimary.sourceLabel,
      model: defaultPrimary.model,
      modelLabel: defaultPrimary.modelLabel,
      precision: defaultPrimary.precision,
      issuedAt: defaultPrimary.issuedAt
    },
    supplements: windguruModelsOk.length
      ? windguruModelsOk.map((model) => ({
          provider: model.provider,
          model: model.modelLabel,
          sourceLabel: model.sourceLabel,
          precision: model.precision
        }))
      : [],
    providerNotes: windguruModelsOk.length
      ? ["Open-Meteo exacto es la base principal", "Windguru público disponible como referencia secundaria cercana"]
      : [shouldTryWindguru ? "Windguru público no quedó disponible para este punto/modelo" : "Sin spot público curado de Windguru para este punto"],
    summary: {
      ...summary,
      consensus
    },
    longRange: buildLongRange(openMeteoModelsOk[0].hourly, availableDates),
    models: {
      primaryFamily: "open-meteo",
      windguru: windguruModelsOk.map((model) => ({
        provider: model.provider,
        model: model.model,
        modelLabel: model.modelLabel,
        precision: model.precision,
        hourly: filterDay(model.hourly, dateKey)
      })),
      openMeteo: openMeteoModelsOk.map((model) => ({
        provider: model.provider,
        model: model.model,
        modelLabel: model.modelLabel,
        precision: model.precision,
        hourly: filterDay(model.hourly, dateKey)
      }))
    },
    hourly: combinedDay.map((entry) => ({
      ...entry,
      label: formatHour(entry.time)
    })),
    sourceMatrix: [
      { metric: "temperatura", source: combinedDay[0]?.sourceTags.temperatureC ?? null },
      { metric: "precipitacion acumulada", source: combinedDay[0]?.sourceTags.precipitationMm ?? null },
      { metric: "probabilidad de precipitacion", source: combinedDay[0]?.sourceTags.precipitationProbabilityPct ?? null },
      { metric: "sensacion termica", source: combinedDay[0]?.sourceTags.apparentTemperatureC ?? null },
      { metric: "humedad", source: combinedDay[0]?.sourceTags.humidityPct ?? null },
      { metric: "viento", source: combinedDay[0]?.sourceTags.windSpeedKmh ?? null },
      { metric: "nubosidad baja", source: combinedDay[0]?.sourceTags.lowCloudPct ?? null },
      { metric: "nubosidad media", source: combinedDay[0]?.sourceTags.midCloudPct ?? null },
      { metric: "nubosidad alta", source: combinedDay[0]?.sourceTags.highCloudPct ?? null },
      { metric: "visibilidad", source: combinedDay[0]?.sourceTags.visibilityM ?? null },
      { metric: "freezing level", source: combinedDay[0]?.sourceTags.freezingLevelM ?? null }
    ]
  };
}

/**
 * @param {{ targetDate?: string }} [options]
 */
export async function buildBoard(options = {}) {
  const ttlMs = Number(process.env.CACHE_TTL_SECONDS || "300") * 1000;
  const cacheKey = `board:${options.targetDate ?? "auto"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const requestedAt = new Date().toISOString();
  const pointResults = await mapSeries(points, async (point) => {
    try {
      const value = await buildPointBoard(point, { targetDate: options.targetDate });
      return { status: "fulfilled", value };
    } catch (reason) {
      return { status: "rejected", reason };
    }
  });
  const boards = pointResults.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          point: points[index],
          error: result.reason?.message ?? "No se pudo obtener pronóstico"
        }
  );

  const plan = boards
    .filter((item) => !("error" in item))
    .flatMap((item) =>
      item.summary.bestWindows.map((window) => ({
        pointId: item.point.id,
        pointName: item.point.name,
        zone: item.point.zone,
        score: window.score,
        start: window.start,
        end: window.end,
        reasons: window.reasons,
        condition: item.summary.condition
      }))
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  const payload = {
    requestedAt,
    timezone,
    cacheTtlSeconds: Math.round(ttlMs / 1000),
    sources: {
      windguru: {
        enabled: true,
        mode: "public-spot-only-when-curated",
        preferredModels: csv(process.env.WINDGURU_PREFERRED_MODELS, ["ifs", "icon", "swrfar", "wrfarg"])
      },
      openMeteo: {
        enabled: true,
        models: csv(process.env.OPEN_METEO_MODELS, ["ecmwf", "dwd-icon", "gfs"])
      }
    },
    rules: getRules(ttlMs),
    boards,
    plan,
    longRangePlan: boards
      .filter((item) => !("error" in item))
      .flatMap((item) =>
        item.longRange.map((day) => ({
          pointId: item.point.id,
          pointName: item.point.name,
          zone: item.point.zone,
          date: day.date,
          score: day.gradeScore,
          condition: day.condition,
          rainMm: day.precipTotalMm,
          windKmh: day.windMaxKmh
        }))
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, 18)
  };

  cache.set(cacheKey, payload, ttlMs);
  return payload;
}
