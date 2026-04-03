const DEFAULT_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOWQ4YzUzYy0zMTAwLTRmZGMtYWVlMi1hNDYwZGNhMjE4YWUiLCJpZCI6NDA4MjE3LCJpYXQiOjE3NzQzMzEzOTF9.akI_d21xq7K1IKDuYAydgCibCrYhLU7lDKAPb0ohYZA";
const ION_SATELLITE_ASSET_ID = 3830183;
const CATALOG_URL = "./datasets/catalog.json";
const STARTER_UNIVERSE_COUNT = 120;

const runtimeBranchSeeds = [
  { label: "Open Printing", year: 1439, setup: "trade-port printing spreads before monarchies can lock it down", vector: "knowledge acceleration" },
  { label: "Battery Leap", year: 1916, setup: "dense storage goes mainstream decades early", vector: "distributed energy" },
  { label: "Ocean Cities", year: 1821, setup: "desalination ships remake water politics along every coast", vector: "maritime urbanism" },
  { label: "Planetary Watch", year: 1908, setup: "asteroid defense becomes a planetary mission after a sky shock", vector: "preparedness culture" },
  { label: "Monsoon Compute", year: 1988, setup: "mesh forecasting networks arrive before consumer social media", vector: "civic computation" }
];

const runtimeFutureArcs = [
  { label: "Research Commonwealth", consequence: "prestige shifts from scarcity control to openly useful discovery", endState: "planetary life organizes around public laboratories and restoration charters" },
  { label: "Pelagic Union", consequence: "ports and current routes matter more than old inland power centers", endState: "floating districts and reef metropolises become the dominant urban form" },
  { label: "Prepared Planet", consequence: "simulations and rehearsals become more trusted than panic politics", endState: "Earth expands into orbit with resilience engineering as a civic identity" },
  { label: "Soft Grid Era", consequence: "local abundance rewrites housing, industry, and diplomacy from below", endState: "decentralized fabrication belts replace many fossil-era chokepoints" }
];

const runtimeRegions = [
  { name: "London", lat: 51.5, lng: -0.1 },
  { name: "Amazon Basin", lat: -4, lng: -63 },
  { name: "Cairo", lat: 30, lng: 31 },
  { name: "Lagos", lat: 6.5, lng: 3.4 },
  { name: "Mumbai", lat: 19, lng: 72.8 },
  { name: "Tokyo Bay", lat: 35.6, lng: 139.7 },
  { name: "Arctic Gate", lat: 78, lng: 15 },
  { name: "Sydney Shelf", lat: -33.8, lng: 151.2 }
];

const settlementStartRules = {
  "knowledge acceleration": { year: -3800, reason: "Dense learning exchange begins after stable early settlements appear in this branch." },
  "distributed energy": { year: -3200, reason: "This branch becomes interactive from its first durable settlement and storage societies." },
  "maritime urbanism": { year: -4200, reason: "Permanent coastal settlements form early in this branch and anchor the interactive timeline." },
  "preparedness culture": { year: -3000, reason: "The first resilient settlement networks define the start of this branch timeline." },
  "civic computation": { year: -3400, reason: "The branch timeline begins at its first organized settlements rather than at early-human migration eras." }
};

const eraTemplates = [
  { label: "Origin", altitude: 18000000 },
  { label: "Expansion", altitude: 9000000 },
  { label: "Realignment", altitude: 5000000 },
  { label: "Far Future", altitude: 2600000 }
];

const defaultLayerVisibility = {
  surface: true,
  elevation: false,
  climate: false,
  biomes: false,
  hydrology: false,
  settlement: false
};

const baseModes = [
  {
    id: "terrain",
    label: "Terrain Mesh",
    description: "Real terrain mesh with branch layers on top."
  },
  {
    id: "photoreal",
    label: "Photogrammetry",
    description: "Photorealistic Earth replacement when available."
  }
];

const state = {
  seed: 1,
  eraIndex: 0,
  currentYear: null,
  hasExplicitYear: false,
  catalog: [],
  catalogMap: new Map(),
  activeManifest: null,
  activeLocalScenes: null,
  activeYearIndex: null,
  activeYearState: null,
  activeYearCatalog: null,
  layerVisibility: { ...defaultLayerVisibility },
  baseMode: "terrain",
  selectedHotspotIndex: 0,
  streetMode: false,
  currentZoomTierId: "district",
  timelineRenderTimer: null
};

const viewerState = {
  viewer: null,
  markers: [],
  localDetailEntities: [],
  layerProviders: new Map(),
  ellipsoidTerrainProvider: null,
  worldTerrainProvider: null,
  branchTerrainProvider: null,
  branchTerrainReady: false,
  terrainStatus: "Ellipsoid fallback",
  photorealisticTileset: null,
  osmBuildingsTileset: null,
  supportsPhotorealistic: false,
  supportsTerrainMesh: false,
  booted: false,
  localDetailUpdateQueued: false
};

const elements = {
  seedDisplay: document.querySelector("#seed-display"),
  cameraDisplay: document.querySelector("#camera-display"),
  eraDisplay: document.querySelector("#era-display"),
  branchTitle: document.querySelector("#branch-title"),
  branchPremise: document.querySelector("#branch-premise"),
  globeHeading: document.querySelector("#globe-heading"),
  yearBadge: document.querySelector("#year-badge"),
  modeTitle: document.querySelector("#mode-title"),
  modeCopy: document.querySelector("#mode-copy"),
  timelineHeading: document.querySelector("#timeline-heading"),
  shareState: document.querySelector("#share-state"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryCopy: document.querySelector("#summary-copy"),
  futureTitle: document.querySelector("#future-title"),
  futureCopy: document.querySelector("#future-copy"),
  hotspotTitle: document.querySelector("#hotspot-title"),
  hotspotCopy: document.querySelector("#hotspot-copy"),
  streetViewButton: document.querySelector("#street-view-button"),
  zoomInButton: document.querySelector("#zoom-in-button"),
  zoomOutButton: document.querySelector("#zoom-out-button"),
  promptTitle: document.querySelector("#prompt-title"),
  promptCopy: document.querySelector("#prompt-copy"),
  seedInput: document.querySelector("#seed-input"),
  eraSlider: document.querySelector("#era-slider"),
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-button"),
  searchStatus: document.querySelector("#search-status"),
  searchResults: document.querySelector("#search-results"),
  datasetStatus: document.querySelector("#dataset-status"),
  baseModeControls: document.querySelector("#base-mode-controls"),
  layerControls: document.querySelector("#layer-controls"),
  randomizeButton: document.querySelector("#randomize-button"),
  shareButton: document.querySelector("#share-button"),
  loadButton: document.querySelector("#load-button"),
  previousButton: document.querySelector("#previous-button"),
  nextButton: document.querySelector("#next-button"),
  copyPromptButton: document.querySelector("#copy-prompt-button"),
  engineNote: document.querySelector("#engine-note"),
  timelineStops: document.querySelector("#timeline-stops")
};

function initializeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get("seed") || "1", 10);
  const era = Number.parseInt(params.get("era") || "0", 10);
  const year = Number.parseInt(params.get("year") || "", 10);
  if (!Number.isNaN(seed) && seed > 0) {
    state.seed = seed;
  }
  if (!Number.isNaN(era) && era >= 0 && era < eraTemplates.length) {
    state.eraIndex = era;
  }
  if (!Number.isNaN(year)) {
    state.currentYear = year;
    state.hasExplicitYear = true;
  }
}

