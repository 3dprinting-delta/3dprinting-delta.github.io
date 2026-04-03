const STORAGE_KEY = "ragdoll-original-build-profile-v1";
const MODE_TWOD = "twod";
const MODE_FPS = "fps";

const FOOD_ITEMS = [
  { key: "coffee", label: "Coffee", category: "food", stamina: 12 },
  { key: "cake", label: "Cake", category: "food", stamina: 18 },
  { key: "pizza", label: "Pizza", category: "food", stamina: 24 },
  { key: "monster", label: "Monster", category: "food", stamina: 20 },
  { key: "redbull", label: "Red Bull", category: "food", stamina: 18 },
  { key: "enchanted_apple", label: "Enchanted Golden Apple", category: "special", stamina: 28 },
  { key: "totem", label: "Totem of Undying", category: "special", stamina: 0 },
];

const SUPPLY_ITEMS = [
  { key: "bandage", label: "Bandage", category: "med" },
  { key: "antiseptic", label: "Antiseptic", category: "med" },
  { key: "pressure_dressing", label: "Pressure Dressing", category: "med" },
  { key: "suture_kit", label: "Suture Kit", category: "tool" },
  { key: "disinfectant", label: "Disinfectant", category: "med" },
  { key: "splint", label: "Splint", category: "tool" },
  { key: "wrap", label: "Wrap", category: "med" },
  { key: "pain_relief", label: "Pain Relief", category: "med" },
  { key: "clotting_agent", label: "Clotting Agent", category: "med" },
  { key: "monitor", label: "Monitoring Tool", category: "tool" },
];

const ITEM_MAP = new Map([...FOOD_ITEMS, ...SUPPLY_ITEMS].map((item) => [item.key, item]));

const RECIPES = {
  bleeding_minor: {
    label: "Minor Bleeding",
    items: { bandage: 1, antiseptic: 1 },
    tools: [],
    staminaCost: 6,
  },
  wound_deep: {
    label: "Deep Wound",
    items: { pressure_dressing: 1, disinfectant: 1 },
    tools: ["suture_kit"],
    staminaCost: 12,
  },
  fracture: {
    label: "Fracture / Sprain",
    items: { wrap: 1, pain_relief: 1 },
    tools: ["splint"],
    staminaCost: 10,
  },
  puncture: {
    label: "Puncture Trauma",
    items: { clotting_agent: 1, bandage: 1 },
    tools: ["monitor"],
    staminaCost: 10,
  },
};

const UPGRADE_GROUPS = [
  {
    title: "Gameplay Upgrades",
    items: [
      "Body-part-specific armor loadouts",
      "Pain and shock simulation",
      "Blood loss and hydration interplay",
      "Advanced triage under wave pressure",
      "Co-op medic support mode",
    ],
  },
  {
    title: "Original Build Patching",
    items: [
      "More direct hit telemetry from the original build",
      "Arrow-type gating through recovered runtime hooks",
      "Deeper persistence integrated into original upgrade flow",
      "Richer death-cause extraction from real match state",
    ],
  },
  {
    title: "Medical Realism",
    items: [
      "Delayed infection windows",
      "Recovery and rehab timers",
      "Diagnostics and field scan tools",
      "Multi-stage stabilization recipes",
    ],
  },
];

function createDefaultState() {
  return {
    version: 1,
    profile: {
      name: "Guest Operator",
      saveSlot: `guest-${Math.floor(Math.random() * 9000 + 1000)}`,
      deaths: 0,
      treatmentsCompleted: 0,
      stats: {
        arenaRuns: 0,
        supplyCollections: 0,
      },
    },
    health: 100,
    stamina: 100,
    injuries: [],
    collectedSupplies: {
      coffee: 1,
      cake: 0,
      pizza: 0,
      monster: 0,
      redbull: 0,
      enchanted_apple: 0,
      totem: 1,
      bandage: 1,
      antiseptic: 1,
      pressure_dressing: 0,
      suture_kit: 0,
      disinfectant: 0,
      splint: 0,
      wrap: 0,
      pain_relief: 0,
      clotting_agent: 0,
      monitor: 0,
    },
    treatmentHistory: [],
    deathReports: [],
    unreadReports: 0,
    activeMode: MODE_TWOD,
    runtime: {
      unityReady: false,
      originalBuildLoaded: false,
      lastArenaEvent: "Arena idle",
    },
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultState(),
      ...parsed,
      profile: { ...createDefaultState().profile, ...(parsed.profile || {}) },
      collectedSupplies: {
        ...createDefaultState().collectedSupplies,
        ...(parsed.collectedSupplies || {}),
      },
      runtime: {
        ...createDefaultState().runtime,
        ...(parsed.runtime || {}),
      },
    };
  } catch (error) {
    console.warn("Failed to load saved profile, creating new guest run.", error);
    return createDefaultState();
  }
}

