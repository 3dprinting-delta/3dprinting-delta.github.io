const worldWidth = 2400;
const worldHeight = 1500;
const viewWidth = 1280;
const viewHeight = 800;
const playerRadius = 20;
const playerMaxHp = 100;
const playerMaxLives = 4;
const bulletSpeed = 760;
const enemyBulletSpeed = 560;
const bulletLife = 1.5;
const scanInterval = 16;
const scanDuration = 3.8;
const zoneWarningSeconds = 3.2;
const inventoryLimit = 4;
const realPvpUrl = "https://nomads-game-pvp-live.onrender.com/";
const warmupDelayMs = 3500;

const pickupInfo = {
  wall_pass: {
    label: "Wall Pass",
    short: "Phase",
    color: "#4dd8ff",
    description: "Move through geometry and break tight choke points."
  },
  invisibility: {
    label: "Invisibility",
    short: "Ghost",
    color: "#cc7dff",
    description: "Drop enemy lock and glide out of heavy pressure."
  },
  speed: {
    label: "Speed",
    short: "Boost",
    color: "#ffb347",
    description: "Turn the arena into a sprint lane for a few seconds."
  },
  super_bullet: {
    label: "Super Bullet",
    short: "Cannon",
    color: "#ff537e",
    description: "Load one piercing shot that tears through the room."
  }
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const overlayKicker = document.getElementById("overlay-kicker");
const scoreStat = document.getElementById("score-stat");
const hpStat = document.getElementById("hp-stat");
const livesStat = document.getElementById("lives-stat");
const statusText = document.getElementById("status-text");
const scanBadge = document.getElementById("scan-badge");
const phaseBadge = document.getElementById("phase-badge");
const inventoryRoot = document.getElementById("inventory");
const killfeedRoot = document.getElementById("killfeed");
const rosterRoot = document.getElementById("roster");
const launchButton = document.getElementById("launch-button");
const overlayButton = document.getElementById("overlay-button");
const backendLink = document.getElementById("backend-link");

const keys = { w: false, a: false, s: false, d: false, shoot: false };
const pointer = { x: viewWidth / 2, y: viewHeight / 2 };
let lastTime = 0;
let flash = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createEffects() {
  return { wall_pass: 0, invisibility: 0, speed: 0 };
}

function createObstacleField() {
  const obstacles = [];
  for (let index = 0; index < 20; index += 1) {
    const obstacle = {
      x: randomBetween(120, worldWidth - 340),
      y: randomBetween(120, worldHeight - 260),
      w: randomBetween(120, 240),
      h: randomBetween(80, 200)
    };

    if (
      obstacle.x < worldWidth / 2 + 180 &&
      obstacle.x + obstacle.w > worldWidth / 2 - 180 &&
      obstacle.y < worldHeight / 2 + 140 &&
      obstacle.y + obstacle.h > worldHeight / 2 - 140
    ) {
      index -= 1;
      continue;
    }

    obstacles.push(obstacle);
  }
  return obstacles;
}

function overlapsRect(x, y, radius, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  return distance({ x, y }, { x: nearestX, y: nearestY }) < radius;
}

function createPlayer() {
  return {
    id: "player",
    name: "You",
    x: worldWidth / 2,
    y: worldHeight / 2,
    vx: 0,
    vy: 0,
    hp: playerMaxHp,
    maxHp: playerMaxHp,
    lives: playerMaxLives,
    alive: true,
    color: "#ff8c5f",
    angle: 0,
    fireCooldown: 0,
    respawnTimer: 0,
    effects: createEffects(),
    inventory: [],
    superReady: false,
    score: 0,
    aiTimer: 0,
    roamTarget: { x: worldWidth / 2, y: worldHeight / 2 }
  };
}

function createEnemy(index) {
  const colors = ["#a3e635", "#38bdf8", "#f472b6", "#fbbf24", "#fb7185", "#2dd4bf", "#c084fc"];
  const margin = 140;
  const side = index % 4;
  const position =
    side === 0
      ? { x: margin, y: randomBetween(margin, worldHeight - margin) }
      : side === 1
        ? { x: worldWidth - margin, y: randomBetween(margin, worldHeight - margin) }
        : side === 2
          ? { x: randomBetween(margin, worldWidth - margin), y: margin }
          : { x: randomBetween(margin, worldWidth - margin), y: worldHeight - margin };

  return {
    id: `enemy-${index}`,
    name: `Bot ${index + 1}`,
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    lives: 2,
    alive: true,
    color: colors[index % colors.length],
    angle: 0,
    fireCooldown: randomBetween(0.4, 1.4),
    respawnTimer: 0,
    effects: createEffects(),
    inventory: [],
    superReady: false,
    score: 0,
    aiTimer: randomBetween(0.2, 1.6),
    roamTarget: {
      x: randomBetween(160, worldWidth - 160),
      y: randomBetween(160, worldHeight - 160)
    }
  };
}

function createState(previousBest = 0) {
  return {
    phase: "intro",
    player: createPlayer(),
    enemies: Array.from({ length: 7 }, (_, index) => createEnemy(index)),
    obstacles: createObstacleField(),
    bullets: [],
    pickups: [],
    particles: [],
    zones: [],
    scan: { active: false, timer: 0, cooldown: scanInterval },
    killfeed: [],
    score: 0,
    best: previousBest,
    boxTimer: 7,
    zoneTimer: 9,
    time: 0
  };
}

let game = createState();
let wakeInFlight = false;

function addKillfeed(text, color) {
  game.killfeed.unshift({ id: `${Math.random()}`, text, color, ttl: 3.5 });
  game.killfeed = game.killfeed.slice(0, 5);
}

function makeParticles(store, x, y, color, count = 10) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(35, 180);
    store.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.25, 0.6),
      maxLife: 0.6,
      color,
      size: randomBetween(2, 5)
    });
  }
}