function setSearchParams() {
  const params = new URLSearchParams();
  params.set("seed", String(state.seed));
  params.set("era", String(state.eraIndex));
  if (state.currentYear) {
    params.set("year", String(state.currentYear));
  }
  history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

function showGlobalView(duration = 0) {
  if (!viewerState.viewer) return;
  const destination = Cesium.Cartesian3.fromDegrees(12, 22, 21000000);
  const orientation = {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-38),
    roll: 0
  };

  if (duration > 0) {
    viewerState.viewer.camera.flyTo({
      destination,
      orientation,
      duration,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  } else {
    viewerState.viewer.camera.setView({ destination, orientation });
  }
}

function getStoredToken() {
  return window.localStorage.getItem("altered-earth-ion-token") || DEFAULT_ION_TOKEN;
}

async function copyShareLink() {
  const params = new URLSearchParams({ seed: String(state.seed), era: String(state.eraIndex) });
  if (state.currentYear) {
    params.set("year", String(state.currentYear));
  }
  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  try {
    await navigator.clipboard.writeText(url);
    elements.shareState.textContent = "Link copied";
  } catch {
    elements.shareState.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    elements.shareState.textContent = "Ready";
  }, 1800);
}

async function copyPromptText(text) {
  try {
    await navigator.clipboard.writeText(text);
    elements.shareState.textContent = "Prompt copied";
  } catch {
    elements.shareState.textContent = "Prompt copy failed";
  }
  window.setTimeout(() => {
    elements.shareState.textContent = "Ready";
  }, 1800);
}

function getCatalogEntry(seed) {
  return state.catalogMap.get(String(seed)) || null;
}

function hashString(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function wrapIndex(index, length) {
  return ((index % length) + length) % length;
}

function getSettlementStart(manifest) {
  return settlementStartRules[manifest.vector] || {
    year: -3500,
    reason: "The interactive timeline begins at the first durable settlements in this branch."
  };
}

function buildRuntimeBranch(seed) {
  const normalizedSeed = Math.max(1, Number(seed) || 1);
  const base = runtimeBranchSeeds[wrapIndex(normalizedSeed - 1, runtimeBranchSeeds.length)];
  const arc = runtimeFutureArcs[wrapIndex(Math.floor((normalizedSeed - 1) / runtimeBranchSeeds.length), runtimeFutureArcs.length)];
  const regionA = runtimeRegions[wrapIndex(normalizedSeed * 3, runtimeRegions.length)];
  const regionB = runtimeRegions[wrapIndex((normalizedSeed * 5) + 1, runtimeRegions.length)];
  const regionC = runtimeRegions[wrapIndex((normalizedSeed * 7) + 2, runtimeRegions.length)];
  const branchHash = hashString(`${normalizedSeed}:${base.label}:${arc.label}`);
  const yearSeries = eraTemplates.map((era) => base.year + [0, 40, 120, 260][eraTemplates.indexOf(era)]);
  const manifest = {
    seed: normalizedSeed,
    code: `ALT-${String(normalizedSeed).padStart(6, "0")}`,
    title: `${base.label} / ${arc.label}`,
    premise: `Seed ${normalizedSeed} follows a world where ${base.setup}, spreading first through ${regionA.name} and ${regionB.name}.`,
    summary: `${base.vector} becomes the dominant organizing logic of this branch.`,
    future: arc.endState,
    differences: `${arc.consequence}. Terrain, water access, climate patterns, and settlement corridors gradually reorganize around ${base.vector}.`,
    vector: base.vector,
    prompt: `Near-Earth derivative world where ${base.setup}, reshaping ${regionA.name}, ${regionB.name}, and ${regionC.name}, ending in ${arc.endState}.`,
    physicalModel: {
      verticalExaggeration: 1 + ((branchHash % 7) * 0.035),
      verticalReferenceHeight: 0,
      seaLevelShiftMeters: ((branchHash % 9) - 4) * 22,
      climateBiasCelsius: ((branchHash % 11) - 5) * 0.4,
      baseColor: "#0b213d"
    },
    searchText: `${base.label} ${base.setup} ${base.vector} ${arc.label} ${arc.consequence} ${arc.endState} ${regionA.name} ${regionB.name} ${regionC.name}`.toLowerCase(),
    hotspots: [
      { name: regionA.name, lat: regionA.lat + ((branchHash % 3) - 1) * 2.4, lng: regionA.lng + ((branchHash % 5) - 2) * 4.2, detail: `${regionA.name} is the first region where the new branch stabilizes.` },
      { name: regionB.name, lat: regionB.lat + (((branchHash + 1) % 3) - 1) * 2.2, lng: regionB.lng + (((branchHash + 3) % 5) - 2) * 4.4, detail: `${regionB.name} becomes the large-scale systems hinge of this universe.` },
      { name: regionC.name, lat: regionC.lat + (((branchHash + 2) % 3) - 1) * 2.4, lng: regionC.lng + (((branchHash + 4) % 5) - 2) * 4.1, detail: `${regionC.name} shows the late-stage consequence of the divergence.` }
    ],
    eras: [
      { year: base.year, title: `${arc.label} Origin`, summary: `In ${base.year}, ${base.setup}.`, future: arc.consequence, camera: "Global orbit", altitude: 18000000 },
      { year: base.year + 40, title: `${arc.label} Expansion`, summary: `${base.vector} expands through connected settlements by ${base.year + 40}.`, future: arc.consequence, camera: "Continental sweep", altitude: 9000000 },
      { year: base.year + 120, title: `${arc.label} Realignment`, summary: `${base.vector} reorganizes institutions and landscapes by ${base.year + 120}.`, future: arc.endState, camera: "Regional scan", altitude: 5000000 },
      { year: base.year + 260, title: `${arc.label} Far Future`, summary: `${base.vector} defines the future horizon by ${base.year + 260}.`, future: `The branch culminates in ${arc.endState}.`, camera: "Lower atmosphere pass", altitude: 2600000 }
    ],
    layers: {
      surface: { id: "surface", label: "Surface", description: "Runtime-generated branch surface." },
      climate: { id: "climate", label: "Climate", description: "Runtime-generated climate layer." },
      settlement: { id: "settlement", label: "Settlement", description: "Runtime-generated settlement layer." }
    }
  };
  manifest.visualProfile = buildVisualProfile(manifest);
  const settlementStart = getSettlementStart(manifest);
  manifest.processing = {
    datasetClass: "Runtime generated branch",
    historyRange: {
      startYear: settlementStart.year,
      endYear: manifest.eras[manifest.eras.length - 1].year,
      startReason: settlementStart.reason,
      authoredStartYear: manifest.eras[0].year,
      authoredEndYear: manifest.eras[manifest.eras.length - 1].year
    }
  };
  return manifest;
}

function buildRuntimeCatalogEntry(seed) {
  const manifest = buildRuntimeBranch(seed);
  return {
    seed: manifest.seed,
    code: manifest.code,
    title: manifest.title,
    summary: manifest.summary,
    searchText: manifest.searchText,
    searchSnippet: manifest.premise,
    matchReason: "Runtime generated branch",
    runtimeGenerated: true
  };
}

function getInteractiveStartYear(manifest) {
  return manifest?.processing?.historyRange?.startYear
    ?? manifest?.processing?.yearlyIndexData?.interactiveStartYear
    ?? manifest?.processing?.yearlyIndexData?.firstSettlementYear
    ?? manifest?.processing?.yearlyIndexData?.startYear
    ?? manifest?.eras?.[0]?.year
    ?? 0;
}

function buildRuntimeYearCatalog(manifest) {
  const settlementStart = getSettlementStart(manifest);
  const startYear = settlementStart.year;
  const endYear = manifest.eras[manifest.eras.length - 1].year;
  return {
    generatedAt: new Date().toISOString(),
    startYear,
    endYear,
    firstSettlementYear: settlementStart.year,
    firstSettlementReason: settlementStart.reason,
    interactiveStartYear: settlementStart.year,
    historyStartYear: settlementStart.year,
    historyEndYear: endYear,
    historyStartReason: settlementStart.reason,
    authoredStartYear: manifest.eras[0].year,
    authoredEndYear: endYear,
    model: {
      startSeaLevel: manifest.physicalModel?.seaLevelShiftMeters || 0,
      climateBias: manifest.physicalModel?.climateBiasCelsius || 0,
      settlementMean: 0.34 + ((manifest.seed % 5) * 0.03),
      hydrologyMean: 0.36 + ((manifest.seed % 7) * 0.02),
      iceBase: 0.72
    },
    count: endYear - manifest.eras[0].year + 1,
    years: (manifest.eras || []).map((era, index) => ({
      year: era.year,
      eraIndex: index,
      nextEraIndex: Math.min(index + 1, manifest.eras.length - 1)
    }))
  };
}

function buildRuntimeLocalScenes(manifest) {
  return {
    generatedAt: new Date().toISOString(),
    stageOrder: CLIENT_STAGE_ORDER,
    hotspots: (manifest.hotspots || []).map((hotspot, hotspotIndex) => {
      const hotspotHash = hashString(`${manifest.seed}:${hotspotIndex}:${hotspot.name}`);
      const baseOffset = ((hotspotHash % 7) - 3) * 0.004;
      return {
        hotspotIndex,
        name: hotspot.name,
        lat: hotspot.lat,
        lng: hotspot.lng,
        settlementScore: Number((0.34 + ((hotspotHash % 11) * 0.045)).toFixed(3)),
        stageScenes: CLIENT_STAGE_ORDER.map((stageId, stageIndex) => {
          const config = CLIENT_STAGE_CONFIG[stageId];
          const isAgrarian = stageId === "agrarian";
          const focus = {
            lat: Number((hotspot.lat + baseOffset).toFixed(6)),
            lng: Number((hotspot.lng - baseOffset).toFixed(6))
          };
          const roads = [];
          const buildings = [];
          const plazas = [];
          const landmarks = [];
          const water = [];
          const greenways = [];
          const radius = 80 + (stageIndex * 30);
          const segmentCount = stageIndex <= 2 ? 2 + stageIndex : 4 + (stageIndex * 2);
          for (let index = 0; index < segmentCount; index += 1) {
            const spread = (index - (segmentCount / 2)) * (0.004 + (stageIndex * 0.0008));
            roads.push({
              kind: stageIndex <= 2 ? "trail" : (isAgrarian ? "lane" : "street"),
              width: stageIndex <= 2 ? 2 : (isAgrarian ? 3 : 4 + Math.max(0, stageIndex - 3)),
              points: [
                [Number((focus.lng - 0.006).toFixed(6)), Number((focus.lat + spread).toFixed(6))],
                [Number((focus.lng + 0.006).toFixed(6)), Number((focus.lat + spread).toFixed(6))]
              ]
            });
          }
          if (stageIndex >= 2) {
            plazas.push({
              kind: stageId === "agrarian" ? "market-green" : "civic-plaza",
              center: [focus.lng, focus.lat],
              polygon: [
                [focus.lng - 0.0015, focus.lat - 0.0012],
                [focus.lng + 0.0015, focus.lat - 0.0012],
                [focus.lng + 0.0015, focus.lat + 0.0012],
                [focus.lng - 0.0015, focus.lat + 0.0012]
              ]
            });
          }
          const buildingCount = stageIndex <= 1 ? 0 : stageIndex === 2 ? 6 : isAgrarian ? 8 : 12 + (stageIndex * 8);
          for (let index = 0; index < buildingCount; index += 1) {
            const angle = (index / Math.max(buildingCount, 1)) * Math.PI * 2;
            const distance = 0.0015 + ((index % 5) * 0.0008) + (stageIndex * 0.0002);
            buildings.push({
              center: [
                Number((focus.lng + (Math.cos(angle) * distance)).toFixed(6)),
                Number((focus.lat + (Math.sin(angle) * distance)).toFixed(6))
              ],
              width: stageIndex <= 2 ? 10 : isAgrarian ? 11 + (index % 3) : 14 + (stageIndex * 2),
              depth: stageIndex <= 2 ? 9 : isAgrarian ? 10 + (index % 2) : 12 + (stageIndex * 2),
              height: stageIndex <= 2 ? 7 + (index % 4) : isAgrarian ? 8 + (index % 5) : 20 + (stageIndex * 16) + (index % 7)
            });
          }
          if (stageIndex >= 4) {
            landmarks.push({
              kind: config.label,
              center: [focus.lng, focus.lat],
              radius: 18 + (stageIndex * 4),
              height: 54 + (stageIndex * 24)
            });
          }
          if (stageIndex >= 3) {
            water.push({
              width: 18 + (stageIndex * 3),
              points: [
                [Number((focus.lng - 0.007).toFixed(6)), Number((focus.lat - 0.004).toFixed(6))],
                [Number((focus.lng + 0.007).toFixed(6)), Number((focus.lat + 0.004).toFixed(6))]
              ]
            });
            greenways.push({
              width: 24 + (stageIndex * 3),
              points: [
                [Number((focus.lng - 0.006).toFixed(6)), Number((focus.lat + 0.005).toFixed(6))],
                [Number((focus.lng + 0.006).toFixed(6)), Number((focus.lat + 0.005).toFixed(6))]
              ]
            });
          }
          return {
            stageId,
            stageLabel: config.label,
            builtEnvironmentLevel: config.builtEnvironmentLevel,
            detailMode: config.detailMode,
            allowStreetMode: config.allowStreetMode,
            yearRange: stageId === "forager" ? { start: getInteractiveStartYear(manifest), end: -1500 }
              : stageId === "proto-settlement" ? { start: -1499, end: 1199 }
              : stageId === "agrarian" ? { start: 1200, end: 1759 }
              : stageId === "industrial" ? { start: 1760, end: 2069 }
              : stageId === "networked" ? { start: 2070, end: 2349 }
              : stageId === "post-planetary" ? { start: 2350, end: 10000 }
              : { start: getInteractiveStartYear(manifest), end: -4001 },
            description: `${hotspot.name} is shown as ${config.label.toLowerCase()}-era local form for this branch year.`,
            theme: manifest.visualProfile?.eraStates?.[0]?.local || {},
            focus,
            focusAltitude: stageIndex <= 2 ? 180 : stageIndex === 3 ? 140 : 92 - ((stageIndex - 4) * 10),
            focusRangeMeters: stageIndex <= 2 ? 160 : stageIndex === 3 ? 120 : 72 - ((stageIndex - 4) * 12),
            pitchDegrees: stageIndex <= 2 ? 64 : 72 + (stageIndex * 2),
            headingDegrees: hotspotHash % 360,
            radiusMeters: radius * 4,
            streetSegments: roads,
            buildings,
            hubs: [],
            landmarks,
            plazas,
            parcels: [],
            water,
            transit: [],
            greenways,
            zoomTiers: [
              { id: "district", label: stageIndex <= 2 ? "Region" : "District", maxCameraHeight: 2400, roads: roads.slice(0, Math.max(1, Math.ceil(roads.length / 3))), buildings: buildings.slice(0, Math.max(0, Math.ceil(buildings.length / 5))), hubs: [], landmarks: landmarks.slice(0, 1), plazas: plazas.slice(0, 1), parcels: [], water, transit: [], greenways },
              { id: "neighborhood", label: stageIndex <= 2 ? "Camp" : "Neighborhood", maxCameraHeight: 1200, roads: roads.slice(0, Math.max(1, Math.ceil(roads.length / 2))), buildings: buildings.slice(0, Math.max(0, Math.ceil(buildings.length / 2))), hubs: [], landmarks, plazas, parcels: [], water, transit: [], greenways },
              { id: "block", label: stageIndex <= 2 ? "Cluster" : "Block", maxCameraHeight: 520, roads, buildings: buildings.slice(0, Math.max(0, Math.ceil(buildings.length * 0.8))), hubs: [], landmarks, plazas, parcels: [], water, transit: [], greenways },
              { id: "street", label: stageIndex <= 2 ? "Ground" : "Street", maxCameraHeight: 190, roads, buildings, hubs: [], landmarks, plazas, parcels: [], water, transit: [], greenways }
            ]
          };
        })
      };
    })
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const normalized = String(hex || "#000000").replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(first, second, amount) {
  const t = clamp(amount, 0, 1);
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return rgbToHex({
    r: a.r + ((b.r - a.r) * t),
    g: a.g + ((b.g - a.g) * t),
    b: a.b + ((b.b - a.b) * t)
  });
}

function interpolateNumber(a, b, t) {
  return a + ((b - a) * t);
}

function interpolateLayerStyle(a, b, t) {
  return {
    alpha: Number(interpolateNumber(a?.alpha ?? 1, b?.alpha ?? a?.alpha ?? 1, t).toFixed(3)),
    brightness: Number(interpolateNumber(a?.brightness ?? 1, b?.brightness ?? a?.brightness ?? 1, t).toFixed(3)),
    contrast: Number(interpolateNumber(a?.contrast ?? 1, b?.contrast ?? a?.contrast ?? 1, t).toFixed(3)),
    saturation: Number(interpolateNumber(a?.saturation ?? 1, b?.saturation ?? a?.saturation ?? 1, t).toFixed(3)),
    gamma: Number(interpolateNumber(a?.gamma ?? 1, b?.gamma ?? a?.gamma ?? 1, t).toFixed(3)),
    hue: Number(interpolateNumber(a?.hue ?? 0, b?.hue ?? a?.hue ?? 0, t).toFixed(3))
  };
}

function interpolateVisualState(fromState, toState, t, year) {
  const layerIds = ["surface", "elevation", "climate", "biomes", "hydrology", "settlement"];
  const layers = {};
  layerIds.forEach((id) => {
    layers[id] = interpolateLayerStyle(fromState?.globe?.layerStyles?.[id], toState?.globe?.layerStyles?.[id], t);
  });
  return {
    year,
    globe: {
      baseColor: mixHex(fromState?.globe?.baseColor || "#0b213d", toState?.globe?.baseColor || fromState?.globe?.baseColor || "#0b213d", t),
      atmosphereTint: mixHex(fromState?.globe?.atmosphereTint || "#88d8ff", toState?.globe?.atmosphereTint || fromState?.globe?.atmosphereTint || "#88d8ff", t),
      fogTint: mixHex(fromState?.globe?.fogTint || "#6dc7ff", toState?.globe?.fogTint || fromState?.globe?.fogTint || "#6dc7ff", t),
      hueShift: Number(interpolateNumber(fromState?.globe?.hueShift ?? 0, toState?.globe?.hueShift ?? fromState?.globe?.hueShift ?? 0, t).toFixed(3)),
      saturationShift: Number(interpolateNumber(fromState?.globe?.saturationShift ?? 0, toState?.globe?.saturationShift ?? fromState?.globe?.saturationShift ?? 0, t).toFixed(3)),
      brightnessShift: Number(interpolateNumber(fromState?.globe?.brightnessShift ?? 0, toState?.globe?.brightnessShift ?? fromState?.globe?.brightnessShift ?? 0, t).toFixed(3)),
      fogDensity: Number(interpolateNumber(fromState?.globe?.fogDensity ?? 0.00012, toState?.globe?.fogDensity ?? fromState?.globe?.fogDensity ?? 0.00012, t).toFixed(6)),
      layerStyles: layers
    },
    local: {
      accent: mixHex(fromState?.local?.accent || "#88d2f4", toState?.local?.accent || fromState?.local?.accent || "#88d2f4", t),
      road: mixHex(fromState?.local?.road || "#a3cbe6", toState?.local?.road || fromState?.local?.road || "#a3cbe6", t),
      hub: mixHex(fromState?.local?.hub || "#f8edb4", toState?.local?.hub || fromState?.local?.hub || "#f8edb4", t),
      facade: mixHex(fromState?.local?.facade || "#9cc8ec", toState?.local?.facade || fromState?.local?.facade || "#9cc8ec", t),
      roof: mixHex(fromState?.local?.roof || "#dceffb", toState?.local?.roof || fromState?.local?.roof || "#dceffb", t),
      parcel: mixHex(fromState?.local?.parcel || "#3e5d86", toState?.local?.parcel || fromState?.local?.parcel || "#3e5d86", t),
      plaza: mixHex(fromState?.local?.plaza || "#e1e9ea", toState?.local?.plaza || fromState?.local?.plaza || "#e1e9ea", t),
      water: mixHex(fromState?.local?.water || "#69c0ff", toState?.local?.water || fromState?.local?.water || "#69c0ff", t),
      greenery: mixHex(fromState?.local?.greenery || "#73d1a2", toState?.local?.greenery || fromState?.local?.greenery || "#73d1a2", t),
      transit: mixHex(fromState?.local?.transit || "#98eef9", toState?.local?.transit || fromState?.local?.transit || "#98eef9", t),
      landmark: mixHex(fromState?.local?.landmark || "#fef1b4", toState?.local?.landmark || fromState?.local?.landmark || "#fef1b4", t),
      glow: Number(interpolateNumber(fromState?.local?.glow ?? 0.2, toState?.local?.glow ?? fromState?.local?.glow ?? 0.2, t).toFixed(3)),
      roadGlow: Number(interpolateNumber(fromState?.local?.roadGlow ?? 0.16, toState?.local?.roadGlow ?? fromState?.local?.roadGlow ?? 0.16, t).toFixed(3)),
      buildingAlpha: Number(interpolateNumber(fromState?.local?.buildingAlpha ?? 0.62, toState?.local?.buildingAlpha ?? fromState?.local?.buildingAlpha ?? 0.62, t).toFixed(3)),
      infrastructureMix: Number(interpolateNumber(fromState?.local?.infrastructureMix ?? 0.16, toState?.local?.infrastructureMix ?? fromState?.local?.infrastructureMix ?? 0.16, t).toFixed(3)),
      sceneMood: t < 0.5 ? (fromState?.local?.sceneMood || "") : (toState?.local?.sceneMood || fromState?.local?.sceneMood || "")
    }
  };
}

const CLIENT_STAGE_ORDER = ["prehuman", "forager", "proto-settlement", "agrarian", "industrial", "networked", "post-planetary"];
const CLIENT_STAGE_CONFIG = {
  prehuman: { label: "Prehuman", builtEnvironmentLevel: 0, detailMode: "wilderness", allowStreetMode: false, settlementCap: 0.01, connectivityCap: 0.01, urbanCap: 0, cultivatedCap: 0, orbitalCap: 0, restorationFloor: 0.06 },
  forager: { label: "Forager", builtEnvironmentLevel: 1, detailMode: "camp", allowStreetMode: false, settlementCap: 0.06, connectivityCap: 0.08, urbanCap: 0.01, cultivatedCap: 0.01, orbitalCap: 0, restorationFloor: 0.08 },
  "proto-settlement": { label: "Proto-settlement", builtEnvironmentLevel: 2, detailMode: "camp", allowStreetMode: false, settlementCap: 0.14, connectivityCap: 0.18, urbanCap: 0.03, cultivatedCap: 0.08, orbitalCap: 0, restorationFloor: 0.07 },
  agrarian: { label: "Agrarian", builtEnvironmentLevel: 3, detailMode: "settlement", allowStreetMode: false, settlementCap: 0.34, connectivityCap: 0.34, urbanCap: 0.08, cultivatedCap: 0.28, orbitalCap: 0, restorationFloor: 0.05 },
  industrial: { label: "Industrial", builtEnvironmentLevel: 4, detailMode: "street", allowStreetMode: true, settlementCap: 0.58, connectivityCap: 0.56, urbanCap: 0.18, cultivatedCap: 0.36, orbitalCap: 0.02, restorationFloor: 0.04 },
  networked: { label: "Networked", builtEnvironmentLevel: 5, detailMode: "street", allowStreetMode: true, settlementCap: 0.82, connectivityCap: 0.8, urbanCap: 0.3, cultivatedCap: 0.3, orbitalCap: 0.12, restorationFloor: 0.06 },
  "post-planetary": { label: "Post-planetary", builtEnvironmentLevel: 6, detailMode: "street", allowStreetMode: true, settlementCap: 0.96, connectivityCap: 0.94, urbanCap: 0.42, cultivatedCap: 0.22, orbitalCap: 0.36, restorationFloor: 0.08 }
};
const CLIENT_STAGE_ACCELERATION_RULES = {
  "knowledge acceleration": { bonus: 1, thresholdYear: 1450, minProgress: 0.1, minSettlement: 0.24, reason: "Accelerated learning systems and coordinated institutions pull advanced settlement forms earlier than baseline history." },
  "distributed energy": { bonus: 1, thresholdYear: 1680, minProgress: 0.16, minSettlement: 0.26, reason: "Abundant distributed power lets this branch scale infrastructure earlier than a baseline agrarian timeline." },
  "maritime urbanism": { bonus: 1, thresholdYear: 1600, minProgress: 0.14, minSettlement: 0.25, reason: "Coastal adaptation and port density advance urban complexity earlier in this branch." },
  "preparedness culture": { bonus: 1, thresholdYear: 1750, minProgress: 0.18, minSettlement: 0.28, reason: "Preparedness-focused logistics move this branch into earlier large-scale infrastructure buildout." },
  "civic computation": { bonus: 1, thresholdYear: 1500, minProgress: 0.12, minSettlement: 0.24, reason: "Civic computation and dense coordination justify an earlier shift into advanced built environments." }
};

function getClientBaselineStageIdForYear(year) {
  if (year < -10000) return "prehuman";
  if (year < -3500) return "forager";
  if (year < 900) return "proto-settlement";
  if (year < 1760) return "agrarian";
  if (year < 2070) return "industrial";
  if (year < 2350) return "networked";
  return "post-planetary";
}

function resolveClientCivilizationStage(manifest, year, progress, rawSettlementIntensity) {
  const baseStageId = getClientBaselineStageIdForYear(year);
  const baseStageIndex = CLIENT_STAGE_ORDER.indexOf(baseStageId);
  const rule = CLIENT_STAGE_ACCELERATION_RULES[manifest.vector];
  let stageIndex = Math.max(baseStageIndex, 0);
  let branchOverrideReason = null;
  if (rule && year >= rule.thresholdYear && progress >= rule.minProgress && rawSettlementIntensity >= rule.minSettlement) {
    stageIndex = Math.min(stageIndex + rule.bonus, CLIENT_STAGE_ORDER.length - 1);
    if (stageIndex > baseStageIndex) {
      branchOverrideReason = rule.reason;
    }
  }
  const stageId = CLIENT_STAGE_ORDER[stageIndex];
  const config = CLIENT_STAGE_CONFIG[stageId];
  return { id: stageId, label: config.label, builtEnvironmentLevel: config.builtEnvironmentLevel, detailMode: config.detailMode, allowStreetMode: config.allowStreetMode, branchOverrideReason, config };
}

function scaleHex(hex, factor) {
  const value = hexToRgb(hex);
  return rgbToHex({ r: value.r * factor, g: value.g * factor, b: value.b * factor });
}

function encodeSvgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  const catalog = await response.json();
  state.catalog = catalog.universes || [];
  state.catalogMap = new Map(state.catalog.map((entry) => [String(entry.seed), entry]));
}

async function loadManifest(seed) {
  const entry = getCatalogEntry(seed) || buildRuntimeCatalogEntry(seed);
  if (entry.runtimeGenerated) {
    return buildRuntimeBranch(seed);
  }
  const response = await fetch(entry.manifest, { cache: "no-store" });
  if (!response.ok) {
    return buildRuntimeBranch(seed);
  }
  return response.json();
}

async function loadJson(pathValue) {
  const response = await fetch(pathValue, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function resolveYearPath(template, year) {
  return template.replace("{year}", String(year));
}

async function loadYearCatalog(manifest) {
  if (manifest?.processing?.yearlyIndexData) {
    return manifest.processing.yearlyIndexData;
  }
  const yearlyIndexPath = manifest?.processing?.products?.yearlyIndex;
  return yearlyIndexPath ? loadJson(yearlyIndexPath) : null;
}

async function loadYearState(manifest, yearCatalog, year) {
  const template = manifest?.processing?.products?.yearlyStateTemplate;
  const entry = yearCatalog?.years?.find((item) => item.year === year) || null;
  if (entry?.path) {
    return loadJson(entry.path);
  }
  if (template && year) {
    const loaded = await loadJson(resolveYearPath(template, year));
    if (loaded) {
      return loaded;
    }
  }
  return synthesizeYearState(manifest, yearCatalog, year);
}

function buildClientYearTileSvg(manifest, yearState, layer) {
  const palette = manifest.visualProfile?.palette || {};
  const render = yearState.render || {};
  const atmosphere = yearState.systems.atmosphere;
  const ocean = yearState.systems.ocean;
  const vegetation = yearState.systems.vegetation;
  const ice = yearState.systems.ice;
  const settlement = yearState.systems.settlement;
  const landA = scaleHex(render.local?.greenery || palette.vegetation || "#6fbf85", 0.78 + vegetation.vitalityIndex * 0.35);
  const landB = mixHex(render.local?.greenery || palette.vegetation || "#6fbf85", render.local?.parcel || palette.globeBase || "#22364c", 0.24 + settlement.intensityIndex * 0.18);
  const landC = mixHex(render.local?.roof || "#dceffb", render.local?.greenery || "#6fbf85", 0.34);
  const waterA = mixHex(render.local?.water || palette.water || "#5abfff", palette.globeBase || "#0b213d", 0.42);
  const waterB = mixHex(render.local?.water || palette.water || "#5abfff", "#ffffff", 0.12 + Math.max(0, ocean.surfaceTempAnomalyC) * 0.06);
  const settlementGlow = render.local?.hub || palette.settlement || "#f7e9a6";
  const atmosphereTint = render.globe?.atmosphereTint || palette.atmosphere || "#88d8ff";
  const iceColor = mixHex("#eef7ff", atmosphereTint, 0.08);
  const waveY = 658 + Math.round(ocean.seaLevelMeters * 3);
  const cloudOpacity = clamp(atmosphere.cloudCover, 0.2, 0.86);
  const iceOpacity = clamp(ice.polarExtentIndex, 0.08, 0.92);
  const builtLevel = yearState.builtEnvironmentLevel || 0;
  const settlementOpacity = clamp(settlement.intensityIndex * 0.72 * Math.max(builtLevel / 6, 0.08), 0.02, 0.84);
  const sparseFootprint = builtLevel <= 2;
  const naturalLandMix = builtLevel <= 1 ? 0.08 : builtLevel <= 3 ? 0.16 : 0.24;
  if (layer === "climate") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024"><defs><linearGradient id="sky" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="${atmosphereTint}"/><stop offset="100%" stop-color="${mixHex(atmosphereTint, waterA, 0.45)}"/></linearGradient></defs><rect width="2048" height="1024" fill="${mixHex("#102139", "#2b3d5c", 0.28)}"/><rect width="2048" height="1024" fill="url(#sky)" opacity="${cloudOpacity}"/><path d="M0 ${waveY}C224 ${waveY - 34} 518 ${waveY + 18} 768 ${waveY - 6}C1064 ${waveY - 38} 1358 ${waveY + 42} 1656 ${waveY + 10}C1864 ${waveY - 12} 1970 ${waveY + 20} 2048 ${waveY + 8}V1024H0Z" fill="${waterA}" opacity="0.66"/><rect x="0" y="${Math.round(64 + (1 - ice.polarExtentIndex) * 80)}" width="2048" height="${Math.round(120 + ice.polarExtentIndex * 140)}" fill="${iceColor}" opacity="${iceOpacity * 0.42}"/><rect x="0" y="${Math.round(920 - ice.polarExtentIndex * 110)}" width="2048" height="${Math.round(104 + ice.polarExtentIndex * 110)}" fill="${iceColor}" opacity="${iceOpacity * 0.36}"/></svg>`;
  }
  if (layer === "settlement") {
    if (builtLevel === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024"><rect width="2048" height="1024" fill="${mixHex(palette.globeBase || "#0b213d", "#09131f", 0.42)}"/></svg>`;
    }
    if (sparseFootprint) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024"><rect width="2048" height="1024" fill="${mixHex(palette.globeBase || "#0b213d", "#09131f", 0.4)}"/><g opacity="${settlementOpacity}"><circle cx="332" cy="344" r="${6 + settlement.intensityIndex * 10}" fill="${settlementGlow}"/><circle cx="882" cy="418" r="${5 + settlement.intensityIndex * 9}" fill="${settlementGlow}"/><circle cx="1398" cy="304" r="${5 + settlement.intensityIndex * 8}" fill="${settlementGlow}"/><path d="M332 344L882 418" stroke="${mixHex(settlementGlow, waterB, 0.2)}" stroke-width="${1 + settlement.connectivityIndex * 3}" opacity="0.4"/></g></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024"><rect width="2048" height="1024" fill="${mixHex(palette.globeBase || "#0b213d", "#09131f", 0.38)}"/><g opacity="${settlementOpacity}"><circle cx="332" cy="344" r="${22 + settlement.intensityIndex * 32}" fill="${settlementGlow}"/><circle cx="882" cy="418" r="${18 + settlement.connectivityIndex * 30}" fill="${settlementGlow}"/><circle cx="1398" cy="304" r="${16 + settlement.intensityIndex * 24}" fill="${settlementGlow}"/><path d="M312 362L864 428L1406 324" stroke="${mixHex(settlementGlow, "#ffffff", 0.2)}" stroke-width="${6 + settlement.connectivityIndex * 7}" opacity="0.76"/><path d="M268 512L812 584L1602 616" stroke="${mixHex(settlementGlow, waterB, 0.24)}" stroke-width="${4 + settlement.connectivityIndex * 6}" opacity="0.58"/></g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1024"><defs><linearGradient id="ocean" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="${waterA}"/><stop offset="100%" stop-color="${waterB}"/></linearGradient><radialGradient id="atmo" cx="40%" cy="28%" r="74%"><stop offset="0%" stop-color="${atmosphereTint}" stop-opacity="${cloudOpacity}"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="2048" height="1024" fill="url(#ocean)"/><rect width="2048" height="1024" fill="url(#atmo)"/><path d="M208 244C402 132 636 120 828 182C1024 244 1206 210 1452 300C1640 370 1824 472 1964 628L1898 892L110 892Z" fill="${landA}" opacity="${0.9 + naturalLandMix * 0.1}"/><path d="M92 ${waveY}C256 ${waveY - 58} 506 ${waveY - 28} 702 ${waveY + 12}C968 ${waveY + 66} 1238 ${waveY + 36} 1502 ${waveY + 92}C1738 ${waveY + 140} 1918 ${waveY + 124} 2048 ${waveY + 146}V1024H0Z" fill="${landB}" opacity="${0.74 + naturalLandMix * 0.5}"/><path d="M356 126C548 72 822 80 1046 126C1266 172 1478 166 1718 254C1882 316 1984 350 2048 396V486C1840 404 1662 392 1452 370C1246 348 1120 384 906 342C706 304 550 238 388 236C244 234 126 248 0 304V216C110 178 214 154 356 126Z" fill="${landC}" opacity="0.72"/><rect x="0" y="${Math.round(44 + (1 - ice.polarExtentIndex) * 90)}" width="2048" height="${Math.round(144 + ice.polarExtentIndex * 150)}" fill="${iceColor}" opacity="${iceOpacity * 0.72}"/><rect x="0" y="${Math.round(900 - ice.polarExtentIndex * 130)}" width="2048" height="${Math.round(130 + ice.polarExtentIndex * 124)}" fill="${iceColor}" opacity="${iceOpacity * 0.68}"/><g opacity="${settlementOpacity}"><circle cx="332" cy="344" r="${sparseFootprint ? 7 + settlement.intensityIndex * 8 : 16 + settlement.intensityIndex * 28}" fill="${settlementGlow}"/><circle cx="882" cy="418" r="${sparseFootprint ? 6 + settlement.connectivityIndex * 7 : 14 + settlement.connectivityIndex * 24}" fill="${settlementGlow}"/><circle cx="1398" cy="304" r="${sparseFootprint ? 6 + settlement.intensityIndex * 7 : 14 + settlement.intensityIndex * 20}" fill="${settlementGlow}"/></g></svg>`;
}

function synthesizeYearState(manifest, yearCatalog, year) {
  if (!manifest || !yearCatalog || !year) return null;
  const eras = manifest.eras || [];
  const visualStates = manifest.visualProfile?.eraStates || [];
  const startYear = yearCatalog.startYear ?? eras[0]?.year ?? 0;
  const endYear = yearCatalog.endYear ?? eras[eras.length - 1]?.year ?? startYear;
  const authoredStartYear = yearCatalog.authoredStartYear ?? eras[0]?.year ?? startYear;
  const model = yearCatalog.model || {};
  let fromIndex = 0;
  let toIndex = Math.max(visualStates.length - 1, 0);
  for (let index = 0; index < eras.length - 1; index += 1) {
    if (year >= eras[index].year && year <= eras[index + 1].year) {
      fromIndex = index;
      toIndex = index + 1;
      break;
    }
  }
  const fromEra = eras[fromIndex] || eras[0];
  const toEra = eras[toIndex] || eras[eras.length - 1] || fromEra;
  const isPreEra = year < authoredStartYear;
  const denominator = Math.max((toEra?.year || year) - (fromEra?.year || year), 1);
  const t = isPreEra ? 0 : clamp((year - (fromEra?.year || year)) / denominator, 0, 1);
  const progress = clamp((year - startYear) / Math.max(endYear - startYear, 1), 0, 1);
  const renderBase = isPreEra
    ? interpolateVisualState(visualStates[0], visualStates[0], 0, year)
    : interpolateVisualState(visualStates[fromIndex], visualStates[toIndex], t, year);
  const rawSettlementIntensity = (model.settlementMean ?? 0.22) + (progress * 0.22);
  const stageRecord = resolveClientCivilizationStage(manifest, year, progress, rawSettlementIntensity);
  const stageConfig = stageRecord.config;
  const stageUrbanMultiplier = stageConfig.builtEnvironmentLevel / 6;
  const preEraBlend = isPreEra ? clamp((year - startYear) / Math.max(authoredStartYear - startYear, 1), 0, 1) : 1;
  const historicalLocal = stageRecord.builtEnvironmentLevel <= 3
    ? {
        facade: year < 1700 ? "#9b7b56" : "#ae8b62",
        roof: year < 1700 ? "#6f5438" : "#7f6242",
        road: year < 1700 ? "#8b775b" : "#9a8567",
        parcel: "#5d4a35",
        plaza: "#b79d74",
        transit: "#7e6c52",
        landmark: "#c7aa74",
        buildingAlpha: 0.3 + (stageUrbanMultiplier * 0.18),
        infrastructureMix: 0.08 + (stageUrbanMultiplier * 0.08)
      }
    : null;
  const render = {
    ...renderBase,
    globe: {
      ...renderBase.globe,
      fogDensity: Number((renderBase.globe.fogDensity + (isPreEra ? 0.00003 * (1 - preEraBlend) : 0)).toFixed(6)),
      layerStyles: {
        ...renderBase.globe.layerStyles,
        settlement: { ...renderBase.globe.layerStyles.settlement, alpha: Number((renderBase.globe.layerStyles.settlement.alpha * Math.max(stageUrbanMultiplier, 0.05)).toFixed(3)) },
        surface: { ...renderBase.globe.layerStyles.surface, saturation: Number((renderBase.globe.layerStyles.surface.saturation - (isPreEra ? 0.12 * (1 - preEraBlend) : 0)).toFixed(3)) }
      }
    },
    local: {
      ...renderBase.local,
      ...(historicalLocal || {}),
      buildingAlpha: Number((((historicalLocal?.buildingAlpha ?? renderBase.local.buildingAlpha)) * Math.max(stageUrbanMultiplier, stageRecord.builtEnvironmentLevel <= 3 ? 0.7 : 0.2)).toFixed(3)),
      infrastructureMix: Number((((historicalLocal?.infrastructureMix ?? renderBase.local.infrastructureMix)) * Math.max(stageUrbanMultiplier, stageRecord.builtEnvironmentLevel <= 3 ? 0.6 : 0.18)).toFixed(3)),
      sceneMood: isPreEra ? `By ${year}, this branch is still in an early-human phase before its first authored divergence era.` : renderBase.local.sceneMood
    }
  };
  const atmosphere = {
    temperatureAnomalyC: Number(((model.climateBias ?? 0) + ((progress - 0.3) * 2.2)).toFixed(2)),
    aerosolIndex: Number((0.22 + ((1 - progress) * 0.18) + ((model.hydrologyMean ?? 0.3) * 0.04)).toFixed(3)),
    cloudCover: Number((0.44 + ((model.hydrologyMean ?? 0.3) * 0.26) - (progress * 0.06)).toFixed(3)),
    stormEnergyIndex: Number((0.38 + ((model.hydrologyMean ?? 0.3) * 0.24) + (progress * 0.18)).toFixed(3))
  };
  const ocean = {
    seaLevelMeters: Number(((model.startSeaLevel ?? 0) + ((progress - 0.5) * 8)).toFixed(2)),
    surfaceTempAnomalyC: Number((atmosphere.temperatureAnomalyC * 0.62).toFixed(2)),
    currentIntensityIndex: Number((0.48 + (progress * 0.16) + ((model.hydrologyMean ?? 0.3) * 0.14)).toFixed(3)),
    salinityShiftIndex: Number((-0.08 + (progress * 0.12)).toFixed(3))
  };
  const landUse = {
    cultivatedShare: Number(clamp(0.02 + (progress * 0.24) + ((model.settlementMean ?? 0.22) * 0.08), 0, stageConfig.cultivatedCap).toFixed(3)),
    urbanShare: Number(clamp(0.01 + (progress * 0.22) + ((model.settlementMean ?? 0.22) * 0.14), 0, stageConfig.urbanCap).toFixed(3)),
    restorationShare: Number((stageConfig.restorationFloor + (progress * 0.12) + ((1 - stageUrbanMultiplier) * 0.04)).toFixed(3)),
    extractionShare: Number(clamp(0.26 - (progress * 0.08) + ((1 - (model.settlementMean ?? 0.22)) * 0.04) - (stageUrbanMultiplier * 0.03), 0.02, 0.34).toFixed(3))
  };
  const vegetation = {
    vitalityIndex: Number(clamp(0.48 + ((1 - stageUrbanMultiplier) * 0.12) + ((1 - Math.max(0, atmosphere.temperatureAnomalyC)) * 0.05), 0.12, 0.96).toFixed(3)),
    forestCoverShare: Number(clamp(0.34 + ((1 - stageUrbanMultiplier) * 0.18) + ((model.hydrologyMean ?? 0.3) * 0.08), 0.08, 0.92).toFixed(3)),
    cropDiversityIndex: Number(clamp(0.08 + (progress * 0.18) + ((model.settlementMean ?? 0.22) * 0.08), 0, 0.78).toFixed(3))
  };
  const ice = {
    polarExtentIndex: Number(clamp((model.iceBase ?? 0.7) - (progress * 0.18) - (Math.max(0, atmosphere.temperatureAnomalyC) * 0.03), 0.08, 0.95).toFixed(3)),
    glacierMassIndex: Number(clamp((model.iceBase ?? 0.7) - (progress * 0.22), 0.06, 0.96).toFixed(3)),
    albedoIndex: Number(clamp(0.64 - (progress * 0.14), 0.22, 0.76).toFixed(3))
  };
  const settlement = {
    intensityIndex: Number(clamp(rawSettlementIntensity, 0, stageConfig.settlementCap).toFixed(3)),
    connectivityIndex: Number(clamp(0.04 + (progress * 0.42), 0, stageConfig.connectivityCap).toFixed(3)),
    coastalUrbanShare: Number(clamp(0.02 + (progress * 0.12) + (ocean.seaLevelMeters > 0 ? 0.03 : 0), 0, Math.max(stageConfig.urbanCap, 0.02)).toFixed(3)),
    orbitalInfrastructureIndex: Number(clamp(progress > 0.7 ? ((progress - 0.7) / 0.3) * stageConfig.orbitalCap : 0, 0, stageConfig.orbitalCap).toFixed(3))
  };
  const yearState = {
    year,
    eraIndex: fromIndex,
    nextEraIndex: toIndex,
    phase: isPreEra ? `Early human baseline -> ${fromEra?.title || manifest.title}` : `${fromEra?.title || manifest.title} -> ${toEra?.title || fromEra?.title || manifest.title}`,
    progress,
    civilizationStage: stageRecord.id,
    civilizationStageLabel: stageRecord.label,
    builtEnvironmentLevel: stageRecord.builtEnvironmentLevel,
    detailMode: stageRecord.detailMode,
    allowStreetMode: stageRecord.allowStreetMode,
    branchOverrideReason: stageRecord.branchOverrideReason,
    historyStartYear: yearCatalog.historyStartYear ?? startYear,
    historyEndYear: yearCatalog.historyEndYear ?? endYear,
    historyStartReason: yearCatalog.historyStartReason || "",
    summary: `In ${year}, ${manifest.vector || "alternate development"} is in ${/^[aeiou]/i.test(stageRecord.label) ? "an" : "a"} ${stageRecord.label.toLowerCase()} stage, with a ${atmosphere.temperatureAnomalyC >= 0 ? "warmer" : "cooler"} atmosphere, ${ocean.seaLevelMeters >= 0 ? "higher coastlines" : "lower coastlines"}, ${Math.round(vegetation.vitalityIndex * 100)}% vegetation vitality, and ${Math.round(settlement.intensityIndex * 100)}% settlement intensity relative to the branch baseline.`,
    systems: { atmosphere, ocean, landUse, vegetation, ice, settlement },
    render
  };
  yearState.tiles = {
    surface: encodeSvgDataUri(buildClientYearTileSvg(manifest, yearState, "surface")),
    climate: encodeSvgDataUri(buildClientYearTileSvg(manifest, yearState, "climate")),
    settlement: encodeSvgDataUri(buildClientYearTileSvg(manifest, yearState, "settlement"))
  };
  return yearState;
}

function syncCurrentYear(manifest, yearCatalog) {
  const startYear = yearCatalog?.interactiveStartYear ?? yearCatalog?.firstSettlementYear ?? yearCatalog?.startYear ?? manifest?.eras?.[0]?.year ?? 0;
  const endYear = yearCatalog?.endYear ?? manifest?.eras?.[manifest.eras.length - 1]?.year ?? startYear;
  const desired = state.hasExplicitYear
    ? (state.currentYear ?? startYear)
    : (manifest?.eras?.[state.eraIndex]?.year ?? yearCatalog?.authoredStartYear ?? yearCatalog?.firstSettlementYear ?? startYear);
  state.currentYear = clamp(desired, startYear, endYear);
}

function clearMarkers() {
  if (!viewerState.viewer) return;
  viewerState.markers.forEach((entity) => viewerState.viewer.entities.remove(entity));
  viewerState.markers = [];
}

function updateSelectedRegion(name, detail) {
  elements.hotspotTitle.textContent = name || "Choose a hotspot";
  elements.hotspotCopy.textContent = detail || "Region-level changes appear here.";
}

function clearLocalDetailEntities() {
  if (!viewerState.viewer) return;
  viewerState.localDetailEntities.forEach((entity) => viewerState.viewer.entities.remove(entity));
  viewerState.localDetailEntities = [];
}

function getActiveHotspot(manifest) {
  return manifest?.hotspots?.[state.selectedHotspotIndex] || manifest?.hotspots?.[0] || null;
}

function getActiveStageInfo() {
  return {
    id: state.activeYearState?.civilizationStage || "agrarian",
    label: state.activeYearState?.civilizationStageLabel || "Agrarian",
    builtEnvironmentLevel: state.activeYearState?.builtEnvironmentLevel ?? 3,
    detailMode: state.activeYearState?.detailMode || "settlement",
    allowStreetMode: state.activeYearState?.allowStreetMode ?? false,
    branchOverrideReason: state.activeYearState?.branchOverrideReason || ""
  };
}

function getActiveLocalScene() {
  const hotspotScenes = state.activeLocalScenes?.hotspots?.[state.selectedHotspotIndex];
  const activeStage = state.activeYearState?.civilizationStage;
  if (activeStage && hotspotScenes?.stageScenes?.length) {
    return hotspotScenes.stageScenes.find((scene) => scene.stageId === activeStage && (!scene.yearRange || (state.currentYear >= scene.yearRange.start && state.currentYear <= scene.yearRange.end)))
      || hotspotScenes.stageScenes.find((scene) => scene.stageId === activeStage)
        || hotspotScenes.stageScenes.find((scene) => scene.stageId === "agrarian")
        || hotspotScenes.stageScenes[0]
        || null;
  }
  const sceneEraIndex = state.activeYearState?.eraIndex ?? state.eraIndex;
  return hotspotScenes?.eraScenes?.[sceneEraIndex] || hotspotScenes?.eraScenes?.[state.eraIndex] || null;
}

function getSceneModeLabel(localScene) {
  const mode = localScene?.detailMode || getActiveStageInfo().detailMode;
  if (mode === "wilderness") return "Wilderness";
  if (mode === "camp") return "Camp";
  if (mode === "settlement") return "Settlement";
  return "Street";
}

function updateStreetViewButton() {
  const localScene = getActiveLocalScene();
  const modeLabel = getSceneModeLabel(localScene);
  elements.streetViewButton.textContent = `Zoom To ${modeLabel} Detail`;
  elements.streetViewButton.disabled = !state.activeManifest || !localScene;
}

function zoomByFactor(direction) {
  if (!viewerState.viewer) return;
  const cameraHeight = viewerState.viewer.camera.positionCartographic?.height || 1000;
  const amount = direction === "in" ? Math.max(cameraHeight * 0.45, 60) : Math.max(cameraHeight * 0.7, 120);
  if (direction === "in") {
    viewerState.viewer.camera.zoomIn(amount);
  } else {
    viewerState.viewer.camera.zoomOut(amount);
  }
}

function getActiveZoomTier(localScene) {
  const scene = localScene || getActiveLocalScene();
  if (!scene) {
    return null;
  }

  const zoomTiers = scene.zoomTiers || [];
  if (!zoomTiers.length || !viewerState.viewer) {
    return null;
  }

  const cameraHeight = viewerState.viewer.camera.positionCartographic?.height || Number.POSITIVE_INFINITY;
  for (let index = zoomTiers.length - 1; index >= 0; index -= 1) {
    if (cameraHeight <= zoomTiers[index].maxCameraHeight) {
      return zoomTiers[index];
    }
  }
  return zoomTiers[0];
}

function getTierIndex(localScene, tierId) {
  return (localScene?.zoomTiers || []).findIndex((tier) => tier.id === tierId);
}

function getVisibleTierSet(localScene) {
  const tiers = localScene?.zoomTiers || [];
  if (!tiers.length) {
    return [];
  }
  const activeTier = getActiveZoomTier(localScene) || tiers[0];
  const activeIndex = Math.max(0, getTierIndex(localScene, activeTier.id));
  return tiers.slice(0, activeIndex + 1);
}

function applyOsmBuildingStyle(manifest) {
  if (!viewerState.osmBuildingsTileset || !manifest) {
    return;
  }

  const stageInfo = getActiveStageInfo();
  viewerState.osmBuildingsTileset.show = state.baseMode !== "photoreal" && stageInfo.builtEnvironmentLevel >= 4;
  if (!viewerState.osmBuildingsTileset.show) {
    return;
  }

  const vector = manifest.vector || "";
  const eraVisual = getEraVisualState(manifest);
  const colorMap = {
    "knowledge acceleration": "color('#9fd8ff', 0.72)",
    "distributed energy": "color('#9ff6d2', 0.7)",
    "maritime urbanism": "color('#8cd8ff', 0.72)",
    "preparedness culture": "color('#ffd59b', 0.75)",
    "civic computation": "color('#b3c3ff', 0.72)"
  };
  const facadeColor = eraVisual?.local?.facade;

  viewerState.osmBuildingsTileset.style = new Cesium.Cesium3DTileStyle({
    color: facadeColor ? `color('${facadeColor}', 0.78)` : (colorMap[vector] || "color('#d7e7ff', 0.68)")
  });
}

function addMarkers(manifest) {
  if (!viewerState.viewer || !manifest) return;
  clearMarkers();
  (manifest.hotspots || []).forEach((hotspot, hotspotIndex) => {
    const entity = viewerState.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(hotspot.lng, hotspot.lat),
      point: {
        pixelSize: hotspotIndex === state.selectedHotspotIndex ? 13 : 10,
        color: Cesium.Color.fromCssColorString("#7cf7c6"),
        outlineColor: Cesium.Color.fromCssColorString("#04111b"),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: hotspot.name,
        font: "12px Segoe UI",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: {
        ...hotspot,
        hotspotIndex
      }
    });
    viewerState.markers.push(entity);
  });
}

function getEraRecord(manifest) {
  const yearEraIndex = state.activeYearState?.eraIndex;
  return manifest?.eras?.[yearEraIndex ?? state.eraIndex] || manifest?.eras?.[0] || null;
}

function getEraVisualState(manifest) {
  return state.activeYearState?.render || manifest?.visualProfile?.eraStates?.[state.eraIndex] || manifest?.visualProfile?.eraStates?.[0] || null;
}

function flyToManifestEra(manifest) {
  if (!viewerState.viewer || !manifest) return;
  state.streetMode = false;
  state.currentZoomTierId = "district";
  const era = getEraRecord(manifest);
  const hotspot = getActiveHotspot(manifest) || manifest.hotspots?.[Math.min(state.eraIndex, Math.max((manifest.hotspots?.length || 1) - 1, 0))];
  if (!era || !hotspot) {
    showGlobalView(1.6);
    return;
  }

  const center = Cesium.Cartesian3.fromDegrees(hotspot.lng, hotspot.lat, 0);
  const sphere = new Cesium.BoundingSphere(center, Math.max((era.altitude || 5000000) * 0.42, 900000));
  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(12 + state.eraIndex * 16),
    Cesium.Math.toRadians(-30 - state.eraIndex * 2),
    era.altitude || 5000000
  );

  viewerState.viewer.camera.cancelFlight();
  viewerState.viewer.camera.flyToBoundingSphere(sphere, {
    offset,
    duration: viewerState.booted ? 2.6 : 1.6,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  });
}

function flyToStreetScene(manifest) {
  if (!viewerState.viewer || !manifest) return;
  const hotspot = getActiveHotspot(manifest);
  const scene = getActiveLocalScene();
  if (!hotspot || !scene) {
    flyToManifestEra(manifest);
    return;
  }

  state.streetMode = true;
  const focusLng = scene.focus?.lng ?? hotspot.lng;
  const focusLat = scene.focus?.lat ?? hotspot.lat;
  const center = Cesium.Cartesian3.fromDegrees(focusLng, focusLat, 0);
  const desiredRange = Math.max(scene.focusRangeMeters || 120, 26);
  const sphere = new Cesium.BoundingSphere(center, Math.max(desiredRange * 0.08, 10));
  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(scene.headingDegrees),
    Cesium.Math.toRadians(-scene.pitchDegrees),
    desiredRange
  );

  viewerState.viewer.camera.cancelFlight();
  viewerState.viewer.camera.flyToBoundingSphere(sphere, {
    offset,
    duration: 2.1,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  });
  renderLocalDetailScene(manifest);
  updateStreetModeCaption(manifest);
}

function clearDatasetLayers() {
  if (!viewerState.viewer) return;
  for (const layer of viewerState.layerProviders.values()) {
    viewerState.viewer.imageryLayers.remove(layer, false);
  }
  viewerState.layerProviders.clear();
}

function createImageryProvider(layerMeta) {
  if (!layerMeta?.template) return null;
  if (layerMeta.provider === "single" || layerMeta.template.startsWith("data:")) {
    return new Cesium.SingleTileImageryProvider({
      url: layerMeta.template,
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
    });
  }
  return new Cesium.UrlTemplateImageryProvider({
    url: layerMeta.template,
    tilingScheme: new Cesium.GeographicTilingScheme(),
    maximumLevel: layerMeta.maximumLevel ?? 0,
    minimumLevel: layerMeta.minimumLevel ?? 0,
    rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
  });
}

function resolveUrl(baseUrl, relativeUrl) {
  return new URL(relativeUrl, baseUrl).toString();
}

function createBranchTerrainProvider(manifest) {
  const layerUrl = manifest?.processing?.products?.terrainQuantizedMeshLayer;
  if (!layerUrl) {
    return null;
  }

  const absoluteLayerUrl = resolveUrl(window.location.href, layerUrl);
  return new Cesium.CustomHeightmapTerrainProvider({
    width: 32,
    height: 32,
    tilingScheme: new Cesium.GeographicTilingScheme(),
    callback: async (x, y, level) => {
      const layerResponse = await fetch(absoluteLayerUrl, { cache: "no-store" });
      if (!layerResponse.ok) {
        return new Float32Array(32 * 32);
      }

      const layer = await layerResponse.json();
      const maxZoom = layer.maxzoom ?? 0;
      const template = layer.tiles?.[0] || "./{z}/{x}/{y}.terrain";
      const requestLevel = Math.min(level, maxZoom);
      const scale = 2 ** (level - requestLevel);
      const requestX = Math.floor(x / scale);
      const requestY = Math.floor(y / scale);
      const tileUrl = resolveUrl(absoluteLayerUrl, template.replace("{z}", String(requestLevel)).replace("{x}", String(requestX)).replace("{y}", String(requestY)));
      const tileResponse = await fetch(tileUrl, { cache: "no-store" });
      if (!tileResponse.ok) {
        return new Float32Array(32 * 32);
      }

      const tile = await tileResponse.json();
      const minHeight = tile.minHeight ?? 0;
      const maxHeight = tile.maxHeight ?? 0;
      const quantized = tile.quantizedHeights || [];
      const values = new Float32Array(32 * 32);

      for (let row = 0; row < 32; row += 1) {
        for (let col = 0; col < 32; col += 1) {
          const q = quantized[row]?.[col] ?? 0;
          values[(row * 32) + col] = minHeight + ((maxHeight - minHeight) * (q / 32767));
        }
      }

      return values;
    }
  });
}

async function updateTerrainProviderForManifest(manifest) {
  if (!viewerState.viewer) return;
  viewerState.branchTerrainReady = false;

  const branchLayer = manifest?.processing?.products?.terrainQuantizedMeshLayer;
  if (branchLayer && state.baseMode === "terrain") {
    try {
      viewerState.branchTerrainProvider = createBranchTerrainProvider(manifest);
      viewerState.viewer.terrainProvider = viewerState.branchTerrainProvider;
      viewerState.branchTerrainReady = true;
      viewerState.terrainStatus = "Branch quantized mesh";
      return;
    } catch {
      viewerState.branchTerrainReady = false;
    }
  }

  if (viewerState.worldTerrainProvider) {
    viewerState.viewer.terrainProvider = viewerState.worldTerrainProvider;
    viewerState.terrainStatus = "Cesium World Terrain";
  } else {
    viewerState.viewer.terrainProvider = viewerState.ellipsoidTerrainProvider;
    viewerState.terrainStatus = "Ellipsoid fallback";
  }
}

function attachLayer(id, layerMeta, alpha = 1) {
  if (!viewerState.viewer || !layerMeta) return;
  const provider = createImageryProvider(layerMeta);
  if (!provider) return;
  const imageryLayer = viewerState.viewer.imageryLayers.addImageryProvider(provider);
  imageryLayer.alpha = alpha;
  const style = getEraVisualState(state.activeManifest)?.globe?.layerStyles?.[id];
  if (style) {
    imageryLayer.brightness = style.brightness ?? 1;
    imageryLayer.contrast = style.contrast ?? 1;
    imageryLayer.saturation = style.saturation ?? 1;
    imageryLayer.gamma = style.gamma ?? 1;
    imageryLayer.hue = style.hue ?? 0;
  }
  viewerState.layerProviders.set(id, imageryLayer);
}

function applyManifestLayers(manifest) {
  if (!viewerState.viewer || !manifest) return;
  clearDatasetLayers();
  const layers = manifest.layers || {};
  const layerStyles = getEraVisualState(manifest)?.globe?.layerStyles || {};
  const yearTiles = state.activeYearState?.tiles || {};
  const historyTemplates = manifest?.processing?.products?.yearlyTileTemplates || {};
  const resolveLayerMeta = (id, baseMeta) => {
    const activeTile = yearTiles[id];
    const template = activeTile || (historyTemplates[id] && state.currentYear ? resolveYearPath(historyTemplates[id], state.currentYear) : null);
    return template
      ? {
          ...baseMeta,
          template,
          minimumLevel: 0,
          maximumLevel: 0,
          provider: template.startsWith("data:") ? "single" : baseMeta?.provider
        }
      : baseMeta;
  };
  if (layers.surface) {
    attachLayer("surface", resolveLayerMeta("surface", layers.surface), state.layerVisibility.surface ? (layerStyles.surface?.alpha ?? 1) : 0);
  }
  if (layers.elevation) {
    attachLayer("elevation", layers.elevation, state.layerVisibility.elevation ? (layerStyles.elevation?.alpha ?? 0.72) : 0);
  }
  if (layers.climate) {
    attachLayer("climate", resolveLayerMeta("climate", layers.climate), state.layerVisibility.climate ? (layerStyles.climate?.alpha ?? 0.66) : 0);
  }
  if (layers.biomes) {
    attachLayer("biomes", layers.biomes, state.layerVisibility.biomes ? (layerStyles.biomes?.alpha ?? 0.68) : 0);
  }
  if (layers.hydrology) {
    attachLayer("hydrology", layers.hydrology, state.layerVisibility.hydrology ? (layerStyles.hydrology?.alpha ?? 0.7) : 0);
  }
  if (layers.settlement) {
    attachLayer("settlement", resolveLayerMeta("settlement", layers.settlement), state.layerVisibility.settlement ? (layerStyles.settlement?.alpha ?? 0.72) : 0);
  }
}

function updateLayerVisibility() {
  for (const [id, imageryLayer] of viewerState.layerProviders.entries()) {
    const visible = state.layerVisibility[id];
    if (state.baseMode === "photoreal") {
      imageryLayer.alpha = 0;
      continue;
    }
    const style = getEraVisualState(state.activeManifest)?.globe?.layerStyles?.[id];
    imageryLayer.alpha = visible ? (style?.alpha ?? (id === "surface" ? 1 : 0.68)) : 0;
  }
}

function applyManifestPhysics(manifest) {
  if (!viewerState.viewer || !manifest?.physicalModel) return;
  const model = manifest.physicalModel;
  const eraVisual = getEraVisualState(manifest);
  if ("verticalExaggeration" in viewerState.viewer.scene) {
    viewerState.viewer.scene.verticalExaggeration = model.verticalExaggeration || 1;
  }
  if ("verticalExaggerationRelativeHeight" in viewerState.viewer.scene) {
    viewerState.viewer.scene.verticalExaggerationRelativeHeight = model.verticalReferenceHeight || 0;
  }
  viewerState.viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(eraVisual?.globe?.baseColor || model.baseColor || "#0a1830");
  if (viewerState.viewer.scene.skyAtmosphere) {
    viewerState.viewer.scene.skyAtmosphere.hueShift = eraVisual?.globe?.hueShift || 0;
    viewerState.viewer.scene.skyAtmosphere.saturationShift = eraVisual?.globe?.saturationShift || 0;
    viewerState.viewer.scene.skyAtmosphere.brightnessShift = eraVisual?.globe?.brightnessShift || 0;
  }
  if (viewerState.viewer.scene.fog) {
    viewerState.viewer.scene.fog.enabled = true;
    viewerState.viewer.scene.fog.density = eraVisual?.globe?.fogDensity || 0.00012;
    viewerState.viewer.scene.fog.minimumBrightness = 0.05;
  }
}

function renderLocalDetailScene(manifest) {
  clearLocalDetailEntities();
  const localScene = getActiveLocalScene();
  if (!viewerState.viewer || !localScene) {
    return;
  }

  const visibleTiers = getVisibleTierSet(localScene);
  const activeTier = visibleTiers[visibleTiers.length - 1] || localScene.zoomTiers?.[0] || null;
  state.currentZoomTierId = activeTier?.id || "district";

  const runtimeTheme = {
    ...(localScene.theme || {}),
    ...(state.activeYearState?.render?.local || {})
  };
  const stageLevel = state.activeYearState?.builtEnvironmentLevel ?? localScene.builtEnvironmentLevel ?? 3;
  const accentColor = Cesium.Color.fromCssColorString(runtimeTheme.accent || "#8fd7ff");
  const roadColor = Cesium.Color.fromCssColorString(runtimeTheme.road || runtimeTheme.accent || "#8dc6ff");
  const hubColor = Cesium.Color.fromCssColorString(runtimeTheme.hub || "#f7e9a6");
  const facadeColor = Cesium.Color.fromCssColorString(runtimeTheme.facade || runtimeTheme.accent || "#9cc8ec");
  const roofColor = Cesium.Color.fromCssColorString(runtimeTheme.roof || runtimeTheme.hub || "#dceffb");
  const parcelColor = Cesium.Color.fromCssColorString(runtimeTheme.parcel || runtimeTheme.accent || "#3e5d86");
  const plazaColor = Cesium.Color.fromCssColorString(runtimeTheme.plaza || runtimeTheme.hub || "#e1e9ea");
  const waterColor = Cesium.Color.fromCssColorString(runtimeTheme.water || "#67bfff");
  const greeneryColor = Cesium.Color.fromCssColorString(runtimeTheme.greenery || "#74c98a");
  const transitColor = Cesium.Color.fromCssColorString(runtimeTheme.transit || runtimeTheme.accent || "#98eef9");
  const landmarkColor = Cesium.Color.fromCssColorString(runtimeTheme.landmark || runtimeTheme.hub || "#fef1b4");
  const streetVisuals = state.streetMode && localScene.allowStreetMode !== false;
  const roadWidthScale = (streetVisuals ? 1.35 : 0.9) + (stageLevel * 0.12);
  const buildingAlpha = streetVisuals ? (runtimeTheme.buildingAlpha || 0.72) : Math.max((runtimeTheme.buildingAlpha || 0.62) - 0.16, 0.32);
  const outlineAlpha = streetVisuals ? 0.7 : 0.42;
  const yearValue = state.activeYearState?.year ?? state.currentYear ?? 0;
  const earlySettlement = stageLevel <= 2;
  const agrarianSettlement = stageLevel === 3;
  const preIndustrial = yearValue < 1760;
  const allRoads = visibleTiers
    .flatMap((tier) => tier.roads || [])
    .filter((road) => !earlySettlement || (road.kind !== "avenue" && road.kind !== "spine"))
    .filter((road) => !preIndustrial || (road.kind !== "avenue" && road.kind !== "spine" && road.kind !== "connector"));
  const allBuildings = visibleTiers.flatMap((tier) => tier.buildings || []).filter((_, index) => {
    if (earlySettlement) return index < 8;
    if (agrarianSettlement) return index < 18 && index % 3 !== 1;
    if (yearValue < 1900) return index % 3 !== 1;
    return true;
  });
  const allHubs = visibleTiers.flatMap((tier) => tier.hubs || []);
  const allLandmarks = stageLevel >= 4 && yearValue >= 1760 ? visibleTiers.flatMap((tier) => tier.landmarks || []) : [];
  const allPlazas = visibleTiers.flatMap((tier) => tier.plazas || []);
  const allParcels = yearValue >= 1200 ? visibleTiers.flatMap((tier) => tier.parcels || []) : [];
  const allWater = visibleTiers.flatMap((tier) => tier.water || []);
  const allTransit = stageLevel >= 4 && yearValue >= 1880 ? visibleTiers.flatMap((tier) => tier.transit || []) : [];
  const allGreenways = visibleTiers.flatMap((tier) => tier.greenways || []);

  allGreenways.forEach((greenway) => {
    const positions = greenway.points.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0));
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        corridor: {
          positions,
          width: greenway.width,
          height: 1,
            material: greeneryColor.withAlpha(streetVisuals ? 0.34 : 0.22)
        }
      })
    );
  });

  allWater.forEach((feature) => {
    const positions = feature.points.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0));
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        corridor: {
          positions,
          width: feature.width,
          height: 0,
            material: waterColor.withAlpha(streetVisuals ? 0.5 : 0.34)
        }
      })
    );
  });

  allTransit.forEach((loop) => {
    const positions = loop.points.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 10));
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        polyline: {
          positions,
          width: loop.width,
          clampToGround: false,
          material: new Cesium.PolylineDashMaterialProperty({
            color: transitColor.withAlpha(0.92),
            dashLength: 18
          })
        }
      })
    );
  });

  allRoads.forEach((segment) => {
    const positions = segment.points.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0));
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        polyline: {
          positions,
          width: segment.width * roadWidthScale,
          clampToGround: true,
          material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: segment.kind === "avenue" || segment.kind === "spine" ? (streetVisuals ? 0.28 : 0.22) : (streetVisuals ? 0.18 : 0.12),
              color: roadColor.withAlpha(segment.kind === "street" ? (streetVisuals ? 0.72 : 0.5) : 0.86)
          })
        }
      })
    );
  });

  allPlazas.forEach((plaza) => {
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        polygon: {
          hierarchy: plaza.polygon.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0)),
            material: plazaColor.withAlpha(streetVisuals ? 0.22 : 0.14),
          perPositionHeight: false
        }
      })
    );
  });

  allParcels.forEach((parcel) => {
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        polygon: {
          hierarchy: parcel.polygon.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0)),
            material: parcelColor.withAlpha(parcel.tone * (streetVisuals ? 0.24 : 0.13)),
            outline: true,
            outlineColor: parcelColor.withAlpha(streetVisuals ? 0.2 : 0.1),
          perPositionHeight: false
        }
      })
    );
  });

  allHubs.forEach((hub) => {
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(hub.center[0], hub.center[1], 0),
        ellipse: {
          semiMinorAxis: hub.radius,
          semiMajorAxis: hub.radius * 1.15,
          height: 6,
            material: hubColor.withAlpha(streetVisuals ? 0.45 : 0.32),
            outline: true,
            outlineColor: hubColor.withAlpha(streetVisuals ? 0.95 : 0.85)
        }
      })
    );
  });

  allBuildings.forEach((building, index) => {
    const height = agrarianSettlement ? Math.min(building.height, 18) : (yearValue < 1760 ? Math.min(building.height, 28) : building.height);
    const tintSeed = hashString(`${manifest.seed}:${state.activeYearState?.civilizationStage || state.eraIndex}:${index}`);
    const tintMix = 0.2 + ((tintSeed % 5) * 0.12);
    const buildingTone = index % 3 === 0 ? roofColor : facadeColor.brighten(tintMix * 0.3, new Cesium.Color());
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(building.center[0], building.center[1], height / 2),
        box: {
          dimensions: new Cesium.Cartesian3(building.width, building.depth, height),
          material: buildingTone.withAlpha(buildingAlpha),
          outline: true,
          outlineColor: roofColor.withAlpha(outlineAlpha)
        }
      })
    );
  });

  allLandmarks.forEach((landmark, index) => {
    const tintSeed = hashString(`${manifest.seed}:landmark:${state.activeYearState?.civilizationStage || state.eraIndex}:${index}`);
    const tintMix = 0.28 + ((tintSeed % 4) * 0.1);
    viewerState.localDetailEntities.push(
      viewerState.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(landmark.center[0], landmark.center[1], landmark.height / 2),
        cylinder: {
          length: landmark.height,
          topRadius: Math.max(landmark.radius * 0.18, 8),
          bottomRadius: landmark.radius,
            material: landmarkColor.brighten(tintMix, new Cesium.Color()).withAlpha(streetVisuals ? 0.88 : 0.66)
        }
      })
    );
  });
}