const state = loadState();
const session = {
  unityInstance: null,
  unityLoadPromise: null,
  arenaRunning: false,
  arenaTickId: null,
  arenaTickCount: 0,
};

const refs = {
  body: document.body,
  profileName: document.getElementById("profile-name"),
  saveState: document.getElementById("save-state"),
  profileSlot: document.getElementById("profile-slot"),
  profileDeaths: document.getElementById("profile-deaths"),
  profileTreatments: document.getElementById("profile-treatments"),
  currentModeLabel: document.getElementById("current-mode-label"),
  injuryCount: document.getElementById("injury-count"),
  reportCount: document.getElementById("report-count"),
  readinessLevel: document.getElementById("readiness-level"),
  healthValue: document.getElementById("health-value"),
  staminaValue: document.getElementById("stamina-value"),
  healthBar: document.getElementById("health-bar"),
  staminaBar: document.getElementById("stamina-bar"),
  supplySummary: document.getElementById("supply-summary"),
  suppliesGrid: document.getElementById("supplies-grid"),
  treatmentSummary: document.getElementById("treatment-summary"),
  treatmentList: document.getElementById("treatment-list"),
  twodPanel: document.getElementById("twod-panel"),
  fpsPanel: document.getElementById("fps-panel"),
  twodCanvas: document.getElementById("twod-canvas"),
  twodStatus: document.getElementById("twod-status"),
  twodEvents: document.getElementById("twod-events"),
  fpsStatus: document.getElementById("fps-status"),
  fpsObjectives: document.getElementById("fps-objectives"),
  statusEffects: document.getElementById("status-effects"),
  reportList: document.getElementById("report-list"),
  deathModal: document.getElementById("death-modal"),
  deathTitle: document.getElementById("death-title"),
  deathReportBody: document.getElementById("death-report-body"),
  closeModal: document.getElementById("close-modal"),
  openLatestReport: document.getElementById("open-latest-report"),
  resetProfile: document.getElementById("reset-profile"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  startTwod: document.getElementById("start-twod"),
  pauseTwod: document.getElementById("pause-twod"),
  fullscreenTwod: document.getElementById("fullscreen-twod"),
  twodReportButton: document.getElementById("twod-report-button"),
  foodButtons: document.getElementById("food-buttons"),
  attemptTreatment: document.getElementById("attempt-treatment"),
  restButton: document.getElementById("rest-button"),
  startFps: document.getElementById("start-fps"),
  pauseFps: document.getElementById("pause-fps"),
  upgradeGroups: document.getElementById("upgrade-groups"),
};

function saveState() {
  const persistable = {
    ...state,
    runtime: {
      ...state.runtime,
      unityReady: !!session.unityInstance,
      originalBuildLoaded: !!session.unityInstance,
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

function setMode(mode) {
  state.activeMode = mode;
  refs.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  refs.twodPanel.classList.toggle("hidden", mode !== MODE_TWOD);
  refs.fpsPanel.classList.toggle("hidden", mode !== MODE_FPS);
  refs.currentModeLabel.textContent =
    mode === MODE_TWOD ? "Classic 2D Ragdoll Mode" : "First-Person Survival Mode";
  saveState();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function totalSupplies() {
  return Object.values(state.collectedSupplies).reduce((sum, value) => sum + value, 0);
}

function getReadinessLabel() {
  if (state.health <= 0) return "Critical";
  if (state.injuries.length >= 3) return "Unstable";
  if (state.injuries.length > 0) return "Monitoring";
  if (state.stamina < 35) return "Fatigued";
  return "Stable";
}

function formatItem(itemKey) {
  return ITEM_MAP.get(itemKey)?.label || itemKey;
}

function getRequiredTreatment(injury) {
  return RECIPES[injury.recipeKey] || null;
}

function renderProfile() {
  refs.profileName.textContent = state.profile.name;
  refs.saveState.textContent = session.unityInstance ? "Original build linked" : "Local save active";
  refs.profileSlot.textContent = state.profile.saveSlot;
  refs.profileDeaths.textContent = String(state.profile.deaths);
  refs.profileTreatments.textContent = String(state.profile.treatmentsCompleted);
  refs.injuryCount.textContent = String(state.injuries.length);
  refs.reportCount.textContent = String(state.unreadReports);
  refs.readinessLevel.textContent = getReadinessLabel();
}

function renderBars() {
  refs.healthValue.textContent = String(Math.round(state.health));
  refs.staminaValue.textContent = String(Math.round(state.stamina));
  refs.healthBar.style.width = `${clamp(state.health, 0, 100)}%`;
  refs.staminaBar.style.width = `${clamp(state.stamina, 0, 100)}%`;
}

function renderSupplies() {
  const entries = Object.entries(state.collectedSupplies)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  refs.supplySummary.textContent =
    entries.length > 0 ? `${entries.length} supply types tracked` : "No inventory recorded";
  refs.suppliesGrid.innerHTML = entries
    .map(
      ([key, amount]) =>
        `<article class="supply-card"><strong>${formatItem(key)}</strong><span>x${amount}</span></article>`
    )
    .join("");
}

function renderTreatmentList() {
  if (!state.injuries.length) {
    refs.treatmentSummary.textContent = "No active trauma";
    refs.treatmentList.innerHTML = '<p class="muted">Arena injuries will appear here with exact supply and tool requirements.</p>';
    return;
  }

  refs.treatmentSummary.textContent = `${state.injuries.length} treatment plan${state.injuries.length === 1 ? "" : "s"} active`;
  refs.treatmentList.innerHTML = state.injuries
    .map((injury) => {
      const recipe = getRequiredTreatment(injury);
      if (!recipe) {
        return `<article class="treatment-card"><strong>${injury.type}</strong><span>No recipe mapped</span></article>`;
      }
      const itemRows = Object.entries(recipe.items)
        .map(([key, amount]) => {
          const owned = state.collectedSupplies[key] || 0;
          const ok = owned >= amount ? "ready" : "missing";
          return `<span class="treatment-chip ${ok}">${formatItem(key)} ${owned}/${amount}</span>`;
        })
        .join("");
      const toolRows = recipe.tools
        .map((tool) => {
          const owned = state.collectedSupplies[tool] || 0;
          const ok = owned >= 1 ? "ready" : "missing";
          return `<span class="treatment-chip ${ok}">${formatItem(tool)} ${owned}/1</span>`;
        })
        .join("");
      return `
        <article class="treatment-card">
          <div class="treatment-card-head">
            <strong>${injury.label}</strong>
            <span>${injury.region} · ${injury.severity}</span>
          </div>
          <p>${injury.type}</p>
          <div class="treatment-chip-row">${itemRows}${toolRows}</div>
        </article>
      `;
    })
    .join("");
}

function renderArenaEvents() {
  refs.twodEvents.innerHTML = `
    <article class="event-line"><strong>Status</strong><span>${state.runtime.lastArenaEvent}</span></article>
    <article class="event-line"><strong>Original Build</strong><span>${session.unityInstance ? "Patched WASM active" : "Not loaded"}</span></article>
    <article class="event-line"><strong>Session</strong><span>${session.arenaRunning ? "Arena run live" : "Arena idle"}</span></article>
  `;
}

function renderFpsPlaceholder() {
  refs.fpsStatus.textContent = "Side mode parked while original arena build is prioritized";
  refs.fpsObjectives.innerHTML =
    '<article class="event-line"><strong>Priority</strong><span>Original build patching and arena telemetry</span></article>';
  refs.statusEffects.innerHTML =
    '<span class="treatment-chip ready">Persistence live</span><span class="treatment-chip ready">Medical sidecar live</span>';
}

function renderReports() {
  if (!state.deathReports.length) {
    refs.reportList.innerHTML = '<p class="muted">No death reports recorded yet.</p>';
    return;
  }
  refs.reportList.innerHTML = state.deathReports
    .slice()
    .reverse()
    .map(
      (report, index) => `
        <article class="report-card" data-report-index="${state.deathReports.length - 1 - index}">
          <strong>${report.causeOfDeath}</strong>
          <span>${report.primaryInjury}</span>
          <span>${new Date(report.timestamp).toLocaleString()}</span>
        </article>
      `
    )
    .join("");
}

function renderFoodButtons() {
  refs.foodButtons.innerHTML = FOOD_ITEMS.map((item) => {
    const amount = state.collectedSupplies[item.key] || 0;
    return `<button class="button button-ghost" type="button" data-food="${item.key}">${item.label} x${amount}</button>`;
  }).join("");
}

function renderUpgrades() {
  refs.upgradeGroups.innerHTML = UPGRADE_GROUPS.map(
    (group) => `
      <section class="upgrade-group">
        <h3>${group.title}</h3>
        <ul>
          ${group.items.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </section>
    `
  ).join("");
}

function renderAll() {
  renderProfile();
  renderBars();
  renderSupplies();
  renderTreatmentList();
  renderArenaEvents();
  renderFpsPlaceholder();
  renderReports();
  renderFoodButtons();
  renderUpgrades();
}

function createInjury(recipeKey, options) {
  const recipe = RECIPES[recipeKey];
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mode: MODE_TWOD,
    region: options.region,
    type: options.type,
    severity: options.severity,
    status: "active",
    requiredSupplies: recipe ? { ...recipe.items } : {},
    requiredTools: recipe ? [...recipe.tools] : [],
    recipeKey,
    label: recipe ? recipe.label : options.type,
    timeCreated: new Date().toISOString(),
  };
}

function addSupply(key, amount) {
  state.collectedSupplies[key] = (state.collectedSupplies[key] || 0) + amount;
  state.profile.stats.supplyCollections += amount;
}

function queueArenaIncident() {
  const roll = session.arenaTickCount % 4;
  if (roll === 0) {
    addSupply("bandage", 1);
    addSupply("coffee", 1);
    state.runtime.lastArenaEvent = "Collected a field pouch: bandage + coffee";
  } else if (roll === 1) {
    const injury = createInjury("bleeding_minor", {
      region: "Upper torso",
      type: "Arrow graze with persistent bleeding",
      severity: "minor",
    });
    state.injuries.push(injury);
    state.health = clamp(state.health - 10, 0, 100);
    state.runtime.lastArenaEvent = "Arrow hit registered: minor torso bleed";
  } else if (roll === 2) {
    addSupply("pressure_dressing", 1);
    addSupply("disinfectant", 1);
    state.runtime.lastArenaEvent = "Recovered trauma kit from arena floor";
  } else {
    const injury = createInjury("wound_deep", {
      region: "Right arm",
      type: "Deep puncture from embedded arrow",
      severity: "serious",
    });
    state.injuries.push(injury);
    state.health = clamp(state.health - 18, 0, 100);
    state.stamina = clamp(state.stamina - 12, 0, 100);
    state.runtime.lastArenaEvent = "Direct arrow penetration: right arm trauma";
  }
  session.arenaTickCount += 1;
  if (state.health <= 0) {
    handleDeath("Combat trauma", "Original arena fatality");
  }
}

function startArenaTicker() {
  stopArenaTicker();
  session.arenaRunning = true;
  state.profile.stats.arenaRuns += 1;
  refs.twodStatus.textContent = session.unityInstance ? "Original arena live" : "Loading original arena";
  session.arenaTickId = window.setInterval(() => {
    if (!session.arenaRunning) return;
    state.stamina = clamp(state.stamina - 2, 0, 100);
    if (state.stamina <= 0) {
      state.health = clamp(state.health - 4, 0, 100);
      state.runtime.lastArenaEvent = "Operator exhausted under arena pressure";
    } else {
      queueArenaIncident();
    }
    renderAll();
    saveState();
  }, 8000);
}

function stopArenaTicker() {
  session.arenaRunning = false;
  if (session.arenaTickId) {
    window.clearInterval(session.arenaTickId);
    session.arenaTickId = null;
  }
}

function canTreatInjury(injury) {
  const recipe = getRequiredTreatment(injury);
  if (!recipe) return false;
  const hasItems = Object.entries(recipe.items).every(
    ([key, amount]) => (state.collectedSupplies[key] || 0) >= amount
  );
  const hasTools = recipe.tools.every((tool) => (state.collectedSupplies[tool] || 0) >= 1);
  return hasItems && hasTools && state.stamina >= recipe.staminaCost;
}

function attemptTreatment() {
  const treatable = state.injuries.find((injury) => canTreatInjury(injury));
  if (!treatable) {
    state.runtime.lastArenaEvent = "Treatment failed: missing supplies, tools, or stamina";
    renderAll();
    saveState();
    return;
  }
  const recipe = getRequiredTreatment(treatable);
  Object.entries(recipe.items).forEach(([key, amount]) => {
    state.collectedSupplies[key] -= amount;
  });
  state.stamina = clamp(state.stamina - recipe.staminaCost, 0, 100);
  state.health = clamp(state.health + (treatable.severity === "minor" ? 8 : 14), 0, 100);
  state.injuries = state.injuries.filter((injury) => injury.id !== treatable.id);
  state.profile.treatmentsCompleted += 1;
  state.treatmentHistory.push({
    injuryId: treatable.id,
    recipeKey: treatable.recipeKey,
    timestamp: new Date().toISOString(),
  });
  state.runtime.lastArenaEvent = `Treatment complete: ${treatable.label}`;
  renderAll();
  saveState();
}

function useFoodItem(key) {
  if ((state.collectedSupplies[key] || 0) <= 0) {
    state.runtime.lastArenaEvent = `${formatItem(key)} unavailable`;
    renderAll();
    return;
  }
  if (key === "totem") {
    state.runtime.lastArenaEvent = "Totem is passive and triggers only on fatal collapse";
    renderAll();
    return;
  }
  const item = ITEM_MAP.get(key);
  state.collectedSupplies[key] -= 1;
  state.stamina = clamp(state.stamina + (item?.stamina || 0), 0, 100);
  if (key === "enchanted_apple") {
    state.health = clamp(state.health + 4, 0, 100);
  }
  state.runtime.lastArenaEvent = `${item?.label || key} consumed for stamina recovery`;
  renderAll();
  saveState();
}

function stabilize() {
  state.stamina = clamp(state.stamina + 8, 0, 100);
  state.runtime.lastArenaEvent = "Short stabilization cycle completed";
  renderAll();
  saveState();
}

function handleDeath(causeOfDeath, primaryInjury) {
  if ((state.collectedSupplies.totem || 0) > 0) {
    state.collectedSupplies.totem -= 1;
    state.health = 25;
    state.stamina = 20;
    state.runtime.lastArenaEvent = "Totem of Undying prevented fatal collapse";
    renderAll();
    saveState();
    return;
  }
  stopArenaTicker();
  const missingTreatment = state.injuries.flatMap((injury) => {
    const recipe = getRequiredTreatment(injury);
    if (!recipe) return [];
    const missingItems = Object.entries(recipe.items)
      .filter(([key, amount]) => (state.collectedSupplies[key] || 0) < amount)
      .map(([key, amount]) => `${formatItem(key)} ${state.collectedSupplies[key] || 0}/${amount}`);
    const missingTools = recipe.tools
      .filter((tool) => (state.collectedSupplies[tool] || 0) < 1)
      .map((tool) => `${formatItem(tool)} 0/1`);
    return [...missingItems, ...missingTools];
  });
  const report = {
    causeOfDeath,
    primaryInjury,
    contributingFactors: state.injuries.map((injury) => injury.type),
    missingTreatment,
    timestamp: new Date().toISOString(),
  };
  state.deathReports.push(report);
  state.unreadReports += 1;
  state.profile.deaths += 1;
  refs.twodStatus.textContent = "Operator deceased";
  openReport(report);
  renderAll();
  saveState();
}

function openReport(report) {
  refs.deathTitle.textContent = report.causeOfDeath;
  refs.deathReportBody.innerHTML = `
    <article class="report-detail"><strong>Primary injury</strong><p>${report.primaryInjury}</p></article>
    <article class="report-detail"><strong>Contributing factors</strong><p>${report.contributingFactors.join(", ") || "No secondary factors logged"}</p></article>
    <article class="report-detail"><strong>Missing treatment</strong><p>${report.missingTreatment.join(", ") || "No missing treatment logged"}</p></article>
    <article class="report-detail"><strong>Time</strong><p>${new Date(report.timestamp).toLocaleString()}</p></article>
  `;
  if (typeof refs.deathModal.showModal === "function") {
    refs.deathModal.showModal();
  } else {
    refs.deathModal.setAttribute("open", "open");
  }
}

function closeReport() {
  if (typeof refs.deathModal.close === "function") {
    refs.deathModal.close();
  } else {
    refs.deathModal.removeAttribute("open");
  }
  state.unreadReports = 0;
  renderAll();
  saveState();
}

function resetProfile() {
  Object.assign(state, createDefaultState());
  stopArenaTicker();
  renderAll();
  saveState();
}

function requestFullscreen() {
  const canvas = refs.twodCanvas;
  if (canvas.requestFullscreen) {
    canvas.requestFullscreen();
  }
}

function showUnityBanner(message, type) {
  console[type === "error" ? "error" : "log"](message);
  state.runtime.lastArenaEvent = message;
  renderArenaEvents();
}

function loadOriginalBuild() {
  if (session.unityLoadPromise) {
    return session.unityLoadPromise;
  }
  refs.twodStatus.textContent = "Loading original Unity arena";
  session.unityLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./game/Build/v111.loader.js";
    script.onload = () => {
      const config = {
        dataUrl: "./game/Build/6697b6deba8b617c67b69c55dcd07cb1.data.unityweb",
        frameworkUrl: "./game/Build/0be3c3ee7115b26e1ae28e643afdf1f2.js.unityweb",
        codeUrl: "./game/PatchedBuild/build.patched.wasm",
        streamingAssetsUrl: "./game/StreamingAssets",
        companyName: "RagdollArchers2",
        productName: "RagdollArchers2OriginalPatched",
        productVersion: "1.0.0",
        showBanner: showUnityBanner,
      };
      window
        .createUnityInstance(refs.twodCanvas, config, () => {})
        .then((instance) => {
          session.unityInstance = instance;
          state.runtime.unityReady = true;
          state.runtime.originalBuildLoaded = true;
          refs.twodStatus.textContent = "Original Unity arena loaded";
          renderAll();
          saveState();
          resolve(instance);
        })
        .catch((error) => {
          refs.twodStatus.textContent = "Original build failed to load";
          reject(error);
        });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return session.unityLoadPromise;
}

function startTwod() {
  loadOriginalBuild()
    .then(() => {
      refs.twodStatus.textContent = "Original arena running with patched WASM";
      startArenaTicker();
      renderAll();
      saveState();
    })
    .catch((error) => {
      console.error(error);
      refs.twodStatus.textContent = "Failed to load original build";
      state.runtime.lastArenaEvent = "Unity loader error prevented arena startup";
      renderAll();
    });
}

function bindEvents() {
  refs.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });
  refs.startTwod.addEventListener("click", startTwod);
  refs.pauseTwod.addEventListener("click", () => {
    stopArenaTicker();
    refs.twodStatus.textContent = "Arena paused";
  });
  refs.fullscreenTwod.addEventListener("click", requestFullscreen);
  refs.foodButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-food]");
    if (!button) return;
    useFoodItem(button.dataset.food);
  });
  refs.attemptTreatment.addEventListener("click", attemptTreatment);
  refs.restButton.addEventListener("click", stabilize);
  refs.closeModal.addEventListener("click", closeReport);
  refs.openLatestReport.addEventListener("click", () => {
    const latest = state.deathReports[state.deathReports.length - 1];
    if (latest) openReport(latest);
  });
  refs.twodReportButton.addEventListener("click", () => {
    const latest = state.deathReports[state.deathReports.length - 1];
    if (latest) openReport(latest);
  });
  refs.resetProfile.addEventListener("click", resetProfile);
  refs.reportList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-report-index]");
    if (!card) return;
    const report = state.deathReports[Number(card.dataset.reportIndex)];
    if (report) openReport(report);
  });
  refs.startFps.addEventListener("click", () => setMode(MODE_TWOD));
  refs.pauseFps.addEventListener("click", () => setMode(MODE_TWOD));
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      attemptTreatment();
    }
    if (event.key.toLowerCase() === "e") {
      queueArenaIncident();
      renderAll();
      saveState();
    }
  });
}

function applyQueryState() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1") {
    Object.assign(state, createDefaultState());
    saveState();
  }
  const requestedMode = params.get("mode");
  if (requestedMode === MODE_TWOD || requestedMode === MODE_FPS) {
    setMode(requestedMode);
  } else {
    setMode(state.activeMode || MODE_TWOD);
  }
  if (params.get("autostart") === "1" && state.activeMode === MODE_TWOD) {
    startTwod();
  }
}

bindEvents();
renderAll();
applyQueryState();
