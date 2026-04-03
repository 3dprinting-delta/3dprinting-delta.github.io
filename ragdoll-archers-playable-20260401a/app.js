const SAVE_KEY = "ragdoll-realism-protocol-v2";
const SAVE_VERSION = 2;

const dom = {
  currentModeLabel: document.querySelector("#current-mode-label"),
  injuryCount: document.querySelector("#injury-count"),
  reportCount: document.querySelector("#report-count"),
  readinessLevel: document.querySelector("#readiness-level"),
  profileName: document.querySelector("#profile-name"),
  profileSlot: document.querySelector("#profile-slot"),
  profileDeaths: document.querySelector("#profile-deaths"),
  profileTreatments: document.querySelector("#profile-treatments"),
  saveState: document.querySelector("#save-state"),
  healthValue: document.querySelector("#health-value"),
  staminaValue: document.querySelector("#stamina-value"),
  healthBar: document.querySelector("#health-bar"),
  staminaBar: document.querySelector("#stamina-bar"),
  suppliesGrid: document.querySelector("#supplies-grid"),
  treatmentList: document.querySelector("#treatment-list"),
  supplySummary: document.querySelector("#supply-summary"),
  treatmentSummary: document.querySelector("#treatment-summary"),
  reportList: document.querySelector("#report-list"),
  upgradeGroups: document.querySelector("#upgrade-groups"),
  statusEffects: document.querySelector("#status-effects"),
  twodPanel: document.querySelector("#twod-panel"),
  fpsPanel: document.querySelector("#fps-panel"),
  modeTabs: [...document.querySelectorAll(".mode-tab")],
  foodButtons: document.querySelector("#food-buttons"),
  startTwod: document.querySelector("#start-twod"),
  pauseTwod: document.querySelector("#pause-twod"),
  twodCanvas: document.querySelector("#twod-canvas"),
  twodStatus: document.querySelector("#twod-status"),
  twodEvents: document.querySelector("#twod-events"),
  attemptTreatment: document.querySelector("#attempt-treatment"),
  restButton: document.querySelector("#rest-button"),
  resetProfile: document.querySelector("#reset-profile"),
  openLatestReport: document.querySelector("#open-latest-report"),
  twodReportButton: document.querySelector("#twod-report-button"),
  startFps: document.querySelector("#start-fps"),
  pauseFps: document.querySelector("#pause-fps"),
  fpsCanvas: document.querySelector("#fps-canvas"),
  fpsStatus: document.querySelector("#fps-status"),
  fpsObjectives: document.querySelector("#fps-objectives"),
  deathModal: document.querySelector("#death-modal"),
  deathTitle: document.querySelector("#death-title"),
  deathReportBody: document.querySelector("#death-report-body"),
  closeModal: document.querySelector("#close-modal"),
  fullscreenTwod: document.querySelector("#fullscreen-twod"),
};

const MODE_TWOD = "twod";
const MODE_FPS = "fps";
const modeNames = {
  [MODE_TWOD]: "Classic 2D Ragdoll Mode",
  [MODE_FPS]: "First-Person Survival",
};

const upgradeGroups = {
  Gameplay: [
    "Body-part-specific armor and arrow penetration models",
    "Pain and shock stack that changes movement and aim stability",
    "Blood loss, hydration, and fatigue interaction",
    "Advanced triage chains under wave pressure",
    "Co-op medic and support operator role",
  ],
  "2D Arena": [
    "Boss wave encounters with named trauma patterns",
    "Dynamic weather and wind affecting projectile arcs",
    "Recoverable cover objects and destructible terrain",
    "Class-based operator loadouts with different medical kits",
  ],
  "First-Person Survival": [
    "Larger arenas with extraction routes",
    "Weapon-specific trauma patterns and stagger",
    "Smarter hostile flanking and suppression behavior",
    "Richer audio cues for incoming fire and critical injury",
  ],
  "Account and Social": [
    "Cloud save and guest-to-account migration",
    "Cross-device progression sync",
    "Challenge contracts and daily trauma drills",
    "Leaderboards by survival efficiency and treatment quality",
  ],
  "Medical Realism": [
    "Infection windows and delayed complications",
    "Rehabilitation penalties after severe trauma",
    "Diagnostic tools with vitals, scans, and monitoring",
    "Expanded airway and circulation management pathways",
  ],
};

const supplyCatalog = {
  bandage: { label: "Bandage", category: "med", short: "Bandage" },
  antiseptic: { label: "Antiseptic", category: "med", short: "Antiseptic" },
  pressure_dressing: { label: "Pressure Dressing", category: "med", short: "Pressure" },
  suture_kit: { label: "Suture Kit", category: "tool", short: "Sutures" },
  disinfectant: { label: "Disinfectant", category: "med", short: "Disinfect" },
  splint: { label: "Splint", category: "tool", short: "Splint" },
  wrap: { label: "Compression Wrap", category: "med", short: "Wrap" },
  pain_relief: { label: "Pain Relief", category: "med", short: "Pain Relief" },
  clotting_agent: { label: "Clotting Agent", category: "med", short: "Clotting" },
  monitor: { label: "Vitals Monitor", category: "tool", short: "Monitor" },
  airway_kit: { label: "Airway Kit", category: "tool", short: "Airway" },
  iv_fluids: { label: "IV Fluids", category: "med", short: "IV Fluids" },
  trauma_pack: { label: "Trauma Pack", category: "med", short: "Trauma Pack" },
  coffee: { label: "Coffee", category: "food", short: "Coffee" },
  cake: { label: "Cake", category: "food", short: "Cake" },
  pizza: { label: "Pizza", category: "food", short: "Pizza" },
  monster: { label: "Monster Drink", category: "food", short: "Monster" },
  red_bull: { label: "Red Bull", category: "food", short: "Red Bull" },
  enchanted_golden_apple: { label: "Enchanted Golden Apple", category: "special", short: "Golden Apple" },
  totem_of_revival: { label: "Totem of Revival", category: "special", short: "Totem" },
};

const intakeItems = {
  coffee: { stamina: 12, focus: "Steady hands", crash: -4 },
  cake: { stamina: 8, focus: "Sugar rush", crash: -3 },
  pizza: { stamina: 16, focus: "Dense calorie recovery", crash: -2 },
  monster: { stamina: 18, focus: "Jittery energy spike", crash: -8 },
  red_bull: { stamina: 14, focus: "Short emergency boost", crash: -6 },
  enchanted_golden_apple: { stamina: 24, focus: "Rare enchanted stamina surge", crash: 0 },
  totem_of_revival: { stamina: 0, focus: "Fatality prevention relic", crash: 0 },
};