function updateStreetModeCaption(manifest) {
  const hotspot = getActiveHotspot(manifest);
  const localScene = getActiveLocalScene();
  if (!hotspot || !localScene) {
    return;
  }

  const tier = (localScene.zoomTiers || []).find((entry) => entry.id === state.currentZoomTierId) || localScene.zoomTiers?.[0];
  const tierLabel = tier?.label || getSceneModeLabel(localScene);
  const stageInfo = getActiveStageInfo();
  elements.modeTitle.textContent = `${tierLabel} Detail - ${hotspot.name}`;
  elements.modeCopy.textContent = `${localScene.description} Active stage: ${stageInfo.label.toLowerCase()}. Active zoom tier: ${tierLabel.toLowerCase()}. ${stageInfo.branchOverrideReason || ""} ${describeProcessing(manifest)} Keep zooming to reveal more synthetic detail.`;
}

function describeProcessing(manifest) {
  if (!manifest?.processing) {
    return "Prepared branch dataset loaded.";
  }
  return `${manifest.processing.datasetClass} loaded with terrain, climate, hydrology, biome, settlement, and yearly planet-state products. Terrain source: ${viewerState.terrainStatus}.`;
}

function renderBaseModeControls() {
  elements.baseModeControls.innerHTML = "";
  baseModes.forEach((mode) => {
    const enabled = mode.id !== "photoreal" || viewerState.supportsPhotorealistic;
    const wrapper = document.createElement("div");
    wrapper.className = `layer-chip ${state.baseMode === mode.id ? "active" : ""}`;
    wrapper.innerHTML = `
      <button type="button" ${enabled ? "" : "disabled"} title="${mode.description}">
        <span>${mode.label}</span>
      </button>
    `;
    const button = wrapper.querySelector("button");
    if (!enabled) {
      button.textContent = `${mode.label} (Unavailable)`;
      button.style.opacity = "0.5";
      button.style.cursor = "not-allowed";
    } else {
      button.addEventListener("click", async () => {
        state.baseMode = mode.id;
        await applyBaseMode();
        renderBaseModeControls();
      });
    }
    elements.baseModeControls.appendChild(wrapper);
  });
}

