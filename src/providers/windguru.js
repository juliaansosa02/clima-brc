// @ts-check

import { round } from "../lib/utils.js";

const MODEL_LABELS = {
  ifs: "IFS / ECMWF",
  icon: "ICON Global",
  swrfar: "Zephr-HD Argentina",
  wrfarg: "WRF Argentina",
  gfs: "GFS"
};

const DIRECTION_TO_DEG = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5
};

/**
 * @param {string} direction
 */
function directionToDeg(direction) {
  return DIRECTION_TO_DEG[direction.trim().toUpperCase()] ?? null;
}

/**
 * @param {string} text
 */
function parseWindguruTable(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const locationLine = lines.find((line) => line.includes("lat:"));
  const modelLine = lines.find((line) => /\(init: .* UTC\)/.test(line));
  const headerLineIndex = lines.findIndex((line) => line.includes("Date") && line.includes("WSPD"));
  if (headerLineIndex === -1 || !modelLine || !locationLine) {
    throw new Error("Windguru devolvió un formato no esperado");
  }

  const dataLines = lines.slice(headerLineIndex + 3).filter((line) => line && !line.startsWith("©"));
  /** @type {any[]} */
  const entries = [];
  let currentDay = "";
  const now = new Date();

  for (const line of dataLines) {
    const match = line.match(/^\s*(?:([A-Za-z]{3}\s+\d+\.)\s+)?(\d{2})h\s+(.+)$/);
    if (!match) continue;
    if (match[1]) currentDay = match[1].trim();
    if (!currentDay) continue;
    const hour = match[2];
    const parts = match[3].trim().split(/\s+/);
    if (parts.length < 9) continue;

    const [wspd, dir, gust, tmp, hcld, mcld, lcld, apcp, rh] = parts;
    const dayParts = currentDay.match(/([A-Za-z]{3})\s+(\d+)\./);
    if (!dayParts) continue;
    const currentDayNumber = now.getDate();
    const parsedDay = Number(dayParts[2]);
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), parsedDay, Number(hour) + 3));
    if (parsedDay < currentDayNumber - 7) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    }
    const date = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, "0")}-${String(
      candidate.getUTCDate()
    ).padStart(2, "0")}T${hour}:00`;

    const windSpeedKnots = Number(wspd);
    const gustKnots = Number(gust);

    entries.push({
      time: date,
      temperatureC: round(Number(tmp), 1),
      precipitationMm: round(Number(apcp), 1),
      humidityPct: round(Number(rh), 0),
      windSpeedKmh: round(windSpeedKnots * 1.852, 1),
      windGustKmh: round(gustKnots * 1.852, 1),
      windDirectionDeg: directionToDeg(dir),
      lowCloudPct: round(Number(lcld), 0),
      midCloudPct: round(Number(mcld), 0),
      highCloudPct: round(Number(hcld), 0),
      sourceTags: {
        temperatureC: "Windguru",
        precipitationMm: "Windguru",
        humidityPct: "Windguru",
        windSpeedKmh: "Windguru",
        windGustKmh: "Windguru",
        windDirectionDeg: "Windguru",
        lowCloudPct: "Windguru",
        midCloudPct: "Windguru",
        highCloudPct: "Windguru"
      }
    });
  }

  const coordsMatch = locationLine.match(/lat:\s*(-?\d+(\.\d+)?),\s+lon:\s*(-?\d+(\.\d+)?)/);

  return {
    latitude: coordsMatch ? Number(coordsMatch[1]) : null,
    longitude: coordsMatch ? Number(coordsMatch[3]) : null,
    hourly: entries
  };
}

/**
 * @param {import("../config/points.js").PointConfig} point
 * @param {{ username?: string, password?: string, timezone: string, model: keyof typeof MODEL_LABELS }} options
 */
export async function fetchWindguruModel(point, options) {
  const url = new URL("https://micro.windguru.cz/");
  url.searchParams.set("m", options.model);
  url.searchParams.set("v", "WSPD,WDIRN,GUST,TMP,HCLD,MCLD,LCLD,APCP1,RH");

  let precision = "unsupported";

  if (options.username && options.password) {
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lon));
    url.searchParams.set("u", options.username);
    url.searchParams.set("p", options.password);
    url.searchParams.set("tz", "-3");
    precision = "exact-coordinates-pro";
  } else if (point.windguru?.spotId) {
    url.searchParams.set("s", String(point.windguru.spotId));
    precision = `public-spot-${point.windguru.precision ?? "area"}`;
  } else {
    throw new Error("Sin credenciales PRO ni spot público configurado para este punto");
  }

  const response = await fetch(url, {
    headers: { "user-agent": "clima-brc/0.1" }
  });

  if (!response.ok) {
    throw new Error(`Windguru ${options.model} respondió ${response.status}`);
  }

  const text = await response.text();
  if (/wrong password|login/i.test(text)) {
    throw new Error("Windguru rechazó las credenciales PRO o el secondary password");
  }

  const parsed = parseWindguruTable(text);
  if (!parsed.hourly.length) {
    throw new Error(`Windguru ${options.model} no devolvió filas útiles`);
  }

  return {
    provider: "windguru",
    model: options.model,
    modelLabel: MODEL_LABELS[options.model],
    sourceLabel: "Windguru micro",
    precision,
    issuedAt: new Date().toISOString(),
    latitude: parsed.latitude ?? point.lat,
    longitude: parsed.longitude ?? point.lon,
    hourly: parsed.hourly.map((entry) => ({
      ...entry,
      sourceTags: Object.fromEntries(
        Object.keys(entry.sourceTags).map((key) => [key, `${MODEL_LABELS[options.model]} · Windguru`])
      )
    }))
  };
}
