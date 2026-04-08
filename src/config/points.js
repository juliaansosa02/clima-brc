// @ts-check

/**
 * @typedef {"ciudad" | "villa" | "refugio" | "montana"} PointType
 */

/**
 * @typedef {Object} PointConfig
 * @property {string} id
 * @property {string} name
 * @property {string[]} aliases
 * @property {string} zone
 * @property {string} region
 * @property {PointType} type
 * @property {number} lat
 * @property {number} lon
 * @property {number | null} altitudeM
 * @property {string[]} outingTags
 * @property {string[]} exposureTags
 * @property {{ spotId?: number, label?: string, precision?: "exact" | "nearby" | "area" } | null} windguru
 * @property {string} coordinatesSource
 * @property {string | null} altitudeSource
 */

/** @type {PointConfig[]} */
export const points = [
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    aliases: ["CABA", "Capital Federal", "Ciudad de Buenos Aires"],
    zone: "Buenos Aires",
    region: "buenos-aires",
    type: "ciudad",
    lat: -34.6083696,
    lon: -58.4440583,
    altitudeM: null,
    outingTags: ["urbano", "referencia", "base"],
    exposureTags: ["urbano", "llanura"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "bariloche-centro",
    name: "San Carlos de Bariloche",
    aliases: ["Bariloche", "Centro", "Ciudad"],
    zone: "Bariloche urbano",
    region: "bariloche",
    type: "ciudad",
    lat: -41.1334781,
    lon: -71.3101474,
    altitudeM: null,
    outingTags: ["base", "urbano", "logistica"],
    exposureTags: ["lago", "valle"],
    windguru: { spotId: 141627, label: "Argentina - Bariloche", precision: "area" },
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "villa-catedral",
    name: "Villa Catedral",
    aliases: ["Catedral", "Base Catedral", "Cerro Catedral"],
    zone: "Cerro Catedral",
    region: "bariloche",
    type: "villa",
    lat: -41.1652469,
    lon: -71.4394927,
    altitudeM: null,
    outingTags: ["base", "esqui", "trekking"],
    exposureTags: ["montana", "viento"],
    windguru: { spotId: 1012563, label: "Argentina - Villa Catedral", precision: "nearby" },
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "villa-llao-llao",
    name: "Villa Llao Llao",
    aliases: ["Llao Llao", "Circuito Chico"],
    zone: "Llao Llao",
    region: "bariloche",
    type: "villa",
    lat: -41.0539926,
    lon: -71.5239328,
    altitudeM: null,
    outingTags: ["bosque", "miradores", "lagos"],
    exposureTags: ["bosque", "lago"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "el-bolson",
    name: "El Bolsón",
    aliases: ["Bolson", "Centro Bolsón"],
    zone: "El Bolsón",
    region: "bolson",
    type: "ciudad",
    lat: -41.9649027,
    lon: -71.5348197,
    altitudeM: null,
    outingTags: ["base", "logistica", "valle"],
    exposureTags: ["valle", "urbano"],
    windguru: { spotId: 166542, label: "Argentina - El Bolsón", precision: "area" },
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "villa-la-angostura",
    name: "Villa La Angostura",
    aliases: ["La Angostura", "VLA"],
    zone: "Nahuel Huapi norte",
    region: "angostura",
    type: "villa",
    lat: -40.7620693,
    lon: -71.6472306,
    altitudeM: null,
    outingTags: ["base", "bosque", "lagos"],
    exposureTags: ["bosque", "lago"],
    windguru: { spotId: 996095, label: "Argentina - Villa Angostura Neuquén", precision: "area" },
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "refugio-jakob",
    name: "Refugio Jakob / Laguna San Martín",
    aliases: ["Jakob", "Refugio San Martín", "Laguna San Martin"],
    zone: "Catedral - Jakob",
    region: "bariloche",
    type: "refugio",
    lat: -41.1867539,
    lon: -71.5610164,
    altitudeM: null,
    outingTags: ["refugio", "alta-montana", "lago"],
    exposureTags: ["alta-montana", "viento", "roca"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "refugio-italia",
    name: "Refugio Italia / Laguna Negra / Manfredo Segré",
    aliases: ["Refugio Italia", "Laguna Negra", "Manfredo Segre", "Segré"],
    zone: "Colonia Suiza - Laguna Negra",
    region: "bariloche",
    type: "refugio",
    lat: -41.1367041,
    lon: -71.5777839,
    altitudeM: null,
    outingTags: ["refugio", "alta-montana", "laguna"],
    exposureTags: ["alta-montana", "viento", "niebla"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "pampa-linda",
    name: "Pampa Linda",
    aliases: ["Tronador base", "Pampa"],
    zone: "Tronador - Pampa Linda",
    region: "tronador",
    type: "montana",
    lat: -41.2305654,
    lon: -71.7732021,
    altitudeM: null,
    outingTags: ["alta-montana", "glaciar", "base"],
    exposureTags: ["montana", "viento", "precipitacion"],
    windguru: { spotId: 992465, label: "Argentina - Bariloche - Cerro tronador", precision: "nearby" },
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "otto-meiling",
    name: "Refugio Otto Meiling",
    aliases: ["Otto Meiling", "Meiling", "Tronador alto"],
    zone: "Tronador alto",
    region: "tronador",
    type: "refugio",
    lat: -41.1759253,
    lon: -71.8180138,
    altitudeM: null,
    outingTags: ["refugio", "glaciar", "alta-montana"],
    exposureTags: ["alta-montana", "viento", "frio"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "refugio-rocca",
    name: "Refugio Rocca",
    aliases: ["Agostino Rocca", "Rocca", "Paso de las Nubes"],
    zone: "Tronador - Paso de las Nubes",
    region: "tronador",
    type: "refugio",
    lat: -41.1546665,
    lon: -71.8058898,
    altitudeM: null,
    outingTags: ["refugio", "alta-montana", "travesia"],
    exposureTags: ["alta-montana", "viento", "glaciar"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  },
  {
    id: "refugio-piltriquitron",
    name: "Refugio Piltriquitrón",
    aliases: ["Piltriquitron", "Piltri", "Refugio del Piltri"],
    zone: "Piltriquitrón",
    region: "bolson",
    type: "refugio",
    lat: -41.9689585,
    lon: -71.4701407,
    altitudeM: null,
    outingTags: ["refugio", "mirador", "montana"],
    exposureTags: ["montana", "viento", "bosque"],
    windguru: null,
    coordinatesSource: "Coordenadas curadas desde búsqueda geográfica pública de OpenStreetMap/Nominatim",
    altitudeSource: null
  }
];

export const timezone = "America/Argentina/Buenos_Aires";