const injuryTemplates = {
  minor_bleeding: {
    label: "Minor bleeding",
    type: "minor_bleeding",
    severity: "minor",
    status: "bleeding",
    bleedingState: "slow external bleed",
    mobilityImpact: "minimal movement loss",
    consciousnessRisk: "low",
    recipe: { requiredItems: { bandage: 1, antiseptic: 1 }, requiredTools: [], staminaCost: 5, result: "Bleeding controlled and wound cleaned." },
    healthPenalty: 10,
  },
  deep_laceration: {
    label: "Deep laceration",
    type: "deep_laceration",
    severity: "major",
    status: "open wound",
    bleedingState: "moderate hemorrhage risk",
    mobilityImpact: "draw and movement slowed",
    consciousnessRisk: "elevated",
    recipe: { requiredItems: { pressure_dressing: 1, disinfectant: 1 }, requiredTools: ["suture_kit"], staminaCost: 12, result: "Deep wound closed and dressed." },
    healthPenalty: 18,
  },
  fracture_sprain: {
    label: "Fracture / sprain",
    type: "fracture_sprain",
    severity: "major",
    status: "unstable limb",
    bleedingState: "limited external bleed",
    mobilityImpact: "mobility heavily reduced",
    consciousnessRisk: "medium",
    recipe: { requiredItems: { wrap: 1, pain_relief: 1 }, requiredTools: ["splint"], staminaCost: 10, result: "Limb stabilized for continued combat movement." },
    healthPenalty: 15,
  },
  puncture_trauma: {
    label: "Puncture trauma",
    type: "puncture_trauma",
    severity: "major",
    status: "penetrating wound",
    bleedingState: "internal bleed risk",
    mobilityImpact: "breathing and movement impaired",
    consciousnessRisk: "high",
    recipe: { requiredItems: { clotting_agent: 1, bandage: 1 }, requiredTools: ["monitor"], staminaCost: 11, result: "Penetrating injury packed and monitored." },
    healthPenalty: 20,
  },
  severe_multitrauma: {
    label: "Severe multi-trauma",
    type: "severe_multitrauma",
    severity: "critical",
    status: "systemic collapse risk",
    bleedingState: "critical bleed and shock",
    mobilityImpact: "severe impairment",
    consciousnessRisk: "critical",
    recipe: { requiredItems: { trauma_pack: 1, iv_fluids: 1, pressure_dressing: 1 }, requiredTools: ["airway_kit", "monitor"], staminaCost: 18, result: "Operator stabilized from multi-trauma." },
    healthPenalty: 34,
  },
};

const pickupTable = ["bandage","antiseptic","pressure_dressing","suture_kit","disinfectant","splint","wrap","pain_relief","clotting_agent","monitor","airway_kit","iv_fluids","trauma_pack","coffee","cake","pizza","monster","red_bull","enchanted_golden_apple","totem_of_revival"];

function randomChoice(list) { return list[Math.floor(Math.random() * list.length)]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function makeGuestProfile() {
  const seed = Math.floor(1000 + Math.random() * 9000);
  return {
    version: SAVE_VERSION,
    profile: {
      id: `guest-${seed}`,
      name: "Guest Operator",
      saveSlot: `guest-${seed}`,
      createdAt: new Date().toISOString(),
      accountTier: "guest",
    },
    mode: MODE_TWOD,
    health: 100,
    stamina: 100,
    injuries: [],
    collectedSupplies: {},
    requiredTreatment: [],
    activeStatusEffects: [],
    deathReport: null,
    deathReports: [],
    treatmentHistory: [],
    stats: {
      deaths: 0,
      treatmentsCompleted: 0,
      twodRuns: 0,
      fpsRuns: 0,
      twodWaveBest: 0,
      fpsThreatsNeutralized: 0,
    },
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return makeGuestProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SAVE_VERSION) return makeGuestProfile();
    const base = makeGuestProfile();
    return {
      ...base,
      ...parsed,
      mode: parsed.mode === "legacy2d" ? MODE_TWOD : parsed.mode || MODE_TWOD,
      profile: { ...base.profile, ...parsed.profile },
      stats: { ...base.stats, ...parsed.stats },
      injuries: parsed.injuries || [],
      collectedSupplies: parsed.collectedSupplies || {},
      requiredTreatment: parsed.requiredTreatment || [],
      activeStatusEffects: parsed.activeStatusEffects || [],
      deathReports: parsed.deathReports || [],
      treatmentHistory: parsed.treatmentHistory || [],
    };
  } catch {
    return makeGuestProfile();
  }
}

let state = loadState();