function pushOutOfObstacles(fighter) {
  if (fighter.effects.wall_pass > 0) return;
  for (const obstacle of game.obstacles) {
    if (!overlapsRect(fighter.x, fighter.y, playerRadius, obstacle)) continue;
    const nearestX = clamp(fighter.x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(fighter.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = fighter.x - nearestX;
    const dy = fighter.y - nearestY;
    const length = Math.hypot(dx, dy) || 1;
    fighter.x = nearestX + (dx / length) * (playerRadius + 1);
    fighter.y = nearestY + (dy / length) * (playerRadius + 1);
  }
}

function updateEffects(fighter, dt) {
  fighter.effects.wall_pass = Math.max(0, fighter.effects.wall_pass - dt);
  fighter.effects.invisibility = Math.max(0, fighter.effects.invisibility - dt);
  fighter.effects.speed = Math.max(0, fighter.effects.speed - dt);
}

function respawnFighter(fighter, fallback) {
  fighter.x = fallback.x;
  fighter.y = fallback.y;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.hp = fighter.maxHp;
  fighter.alive = true;
  fighter.fireCooldown = 0.6;
  fighter.effects = createEffects();
  fighter.inventory = [];
  fighter.superReady = false;
}

function applyPickup(fighter, pickup) {
  if (pickup === "wall_pass") fighter.effects.wall_pass = 6;
  if (pickup === "invisibility") fighter.effects.invisibility = 6;
  if (pickup === "speed") fighter.effects.speed = 6;
  if (pickup === "super_bullet") fighter.superReady = true;
}

function useInventory(slotIndex) {
  const pickup = game.player.inventory[slotIndex];
  if (!pickup) return;
  game.player.inventory.splice(slotIndex, 1);
  applyPickup(game.player, pickup);
  addKillfeed(`Power-up armed: ${pickupInfo[pickup].label}`, pickupInfo[pickup].color);
  renderUi();
}

function shootBullet(fighter, speed, baseDamage) {
  const angle = fighter.angle;
  const isSuper = fighter.superReady;
  const muzzleOffset = playerRadius + 10;
  game.bullets.push({
    x: fighter.x + Math.cos(angle) * muzzleOffset,
    y: fighter.y + Math.sin(angle) * muzzleOffset,
    vx: Math.cos(angle) * (isSuper ? speed * 1.12 : speed),
    vy: Math.sin(angle) * (isSuper ? speed * 1.12 : speed),
    life: isSuper ? bulletLife * 1.2 : bulletLife,
    owner: fighter.id,
    color: isSuper ? "#ff537e" : fighter.color,
    damage: isSuper ? 999 : baseDamage,
    radius: isSuper ? 8 : fighter.id === "player" ? 6 : 5,
    isSuper
  });
  fighter.superReady = false;
}

function applyDamage(fighter, damage, attacker) {
  if (!fighter.alive) return;
  const reduced = fighter.effects.invisibility > 0 ? damage * 0.75 : damage;
  fighter.hp -= reduced;
  makeParticles(game.particles, fighter.x, fighter.y, fighter.color, 9);

  if (fighter.hp > 0) return;

  fighter.hp = 0;
  fighter.alive = false;
  fighter.lives -= 1;
  fighter.superReady = false;
  fighter.inventory = [];
  fighter.effects = createEffects();

  if (attacker) attacker.score += 1;

  if (fighter.id === "player") {
    fighter.respawnTimer = fighter.lives > 0 ? 2.2 : 0;
    game.phase = fighter.lives > 0 ? "running" : "gameover";
    overlayKicker.textContent = "Room collapsed";
    overlayTitle.textContent = "Run Over";
    overlayCopy.textContent = `You finished with ${game.score} eliminations. Start another match any time.`;
    addKillfeed(`${attacker ? attacker.name : "Arena"} tagged You`, attacker ? attacker.color : "#ffe2c6");
    return;
  }

  game.score += 1;
  fighter.respawnTimer = fighter.lives > 0 ? randomBetween(2.1, 3.2) : 999;
  addKillfeed(`${attacker ? attacker.name : "Arena"} eliminated ${fighter.name}`, attacker ? attacker.color : fighter.color);
}

function spawnPickup() {
  const types = ["wall_pass", "invisibility", "speed", "super_bullet"];
  for (let tries = 0; tries < 24; tries += 1) {
    const pickup = {
      id: `${Math.random()}`,
      x: randomBetween(100, worldWidth - 100),
      y: randomBetween(100, worldHeight - 100),
      type: types[Math.floor(Math.random() * types.length)],
      ttl: 14
    };
    if (game.obstacles.some((obstacle) => overlapsRect(pickup.x, pickup.y, 18, obstacle))) continue;
    game.pickups.push(pickup);
    return;
  }
}

function spawnZone() {
  const width = randomBetween(180, 320);
  const height = randomBetween(160, 280);
  game.zones.push({
    id: `${Math.random()}`,
    x: randomBetween(60, worldWidth - width - 60),
    y: randomBetween(60, worldHeight - height - 60),
    w: width,
    h: height,
    timer: zoneWarningSeconds
  });
}

function updateBullets(dt) {
  const next = [];
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (
      bullet.life <= 0 ||
      bullet.x < -80 ||
      bullet.y < -80 ||
      bullet.x > worldWidth + 80 ||
      bullet.y > worldHeight + 80
    ) {
      continue;
    }

    if (!bullet.isSuper) {
      for (const obstacle of game.obstacles) {
        if (!overlapsRect(bullet.x, bullet.y, bullet.radius, obstacle)) continue;
        const withinX = bullet.x > obstacle.x && bullet.x < obstacle.x + obstacle.w;
        const withinY = bullet.y > obstacle.y && bullet.y < obstacle.y + obstacle.h;
        if (withinX) bullet.vy *= -1;
        if (withinY) bullet.vx *= -1;
        bullet.life -= 0.24;
        makeParticles(game.particles, bullet.x, bullet.y, bullet.color, 4);
        break;
      }
    }

    const targets = bullet.owner === "player" ? game.enemies : [game.player];
    const attacker = bullet.owner === "player" ? game.player : game.enemies.find((enemy) => enemy.id === bullet.owner);
    let hit = false;
    for (const target of targets) {
      if (!target.alive || target.id === bullet.owner) continue;
      if (distance(bullet, target) <= playerRadius + bullet.radius) {
        applyDamage(target, bullet.damage, attacker);
        hit = !bullet.isSuper;
        if (!bullet.isSuper) break;
      }
    }
    if (!hit) next.push(bullet);
  }
  game.bullets = next;
}

function updatePickups(dt) {
  const next = [];
  for (const pickup of game.pickups) {
    pickup.ttl -= dt;
    if (pickup.ttl <= 0) continue;
    let collected = false;
    for (const fighter of [game.player, ...game.enemies]) {
      if (!fighter.alive || fighter.inventory.length >= inventoryLimit) continue;
      if (distance(pickup, fighter) <= playerRadius + 18) {
        fighter.inventory.push(pickup.type);
        makeParticles(game.particles, pickup.x, pickup.y, pickupInfo[pickup.type].color, 14);
        if (fighter.id === "player") {
          addKillfeed(`Loot secured: ${pickupInfo[pickup.type].label}`, pickupInfo[pickup.type].color);
        }
        collected = true;
        break;
      }
    }
    if (!collected) next.push(pickup);
  }
  game.pickups = next;
}

function updateHazards(dt) {
  game.zoneTimer -= dt;
  if (game.zoneTimer <= 0) {
    spawnZone();
    game.zoneTimer = randomBetween(8, 11.5);
  }

  const aliveZones = [];
  for (const zone of game.zones) {
    zone.timer -= dt;
    if (zone.timer <= 0) {
      for (const fighter of [game.player, ...game.enemies]) {
        if (
          fighter.alive &&
          fighter.x >= zone.x &&
          fighter.x <= zone.x + zone.w &&
          fighter.y >= zone.y &&
          fighter.y <= zone.y + zone.h
        ) {
          applyDamage(fighter, 999);
        }
      }
      makeParticles(game.particles, zone.x + zone.w / 2, zone.y + zone.h / 2, "#ff537e", 24);
      continue;
    }
    aliveZones.push(zone);
  }
  game.zones = aliveZones;

  game.scan.cooldown -= dt;
  if (!game.scan.active && game.scan.cooldown <= 0) {
    game.scan.active = true;
    game.scan.timer = 0;
    addKillfeed("Green scan online. Freeze when the beam hits.", "#7bf7b4");
  }

  if (!game.scan.active) return;

  game.scan.timer += dt;
  const progress = clamp(game.scan.timer / scanDuration, 0, 1);
  const scanX = progress * worldWidth;
  const playerMoving = keys.w || keys.a || keys.s || keys.d || keys.shoot;

  if (game.player.alive && Math.abs(game.player.x - scanX) < 12 && playerMoving) {
    applyDamage(game.player, 999);
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    if (Math.abs(enemy.x - scanX) < 12 && (Math.abs(enemy.vx) > 8 || Math.abs(enemy.vy) > 8)) {
      applyDamage(enemy, 999);
    }
  }

  if (game.scan.timer >= scanDuration) {
    game.scan.active = false;
    game.scan.timer = 0;
    game.scan.cooldown = scanInterval;
  }
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    updateEffects(enemy, dt);

    if (!enemy.alive) {
      if (enemy.lives <= 0) continue;
      enemy.respawnTimer -= dt;
      if (enemy.respawnTimer <= 0) {
        const fresh = createEnemy(Number(enemy.id.replace("enemy-", "")) || 0);
        respawnFighter(enemy, { x: fresh.x, y: fresh.y });
        enemy.roamTarget = fresh.roamTarget;
      }
      continue;
    }

    enemy.aiTimer -= dt;
    enemy.fireCooldown -= dt;

    if (enemy.inventory.length < 2 && Math.random() < 0.0015) {
      const types = ["wall_pass", "invisibility", "speed", "super_bullet"];
      enemy.inventory.push(types[Math.floor(Math.random() * types.length)]);
    }
    if (enemy.inventory.length > 0 && Math.random() < 0.0024) {
      applyPickup(enemy, enemy.inventory.shift());
    }

    const playerTargetable = game.player.alive && game.player.effects.invisibility <= 0;
    const chaseTarget = playerTargetable
      ? game.player
      : { x: randomBetween(140, worldWidth - 140), y: randomBetween(140, worldHeight - 140) };

    if (enemy.aiTimer <= 0) {
      enemy.roamTarget = {
        x: clamp(chaseTarget.x + randomBetween(-220, 220), 80, worldWidth - 80),
        y: clamp(chaseTarget.y + randomBetween(-220, 220), 80, worldHeight - 80)
      };
      enemy.aiTimer = randomBetween(0.8, 1.8);
    }

    const aimTarget = playerTargetable ? game.player : enemy.roamTarget;
    enemy.angle = Math.atan2(aimTarget.y - enemy.y, aimTarget.x - enemy.x);

    const desired =
      distance(enemy, game.player) < 160 && playerTargetable
        ? { x: enemy.x - (game.player.x - enemy.x), y: enemy.y - (game.player.y - enemy.y) }
        : enemy.roamTarget;

    const moveAngle = Math.atan2(desired.y - enemy.y, desired.x - enemy.x);
    const speed = enemy.effects.speed > 0 ? 235 : 165;
    enemy.vx = Math.cos(moveAngle) * speed;
    enemy.vy = Math.sin(moveAngle) * speed;
    enemy.x = clamp(enemy.x + enemy.vx * dt, playerRadius, worldWidth - playerRadius);
    enemy.y = clamp(enemy.y + enemy.vy * dt, playerRadius, worldHeight - playerRadius);
    pushOutOfObstacles(enemy);

    if (playerTargetable && enemy.fireCooldown <= 0 && distance(enemy, game.player) < 520) {
      shootBullet(enemy, enemyBulletSpeed, 20);
      enemy.fireCooldown = randomBetween(0.85, 1.45);
    }
  }
}