async function applyBaseMode() {
  if (!viewerState.viewer) return;
  const inPhotoreal = state.baseMode === "photoreal" && viewerState.supportsPhotorealistic && viewerState.photorealisticTileset;

  if (viewerState.photorealisticTileset) {
    viewerState.photorealisticTileset.show = inPhotoreal;
  }

  viewerState.viewer.scene.globe.show = !inPhotoreal;
  if (viewerState.osmBuildingsTileset) {
    viewerState.osmBuildingsTileset.show = !inPhotoreal;
  }
  if (!inPhotoreal) {
    await updateTerrainProviderForManifest(state.activeManifest);
  } else if (viewerState.worldTerrainProvider) {
    viewerState.viewer.terrainProvider = viewerState.worldTerrainProvider;
    viewerState.terrainStatus = "Photogrammetry base";
  }
  updateLayerVisibility();

  if (inPhotoreal) {
    elements.engineNote.textContent = "Photorealistic Earth replacement is active. Branch metadata, search, and camera travel stay live while physical overlay layers are hidden.";
    elements.datasetStatus.textContent = "Photogrammetry active";
  } else if (viewerState.branchTerrainReady) {
    elements.engineNote.textContent = "Branch quantized-mesh terrain is active under the dataset layers, with world terrain ready as fallback.";
    elements.datasetStatus.textContent = "Branch terrain active";
  } else if (viewerState.supportsTerrainMesh) {
    elements.engineNote.textContent = "Cesium World Terrain is active under the branch dataset layers, with photogrammetry available as an alternate base globe mode.";
    elements.datasetStatus.textContent = "World terrain fallback";
  } else {
    elements.engineNote.textContent = "Fallback Earth imagery is active under the precomputed alternate-world dataset layers.";
    elements.datasetStatus.textContent = "Ellipsoid fallback";
  }
}

