const canvas = document.getElementById("arena-canvas");
const ctx = canvas.getContext("2d");

const fighters = [
  { x: 240, y: 180, vx: 1.2, vy: 0.7, color: "#ff8859", r: 20 },
  { x: 980, y: 520, vx: -1.1, vy: -0.8, color: "#7ef2b8", r: 20 },
  { x: 720, y: 260, vx: 0.8, vy: -1.0, color: "#ff537e", r: 18 },
  { x: 420, y: 560, vx: -0.9, vy: 0.9, color: "#4dd8ff", r: 18 }
];

const zones = [
  { x: 180, y: 120, w: 220, h: 160 },
  { x: 860, y: 360, w: 240, h: 180 }
];

function tick(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#081210");
  bg.addColorStop(1, "#130f0d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x <= canvas.width; x += 80) {
    ctx.strokeStyle = "rgba(122,247,180,0.05)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 80) {
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (const zone of zones) {
    const alpha = 0.18 + Math.sin(now / 350 + zone.x) * 0.08;
    ctx.fillStyle = `rgba(255,83,126,${alpha})`;
    ctx.strokeStyle = "rgba(255,214,225,0.7)";
    ctx.lineWidth = 2;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  }

  const scanX = ((now * 0.12) % canvas.width);
  ctx.fillStyle = "rgba(76,255,173,0.14)";
  ctx.fillRect(scanX - 8, 0, 16, canvas.height);
  ctx.strokeStyle = "rgba(123,247,180,0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scanX, 0);
  ctx.lineTo(scanX, canvas.height);
  ctx.stroke();

  for (const fighter of fighters) {
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;

    if (fighter.x < fighter.r || fighter.x > canvas.width - fighter.r) fighter.vx *= -1;
    if (fighter.y < fighter.r || fighter.y > canvas.height - fighter.r) fighter.vy *= -1;

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = fighter.color;
    ctx.fillStyle = fighter.color;
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.fillRect(fighter.x - 26, fighter.y - 38, 52, 6);
    ctx.fillStyle = fighter.color;
    ctx.fillRect(fighter.x - 26, fighter.y - 38, 52, 6);
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