function updateParticles(dt) {
  game.particles = game.particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    return particle.life > 0;
  });
}

function updateKillfeed(dt) {
  game.killfeed = game.killfeed
    .map((item) => ({ ...item, ttl: item.ttl - dt }))
    .filter((item) => item.ttl > 0);
}

function updatePlayer(dt) {
  const player = game.player;
  updateEffects(player, dt);

  if (!player.alive) {
    if (player.lives > 0) {
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) {
        respawnFighter(player, { x: worldWidth / 2, y: worldHeight / 2 });
      }
    } else {
      game.phase = "gameover";
      overlay.classList.remove("hidden");
    }
    return;
  }

  const speed = player.effects.speed > 0 ? 320 : 225;
  let vx = 0;
  let vy = 0;
  if (keys.w) vy -= speed;
  if (keys.s) vy += speed;
  if (keys.a) vx -= speed;
  if (keys.d) vx += speed;
  if (vx !== 0 && vy !== 0) {
    vx *= 0.7071;
    vy *= 0.7071;
  }

  player.x = clamp(player.x + vx * dt, playerRadius, worldWidth - playerRadius);
  player.y = clamp(player.y + vy * dt, playerRadius, worldHeight - playerRadius);
  player.vx = vx;
  player.vy = vy;
  player.angle = Math.atan2(pointer.y - viewHeight / 2, pointer.x - viewWidth / 2);
  pushOutOfObstacles(player);
  player.fireCooldown -= dt;

  if (keys.shoot && player.fireCooldown <= 0) {
    const firedSuper = player.superReady;
    shootBullet(player, bulletSpeed, 24);
    player.fireCooldown = firedSuper ? 0.34 : 0.24;
    makeParticles(game.particles, player.x, player.y, "#ffd9b5", 4);
  }
}