function renderLayerControls(manifest) {
  elements.layerControls.innerHTML = "";
  if (!manifest?.layers) {
    return;
  }

  const order = ["surface", "elevation", "climate", "biomes", "hydrology", "settlement"];
  order.forEach((id) => {
    if (!manifest.layers[id]) return;
    const label = document.createElement("label");
    label.className = "layer-chip";
    const checked = state.layerVisibility[id] ? "checked" : "";
    label.innerHTML = `<input type="checkbox" data-layer="${id}" ${checked} /><span>${manifest.layers[id].label}</span>`;
    label.querySelector("input").addEventListener("change", (event) => {
      state.layerVisibility[id] = event.target.checked;
      updateLayerVisibility();
    });
    elements.layerControls.appendChild(label);
  });
}

function renderTimeline(manifest) {
  elements.timelineStops.innerHTML = "";
  const yearCatalog = state.activeYearCatalog;
  const startYear = yearCatalog?.interactiveStartYear ?? yearCatalog?.firstSettlementYear ?? yearCatalog?.startYear ?? manifest?.eras?.[0]?.year ?? 0;
  const endYear = yearCatalog?.endYear ?? manifest?.eras?.[manifest.eras.length - 1]?.year ?? startYear;
  elements.eraSlider.min = String(startYear);
  elements.eraSlider.max = String(endYear);
  elements.eraSlider.step = "1";
  elements.eraSlider.value = String(state.currentYear ?? startYear);
  elements.timelineHeading.textContent = yearCatalog?.firstSettlementReason
    ? `${manifest.vector || "branch cascade"} - interactive timeline from ${startYear}`
    : (manifest.vector || "branch cascade");

  (manifest?.eras || []).forEach((era, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const active = (state.currentYear ?? era.year) === era.year || index === (state.activeYearState?.eraIndex ?? state.eraIndex);
    button.className = `timeline-stop ${active ? "active" : ""}`;
    button.innerHTML = `<span>${era.year}</span><strong>${era.title}</strong>`;
    button.addEventListener("click", async () => {
      state.eraIndex = index;
      state.currentYear = era.year;
      await render();
    });
    elements.timelineStops.appendChild(button);
  });
}

