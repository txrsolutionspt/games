export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeRoundRect(ctx, x, y, w, h, r, color, lineWidth = 3) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function setShadow(ctx, blur, color, ox = 0, oy = 4) {
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.shadowOffsetX = ox;
  ctx.shadowOffsetY = oy;
}

export function clearShadow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function text(ctx, str, x, y, {
  font = '28px sans-serif',
  color = '#ffffff',
  align = 'center',
  baseline = 'middle',
  shadow = null,
  shadowBlur = 6,
} = {}) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) setShadow(ctx, shadowBlur, shadow);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (shadow) clearShadow(ctx);
}

export function drawStar(ctx, cx, cy, size, color = '#FFD700') {
  const spikes = 5;
  const outer = size;
  const inner = size * 0.42;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbStr(r, g, b, a = 1) {
  return `rgba(${r},${g},${b},${a})`;
}
