
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let nodes: any[] = [];
const nodeCount = 15;
const CONNECTION_DISTANCE = 200;
const OPACITY_STEPS = 20;
let cachedStrokeStyles: string[] = [];
const NODE_FILL_STYLE = 'rgba(96, 165, 250, 0.9)';

for (let i = 0; i <= OPACITY_STEPS; i++) {
  const opacity = (i / OPACITY_STEPS) * 0.3;
  cachedStrokeStyles.push(`rgba(59, 130, 246, ${opacity.toFixed(3)})`);
}

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'init') {
    const canvas = payload.canvas as OffscreenCanvas;
    canvasWidth = payload.width;
    canvasHeight = payload.height;
    ctx = canvas.getContext('2d', { alpha: true });

    if (ctx) {
      nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          pulse: Math.random() * Math.PI * 2,
        });
      }
      requestAnimationFrame(animate);
    }
  } else if (type === 'resize') {
    canvasWidth = payload.width;
    canvasHeight = payload.height;
  }
};

let lastFrameTime = 0;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function animate(currentTime: number) {
  requestAnimationFrame(animate);

  if (!ctx) return;

  const elapsed = currentTime - lastFrameTime;
  if (elapsed < FRAME_INTERVAL) return;
  lastFrameTime = currentTime - (elapsed % FRAME_INTERVAL);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    node.x += node.vx;
    node.y += node.vy;

    if (node.x < 0 || node.x > canvasWidth) node.vx *= -1;
    if (node.y < 0 || node.y > canvasHeight) node.vy *= -1;

    node.pulse += 0.02;
  }

  ctx.lineWidth = 1;
  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    for (let j = i + 1; j < nodeCount; j++) {
      const otherNode = nodes[j];
      const dx = node.x - otherNode.x;
      const dy = node.y - otherNode.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
        const distance = Math.sqrt(distSq);
        const opacityIndex = Math.round((1 - distance / CONNECTION_DISTANCE) * OPACITY_STEPS);
        ctx.beginPath();
        ctx.strokeStyle = cachedStrokeStyles[opacityIndex];
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(otherNode.x, otherNode.y);
        ctx.stroke();
      }
    }
  }

  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    const pulseSize = 2 + Math.sin(node.pulse) * 0.5;
    const radius = pulseSize * 2;

    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = NODE_FILL_STYLE;
    ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