function renderSearchResults(results, query = "") {
  elements.searchResults.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("article");
    empty.className = "result-card empty-result";
    empty.innerHTML = `<strong>No starter-catalog matches</strong><p>No starter universes matched "${query}". Try a seed number to synthesize a new branch on demand.</p>`;
    elements.searchResults.appendChild(empty);
    return;
  }

    results.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <span class="result-meta">Seed #${entry.seed} • ${entry.matchReason}</span>
      <strong>${entry.title}</strong>
      <p>${entry.searchSnippet}</p>
      <div class="result-actions">
        <button class="ghost-button open-result-button" type="button">Open Universe</button>
      </div>
    `;
      card.querySelector(".open-result-button").addEventListener("click", async () => {
        state.seed = entry.seed;
        state.eraIndex = 0;
        state.currentYear = null;
        state.hasExplicitYear = false;
        await render();
      });
    elements.searchResults.appendChild(card);
  });
}

function searchCatalog(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    elements.searchStatus.textContent = "Idle";
    renderSearchResults([]);
    return;
  }

  const numericSeed = Number.parseInt(normalized, 10);
  const starterMatches = state.catalog.filter((entry) => (entry.searchText || "").includes(normalized)).slice(0, 24);
  const runtimeMatches = [];
  if (!Number.isNaN(numericSeed) && numericSeed > 0 && !state.catalogMap.has(String(numericSeed))) {
    runtimeMatches.push(buildRuntimeCatalogEntry(numericSeed));
  }
  const results = [...runtimeMatches, ...starterMatches].slice(0, 24);
  elements.searchStatus.textContent = results.length ? `${results.length} found` : "No matches";
  renderSearchResults(results, normalized);
}

async function configureViewerBase() {
  const token = getStoredToken();
  if (!viewerState.viewer) return;

  if (token) {
    Cesium.Ion.defaultAccessToken = token;
    try {
      const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(ION_SATELLITE_ASSET_ID);
      viewerState.viewer.imageryLayers.removeAll();
      viewerState.viewer.imageryLayers.addImageryProvider(imageryProvider);
      viewerState.worldTerrainProvider = await Cesium.createWorldTerrainAsync({
        requestVertexNormals: true,
        requestWaterMask: true
      });
      viewerState.viewer.terrainProvider = viewerState.worldTerrainProvider;
      viewerState.supportsTerrainMesh = true;
      if (typeof Cesium.createGooglePhotorealistic3DTileset === "function") {
        try {
          viewerState.photorealisticTileset = await Cesium.createGooglePhotorealistic3DTileset();
          viewerState.photorealisticTileset.show = false;
          viewerState.viewer.scene.primitives.add(viewerState.photorealisticTileset);
          viewerState.supportsPhotorealistic = true;
        } catch {
          viewerState.supportsPhotorealistic = false;
        }
      }
      if (typeof Cesium.createOsmBuildingsAsync === "function") {
        try {
          viewerState.osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();
          viewerState.osmBuildingsTileset.show = state.baseMode === "terrain";
          viewerState.viewer.scene.primitives.add(viewerState.osmBuildingsTileset);
        } catch {
          viewerState.osmBuildingsTileset = null;
        }
      }
      await applyBaseMode();
      return;
    } catch {
      elements.engineNote.textContent = "High-resolution baseline unavailable. Using fallback Earth imagery.";
    }
  }

  viewerState.viewer.imageryLayers.removeAll();
  viewerState.viewer.imageryLayers.addImageryProvider(
    new Cesium.ArcGisMapServerImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
    })
  );
  viewerState.viewer.terrainProvider = viewerState.ellipsoidTerrainProvider;
  viewerState.supportsTerrainMesh = false;
  viewerState.supportsPhotorealistic = false;
  await applyBaseMode();
}

async function initializeViewer() {
  const token = getStoredToken();
  if (token) {
    Cesium.Ion.defaultAccessToken = token;
  }

  viewerState.viewer = new Cesium.Viewer("cesium-container", {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    shouldAnimate: true,
    imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
    }),
    terrainProvider: new Cesium.EllipsoidTerrainProvider()
  });
  viewerState.ellipsoidTerrainProvider = viewerState.viewer.terrainProvider;

  viewerState.viewer.scene.globe.enableLighting = true;
  viewerState.viewer.scene.skyAtmosphere.show = true;
  viewerState.viewer.scene.globe.showGroundAtmosphere = true;
  viewerState.viewer.scene.globe.depthTestAgainstTerrain = true;
  viewerState.viewer.scene.globe.maximumScreenSpaceError = 0.35;
  viewerState.viewer.scene.globe.tileCacheSize = 1600;
  viewerState.viewer.scene.globe.preloadAncestors = true;
  viewerState.viewer.scene.globe.preloadSiblings = true;
  viewerState.viewer.scene.highDynamicRange = true;
  viewerState.viewer.scene.fog.enabled = true;
  viewerState.viewer.scene.fog.density = 0.000026;
  viewerState.viewer.scene.fog.minimumBrightness = 0.2;
  viewerState.viewer.scene.postProcessStages.fxaa.enabled = true;
  viewerState.viewer.resolutionScale = Math.min(Math.max(window.devicePixelRatio || 1, 1.25), 2.4);
  viewerState.viewer.clock.multiplier = 90;
  viewerState.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const controller = viewerState.viewer.scene.screenSpaceCameraController;
  controller.enableCollisionDetection = true;
  controller.minimumZoomDistance = 120;
  controller.maximumZoomDistance = 36000000;
  controller.maximumTiltAngle = Cesium.Math.PI_OVER_TWO - Cesium.Math.toRadians(1.5);
  viewerState.viewer.scene.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;

  const handler = new Cesium.ScreenSpaceEventHandler(viewerState.viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const picked = viewerState.viewer.scene.pick(movement.position);
    if (Cesium.defined(picked) && picked.id && picked.id.properties) {
      state.selectedHotspotIndex = picked.id.properties.hotspotIndex?.getValue?.() ?? 0;
      const selectedScene = getActiveLocalScene();
      updateSelectedRegion(
        picked.id.properties.name.getValue(),
        selectedScene?.description || picked.id.properties.detail.getValue()
      );
      state.streetMode = true;
      renderLocalDetailScene(state.activeManifest);
      updateStreetViewButton();
      addMarkers(state.activeManifest);
      flyToStreetScene(state.activeManifest);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  viewerState.viewer.camera.changed.addEventListener(() => {
    if (!state.streetMode || !state.activeManifest || viewerState.localDetailUpdateQueued) {
      return;
    }

    viewerState.localDetailUpdateQueued = true;
    window.requestAnimationFrame(() => {
      viewerState.localDetailUpdateQueued = false;
      const localScene = getActiveLocalScene();
      const nextTier = getActiveZoomTier(localScene);
      if (nextTier && nextTier.id !== state.currentZoomTierId) {
        renderLocalDetailScene(state.activeManifest);
        updateStreetModeCaption(state.activeManifest);
      }
    });
  });

  showGlobalView(0);
  await configureViewerBase();
  renderBaseModeControls();
}

async function render() {
  const manifest = await loadManifest(state.seed);
  state.activeManifest = manifest;

  if (!manifest) {
    elements.datasetStatus.textContent = "Manifest missing";
    showGlobalView(1.2);
    return;
  }

  state.selectedHotspotIndex = clamp(state.selectedHotspotIndex, 0, Math.max((manifest.hotspots?.length || 1) - 1, 0));
  const localScenesPath = manifest?.processing?.products?.localScenes;
  state.activeLocalScenes = manifest?.processing?.runtimeGenerated
    ? buildRuntimeLocalScenes(manifest)
    : (localScenesPath ? await loadJson(localScenesPath) : null);
  state.activeYearCatalog = manifest?.processing?.runtimeGenerated
    ? buildRuntimeYearCatalog(manifest)
    : await loadYearCatalog(manifest);
  syncCurrentYear(manifest, state.activeYearCatalog);
  state.activeYearState = await loadYearState(manifest, state.activeYearCatalog, state.currentYear);
  state.activeYearIndex = state.activeYearCatalog?.years?.findIndex((item) => item.year === state.currentYear) ?? null;
  if (state.activeYearState?.eraIndex != null) {
    state.eraIndex = state.activeYearState.eraIndex;
  }
  const era = getEraRecord(manifest);
  const activeHotspot = getActiveHotspot(manifest);
  const activeLocalScene = getActiveLocalScene();
  const activeYearState = state.activeYearState;
  const stageInfo = getActiveStageInfo();
  elements.seedDisplay.textContent = `#${manifest.seed}`;
  elements.cameraDisplay.textContent = activeYearState ? `${activeYearState.phase} • ${stageInfo.label}` : (era?.camera || "Global orbit");
  elements.eraDisplay.textContent = activeYearState ? `Year ${activeYearState.year} • ${stageInfo.label}` : eraTemplates[state.eraIndex].label;
  elements.branchTitle.textContent = `${manifest.code} - ${manifest.title}`;
  elements.branchPremise.textContent = manifest.premise;
  elements.globeHeading.textContent = era?.title || "Branch scan";
  elements.yearBadge.textContent = String(activeYearState?.year || era?.year || "0000");
  elements.modeTitle.textContent = activeYearState?.phase || era?.camera || "Global orbit";
  elements.modeCopy.textContent = `${activeYearState?.summary || era?.future || manifest.summary} ${activeYearState?.branchOverrideReason || ""} ${describeProcessing(manifest)}`;
  elements.timelineHeading.textContent = state.activeYearCatalog?.firstSettlementReason
    ? `${manifest.vector || "branch cascade"} - interactive timeline from ${state.activeYearCatalog.interactiveStartYear ?? state.activeYearCatalog.firstSettlementYear ?? state.activeYearCatalog.startYear}`
    : (manifest.vector || "branch cascade");
  elements.summaryTitle.textContent = activeYearState ? `${activeYearState.year} ${stageInfo.label.toLowerCase()} world state` : (era?.summary || manifest.summary);
  elements.summaryCopy.textContent = activeYearState
    ? `${activeYearState.summary} Atmosphere ${activeYearState.systems.atmosphere.temperatureAnomalyC}C anomaly, sea level ${activeYearState.systems.ocean.seaLevelMeters}m, vegetation vitality ${Math.round(activeYearState.systems.vegetation.vitalityIndex * 100)}%.`
    : manifest.differences;
  elements.futureTitle.textContent = activeYearState ? "Planet systems" : (era?.future || manifest.future);
  elements.futureCopy.textContent = activeYearState
    ? `Stage ${stageInfo.label.toLowerCase()}, settlement intensity ${Math.round(activeYearState.systems.settlement.intensityIndex * 100)}%, land restoration ${Math.round(activeYearState.systems.landUse.restorationShare * 100)}%, polar ice ${Math.round(activeYearState.systems.ice.polarExtentIndex * 100)}%. ${state.activeYearCatalog?.firstSettlementReason || state.activeYearCatalog?.historyStartReason || ""}`
    : manifest.future;
  elements.promptTitle.textContent = "Dataset lineage";
  elements.promptCopy.textContent = manifest.prompt;
  elements.seedInput.value = String(manifest.seed);
  elements.eraSlider.value = String(state.currentYear ?? era?.year ?? 0);
  elements.datasetStatus.textContent = manifest.processing ? "Processed dataset ready" : "Manifest ready";
  updateSelectedRegion(activeHotspot?.name, activeLocalScene?.description || activeHotspot?.detail);
  updateStreetViewButton();

  renderTimeline(manifest);
  renderLayerControls(manifest);
  renderBaseModeControls();
  applyManifestPhysics(manifest);
  applyOsmBuildingStyle(manifest);
  applyManifestLayers(manifest);
  await applyBaseMode();
  if (state.streetMode && activeLocalScene) {
    updateStreetModeCaption(manifest);
  } else {
    elements.modeTitle.textContent = activeYearState?.phase || era?.camera || "Global orbit";
    elements.modeCopy.textContent = `${activeYearState?.summary || era?.future || manifest.summary} ${getEraVisualState(manifest)?.local?.sceneMood || ""} ${describeProcessing(manifest)} Click a hotspot or use ${getSceneModeLabel(activeLocalScene).toLowerCase()} detail to inspect the branch locally.`;
  }
  addMarkers(manifest);
  renderLocalDetailScene(manifest);
  if (state.streetMode && activeLocalScene) {
    flyToStreetScene(manifest);
  } else {
    flyToManifestEra(manifest);
  }
  setSearchParams();
  viewerState.booted = true;
}

