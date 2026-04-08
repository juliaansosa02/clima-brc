// @ts-check

import { round } from "../lib/utils.js";

const BASE_URLS = {
  ecmwf: "https://api.open-meteo.com/v1/ecmwf",
  "dwd-icon": "https://api.open-meteo.com/v1/dwd-icon",
  gfs: "https://api.open-meteo.com/v1/gfs"
};

const MODEL_LABELS = {
  ecmwf: "ECMWF / IFS",
  "dwd-icon": "DWD ICON",
  gfs: "NOAA GFS"
};

const HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "relative_humidity_2m",
  "apparent_temperature",
  "visibility",
  "freezing_level_height"
];

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{ lat: number, lon: number }} point
 * @param {{ model: keyof typeof BASE_URLS, timezone: string }} options
 */
export async function fetchOpenMeteoModel(point, options) {
  const url = new URL(BASE_URLS[options.model]);
  url.searchParams.set("latitude", String(point.lat));
  url.searchParams.set("longitude", String(point.lon));
  url.searchParams.set("hourly", HOURLY_FIELDS.join(","));
  url.searchParams.set("forecast_days", "14");
  url.searchParams.set("timezone", options.timezone);

  let response = await fetch(url, {
    headers: { "user-agent": "clima-brc/0.1" }
  });

  if (response.status === 429) {
    await sleep(900);
    response = await fetch(url, {
      headers: { "user-agent": "clima-brc/0.1" }
    });
  }

  if (!response.ok) {
    throw new Error(`Open-Meteo ${options.model} respondió ${response.status}`);
  }

  /** @type {any} */
  const payload = await response.json();
  const hourly = payload.hourly;
  if (!hourly?.time?.length) {
    throw new Error(`Open-Meteo ${options.model} no devolvió datos horarios`);
  }

  /** @type {any[]} */
  const entries = hourly.time.map((time, index) => ({
    time,
    temperatureC: round(hourly.temperature_2m?.[index], 1),
    precipitationProbabilityPct: round(hourly.precipitation_probability?.[index], 0),
    precipitationMm: round(hourly.precipitation?.[index], 1),
    apparentTemperatureC: round(hourly.apparent_temperature?.[index], 1),
    humidityPct: round(hourly.relative_humidity_2m?.[index], 0),
    visibilityM: round(hourly.visibility?.[index], 0),
    freezingLevelM: round(hourly.freezing_level_height?.[index], 0),
    windSpeedKmh: round(hourly.wind_speed_10m?.[index], 1),
    windGustKmh: round(hourly.wind_gusts_10m?.[index], 1),
    windDirectionDeg: round(hourly.wind_direction_10m?.[index], 0),
    lowCloudPct: round(hourly.cloud_cover_low?.[index], 0),
    midCloudPct: round(hourly.cloud_cover_mid?.[index], 0),
    highCloudPct: round(hourly.cloud_cover_high?.[index], 0),
    sourceTags: {
      temperatureC: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      precipitationProbabilityPct: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      precipitationMm: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      apparentTemperatureC: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      humidityPct: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      visibilityM: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      freezingLevelM: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      windSpeedKmh: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      windGustKmh: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      windDirectionDeg: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      lowCloudPct: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      midCloudPct: `${MODEL_LABELS[options.model]} · Open-Meteo`,
      highCloudPct: `${MODEL_LABELS[options.model]} · Open-Meteo`
    }
  }));

  return {
    provider: "open-meteo",
    model: options.model,
    modelLabel: MODEL_LABELS[options.model],
    sourceLabel: "Open-Meteo",
    precision: "exact-coordinates",
    issuedAt: payload.generationtime_ms != null ? new Date().toISOString() : null,
    elevationM: payload.elevation ?? null,
    timezone: payload.timezone ?? options.timezone,
    latitude: payload.latitude ?? point.lat,
    longitude: payload.longitude ?? point.lon,
    hourly: entries
  };
}