function renderGame() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);

  const background = ctx.createLinearGradient(0, 0, 0, viewHeight);
  background.addColorStop(0, "#081210");
  background.addColorStop(1, "#130f0d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const camX = clamp(game.player.x - viewWidth / 2, 0, worldWidth - viewWidth);
  const camY = clamp(game.player.y - viewHeight / 2, 0, worldHeight - viewHeight);

  ctx.save();
  ctx.translate(-camX, -camY);

  for (let x = 0; x <= worldWidth; x += 80) {
    ctx.strokeStyle = "rgba(122, 247, 180, 0.05)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= worldHeight; y += 80) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(worldWidth, y);
    ctx.stroke();
  }

  for (const zone of game.zones) {
    const alpha = 0.18 + Math.sin(game.time * 6 + zone.x) * 0.08;
    ctx.fillStyle = `rgba(255, 83, 126, ${alpha})`;
    ctx.strokeStyle = "rgba(255, 214, 225, 0.75)";
    ctx.lineWidth = 2;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  }

  for (const obstacle of game.obstacles) {
    const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
    gradient.addColorStop(0, "rgba(65, 42, 28, 0.96)");
    gradient.addColorStop(1, "rgba(24, 18, 14, 0.98)");
    ctx.fillStyle = gradient;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeStyle = "rgba(255, 214, 168, 0.14)";
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  }

  for (const pickup of game.pickups) {
    const info = pickupInfo[pickup.type];
    ctx.fillStyle = `${info.color}22`;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c0d0f";
    ctx.font = "700 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(info.short.slice(0, 1), pickup.x, pickup.y + 4);
  }

  for (const fighter of [game.player, ...game.enemies]) {
    if (!fighter.alive) continue;
    ctx.save();
    ctx.translate(fighter.x, fighter.y);
    ctx.rotate(fighter.angle);

    if (fighter.effects.invisibility > 0) ctx.globalAlpha = 0.28;
    if (fighter.effects.wall_pass > 0) {
      ctx.fillStyle = "rgba(77, 216, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = fighter.color;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe9d4";
    ctx.fillRect(10, -4, fighter.superReady ? 26 : 20, fighter.superReady ? 10 : 8);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.fillRect(fighter.x - 30, fighter.y - 44, 60, 8);
    ctx.fillStyle = fighter.color;
    ctx.fillRect(fighter.x - 30, fighter.y - 44, (fighter.hp / fighter.maxHp) * 60, 8);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(fighter.name, fighter.x, fighter.y - 52);
  }

  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const particle of game.particles) {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (game.scan.active) {
    const progress = clamp(game.scan.timer / scanDuration, 0, 1);
    const scanX = progress * worldWidth;
    ctx.fillStyle = "rgba(76, 255, 173, 0.16)";
    ctx.fillRect(scanX - 8, 0, 16, worldHeight);
    ctx.strokeStyle = "rgba(123, 247, 180, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, worldHeight);
    ctx.stroke();
  }

  if (game.player.alive) {
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(game.player.x, game.player.y);
    ctx.lineTo(pointer.x + camX, pointer.y + camY);
    ctx.stroke();
  }

  ctx.restore();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 120, 74, ${Math.min(0.24, flash)})`;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }

  ctx.fillStyle = "rgba(255, 245, 235, 0.8)";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WASD move  |  Mouse aim  |  Click / Space fire  |  1-4 use inventory", 20, 28);
}

function renderInventory() {
  inventoryRoot.innerHTML = "";
  for (let index = 0; index < inventoryLimit; index += 1) {
    const item = game.player.inventory[index];
    const button = document.createElement("button");
    button.className = "inventory-button";
    button.type = "button";
    button.innerHTML = `
      <em>${index + 1}</em>
      <div>
        <strong style="color:${item ? pickupInfo[item].color : "inherit"}">${item ? pickupInfo[item].label : "Empty"}</strong>
        <span>${item ? pickupInfo[item].description : "Collect arena boxes to fill this slot."}</span>
      </div>
    `;
    button.addEventListener("click", () => useInventory(index));
    inventoryRoot.appendChild(button);
  }
}

function renderKillfeed() {
  killfeedRoot.innerHTML = "";
  if (game.killfeed.length === 0) {
    killfeedRoot.innerHTML = '<p class="empty">No events yet. Start the arena to populate the feed.</p>';
    return;
  }
  for (const item of game.killfeed) {
    const el = document.createElement("div");
    el.className = "feed-item";
    el.style.color = item.color;
    el.textContent = item.text;
    killfeedRoot.appendChild(el);
  }
}

function renderRoster() {
  rosterRoot.innerHTML = "";
  for (const fighter of [game.player, ...game.enemies]) {
    const card = document.createElement("article");
    card.className = "roster-card";
    card.innerHTML = `
      <div class="roster-top">
        <strong style="color:${fighter.color}">${fighter.name}</strong>
        <span>${fighter.alive || fighter.lives > 0 ? "online" : "out"}</span>
      </div>
      <div class="roster-bar">
        <div class="roster-fill" style="width:${(fighter.hp / fighter.maxHp) * 100}%;background:${fighter.color}"></div>
      </div>
      <p>${Math.max(0, Math.ceil(fighter.hp))} HP - ${Math.max(0, fighter.lives)} lives - ${fighter.score} score</p>
    `;
    rosterRoot.appendChild(card);
  }
}

function renderUi() {
  scoreStat.textContent = String(game.score);
  hpStat.textContent = String(Math.max(0, Math.ceil(game.player.hp)));
  livesStat.textContent = String(Math.max(0, game.player.lives));

  if (game.phase === "intro") {
    statusText.textContent = "Wake the live Render PvP server from here, or use the standalone browser arena below while it spins up.";
    phaseBadge.textContent = "Awaiting launch";
  } else if (game.phase === "gameover") {
    statusText.textContent = `Run ended at ${game.score} eliminations. Restart to spawn a fresh room.`;
    phaseBadge.textContent = "Match over";
  } else if (game.scan.active) {
    statusText.textContent = "Green scan is moving across the room. Stay still when it crosses your position.";
    phaseBadge.textContent = "Room active";
  } else if (game.zones.length > 0) {
    statusText.textContent = "Collapse zones are primed. Clear the marked sectors before the timer expires.";
    phaseBadge.textContent = "Room active";
  } else {
    statusText.textContent = "Arena live. Farm boxes, arm power-ups, and stay ahead of the next scan.";
    phaseBadge.textContent = "Room active";
  }

  scanBadge.textContent = game.scan.active
    ? `Scan live ${Math.round((game.scan.timer / scanDuration) * 100)}%`
    : `Next scan in ${Math.ceil(game.scan.cooldown)}s`;

  renderInventory();
  renderKillfeed();
  renderRoster();
}

function setJoinButtonState(isBusy, label = "Join Real PvP") {
  launchButton.disabled = isBusy;
  overlayButton.disabled = isBusy;
  launchButton.textContent = label;
  overlayButton.textContent = isBusy ? "Waking..." : "Wake Server";
}

async function wakeAndJoinRealPvp() {
  if (wakeInFlight) return;
  wakeInFlight = true;
  setJoinButtonState(true, "Waking Server...");
  statusText.textContent = "Waking the real PvP server on Render. If it was asleep, the first load can take around a minute.";
  phaseBadge.textContent = "Server warm-up";
  scanBadge.textContent = "Backend waking";
  overlayKicker.textContent = "Wake-up in progress";
  overlayTitle.textContent = "Connecting to Render";
  overlayCopy.textContent = "We are pinging the live multiplayer server now. You will be redirected into the real PvP client next.";
  try {
    await fetch(realPvpUrl, { mode: "no-cors", cache: "no-store" });
  } catch (error) {
    // The warm-up request can be opaque or blocked by the browser; navigation still works.
  }
  window.setTimeout(() => {
    window.location.href = realPvpUrl;
  }, warmupDelayMs);
}

function startRun() {
  const best = game.best;
  game = createState(best);
  game.phase = "running";
  overlay.classList.add("hidden");
  lastTime = 0;
  flash = 0;
  renderUi();
}

function tick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (game.phase === "running") {
    game.time += dt;
    game.boxTimer -= dt;
    flash = Math.max(0, flash - dt * 1.5);
    updateKillfeed(dt);
    updatePlayer(dt);
    if (game.boxTimer <= 0) {
      spawnPickup();
      game.boxTimer = randomBetween(6.5, 9.5);
    }
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    updateHazards(dt);
    updateParticles(dt);
    if (game.player.hp < playerMaxHp * 0.4) flash = 0.18;
  } else {
    updateKillfeed(dt);
  }

  renderGame();
  renderUi();
  requestAnimationFrame(tick);
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * viewWidth;
  pointer.y = ((event.clientY - rect.top) / rect.height) * viewHeight;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) keys[key] = true;
  if (event.code === "Space") {
    keys.shoot = true;
    event.preventDefault();
  }
  if (["1", "2", "3", "4"].includes(event.key)) {
    useInventory(Number(event.key) - 1);
  }
  if (key === "enter" && game.phase !== "running") {
    startRun();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) keys[key] = false;
  if (event.code === "Space") keys.shoot = false;
});

canvas.addEventListener("mousemove", updatePointer);
canvas.addEventListener("mousedown", () => {
  keys.shoot = true;
});
window.addEventListener("mouseup", () => {
  keys.shoot = false;
});

launchButton.addEventListener("click", wakeAndJoinRealPvp);
overlayButton.addEventListener("click", wakeAndJoinRealPvp);
backendLink.href = realPvpUrl;

renderUi();
renderGame();
requestAnimationFrame(tick);