function saveState() {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  dom.saveState.textContent = `Local save synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function labelForSupply(key) {
  return supplyCatalog[key]?.label || key;
}

function ensureSupply(key, amount = 1) {
  state.collectedSupplies[key] = (state.collectedSupplies[key] || 0) + amount;
}

function registerStatusEffect(label, detail) {
  state.activeStatusEffects.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    label,
    detail,
    expiresAt: Date.now() + 14000,
  });
  state.activeStatusEffects = state.activeStatusEffects.slice(0, 6);
}

function pruneStatusEffects() {
  const now = Date.now();
  state.activeStatusEffects = state.activeStatusEffects.filter((entry) => entry.expiresAt > now);
}

function getReadiness() {
  if (state.health <= 0) return "Critical failure";
  if (state.injuries.some((injury) => injury.severity === "critical")) return "Critical trauma";
  if (state.injuries.some((injury) => injury.severity === "major")) return "Unstable";
  if (state.injuries.length) return "Watchlisted";
  return "Stable";
}

function recalcRequiredTreatment() {
  state.requiredTreatment = state.injuries.map((injury) => {
    const recipe = injuryTemplates[injury.type].recipe;
    const missingItems = {};
    for (const [key, qty] of Object.entries(recipe.requiredItems)) {
      const owned = state.collectedSupplies[key] || 0;
      if (owned < qty) missingItems[key] = qty - owned;
    }
    const missingTools = recipe.requiredTools.filter((tool) => (state.collectedSupplies[tool] || 0) < 1);
    return {
      injuryId: injury.id,
      injuryLabel: injury.label,
      severity: injury.severity,
      requiredItems: recipe.requiredItems,
      requiredTools: recipe.requiredTools,
      staminaCost: recipe.staminaCost,
      missingItems,
      missingTools,
      sufficientKit: Object.keys(missingItems).length === 0 && missingTools.length === 0 && state.stamina >= recipe.staminaCost,
    };
  });
}

function mapHeightToRegion(y, height) {
  if (y < height * 0.28) return "Head / neck";
  if (y < height * 0.52) return "Chest";
  if (y < height * 0.72) return "Abdomen / arm";
  return "Leg";
}

function chooseInjuryType(region, severityHint = "major") {
  if (severityHint === "critical") return "severe_multitrauma";
  if (region.includes("Leg")) return "fracture_sprain";
  if (region.includes("Chest")) return "deep_laceration";
  if (region.includes("Abdomen")) return "puncture_trauma";
  return "minor_bleeding";
}

function createInjury({ type, region, mode, source }) {
  const template = injuryTemplates[type];
  const injury = {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    mode,
    region,
    type,
    severity: template.severity,
    status: template.status,
    requiredSupplies: template.recipe.requiredItems,
    requiredTools: template.recipe.requiredTools,
    timeCreated: new Date().toISOString(),
    label: `${template.label} (${region})`,
    source,
    bleedingState: template.bleedingState,
    mobilityImpact: template.mobilityImpact,
    consciousnessRisk: template.consciousnessRisk,
  };
  state.injuries.unshift(injury);
  state.health = clamp(state.health - template.healthPenalty, 0, 100);
  state.stamina = clamp(state.stamina - Math.ceil(template.healthPenalty / 2), 0, 100);
  registerStatusEffect("Injury sustained", `${injury.label} from ${source}.`);
  recalcRequiredTreatment();
  checkForDeath(`Traumatic ${template.label.toLowerCase()}`);
  saveState();
}

function reviveWithTotem() {
  if ((state.collectedSupplies.totem_of_revival || 0) < 1) return false;
  state.collectedSupplies.totem_of_revival -= 1;
  state.health = 42;
  state.stamina = clamp(state.stamina + 18, 0, 100);
  state.injuries = state.injuries.filter((injury) => injury.severity !== "critical");
  registerStatusEffect("Totem activated", "Fatal collapse prevented once.");
  recalcRequiredTreatment();
  return true;
}

function buildDeathReport(cause) {
  const oldest = state.injuries[state.injuries.length - 1];
  const report = {
    causeOfDeath: cause,
    primaryInjury: state.injuries[0]?.label || "Systemic collapse",
    contributingFactors: state.injuries.map((injury) => `${injury.label} - ${injury.bleedingState}`),
    untreatedConditions: state.injuries.map((injury) => injury.status),
    missingTreatment: state.requiredTreatment.flatMap((entry) => [
      ...Object.entries(entry.missingItems).map(([key, qty]) => `${labelForSupply(key)} x${qty}`),
      ...entry.missingTools.map((tool) => labelForSupply(tool)),
    ]),
    timestamp: new Date().toISOString(),
    timeSinceFirstTrauma: oldest
      ? `${Math.max(1, Math.round((Date.now() - new Date(oldest.timeCreated).getTime()) / 1000))} seconds`
      : "Immediate",
  };
  state.deathReport = report;
  state.deathReports.unshift(report);
  state.deathReports = state.deathReports.slice(0, 10);
  state.stats.deaths += 1;
  openDeathReport(report);
}

function checkForDeath(cause) {
  if (state.health > 0) return;
  if (reviveWithTotem()) {
    render();
    saveState();
    return;
  }
  buildDeathReport(cause);
}

function attemptTreatment() {
  recalcRequiredTreatment();
  const target = state.requiredTreatment.find((entry) => entry.sufficientKit);
  if (!target) {
    registerStatusEffect("Treatment blocked", "Missing tool, supplies, or stamina.");
    render();
    saveState();
    return;
  }
  for (const [key, qty] of Object.entries(target.requiredItems)) {
    state.collectedSupplies[key] = Math.max(0, (state.collectedSupplies[key] || 0) - qty);
  }
  for (const tool of target.requiredTools) {
    state.collectedSupplies[tool] = Math.max(0, (state.collectedSupplies[tool] || 0) - 1);
  }
  const injury = state.injuries.find((entry) => entry.id === target.injuryId);
  state.injuries = state.injuries.filter((entry) => entry.id !== target.injuryId);
  state.stamina = clamp(state.stamina - target.staminaCost, 0, 100);
  state.health = clamp(state.health + (injury?.severity === "critical" ? 30 : 18), 0, 100);
  state.stats.treatmentsCompleted += 1;
  state.treatmentHistory.unshift({
    injuryLabel: injury?.label || target.injuryLabel,
    mode: state.mode,
    completedAt: new Date().toISOString(),
  });
  registerStatusEffect("Treatment completed", injuryTemplates[injury.type].recipe.result);
  recalcRequiredTreatment();
  render();
  saveState();
}

function restAndStabilize() {
  state.stamina = clamp(state.stamina + Math.max(4, 10 - state.injuries.length * 2), 0, 100);
  registerStatusEffect("Stabilized", "Short rest restored partial stamina.");
  render();
  saveState();
}

function useIntake(key) {
  const intake = intakeItems[key];
  if (!intake) return;
  if ((state.collectedSupplies[key] || 0) < 1) {
    registerStatusEffect("No item available", `${labelForSupply(key)} not in inventory.`);
    render();
    return;
  }
  if (key === "totem_of_revival") {
    registerStatusEffect("Relic reserved", "Totem only triggers on fatal collapse.");
    render();
    return;
  }
  state.collectedSupplies[key] -= 1;
  state.stamina = clamp(state.stamina + intake.stamina, 0, 100);
  registerStatusEffect(labelForSupply(key), intake.focus);
  if (intake.crash) {
    window.setTimeout(() => {
      state.stamina = clamp(state.stamina + intake.crash, 0, 100);
      registerStatusEffect("Energy crash", `${labelForSupply(key)} effect faded.`);
      render();
      saveState();
    }, 9000);
  }
  render();
  saveState();
}

function openDeathReport(report = state.deathReports[0]) {
  if (!report) return;
  dom.deathTitle.textContent = report.causeOfDeath;
  dom.deathReportBody.innerHTML = `
    <section class="death-section">
      <div class="death-grid">
        <div><strong>Primary Injury</strong><p>${report.primaryInjury}</p></div>
        <div><strong>Time To Death</strong><p>${report.timeSinceFirstTrauma}</p></div>
        <div><strong>Recorded At</strong><p>${new Date(report.timestamp).toLocaleString()}</p></div>
        <div><strong>Untreated Conditions</strong><p>${report.untreatedConditions.join(", ") || "None"}</p></div>
      </div>
    </section>
    <section class="death-section">
      <strong>Contributing Factors</strong>
      <ul>${report.contributingFactors.map((item) => `<li>${item}</li>`).join("") || "<li>None</li>"}</ul>
    </section>
    <section class="death-section">
      <strong>Missing Treatment</strong>
      <ul>${report.missingTreatment.map((item) => `<li>${item}</li>`).join("") || "<li>No missing treatment logged.</li>"}</ul>
    </section>
  `;
  dom.deathModal.showModal();
}

function describeItem(key) {
  const copy = {
    coffee: "Short stamina lift with a mild crash later.",
    cake: "Quick calories for short bursts of movement.",
    pizza: "Steady stamina recovery meal.",
    monster: "Powerful boost with a heavy comedown.",
    red_bull: "Moderate emergency energy burst.",
    enchanted_golden_apple: "Rare enchanted stamina surge only, not a trauma heal.",
    totem_of_revival: "One-time Totem-style fatal collapse prevention.",
  };
  return copy[key] || `${labelForSupply(key)} is required for treatment or survival readiness.`;
}

function renderSupplies() {
  const ownedTotal = Object.values(state.collectedSupplies).reduce((sum, qty) => sum + qty, 0);
  dom.supplySummary.textContent = `${ownedTotal} total items tracked`;
  dom.suppliesGrid.innerHTML = Object.entries(supplyCatalog)
    .map(([key, item]) => {
      const extraClass =
        item.category === "special" ? "special" : item.category === "tool" ? "tool" : item.category === "food" ? "food" : "med";
      return `
        <article class="supply-card">
          <header>
            <strong>${item.label}</strong>
            <span class="item-badge ${extraClass}">${item.category}</span>
          </header>
          <p>Owned quantity: <strong>${state.collectedSupplies[key] || 0}</strong></p>
          <p class="muted">${describeItem(key)}</p>
        </article>
      `;
    })
    .join("");
}

function renderTreatments() {
  recalcRequiredTreatment();
  if (!state.requiredTreatment.length) {
    dom.treatmentSummary.textContent = "No active trauma";
    dom.treatmentList.innerHTML = `<article class="treatment-card"><p>No active injuries. Operator currently needs no treatment.</p></article>`;
    return;
  }
  const readyCount = state.requiredTreatment.filter((entry) => entry.sufficientKit).length;
  dom.treatmentSummary.textContent = `${readyCount}/${state.requiredTreatment.length} treatments ready`;
  dom.treatmentList.innerHTML = state.requiredTreatment
    .map((entry) => {
      const itemLine = Object.entries(entry.requiredItems).map(([k, q]) => `${labelForSupply(k)} x${q}`).join(", ");
      const toolLine = entry.requiredTools.length ? entry.requiredTools.map(labelForSupply).join(", ") : "No dedicated tool";
      const missingItems = Object.entries(entry.missingItems).map(([k, q]) => `${labelForSupply(k)} x${q}`).join(", ");
      const missingTools = entry.missingTools.map(labelForSupply).join(", ");
      return `
        <article class="treatment-card ${entry.sufficientKit ? "ready" : "insufficient"}">
          <header>
            <strong>${entry.injuryLabel}</strong>
            <span class="item-badge ${entry.severity === "critical" ? "special" : "med"}">${entry.severity}</span>
          </header>
          <p><strong>Supplies:</strong> ${itemLine}</p>
          <p><strong>Tools:</strong> ${toolLine}</p>
          <p><strong>Stamina Cost:</strong> ${entry.staminaCost}</p>
          <p><strong>Missing:</strong> ${missingItems || "No item gap"}${missingTools ? `; Tools: ${missingTools}` : ""}</p>
        </article>
      `;
    })
    .join("");
}

function renderReports() {
  dom.reportCount.textContent = String(state.deathReports.length);
  if (!state.deathReports.length) {
    dom.reportList.innerHTML = `<article class="report-item"><p>No death reports recorded yet.</p></article>`;
    return;
  }
  dom.reportList.innerHTML = state.deathReports
    .map(
      (report) => `
      <article class="report-item">
        <header>
          <strong>${report.causeOfDeath}</strong>
          <span class="report-chip">${new Date(report.timestamp).toLocaleDateString()}</span>
        </header>
        <p>Primary injury: ${report.primaryInjury}</p>
        <ul>${report.contributingFactors.slice(0, 3).map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
    `,
    )
    .join("");
}

function renderStatusEffects() {
  pruneStatusEffects();
  if (!state.activeStatusEffects.length) {
    dom.statusEffects.innerHTML = `<span class="effect-pill">No active status effects</span>`;
    return;
  }
  dom.statusEffects.innerHTML = state.activeStatusEffects
    .map((effect) => `<span class="effect-pill">${effect.label}: ${effect.detail}</span>`)
    .join("");
}

function renderUpgrades() {
  dom.upgradeGroups.innerHTML = Object.entries(upgradeGroups)
    .map(
      ([group, items]) => `
        <article class="upgrade-card">
          <header><strong>${group}</strong></header>
          <ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>
        </article>
      `,
    )
    .join("");
}

function renderProfile() {
  dom.profileName.textContent = state.profile.name;
  dom.profileSlot.textContent = state.profile.saveSlot;
  dom.profileDeaths.textContent = String(state.stats.deaths);
  dom.profileTreatments.textContent = String(state.stats.treatmentsCompleted);
  dom.currentModeLabel.textContent = modeNames[state.mode];
  dom.injuryCount.textContent = String(state.injuries.length);
  dom.readinessLevel.textContent = getReadiness();
  dom.healthValue.textContent = `${Math.round(state.health)} / 100`;
  dom.staminaValue.textContent = `${Math.round(state.stamina)} / 100`;
  dom.healthBar.style.width = `${clamp(state.health, 0, 100)}%`;
  dom.staminaBar.style.width = `${clamp(state.stamina, 0, 100)}%`;
}

function renderModeVisibility() {
  const show2d = state.mode === MODE_TWOD;
  dom.twodPanel.classList.toggle("hidden", !show2d);
  dom.fpsPanel.classList.toggle("hidden", show2d);
  dom.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
  });
}

function render() {
  renderProfile();
  renderModeVisibility();
  renderSupplies();
  renderTreatments();
  renderReports();
  renderStatusEffects();
  renderTwodSidebar();
  renderFpsSidebar();
}

function resetProfile() {
  state = makeGuestProfile();
  twoD.reset();
  fps.reset();
  render();
  saveState();
}

function mountFoodButtons() {
  const intakeKeys = ["coffee", "cake", "pizza", "monster", "red_bull", "enchanted_golden_apple", "totem_of_revival"];
  dom.foodButtons.innerHTML = "";
  intakeKeys.forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-secondary";
    button.textContent = `Use ${labelForSupply(key)}`;
    button.addEventListener("click", () => useIntake(key));
    dom.foodButtons.appendChild(button);
  });
}

const twoD = {
  running: false,
  paused: false,
  wave: 1,
  score: 0,
  survivalTime: 0,
  pointer: { x: 360, y: 250 },
  player: { x: 152, y: 424, w: 24, h: 86, vx: 0, dodge: 0, shootCooldown: 0, facing: 1 },
  arrows: [],
  enemyArrows: [],
  enemies: [],
  pickups: [],
  corpses: [],
  feed: [],
  spawnTimer: 0,
  pickupTimer: 0,
  reset() {
    this.running = false;
    this.paused = false;
    this.wave = 1;
    this.score = 0;
    this.survivalTime = 0;
    this.arrows = [];
    this.enemyArrows = [];
    this.enemies = [];
    this.pickups = [];
    this.corpses = [];
    this.feed = [];
    this.spawnTimer = 0;
    this.pickupTimer = 0;
    this.player = { x: 152, y: 424, w: 24, h: 86, vx: 0, dodge: 0, shootCooldown: 0, facing: 1 };
    dom.twodStatus.textContent = "Arena idle";
  },
  start() {
    this.reset();
    this.running = true;
    state.mode = MODE_TWOD;
    state.stats.twodRuns += 1;
    this.log(`Wave ${this.wave} engaged.`);
    dom.twodStatus.textContent = "Arena live";
    render();
    saveState();
  },
  log(text) {
    this.feed.unshift(text);
    this.feed = this.feed.slice(0, 5);
  },
  spawnEnemy() {
    const laneY = 410 + Math.random() * 26;
    this.enemies.push({
      x: 900,
      y: laneY,
      hp: 22 + this.wave * 5,
      shootAt: performance.now() + 900 + Math.random() * 1100,
      speed: 0.28 + this.wave * 0.025 + Math.random() * 0.09,
      pose: Math.random() * Math.PI * 2,
    });
  },
  spawnPickup(x, y) {
    this.pickups.push({ x, y, key: randomChoice(pickupTable), ttl: 1100 });
  },
  fireArrow() {
    if (!this.running || this.paused || this.player.shootCooldown > 0 || state.stamina < 4) return;
    const originX = this.player.x + 18;
    const originY = this.player.y - 44;
    const dx = this.pointer.x - originX;
    const dy = this.pointer.y - originY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 7.1;
    this.player.facing = dx >= 0 ? 1 : -1;
    this.arrows.push({ x: originX, y: originY, vx: (dx / dist) * speed, vy: (dy / dist) * speed, ttl: 120, tilt: 0 });
    this.player.shootCooldown = 28;
    state.stamina = clamp(state.stamina - 2.3, 0, 100);
  },
  collectNearby() {
    const pickupIndex = this.pickups.findIndex((pickup) => Math.abs(pickup.x - this.player.x) < 65);
    if (pickupIndex < 0) {
      this.log("No supply crate in reach.");
      return;
    }
    const pickup = this.pickups.splice(pickupIndex, 1)[0];
    ensureSupply(pickup.key, 1);
    registerStatusEffect("Field pickup", `${labelForSupply(pickup.key)} collected in arena.`);
    this.log(`Collected ${labelForSupply(pickup.key)}.`);
    render();
    saveState();
  },
  takeHit(projectile, source) {
    const region = mapHeightToRegion(projectile.y, 540);
    const severityHint = region.includes("Head") || Math.random() < 0.18 ? "critical" : region.includes("Chest") ? "major" : "minor";
    createInjury({ type: chooseInjuryType(region, severityHint), region, mode: MODE_TWOD, source });
    this.log(`${source} caused ${region.toLowerCase()} trauma.`);
  },
  update() {
    const now = performance.now();
    if (!this.running || this.paused) {
      this.draw();
      return;
    }
    this.survivalTime += 1 / 60;
    this.player.x = clamp(this.player.x + this.player.vx, 70, 420);
    if (this.player.dodge > 0) {
      this.player.dodge -= 1;
      this.player.x = clamp(this.player.x + this.player.facing * 4, 70, 450);
    }
    if (this.player.shootCooldown > 0) this.player.shootCooldown -= 1;
    state.stamina = clamp(state.stamina - 0.01 - this.enemies.length * 0.0008, 0, 100);

    this.spawnTimer -= 1;
    this.pickupTimer -= 1;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(78, 138 - this.wave * 5);
    }
    if (this.pickupTimer <= 0) {
      this.spawnPickup(520 + Math.random() * 320, 442);
      this.pickupTimer = 430;
    }

    this.arrows.forEach((arrow) => {
      arrow.x += arrow.vx;
      arrow.y += arrow.vy;
      arrow.vy += 0.09;
      arrow.tilt = Math.atan2(arrow.vy, arrow.vx);
      arrow.ttl -= 1;
    });
    this.enemyArrows.forEach((arrow) => {
      arrow.x += arrow.vx;
      arrow.y += arrow.vy;
      arrow.vy += 0.075;
      arrow.tilt = Math.atan2(arrow.vy, arrow.vx);
      arrow.ttl -= 1;
    });

    this.enemies.forEach((enemy) => {
      enemy.x -= enemy.speed;
      enemy.pose += 0.09;
      if (now > enemy.shootAt) {
        const ox = enemy.x - 10;
        const oy = enemy.y - 44;
        const px = this.player.x + 12;
        const py = this.player.y - 40;
        const dx = px - ox;
        const dy = py - oy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        this.enemyArrows.push({ x: ox, y: oy, vx: (dx / dist) * 5.5, vy: (dy / dist) * 5.2, ttl: 170, tilt: 0 });
        enemy.shootAt = now + 1600 + Math.random() * 1300;
      }
      if (enemy.x < this.player.x + 45) {
        this.takeHit({ y: enemy.y - 30 }, "Close-range impact");
        enemy.hp = 0;
      }
    });

    this.arrows.forEach((arrow) => {
      this.enemies.forEach((enemy) => {
        if (arrow.ttl > 0 && Math.abs(arrow.x - enemy.x) < 20 && Math.abs(arrow.y - (enemy.y - 45)) < 48) {
          enemy.hp -= 16;
          arrow.ttl = 0;
          if (enemy.hp <= 0) {
            this.score += 1;
            state.stats.twodWaveBest = Math.max(state.stats.twodWaveBest, this.score);
            this.corpses.push({ x: enemy.x, y: enemy.y, rot: (Math.random() - 0.5) * 0.9, ttl: 220 });
            if (Math.random() < 0.55) this.spawnPickup(enemy.x, 442);
          }
        }
      });
    });

    this.enemyArrows.forEach((arrow) => {
      const px = this.player.x + 12;
      const py = this.player.y - 42;
      if (arrow.ttl > 0 && Math.abs(arrow.x - px) < 18 && Math.abs(arrow.y - py) < 48) {
        arrow.ttl = 0;
        this.takeHit(arrow, "Enemy arrow");
      }
    });

    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.x > -30);
    this.arrows = this.arrows.filter((arrow) => arrow.ttl > 0 && arrow.x < 980 && arrow.y < 580 && arrow.y > -30);
    this.enemyArrows = this.enemyArrows.filter((arrow) => arrow.ttl > 0 && arrow.x > -40 && arrow.y < 580 && arrow.y > -40);
    this.pickups.forEach((pickup) => (pickup.ttl -= 1));
    this.pickups = this.pickups.filter((pickup) => pickup.ttl > 0);
    this.corpses.forEach((corpse) => (corpse.ttl -= 1));
    this.corpses = this.corpses.filter((corpse) => corpse.ttl > 0);

    if (this.score > 0 && this.score % 8 === 0) this.wave = 1 + Math.floor(this.score / 8);
    if (state.injuries.some((injury) => injury.severity === "critical")) {
      state.health = clamp(state.health - 0.08, 0, 100);
      checkForDeath("Untreated critical trauma in arena");
    } else if (state.injuries.length) {
      state.health = clamp(state.health - 0.02 * state.injuries.length, 0, 100);
    }
    recalcRequiredTreatment();
    this.draw();
  },
  drawHud(ctx) {
    ctx.fillStyle = "rgba(5,10,16,0.72)";
    ctx.fillRect(12, 12, 300, 114);
    ctx.fillStyle = "#eaf4ff";
    ctx.font = "bold 16px Segoe UI";
    ctx.fillText(`Wave ${this.wave}`, 24, 34);
    ctx.fillText(`Survived ${Math.floor(this.survivalTime)}s`, 118, 34);
    ctx.font = "13px Segoe UI";
    ctx.fillStyle = "#8ecde4";
    ctx.fillText(`Health ${Math.round(state.health)}   Stamina ${Math.round(state.stamina)}`, 24, 58);
    ctx.fillText(`Archer KOs ${this.score}   Injuries ${state.injuries.length}`, 24, 78);
    const supplyLine = Object.entries(state.collectedSupplies).filter(([, qty]) => qty > 0).slice(0, 3).map(([key, qty]) => `${supplyCatalog[key].short} x${qty}`).join(" | ") || "No supplies collected";
    const treatmentLine = state.requiredTreatment[0]
      ? `${state.requiredTreatment[0].injuryLabel} needs ${Object.entries(state.requiredTreatment[0].requiredItems).map(([k, q]) => `${supplyCatalog[k].short} x${q}`).join(", ")}`
      : "No active treatment requirement";
    ctx.fillStyle = "#d2dde9";
    ctx.fillText(supplyLine, 24, 100);
    ctx.fillText(treatmentLine, 24, 118);
  },
  draw() {
    const canvas = dom.twodCanvas;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, "#6a8db1");
    sky.addColorStop(1, "#2d4157");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#3f4e2f";
    ctx.fillRect(0, 410, width, 50);
    ctx.fillStyle = "#20251b";
    ctx.fillRect(0, 460, width, 80);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(120, 434, 80, 10);
    ctx.fillRect(720, 434, 80, 10);
    this.drawHud(ctx);
    this.corpses.forEach((corpse) => {
      ctx.save();
      ctx.translate(corpse.x, corpse.y + 8);
      ctx.rotate(corpse.rot);
      ctx.strokeStyle = "rgba(235, 239, 245, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -16, 8, 0, Math.PI * 2);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 12);
      ctx.moveTo(0, -2);
      ctx.lineTo(-14, 6);
      ctx.moveTo(0, -2);
      ctx.lineTo(15, 10);
      ctx.moveTo(0, 12);
      ctx.lineTo(-14, 22);
      ctx.moveTo(0, 12);
      ctx.lineTo(14, 26);
      ctx.stroke();
      ctx.restore();
    });
    this.pickups.forEach((pickup) => {
      ctx.fillStyle = pickup.key === "totem_of_revival" ? "#64f6ff" : pickup.key === "enchanted_golden_apple" ? "#d58eff" : "#f1c768";
      ctx.fillRect(pickup.x - 14, pickup.y - 18, 28, 28);
      ctx.fillStyle = "#08111a";
      ctx.font = "11px Segoe UI";
      ctx.fillText("+", pickup.x - 4, pickup.y + 2);
    });
    this.arrows.forEach((arrow) => {
      ctx.strokeStyle = "#f7efe3";
      ctx.lineWidth = 3;
      ctx.save();
      ctx.translate(arrow.x, arrow.y);
      ctx.rotate(arrow.tilt);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-20, 0);
      ctx.stroke();
      ctx.restore();
    });
    this.enemyArrows.forEach((arrow) => {
      ctx.strokeStyle = "#ff8e8b";
      ctx.lineWidth = 3;
      ctx.save();
      ctx.translate(arrow.x, arrow.y);
      ctx.rotate(arrow.tilt);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, 0);
      ctx.stroke();
      ctx.restore();
    });
    this.enemies.forEach((enemy) => {
      const sway = Math.sin(enemy.pose) * 5;
      ctx.strokeStyle = "#ffddb4";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y - 74, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y - 62);
      ctx.lineTo(enemy.x, enemy.y - 15);
      ctx.moveTo(enemy.x, enemy.y - 44);
      ctx.lineTo(enemy.x - 16, enemy.y - 22 + sway * 0.2);
      ctx.moveTo(enemy.x, enemy.y - 42);
      ctx.lineTo(enemy.x + 20, enemy.y - 32 - sway * 0.15);
      ctx.moveTo(enemy.x, enemy.y - 15);
      ctx.lineTo(enemy.x - 16, enemy.y + 18);
      ctx.moveTo(enemy.x, enemy.y - 15);
      ctx.lineTo(enemy.x + 16, enemy.y + 20);
      ctx.stroke();
      ctx.strokeStyle = "#eab062";
      ctx.beginPath();
      ctx.arc(enemy.x - 10, enemy.y - 40, 16, 1.5, 3.9);
      ctx.stroke();
      ctx.fillStyle = "#f15a5a";
      ctx.fillRect(enemy.x - 16, enemy.y - 95, 32, 5);
      ctx.fillStyle = "#86f0a2";
      ctx.fillRect(enemy.x - 16, enemy.y - 95, 32 * clamp(enemy.hp / (22 + this.wave * 5), 0, 1), 5);
    });
    ctx.strokeStyle = "#eef6ff";
      ctx.lineWidth = 4;
    const px = this.player.x;
    const py = this.player.y;
    ctx.beginPath();
    ctx.arc(px, py - 78, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, py - 66);
    ctx.lineTo(px, py - 18);
    ctx.moveTo(px, py - 42);
    ctx.lineTo(px - 15, py - 20);
    ctx.moveTo(px, py - 42);
    ctx.lineTo(px + 16, py - 16);
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px - 18, py + 20);
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px + 18, py + 20);
    ctx.stroke();
    ctx.strokeStyle = "#ffb760";
    ctx.beginPath();
    ctx.arc(px + 12, py - 34, 20, -1.25, 1.15);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px + 16, py - 40);
    ctx.lineTo(this.pointer.x, this.pointer.y);
    ctx.stroke();
    ctx.setLineDash([]);
  },
};

const fps = {
  running: false,
  paused: false,
  lane: 1,
  crosshair: { x: 480, y: 260 },
  enemies: [],
  crates: [],
  bolts: [],
  statusFeed: [],
  threatCount: 0,
  score: 0,
  spawnTimer: 0,
  crateTimer: 0,
  reset() {
    this.running = false;
    this.paused = false;
    this.lane = 1;
    this.enemies = [];
    this.crates = [];
    this.bolts = [];
    this.statusFeed = [];
    this.threatCount = 0;
    this.score = 0;
    this.spawnTimer = 0;
    this.crateTimer = 0;
    dom.fpsStatus.textContent = "Simulation idle";
  },
  start() {
    this.reset();
    this.running = true;
    state.mode = MODE_FPS;
    state.stats.fpsRuns += 1;
    this.push("Sweep active. Neutralize threats and collect supplies.");
    dom.fpsStatus.textContent = "Hostile contacts detected";
    render();
    saveState();
  },
  push(text) {
    this.statusFeed.unshift(text);
    this.statusFeed = this.statusFeed.slice(0, 5);
  },
  spawnEnemy() {
    this.enemies.push({
      lane: Math.floor(Math.random() * 3),
      z: 1.9,
      hp: 30 + Math.random() * 12,
      speed: 0.0025 + Math.random() * 0.0015,
      fireAt: performance.now() + 1200 + Math.random() * 1000,
    });
  },
  spawnCrate() {
    this.crates.push({
      lane: Math.floor(Math.random() * 3),
      z: 1.5,
      speed: 0.0017 + Math.random() * 0.0012,
      key: randomChoice(pickupTable),
    });
  },
  collectNearest() {
    const crateIndex = this.crates.findIndex((crate) => crate.lane === this.lane && crate.z < 0.55);
    if (crateIndex < 0) {
      this.push("No nearby crate to collect.");
      return;
    }
    const crate = this.crates.splice(crateIndex, 1)[0];
    ensureSupply(crate.key, 1);
    registerStatusEffect("Field pickup", `${labelForSupply(crate.key)} recovered in FPS mode.`);
    this.push(`Collected ${labelForSupply(crate.key)}.`);
    render();
    saveState();
  },
  fireAt(x, y) {
    if (!this.running || this.paused || state.stamina < 3) return;
    this.crosshair = { x, y };
    state.stamina = clamp(state.stamina - 2.5, 0, 100);
    const hit = this.enemies.find((enemy) => enemy.screen && Math.hypot(enemy.screen.x - x, enemy.screen.y - y) < enemy.screen.radius);
    if (hit) {
      hit.hp -= 22;
      this.push("Threat hit.");
      if (hit.hp <= 0) {
        this.score += 1;
        state.stats.fpsThreatsNeutralized += 1;
        if (Math.random() < 0.65) this.spawnCrate();
      }
    } else {
      this.push("Shot missed.");
    }
    render();
    saveState();
  },
  takeHit(region, source) {
    const severity = region.includes("Head") ? "critical" : region.includes("Chest") ? "major" : "minor";
    createInjury({ type: chooseInjuryType(region, severity), region, mode: MODE_FPS, source });
    this.push(`${source} inflicted ${region.toLowerCase()} trauma.`);
  },
  update() {
    if (!this.running || this.paused) {
      this.draw();
      return;
    }
    state.stamina = clamp(state.stamina - 0.014 - this.enemies.length * 0.001, 0, 100);
    this.spawnTimer -= 1;
    this.crateTimer -= 1;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = 90;
    }
    if (this.crateTimer <= 0) {
      this.spawnCrate();
      this.crateTimer = 240;
    }
    this.enemies.forEach((enemy) => {
      enemy.z -= enemy.speed;
      if (performance.now() > enemy.fireAt && enemy.z < 1.2) {
        enemy.fireAt = performance.now() + 1300 + Math.random() * 1000;
        this.bolts.push({ lane: enemy.lane, z: enemy.z, speed: 0.02 });
      }
    });
    this.crates.forEach((crate) => { crate.z -= crate.speed; });
    this.bolts.forEach((bolt) => { bolt.z -= bolt.speed; });
    this.bolts.forEach((bolt) => {
      if (bolt.z <= 0.15 && bolt.lane === this.lane) {
        this.takeHit(randomChoice(["Head / neck", "Chest", "Abdomen / arm", "Leg"]), "Incoming ballistic impact");
        bolt.z = -1;
      }
    });
    this.enemies.forEach((enemy) => {
      if (enemy.z <= 0.18) {
        this.takeHit(enemy.lane === this.lane ? "Chest" : "Leg", "Close hostile breach");
        enemy.hp = 0;
      }
    });
    if (state.injuries.some((injury) => injury.severity === "critical")) {
      state.health = clamp(state.health - 0.1, 0, 100);
      checkForDeath("Untreated critical trauma in FPS mode");
    } else if (state.injuries.length) {
      state.health = clamp(state.health - 0.025 * state.injuries.length, 0, 100);
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.z > 0);
    this.crates = this.crates.filter((crate) => crate.z > 0.06);
    this.bolts = this.bolts.filter((bolt) => bolt.z > 0);
    this.threatCount = this.enemies.length;
    recalcRequiredTreatment();
    this.draw();
  },
  drawOverlay(ctx) {
    ctx.fillStyle = "rgba(5,10,16,0.7)";
    ctx.fillRect(14, 14, 324, 112);
    ctx.fillStyle = "#eff5ff";
    ctx.font = "bold 16px Segoe UI";
    ctx.fillText(`Lane ${this.lane + 1} / 3`, 26, 36);
    ctx.fillText(`Threats ${this.threatCount}`, 148, 36);
    ctx.font = "13px Segoe UI";
    ctx.fillStyle = "#8ecde4";
    ctx.fillText(`Health ${Math.round(state.health)}   Stamina ${Math.round(state.stamina)}`, 26, 58);
    ctx.fillText(state.requiredTreatment[0] ? `Treat: ${state.requiredTreatment[0].injuryLabel}` : "No active treatment queue", 26, 82);
    const supplyLine = Object.entries(state.collectedSupplies).filter(([, qty]) => qty > 0).slice(0, 3).map(([key, qty]) => `${supplyCatalog[key].short} x${qty}`).join(" | ") || "No supplies collected";
    ctx.fillText(supplyLine, 26, 104);
  },
  draw() {
    const canvas = dom.fpsCanvas;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.56);
    sky.addColorStop(0, "#485f75");
    sky.addColorStop(1, "#1c2835");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.58);
    const floor = ctx.createLinearGradient(0, height * 0.58, 0, height);
    floor.addColorStop(0, "#17212b");
    floor.addColorStop(1, "#060a10");
    ctx.fillStyle = floor;
    ctx.fillRect(0, height * 0.58, width, height * 0.42);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(width / 2, 280);
      ctx.lineTo(i * 140, height);
      ctx.stroke();
    }
    this.drawOverlay(ctx);
    this.crates.forEach((crate) => {
      const sx = [260, 480, 700][crate.lane];
      const scale = 1 / Math.max(crate.z, 0.18);
      const size = 22 * scale;
      const y = 425 + (1 - Math.min(scale / 4.2, 1)) * 70;
      ctx.fillStyle = crate.key === "totem_of_revival" ? "#6befff" : crate.key === "enchanted_golden_apple" ? "#d387ff" : "#f4ca73";
      ctx.fillRect(sx - size / 2, y - size / 2, size, size);
      crate.screen = { x: sx, y, radius: size / 2 };
    });
    this.enemies.forEach((enemy) => {
      const sx = [260, 480, 700][enemy.lane];
      const scale = 1 / Math.max(enemy.z, 0.18);
      const body = 44 * scale;
      const y = 420;
      ctx.strokeStyle = "#e8edf6";
      ctx.lineWidth = Math.max(2, body * 0.07);
      ctx.beginPath();
      ctx.arc(sx, y - body * 1.35, body * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, y - body * 1.1);
      ctx.lineTo(sx, y - body * 0.28);
      ctx.moveTo(sx, y - body * 0.9);
      ctx.lineTo(sx - body * 0.38, y - body * 0.45);
      ctx.moveTo(sx, y - body * 0.9);
      ctx.lineTo(sx + body * 0.44, y - body * 0.5);
      ctx.moveTo(sx, y - body * 0.28);
      ctx.lineTo(sx - body * 0.25, y + body * 0.35);
      ctx.moveTo(sx, y - body * 0.28);
      ctx.lineTo(sx + body * 0.25, y + body * 0.35);
      ctx.stroke();
      ctx.fillStyle = "#ff8e8b";
      ctx.fillRect(sx - 16, y - body * 1.7, 32, 5);
      ctx.fillStyle = "#7cf0a6";
      ctx.fillRect(sx - 16, y - body * 1.7, 32 * clamp(enemy.hp / 42, 0, 1), 5);
      enemy.screen = { x: sx, y: y - body * 0.9, radius: body * 0.55 };
    });
    this.bolts.forEach((bolt) => {
      const sx = [260, 480, 700][bolt.lane];
      const y = 300 + (1 - bolt.z) * 220;
      ctx.strokeStyle = "#ff6e72";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + 18);
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.crosshair.x - 12, this.crosshair.y);
    ctx.lineTo(this.crosshair.x + 12, this.crosshair.y);
    ctx.moveTo(this.crosshair.x, this.crosshair.y - 12);
    ctx.lineTo(this.crosshair.x, this.crosshair.y + 12);
    ctx.stroke();
  },
};

function renderTwodSidebar() {
  dom.twodEvents.innerHTML = [
    `Wave ${twoD.wave}`,
    `Archer KOs ${twoD.score}`,
    `Enemy archers ${twoD.enemies.length}`,
    ...twoD.feed,
  ]
    .slice(0, 5)
    .map((item) => `<article class="injury-card"><p>${item}</p></article>`)
    .join("");
}

function renderFpsSidebar() {
  const lines = [
    `Threats active: ${fps.threatCount}`,
    `Neutralized: ${fps.score}`,
    state.requiredTreatment[0] ? `Priority treatment: ${state.requiredTreatment[0].injuryLabel}` : "No urgent treatment queued",
    ...fps.statusFeed,
  ];
  dom.fpsObjectives.innerHTML = lines
    .slice(0, 5)
    .map((item) => `<article class="injury-card"><p>${item}</p></article>`)
    .join("");
  dom.fpsStatus.textContent = fps.running ? (fps.paused ? "Simulation paused" : `Threats live: ${fps.threatCount}`) : "Simulation idle";
  dom.twodStatus.textContent = twoD.running ? (twoD.paused ? "Arena paused" : `Wave ${twoD.wave} active`) : "Arena idle";
}

function switchMode(mode) {
  state.mode = mode;
  render();
  saveState();
}

function bindModeButtons() {
  dom.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });
}

function bindCanvasEvents() {
  dom.twodCanvas.addEventListener("mousemove", (event) => {
    const rect = dom.twodCanvas.getBoundingClientRect();
    twoD.pointer.x = ((event.clientX - rect.left) / rect.width) * dom.twodCanvas.width;
    twoD.pointer.y = ((event.clientY - rect.top) / rect.height) * dom.twodCanvas.height;
  });
  dom.twodCanvas.addEventListener("click", () => {
    state.mode = MODE_TWOD;
    twoD.fireArrow();
  });
  dom.fpsCanvas.addEventListener("mousemove", (event) => {
    const rect = dom.fpsCanvas.getBoundingClientRect();
    fps.crosshair = {
      x: ((event.clientX - rect.left) / rect.width) * dom.fpsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * dom.fpsCanvas.height,
    };
  });
  dom.fpsCanvas.addEventListener("click", (event) => {
    const rect = dom.fpsCanvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * dom.fpsCanvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * dom.fpsCanvas.height;
    state.mode = MODE_FPS;
    fps.fireAt(x, y);
  });
}

function bindControls() {
  dom.startTwod.addEventListener("click", () => twoD.start());
  dom.pauseTwod.addEventListener("click", () => {
    twoD.paused = !twoD.paused;
    renderTwodSidebar();
  });
  dom.startFps.addEventListener("click", () => fps.start());
  dom.pauseFps.addEventListener("click", () => {
    fps.paused = !fps.paused;
    renderFpsSidebar();
  });
  dom.attemptTreatment.addEventListener("click", attemptTreatment);
  dom.restButton.addEventListener("click", restAndStabilize);
  dom.resetProfile.addEventListener("click", resetProfile);
  dom.openLatestReport.addEventListener("click", () => openDeathReport());
  dom.twodReportButton.addEventListener("click", () => openDeathReport());
  dom.closeModal.addEventListener("click", () => dom.deathModal.close());
  dom.fullscreenTwod.addEventListener("click", () => dom.twodCanvas.requestFullscreen?.());
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "r") {
      attemptTreatment();
      return;
    }
    if (key === "e") {
      if (state.mode === MODE_TWOD) twoD.collectNearby();
      else fps.collectNearest();
      return;
    }
    if (key === "a") {
      if (state.mode === MODE_TWOD) twoD.player.vx = -3.2;
      else fps.lane = clamp(fps.lane - 1, 0, 2);
      return;
    }
    if (key === "d") {
      if (state.mode === MODE_TWOD) twoD.player.vx = 3.2;
      else fps.lane = clamp(fps.lane + 1, 0, 2);
      return;
    }
    if (key === "w") {
      state.stamina = clamp(state.stamina - 1.4, 0, 100);
      return;
    }
    if (key === " ") {
      if (state.mode === MODE_TWOD) {
        twoD.player.dodge = 12;
        state.stamina = clamp(state.stamina - 8, 0, 100);
      }
      event.preventDefault();
    }
  });
  document.addEventListener("keyup", (event) => {
    if (state.mode === MODE_TWOD && ["a", "d"].includes(event.key.toLowerCase())) {
      twoD.player.vx = 0;
    }
  });
}

function applyLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1") {
    window.localStorage.removeItem(SAVE_KEY);
    state = makeGuestProfile();
  }
  if (params.get("mode") === "fps") state.mode = MODE_FPS;
  if (params.get("mode") === "twod") state.mode = MODE_TWOD;
  if (params.get("autostart") === "1") {
    if (params.get("mode") === "twod") {
      state.mode = MODE_TWOD;
      twoD.start();
    } else {
      state.mode = MODE_FPS;
      fps.start();
    }
  }
}

function tick() {
  pruneStatusEffects();
  if (state.mode === MODE_TWOD) twoD.update();
  else fps.update();
  renderProfile();
  renderTreatments();
  renderStatusEffects();
  renderTwodSidebar();
  renderFpsSidebar();
  window.requestAnimationFrame(tick);
}

mountFoodButtons();
bindModeButtons();
bindCanvasEvents();
bindControls();
bindKeyboard();
renderUpgrades();
recalcRequiredTreatment();
applyLaunchParams();
render();
twoD.draw();
fps.draw();
tick();