elements.randomizeButton.addEventListener("click", async () => {
  state.seed = Math.max(1, Math.floor(Math.random() * 999999) + 1);
  state.eraIndex = 0;
  state.currentYear = null;
  state.hasExplicitYear = false;
  await render();
});

elements.shareButton.addEventListener("click", () => {
  copyShareLink();
});

elements.loadButton.addEventListener("click", async () => {
  const numeric = Number.parseInt(elements.seedInput.value || "1", 10);
  state.seed = Number.isNaN(numeric) || numeric < 1 ? 1 : numeric;
  state.eraIndex = 0;
  state.currentYear = null;
  state.hasExplicitYear = false;
  await render();
});

elements.seedInput?.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const numeric = Number.parseInt(elements.seedInput.value || "1", 10);
    state.seed = Number.isNaN(numeric) || numeric < 1 ? 1 : numeric;
    state.eraIndex = 0;
    state.currentYear = null;
    state.hasExplicitYear = false;
    await render();
  }
});

elements.previousButton.addEventListener("click", async () => {
  state.seed = Math.max(1, state.seed - 1);
  state.eraIndex = 0;
  state.currentYear = null;
  state.hasExplicitYear = false;
  await render();
});

elements.nextButton.addEventListener("click", async () => {
  state.seed = state.seed + 1;
  state.eraIndex = 0;
  state.currentYear = null;
  state.hasExplicitYear = false;
  await render();
});

