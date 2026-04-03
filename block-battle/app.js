(function () {
  const THREE = window.THREE;
  const shared = window.BlockBattleShared;
  if (!THREE || !shared) {
    const fallback = document.querySelector("#fallback-message");
    if (fallback) {
      fallback.hidden = false;
    }
    return;
  }

  const { BLOCK_DEFS, ITEM_DEFS, MODE_DEFS, TERRAIN_PRESETS } = shared;

  const refs = {
    connectionStatus: document.querySelector("#connection-status"),
    playerName: document.querySelector("#player-name"),
    roomLabel: document.querySelector("#room-label"),
    modeSelect: document.querySelector("#mode-select"),
    terrainSelect: document.querySelector("#terrain-select"),
    maxPlayers: document.querySelector("#max-players"),
    targetPopulation: document.querySelector("#target-population"),
    createRoom: document.querySelector("#create-room"),
    practicePrivate: document.querySelector("#practice-private"),
    practicePublic: document.querySelector("#practice-public"),
    refreshServers: document.querySelector("#refresh-servers"),
    serverCount: document.querySelector("#server-count"),
    serverList: document.querySelector("#server-list"),
    serverEmptyState: document.querySelector("#server-empty-state"),
    serverCardTemplate: document.querySelector("#server-card-template"),
    modeLabel: document.querySelector("#mode-label"),
    phaseLabel: document.querySelector("#phase-label"),
    healthLabel: document.querySelector("#health-label"),
    viewLabel: document.querySelector("#view-label"),
    roomTitle: document.querySelector("#room-title"),
    roomSubtitle: document.querySelector("#room-subtitle"),
    playersBadge: document.querySelector("#players-badge"),
    timerBadge: document.querySelector("#timer-badge"),
    killFeed: document.querySelector("#kill-feed"),
    scoreboard: document.querySelector("#scoreboard"),
    canvas: document.querySelector("#game-canvas"),
    stageOverlay: document.querySelector("#stage-overlay"),
    stageState: document.querySelector("#stage-state"),
    stageHeadline: document.querySelector("#stage-headline"),
    stageCopy: document.querySelector("#stage-copy"),
    fallbackMessage: document.querySelector("#fallback-message"),
    damageFlash: document.querySelector("#damage-flash"),
    touchControls: document.querySelector("#touch-controls"),
    moveStick: document.querySelector("#move-stick"),
    moveThumb: document.querySelector("#move-thumb"),
    aimStick: document.querySelector("#aim-stick"),
    aimThumb: document.querySelector("#aim-thumb"),
    touchJump: document.querySelector("#touch-jump"),
    touchFire: document.querySelector("#touch-fire"),
    touchPlace: document.querySelector("#touch-place"),
    touchBreak: document.querySelector("#touch-break"),
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: refs.canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#7fc7ff");
  scene.fog = new THREE.Fog("#8fc7ff", 16, 86);

  const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 220);
  const hemi = new THREE.HemisphereLight("#f1fbff", "#3e5234", 1.32);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff4c8", 1.35);
  sun.position.set(18, 28, 14);
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight("#a3d7ff", 0.35);
  rimLight.position.set(-12, 10, -18);
  scene.add(rimLight);

  const worldGroup = new THREE.Group();
  const playerGroup = new THREE.Group();
  const projectileGroup = new THREE.Group();
  const hazardGroup = new THREE.Group();
  scene.add(worldGroup, playerGroup, projectileGroup, hazardGroup);

  const selectionMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.03, 1.03, 1.03),
    new THREE.MeshBasicMaterial({ color: "#ffd86a", wireframe: true, transparent: true, opacity: 0.78 })
  );
  selectionMesh.visible = false;
  scene.add(selectionMesh);

  const state = {
    servers: [],
    snapshot: null,
    socket: null,
    connected: false,
    roomId: null,
    uiStatus: "offline",
    runtimeConfig: {
      apiBaseUrl: "",
      wsBaseUrl: "",
    },
    keys: new Set(),
    mouseDown: false,
    look: { yaw: 0, pitch: 0, seeded: false },
    blockOrder: ["dirt", "stone", "snow", "wood"],
    weaponOrder: ["blaster", "scatter", "pulse", "blade"],
    cameraMode: "first",
    blockMap: new Map(),
    chunkBlockKeys: new Map(),
    blockMeshes: new Map(),
    playerMeshes: new Map(),
    projectileMeshes: [],
    hazardMeshes: [],
    hovered: null,
    healthPulseTimeout: null,
    touch: {
      enabled:
        window.matchMedia("(pointer: coarse)").matches
        || ("ontouchstart" in window)
        || Number(navigator.maxTouchPoints || 0) > 0,
      move: { active: false, pointerId: null, x: 0, y: 0, dx: 0, dy: 0 },
      aim: { active: false, pointerId: null, x: 0, y: 0, dx: 0, dy: 0 },
      fire: false,
    },
    lastFetchFailed: false,
  };

  if (state.touch.enabled) {
    document.body.classList.add("touch-ui");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeBaseUrl(value) {
    return (value || "").replace(/\/+$/, "");
  }

  function apiUrl(pathname) {
    return `${normalizeBaseUrl(state.runtimeConfig.apiBaseUrl)}${pathname}`;
  }

  function wsUrl(pathname, params) {
    const rawBase = normalizeBaseUrl(state.runtimeConfig.wsBaseUrl)
      || normalizeBaseUrl(state.runtimeConfig.apiBaseUrl)
      || location.origin;
    const socketBase = rawBase.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
    return `${socketBase}${pathname}${params ? `?${params}` : ""}`;
  }

  function setStatus(text, connected, stateName = connected ? "live" : "offline") {
    state.uiStatus = stateName;
    refs.connectionStatus.textContent = text;
    refs.connectionStatus.dataset.state = stateName;
    updateStagePresentation();
  }

  function updateStagePresentation() {
    const hasSnapshot = Boolean(state.snapshot?.you);
    refs.stageOverlay.classList.toggle("is-hidden", hasSnapshot);

    refs.stageState.textContent =
      state.uiStatus === "loading" ? "Loading rooms" :
      state.uiStatus === "empty" ? "Bots standing by" :
      state.uiStatus === "connecting" ? "Joining room" :
      state.uiStatus === "live" ? "Match live" :
      "Ready for battle";

    if (hasSnapshot) {
      refs.stageHeadline.textContent = "World loaded.";
      refs.stageCopy.textContent = "The live 3D voxel map has taken over the viewport. Build, bridge, and fight.";
      return;
    }

    if (state.uiStatus === "empty") {
      refs.stageHeadline.textContent = "No humans online. Bots will fill the room.";
      refs.stageCopy.textContent = "Create a room or jump into a public one. Bots stay active so the arena never feels empty.";
      return;
    }

    if (state.uiStatus === "connecting") {
      refs.stageHeadline.textContent = "Connecting to the voxel arena.";
      refs.stageCopy.textContent = "Chunks, players, and bots will appear here as soon as the room snapshot arrives.";
      return;
    }

    refs.stageHeadline.textContent = "Pick a room and drop into the voxel arena.";
    refs.stageCopy.textContent = "Desktop gets mouse-and-keyboard controls, mobile gets dual sticks and action buttons.";
  }

  function fillSelect(select, items) {
    select.innerHTML = "";
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function bootstrapSelects() {
    fillSelect(refs.modeSelect, Object.values(MODE_DEFS));
    fillSelect(refs.terrainSelect, Object.values(TERRAIN_PRESETS));
  }

  function fallbackStatusText() {
    return state.lastFetchFailed ? "Live host offline" : "Bots ready";
  }

  function flashDamage() {
    refs.damageFlash.classList.add("active");
    clearTimeout(state.healthPulseTimeout);
    state.healthPulseTimeout = window.setTimeout(() => {
      refs.damageFlash.classList.remove("active");
    }, 160);
  }

  async function loadRuntimeConfig() {
    try {
      const response = await fetch("/api/block-battle-config", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      state.runtimeConfig.apiBaseUrl = normalizeBaseUrl(payload.apiBaseUrl || "");
      state.runtimeConfig.wsBaseUrl = normalizeBaseUrl(payload.wsBaseUrl || "");
    } catch (_error) {
      state.runtimeConfig.apiBaseUrl = "";
      state.runtimeConfig.wsBaseUrl = "";
    }
  }

  async function fetchServers() {
    setStatus("Loading", false, "loading");
    try {
      const response = await fetch(apiUrl("/block-battle/api/servers"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Server list failed with ${response.status}`);
      }
      const payload = await response.json();
      state.lastFetchFailed = false;
      state.servers = payload.servers || [];
      fillSelect(refs.modeSelect, payload.modeOptions?.length ? payload.modeOptions : Object.values(MODE_DEFS));
      fillSelect(refs.terrainSelect, payload.terrainOptions?.length ? payload.terrainOptions : Object.values(TERRAIN_PRESETS));
      renderServers();
      if (!state.connected) {
        setStatus(
          state.servers.length ? "Offline" : fallbackStatusText(),
          false,
          state.servers.length ? "offline" : (state.lastFetchFailed ? "offline" : "empty")
        );
      }
    } catch (_error) {
      state.lastFetchFailed = true;
      state.servers = [];
      bootstrapSelects();
      renderServers();
      refs.serverCount.textContent = "Live host unavailable";
      refs.serverEmptyState.hidden = false;
      setStatus("Host offline", false, "offline");
    }
  }

  function renderServers() {
    refs.serverList.innerHTML = "";
    refs.serverCount.textContent = `${state.servers.length} live room${state.servers.length === 1 ? "" : "s"}`;
    refs.serverEmptyState.hidden = state.servers.length > 0;
    if (!state.servers.length) {
      const empty = document.createElement("p");
      empty.className = "microcopy";
      empty.textContent = state.lastFetchFailed
        ? "Live server list is unreachable right now. Mode and terrain are still available locally."
        : "No public rooms right now. Create one and bots will fill the lobby.";
      refs.serverList.appendChild(empty);
      return;
    }
    state.servers.forEach((server) => {
      const fragment = refs.serverCardTemplate.content.cloneNode(true);
      const button = fragment.querySelector(".server-card");
      const badge = fragment.querySelector(".server-badge");
      fragment.querySelector(".server-title").textContent = server.label;
      if (server.isPractice) {
        badge.hidden = false;
        badge.textContent = "Practice";
      }
      fragment.querySelector(".server-meta").textContent = `${server.modeLabel} | ${server.terrainLabel} | ${server.humans} human / ${server.bots} bot`;
      button.addEventListener("click", () => connectToRoom(server.id));
      refs.serverList.appendChild(fragment);
    });
  }

  function closeSocket() {
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
  }

  function connectToRoom(roomId) {
    closeSocket();
    state.roomId = roomId;
    const safeName = encodeURIComponent((refs.playerName.value || "Guest Raider").trim().slice(0, 18));
    const socket = new WebSocket(wsUrl("/block-battle/ws", `room=${encodeURIComponent(roomId)}&name=${safeName}`));
    state.socket = socket;
    setStatus("Connecting", false, "connecting");

    socket.addEventListener("open", () => {
      state.connected = true;
      setStatus("Live", true, "live");
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "snapshot") {
        applySnapshot(payload);
      }
    });

    socket.addEventListener("close", () => {
      state.connected = false;
      setStatus(
        state.servers.length ? "Offline" : fallbackStatusText(),
        false,
        state.servers.length ? "offline" : (state.lastFetchFailed ? "offline" : "empty")
      );
    });

    socket.addEventListener("error", () => {
      state.connected = false;
      setStatus("Socket error", false, "offline");
    });
  }

  async function createRoom(overrides = {}) {
    const isPractice = overrides.isPractice === true;
    const visibility = overrides.visibility === "private" ? "private" : "public";
    const defaultLabel = isPractice
      ? `${visibility === "private" ? "Private Practice" : "Public Practice"} / ${refs.modeSelect.selectedOptions[0]?.textContent || "Arena"}`
      : "";
    const targetPopulation = isPractice
      ? Math.max(2, Math.min(Number(refs.targetPopulation.value) || 6, Number(refs.maxPlayers.value) || 8))
      : Number(refs.targetPopulation.value);
    const payload = {
      label: (refs.roomLabel.value.trim() || defaultLabel).slice(0, 32),
      modeId: refs.modeSelect.value,
      terrainId: refs.terrainSelect.value,
      maxPlayers: Number(refs.maxPlayers.value),
      targetPopulation,
      botFill: true,
      isPractice,
      visibility,
    };
    try {
      const response = await fetch(apiUrl("/block-battle/api/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Room creation failed with ${response.status}`);
      }
      const roomPayload = await response.json();
      await fetchServers();
      connectToRoom(roomPayload.room.id);
    } catch (_error) {
      state.lastFetchFailed = true;
      refs.serverCount.textContent = "Live host unavailable";
      refs.serverEmptyState.hidden = false;
      refs.roomSubtitle.textContent = `${isPractice ? "Practice launch" : "Room creation"} needs the live host. Controls and selectors are ready while reconnecting.`;
      setStatus("Host offline", false, "offline");
    }
  }

  function pixelTexture(painter) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    painter(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function fillNoise(ctx, width, height, base, accents) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    accents.forEach((accent) => {
      ctx.fillStyle = accent.color;
      for (let y = 0; y < height; y += accent.stepY) {
        for (let x = (y / accent.stepY) % 2 === 0 ? 0 : accent.offset; x < width; x += accent.stepX) {
          ctx.fillRect(x, y, accent.size, accent.size);
        }
      }
    });
  }

  function makeFaceTexture(blockId, face) {
    return pixelTexture((ctx, width, height) => {
      if (blockId === "grass" && face === "top") {
        fillNoise(ctx, width, height, "#69b54b", [
          { color: "#7bc55b", stepX: 8, stepY: 8, offset: 4, size: 4 },
          { color: "#4a9234", stepX: 10, stepY: 10, offset: 2, size: 3 },
        ]);
        return;
      }
      if (blockId === "grass" && face === "side") {
        fillNoise(ctx, width, height, "#80593a", [
          { color: "#97694a", stepX: 8, stepY: 8, offset: 4, size: 4 },
          { color: "#6b4326", stepX: 12, stepY: 10, offset: 2, size: 3 },
        ]);
        ctx.fillStyle = "#6fbe4f";
        ctx.fillRect(0, 0, width, 8);
        ctx.fillStyle = "#88d267";
        ctx.fillRect(0, 8, width, 3);
        return;
      }
      if (blockId === "dirt") {
        fillNoise(ctx, width, height, "#80593a", [
          { color: "#97694a", stepX: 8, stepY: 8, offset: 4, size: 4 },
          { color: "#6b4326", stepX: 12, stepY: 10, offset: 2, size: 3 },
        ]);
        return;
      }
      if (blockId === "stone" || blockId === "basalt") {
        fillNoise(ctx, width, height, blockId === "stone" ? "#8993a2" : "#4d4452", [
          { color: blockId === "stone" ? "#a3acb8" : "#615665", stepX: 8, stepY: 8, offset: 4, size: 4 },
          { color: blockId === "stone" ? "#6b7480" : "#372d3d", stepX: 12, stepY: 10, offset: 2, size: 3 },
        ]);
        return;
      }
      if (blockId === "sand") {
        fillNoise(ctx, width, height, "#d9c37e", [
          { color: "#ead79a", stepX: 8, stepY: 8, offset: 4, size: 3 },
          { color: "#c6ae6d", stepX: 10, stepY: 10, offset: 2, size: 2 },
        ]);
        return;
      }
      if (blockId === "snow") {
        fillNoise(ctx, width, height, face === "top" ? "#eef8ff" : "#dce7f5", [
          { color: "#ffffff", stepX: 10, stepY: 10, offset: 3, size: 3 },
          { color: "#cbd9ee", stepX: 12, stepY: 12, offset: 2, size: 2 },
        ]);
        return;
      }
      if (blockId === "wood") {
        fillNoise(ctx, width, height, face === "top" ? "#af7c49" : "#916338", [
          { color: "#704820", stepX: 8, stepY: 32, offset: 4, size: 3 },
          { color: "#c0915c", stepX: 12, stepY: 12, offset: 2, size: 2 },
        ]);
        if (face === "top") {
          ctx.strokeStyle = "#704820";
          ctx.lineWidth = 2;
          ctx.strokeRect(5, 5, width - 10, height - 10);
        }
        return;
      }
      if (blockId === "leaf") {
        fillNoise(ctx, width, height, "#53954b", [
          { color: "#6ab85f", stepX: 8, stepY: 8, offset: 4, size: 3 },
          { color: "#407740", stepX: 12, stepY: 10, offset: 2, size: 2 },
        ]);
        return;
      }
      if (blockId === "lucky") {
        fillNoise(ctx, width, height, "#ffd457", [
          { color: "#ffea96", stepX: 8, stepY: 8, offset: 4, size: 3 },
          { color: "#e0a33e", stepX: 12, stepY: 12, offset: 2, size: 2 },
        ]);
        ctx.fillStyle = "#6a4300";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", width / 2, height / 2 + 1);
        return;
      }
      fillNoise(ctx, width, height, "#ffffff", [
        { color: "#dddddd", stepX: 8, stepY: 8, offset: 4, size: 3 },
      ]);
    });
  }

  const blockMaterialCache = new Map();

  function materialsForBlock(blockId) {
    if (blockMaterialCache.has(blockId)) {
      return blockMaterialCache.get(blockId);
    }
    const sideTexture = makeFaceTexture(blockId, "side");
    const topTexture = makeFaceTexture(blockId, "top");
    const bottomTexture = makeFaceTexture(blockId, "bottom");
    const materials = [
      new THREE.MeshLambertMaterial({ map: sideTexture, flatShading: true }),
      new THREE.MeshLambertMaterial({ map: sideTexture.clone(), flatShading: true }),
      new THREE.MeshLambertMaterial({ map: topTexture, flatShading: true }),
      new THREE.MeshLambertMaterial({ map: bottomTexture, flatShading: true }),
      new THREE.MeshLambertMaterial({ map: sideTexture.clone(), flatShading: true }),
      new THREE.MeshLambertMaterial({ map: sideTexture.clone(), flatShading: true }),
    ];
    blockMaterialCache.set(blockId, materials);
    return materials;
  }

  function createBlockMesh(block) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialsForBlock(block.blockId));
    mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.block = { x: block.x, y: block.y, z: block.z, blockId: block.blockId };
    return mesh;
  }

  function ensureBlockMesh(block) {
    const key = `${block.x},${block.y},${block.z}`;
    const existing = state.blockMeshes.get(key);
    if (existing && existing.userData.block.blockId === block.blockId) {
      return;
    }
    if (existing) {
      worldGroup.remove(existing);
      state.blockMeshes.delete(key);
    }
    const mesh = createBlockMesh(block);
    worldGroup.add(mesh);
    state.blockMeshes.set(key, mesh);
  }

  function removeBlockKey(key) {
    const mesh = state.blockMeshes.get(key);
    if (mesh) {
      worldGroup.remove(mesh);
      state.blockMeshes.delete(key);
    }
    state.blockMap.delete(key);
  }

  function applyChunk(chunk) {
    const chunkId = `${chunk.coord.x},${chunk.coord.y},${chunk.coord.z}`;
    const oldKeys = state.chunkBlockKeys.get(chunkId) || [];
    oldKeys.forEach(removeBlockKey);
    const nextKeys = [];
    chunk.blocks.forEach((block) => {
      const key = `${block.x},${block.y},${block.z}`;
      state.blockMap.set(key, block);
      nextKeys.push(key);
      ensureBlockMesh(block);
    });
    state.chunkBlockKeys.set(chunkId, nextKeys);
  }

  function createAvatar(player) {
    const group = new THREE.Group();
    const skinMaterial = new THREE.MeshLambertMaterial({
      color: player.isBot ? "#ffd0d8" : "#f7f0d0",
      flatShading: true,
    });
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: player.isBot ? "#d85a76" : "#4f9dff",
      flatShading: true,
    });
    const limbMaterial = new THREE.MeshLambertMaterial({ color: "#324764", flatShading: true });
    const armMaterial = new THREE.MeshLambertMaterial({
      color: player.isBot ? "#f2bcc7" : "#d8ecff",
      flatShading: true,
    });
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.56),
      skinMaterial
    );
    head.position.y = 1.45;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.86, 0.42),
      bodyMaterial
    );
    body.position.y = 0.9;
    const legLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.62, 0.26),
      limbMaterial
    );
    legLeft.position.set(-0.14, 0.28, 0);
    const legRight = legLeft.clone();
    legRight.position.x = 0.14;
    const armLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.68, 0.22),
      armMaterial
    );
    armLeft.position.set(-0.46, 0.96, 0);
    const armRight = armLeft.clone();
    armRight.position.x = 0.46;
    const tool = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.72),
      new THREE.MeshLambertMaterial({ color: ITEM_DEFS[player.weaponId]?.color || "#ffffff", flatShading: true })
    );
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.12, 0.06),
      new THREE.MeshLambertMaterial({ color: player.isBot ? "#fff0f4" : "#20334f", flatShading: true })
    );
    visor.position.set(0, 1.48, 0.29);
    tool.position.set(0.58, 0.92, 0.12);
    tool.rotation.x = Math.PI * 0.18;

    group.add(head, body, legLeft, legRight, armLeft, armRight, tool, visor);
    group.userData = { head, body, legLeft, legRight, armLeft, armRight, tool, visor };
    return group;
  }

  function syncPlayers(players) {
    const seen = new Set();
    players.forEach((player) => {
      seen.add(player.id);
      let avatar = state.playerMeshes.get(player.id);
      if (!avatar) {
        avatar = createAvatar(player);
        playerGroup.add(avatar);
        state.playerMeshes.set(player.id, avatar);
      }
      avatar.position.set(player.position.x, player.position.y, player.position.z);
      avatar.rotation.y = player.rotation.yaw;
      avatar.visible = player.alive;
      const sway = player.alive ? Math.sin(performance.now() * 0.008 + player.position.x) * 0.1 : 0;
      avatar.userData.armLeft.rotation.x = sway;
      avatar.userData.armRight.rotation.x = -sway;
      avatar.userData.legLeft.rotation.x = -sway;
      avatar.userData.legRight.rotation.x = sway;
      avatar.userData.tool.material.color.set(ITEM_DEFS[player.weaponId]?.color || "#ffffff");
    });

    Array.from(state.playerMeshes.entries()).forEach(([id, avatar]) => {
      if (!seen.has(id)) {
        playerGroup.remove(avatar);
        state.playerMeshes.delete(id);
      }
    });
  }

  function syncProjectiles(projectiles) {
    while (state.projectileMeshes.length < projectiles.length) {
      const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshBasicMaterial({ color: "#ffffff" })
      );
      projectileGroup.add(projectile);
      state.projectileMeshes.push(projectile);
    }
    while (state.projectileMeshes.length > projectiles.length) {
      const projectile = state.projectileMeshes.pop();
      projectileGroup.remove(projectile);
    }
    projectiles.forEach((entry, index) => {
      const projectile = state.projectileMeshes[index];
      projectile.visible = true;
      projectile.position.set(entry.x, entry.y, entry.z);
      projectile.material.color.set(entry.color || "#ffffff");
    });
  }

  function syncHazards(hazards) {
    while (state.hazardMeshes.length < hazards.length) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: "#ff845d", transparent: true, opacity: 0.6 })
      );
      ring.rotation.x = Math.PI / 2;
      hazardGroup.add(ring);
      state.hazardMeshes.push(ring);
    }
    while (state.hazardMeshes.length > hazards.length) {
      const ring = state.hazardMeshes.pop();
      hazardGroup.remove(ring);
    }
    hazards.forEach((hazard, index) => {
      const ring = state.hazardMeshes[index];
      ring.visible = true;
      ring.position.set(hazard.x, hazard.y, hazard.z);
      const scale = Math.max(hazard.radius, 0.6);
      ring.scale.setScalar(scale);
    });
  }

  function updateFogFromSnapshot(snapshot) {
    const fogColor = snapshot.world.fog || "#a6ddff";
    scene.background = new THREE.Color(fogColor);
    scene.fog.color = new THREE.Color(fogColor);
  }

  function applySnapshot(snapshot) {
    const previousHealth = state.snapshot?.you?.health;
    state.snapshot = snapshot;
    if (!state.look.seeded && snapshot.you) {
      state.look.yaw = snapshot.you.rotation.yaw;
      state.look.pitch = snapshot.you.rotation.pitch;
      state.look.seeded = true;
    }
    state.cameraMode = snapshot.you?.cameraMode || state.cameraMode;
    snapshot.world.chunks.forEach(applyChunk);
    snapshot.world.chunkUpdates.forEach(applyChunk);
    syncPlayers(snapshot.players);
    syncProjectiles(snapshot.projectiles);
    syncHazards(snapshot.hazards || []);
    updateFogFromSnapshot(snapshot);
    renderHud();
    if (typeof previousHealth === "number" && snapshot.you && snapshot.you.health < previousHealth) {
      flashDamage();
    }
    updateStagePresentation();
  }

  function renderHud() {
    const snapshot = state.snapshot;
    if (!snapshot) {
      return;
    }
    refs.modeLabel.textContent = `${snapshot.room.modeLabel} / ${snapshot.room.terrainLabel}`;
    refs.phaseLabel.textContent = snapshot.room.phase.replace("_", " ");
    refs.healthLabel.textContent = snapshot.you ? `${snapshot.you.health}/${snapshot.you.maxHealth}` : "--";
    refs.viewLabel.textContent = state.cameraMode === "third" ? "Third-person" : "First-person";
    refs.roomTitle.textContent = snapshot.room.label;
    refs.roomSubtitle.textContent = snapshot.you
      ? `${ITEM_DEFS[snapshot.you.weaponId]?.label || "Weapon"} ready | ${snapshot.you.blocks} blocks | ${snapshot.you.selectedBlock}`
      : "Click to enter";
    refs.playersBadge.textContent = `${snapshot.players.length} fighters`;
    refs.timerBadge.textContent = snapshot.room.phase === "sudden_death"
      ? `Sudden ${Math.ceil(snapshot.room.suddenDeathTicksRemaining / 10)}s`
      : `${Math.ceil(snapshot.room.matchTicksRemaining / 10)}s`;

    refs.killFeed.innerHTML = "";
    (snapshot.killFeed.length ? snapshot.killFeed : ["No eliminations yet"]).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "feed-item";
      item.textContent = entry;
      refs.killFeed.appendChild(item);
    });

    refs.scoreboard.innerHTML = "";
    snapshot.players
      .slice()
      .sort((left, right) => right.kills - left.kills || left.deaths - right.deaths)
      .forEach((player) => {
        const row = document.createElement("div");
        row.className = "score-row";
        row.innerHTML = `<strong>${player.name}${player.id === snapshot.selfId ? " (you)" : ""}${player.isBot ? " [bot]" : ""}</strong><span>${player.kills}K / ${player.deaths}D</span>`;
        refs.scoreboard.appendChild(row);
      });
  }

  function resizeRenderer() {
    const width = refs.canvas.clientWidth || 960;
    const height = refs.canvas.clientHeight || 540;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    const you = state.snapshot?.you;
    if (!you) {
      camera.position.set(18, 14, 18);
      camera.lookAt(16, 6, 16);
      return;
    }
    const eye = new THREE.Vector3(you.position.x, you.position.y + 1.55, you.position.z);
    const forward = new THREE.Vector3(
      Math.sin(state.look.yaw) * Math.cos(state.look.pitch),
      Math.sin(state.look.pitch),
      Math.cos(state.look.yaw) * Math.cos(state.look.pitch)
    );

    if (state.cameraMode === "third") {
      const offset = forward.clone().multiplyScalar(-5.4);
      offset.y += 2.15;
      offset.x += Math.cos(state.look.yaw) * 0.8;
      offset.z -= Math.sin(state.look.yaw) * 0.8;
      camera.position.copy(eye.clone().add(offset));
    } else {
      camera.position.copy(eye);
    }
    camera.lookAt(eye.clone().add(forward.multiplyScalar(state.cameraMode === "third" ? 13.5 : 12)));

    const localAvatar = state.playerMeshes.get(you.id);
    if (localAvatar) {
      localAvatar.visible = state.cameraMode === "third" && you.alive;
    }
  }

  const raycaster = new THREE.Raycaster();

  function updateHover() {
    if (!state.snapshot?.you) {
      selectionMesh.visible = false;
      state.hovered = null;
      return;
    }
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersections = raycaster.intersectObjects(worldGroup.children, false);
    const hit = intersections.find((entry) => entry.distance <= 6.4);
    if (!hit) {
      selectionMesh.visible = false;
      state.hovered = null;
      return;
    }
    const block = hit.object.userData.block;
    const normal = hit.face.normal.clone();
    selectionMesh.visible = true;
    selectionMesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    state.hovered = {
      position: { x: block.x, y: block.y, z: block.z },
      face: { x: Math.round(normal.x), y: Math.round(normal.y), z: Math.round(normal.z) },
    };
  }

  function renderFrame() {
    resizeRenderer();
    applyTouchLook();
    updateCamera();
    updateHover();
    renderer.render(scene, camera);
    requestAnimationFrame(renderFrame);
  }

  function sendAction(action) {
    if (!state.connected || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    state.socket.send(JSON.stringify({ type: "action", action }));
  }

  function sendInput() {
    if (!state.connected || !state.socket || state.socket.readyState !== WebSocket.OPEN || !state.snapshot?.you) {
      return;
    }
    const moveX = state.touch.move.dx;
    const moveY = state.touch.move.dy;
    state.socket.send(JSON.stringify({
      type: "input",
      input: {
        forward: state.keys.has("KeyW") || moveY < -0.25,
        backward: state.keys.has("KeyS") || moveY > 0.25,
        left: state.keys.has("KeyA") || moveX < -0.25,
        right: state.keys.has("KeyD") || moveX > 0.25,
        jump: state.keys.has("Space"),
        sprint: state.keys.has("ShiftLeft") || state.keys.has("ShiftRight"),
        crouch: state.keys.has("ControlLeft") || state.keys.has("ControlRight"),
        firing: state.mouseDown || state.touch.fire,
        yaw: state.look.yaw,
        pitch: state.look.pitch,
        cameraMode: state.cameraMode,
      },
    }));
  }

  function placeHoveredBlock() {
    if (state.hovered) {
      sendAction({ type: "place", position: state.hovered.position, face: state.hovered.face });
    }
  }

  function breakHoveredBlock() {
    if (state.hovered) {
      sendAction({ type: "break", position: state.hovered.position });
    }
  }

  function toggleCameraMode() {
    state.cameraMode = state.cameraMode === "first" ? "third" : "first";
    sendAction({ type: "set_camera", cameraMode: state.cameraMode });
    refs.viewLabel.textContent = state.cameraMode === "third" ? "Third-person" : "First-person";
  }

  function setThumbPosition(thumb, dx, dy) {
    thumb.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
  }

  function bindStick(surface, thumb, key) {
    surface.addEventListener("pointerdown", (event) => {
      const rect = surface.getBoundingClientRect();
      state.touch[key].active = true;
      state.touch[key].pointerId = event.pointerId;
      state.touch[key].x = rect.left + (rect.width / 2);
      state.touch[key].y = rect.top + (rect.height / 2);
      surface.setPointerCapture(event.pointerId);
    });

    surface.addEventListener("pointermove", (event) => {
      if (!state.touch[key].active || state.touch[key].pointerId !== event.pointerId) {
        return;
      }
      const dx = clamp((event.clientX - state.touch[key].x) / 30, -1, 1);
      const dy = clamp((event.clientY - state.touch[key].y) / 30, -1, 1);
      state.touch[key].dx = dx;
      state.touch[key].dy = dy;
      setThumbPosition(thumb, dx, dy);
    });

    function release(pointerId) {
      if (state.touch[key].pointerId !== pointerId) {
        return;
      }
      state.touch[key].active = false;
      state.touch[key].pointerId = null;
      state.touch[key].dx = 0;
      state.touch[key].dy = 0;
      setThumbPosition(thumb, 0, 0);
    }

    surface.addEventListener("pointerup", (event) => release(event.pointerId));
    surface.addEventListener("pointercancel", (event) => release(event.pointerId));
  }

  function bindTouchButtons() {
    refs.touchJump.addEventListener("pointerdown", () => state.keys.add("Space"));
    refs.touchJump.addEventListener("pointerup", () => state.keys.delete("Space"));
    refs.touchJump.addEventListener("pointercancel", () => state.keys.delete("Space"));

    refs.touchFire.addEventListener("pointerdown", () => {
      state.touch.fire = true;
    });
    refs.touchFire.addEventListener("pointerup", () => {
      state.touch.fire = false;
    });
    refs.touchFire.addEventListener("pointercancel", () => {
      state.touch.fire = false;
    });

    refs.touchPlace.addEventListener("pointerdown", placeHoveredBlock);
    refs.touchBreak.addEventListener("pointerdown", breakHoveredBlock);
  }

  function applyTouchLook() {
    if (!state.touch.aim.active) {
      return;
    }
    state.look.yaw -= state.touch.aim.dx * 0.045;
    state.look.pitch = clamp(state.look.pitch - (state.touch.aim.dy * 0.03), -1.25, 1.1);
  }

  refs.refreshServers?.addEventListener("click", fetchServers);
  refs.createRoom.addEventListener("click", () => createRoom());
  refs.practicePrivate.addEventListener("click", () => createRoom({ isPractice: true, visibility: "private" }));
  refs.practicePublic.addEventListener("click", () => createRoom({ isPractice: true, visibility: "public" }));

  refs.canvas.addEventListener("click", () => {
    if (!state.touch.enabled) {
      refs.canvas.requestPointerLock?.();
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== refs.canvas) {
      return;
    }
    state.look.yaw -= event.movementX * 0.0028;
    state.look.pitch = clamp(state.look.pitch - (event.movementY * 0.0024), -1.25, 1.1);
  });

  refs.canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      state.mouseDown = true;
    }
    if (event.button === 2) {
      event.preventDefault();
      placeHoveredBlock();
    }
  });
  refs.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("mouseup", () => {
    state.mouseDown = false;
  });

  window.addEventListener("keydown", (event) => {
    state.keys.add(event.code);
    if (event.code === "KeyR") {
      breakHoveredBlock();
    }
    if (event.code === "KeyF") {
      sendAction({ type: "melee" });
    }
    if (event.code === "KeyQ") {
      toggleCameraMode();
    }
    if (event.code === "Digit1") {
      sendAction({ type: "select_weapon", weaponId: state.weaponOrder[0] });
    }
    if (event.code === "Digit2") {
      sendAction({ type: "select_weapon", weaponId: state.weaponOrder[1] });
    }
    if (event.code === "Digit3") {
      sendAction({ type: "select_weapon", weaponId: state.weaponOrder[2] });
    }
    if (event.code === "Digit4") {
      sendAction({ type: "select_weapon", weaponId: state.weaponOrder[3] });
    }
    if (event.code === "KeyZ") {
      sendAction({ type: "select_block", blockId: state.blockOrder[0] });
    }
    if (event.code === "KeyX") {
      sendAction({ type: "select_block", blockId: state.blockOrder[1] });
    }
    if (event.code === "KeyC") {
      sendAction({ type: "select_block", blockId: state.blockOrder[2] });
    }
    if (event.code === "KeyV") {
      sendAction({ type: "select_block", blockId: state.blockOrder[3] });
    }
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.code);
  });

  bindStick(refs.moveStick, refs.moveThumb, "move");
  bindStick(refs.aimStick, refs.aimThumb, "aim");
  bindTouchButtons();

  window.addEventListener("resize", resizeRenderer);
  document.addEventListener("pointerlockchange", () => {
    refs.roomSubtitle.textContent = document.pointerLockElement === refs.canvas
      ? "Aim locked | Left click fire | Right click place | R break"
      : (state.snapshot?.you
          ? `${ITEM_DEFS[state.snapshot.you.weaponId]?.label || "Weapon"} ready | ${state.snapshot.you.blocks} blocks | ${state.snapshot.you.selectedBlock}`
          : "Click to lock aim. Tap on mobile to play.");
  });

  setInterval(sendInput, 50);
  setInterval(fetchServers, 4000);

  bootstrapSelects();
  resizeRenderer();
  renderFrame();
  loadRuntimeConfig()
    .then(fetchServers)
    .catch(() => {
      refs.serverCount.textContent = "Server list unavailable";
      setStatus("Offline", false, "offline");
    });
  setStatus("Offline", false, "offline");
})();