elements.copyPromptButton.addEventListener("click", () => {
  if (state.activeManifest) {
    copyPromptText(state.activeManifest.prompt);
  }
});

elements.streetViewButton.addEventListener("click", () => {
  if (state.activeManifest) {
    state.streetMode = true;
    updateSelectedRegion(
      getActiveHotspot(state.activeManifest)?.name,
      getActiveLocalScene()?.description || getActiveHotspot(state.activeManifest)?.detail
    );
    renderLocalDetailScene(state.activeManifest);
    updateStreetViewButton();
    flyToStreetScene(state.activeManifest);
  }
});

elements.zoomInButton?.addEventListener("click", () => {
  zoomByFactor("in");
});

elements.zoomOutButton?.addEventListener("click", () => {
  zoomByFactor("out");
});

elements.eraSlider.addEventListener("input", (event) => {
  state.currentYear = Number(event.target.value);
  state.hasExplicitYear = true;
  elements.yearBadge.textContent = String(state.currentYear);
  clearTimeout(state.timelineRenderTimer);
  state.timelineRenderTimer = window.setTimeout(() => {
    render();
  }, 120);
});

elements.eraSlider.addEventListener("change", async (event) => {
  state.currentYear = Number(event.target.value);
  state.hasExplicitYear = true;
  clearTimeout(state.timelineRenderTimer);
  await render();
});

elements.searchButton.addEventListener("click", () => {
  searchCatalog(elements.searchInput.value);
});

elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchCatalog(elements.searchInput.value);
  }
});

async function boot() {
  initializeFromUrl();
  await loadCatalog();
  await initializeViewer();
  renderSearchResults([]);
  await render();
}

boot();
