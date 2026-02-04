import { AgentWhiteboard } from '../src/index.js';

const canvas = document.getElementById('whiteboard') as HTMLCanvasElement;
const canvasWrap = document.getElementById('canvas-wrap') as HTMLDivElement;
const grabBar = document.getElementById('grab-bar') as HTMLDivElement;
const messagesEl = document.getElementById('messages') as HTMLDivElement;
const typingIndicator = document.getElementById('typing-indicator') as HTMLDivElement;
const quickReplies = document.getElementById('quick-replies') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendBtn = document.getElementById('btn-send') as HTMLButtonElement;
const statusDot = document.getElementById('status-dot') as HTMLSpanElement;

let pendingAckId: string | null = null;
let activeWs: WebSocket | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT = 30_000; // 30s without a new message → session idle

// --- Session recording (always-on) ---

interface SlideRecord {
  instructions: unknown[];
  caption: string;
  snapshot: string; // data URL
  timestamp: number;
}

const sessionLog: SlideRecord[] = [];
let currentCaption = '';
let currentInstructions: unknown[] = [];
let isWelcomeScreen = false;
const downloadBtn = document.getElementById('btn-download') as HTMLButtonElement;

function ts(): string {
  return new Date().toISOString();
}

console.log(`[${ts()}] Page loaded`);

const board = new AgentWhiteboard(canvas, {
  animationSpeed: 4,
  roughness: 1,
  backgroundColor: '#ffffff',
  onQueueEmpty: () => {
    console.log(`[${ts()}] Queue empty (drawing done)`);
    // Don't capture welcome screen in session log
    if (!isWelcomeScreen && currentInstructions.length > 0) {
      sessionLog.push({
        instructions: currentInstructions,
        caption: currentCaption,
        snapshot: canvas.toDataURL('image/png'),
        timestamp: Date.now(),
      });
      currentInstructions = [];
      currentCaption = '';
      downloadBtn.classList.add('visible');
    }
    if (pendingAckId) {
      enableInput();
    }
  },
});

// --- Welcome / idle state ---

function showWelcome(): void {
  board.reset();
  isWelcomeScreen = true;
  // Draw centered text directly — writeText instruction has no textAlign support
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const cx = canvas.width / dpr / 2;
  const cy = canvas.height / dpr / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '28px sans-serif';
  ctx.fillText('Hello.', cx, cy - 20);
  ctx.font = '16px sans-serif';
  ctx.fillText('Waiting for agent to draw...', cx, cy + 20);
  ctx.restore();
}

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function startIdleTimer(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    console.log(`[${ts()}] Idle timeout — returning to welcome`);
    hideTyping();
    disableInput();
    showWelcome();
  }, IDLE_TIMEOUT);
}

// --- Canvas sizing ---

let lastViewportW = 0;
let lastViewportH = 0;

function sendViewportSize(w: number, h: number): void {
  if (w === lastViewportW && h === lastViewportH) return;
  lastViewportW = w;
  lastViewportH = h;
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    activeWs.send(JSON.stringify({ type: 'viewport', width: w, height: h }));
  }
}

function syncCanvasSize(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const logicalW = Math.round(rect.width);
  const logicalH = Math.round(rect.height);
  const physW = Math.round(logicalW * dpr);
  const physH = Math.round(logicalH * dpr);
  if (canvas.width === physW && canvas.height === physH) return;
  board.resize(logicalW, logicalH, dpr);
  if (isWelcomeScreen) showWelcome();
  sendViewportSize(logicalW, logicalH);
}

new ResizeObserver(() => syncCanvasSize()).observe(canvasWrap);
syncCanvasSize();

// DPR change listener (e.g. moving window between displays)
function watchDpr(): void {
  const mql = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mql.addEventListener('change', () => {
    syncCanvasSize();
    watchDpr(); // re-register for the new DPR value
  }, { once: true });
}
watchDpr();

// --- Grab bar drag ---

(function initGrabBar() {
  let dragging = false;
  let startY = 0;
  let startH = 0;

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    startH = canvasWrap.getBoundingClientRect().height;
    grabBar.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const delta = e.clientY - startY;
    const newH = Math.max(200, Math.min(window.innerHeight * 0.85, startH + delta));
    canvasWrap.style.height = newH + 'px';
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
  }

  grabBar.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
})();

// Show welcome on initial load
showWelcome();

// --- Chat message helpers ---

function addBubble(text: string, type: 'agent' | 'user' | 'system'): void {
  const div = document.createElement('div');
  div.className = `bubble ${type}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addAgentMessage(text: string): void {
  addBubble(text, 'agent');
}

function addUserMessage(text: string): void {
  addBubble(text, 'user');
}

function addSystemMessage(text: string): void {
  addBubble(text, 'system');
}

// --- Input state ---

function enableInput(): void {
  chatInput.disabled = false;
  sendBtn.disabled = false;
  quickReplies.classList.add('visible');
  typingIndicator.classList.remove('visible');
  chatInput.focus();
}

function disableInput(): void {
  chatInput.disabled = true;
  sendBtn.disabled = true;
  quickReplies.classList.remove('visible');
}

function showTyping(): void {
  typingIndicator.classList.add('visible');
  messagesEl.scrollTop = messagesEl.scrollHeight;
  startIdleTimer();
}

function hideTyping(): void {
  typingIndicator.classList.remove('visible');
}

// --- Send ---

function sendAck(id: string, message: string): void {
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    const msg: Record<string, string> = { type: 'ack', id };
    if (message) {
      msg.message = message;
    }
    activeWs.send(JSON.stringify(msg));
  }
}

function handleSend(): void {
  if (!pendingAckId) return;

  const text = chatInput.value.trim();
  if (text) {
    addUserMessage(text);
  }
  sendAck(pendingAckId, text);
  pendingAckId = null;
  chatInput.value = '';
  disableInput();
  showTyping();
}

// Send on Enter or click
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);

// Quick-reply chips
quickReplies.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.chip') as HTMLButtonElement | null;
  if (!chip || chip.disabled || !pendingAckId) return;

  const message = chip.dataset.message || '';
  addUserMessage(message);
  sendAck(pendingAckId, message);
  pendingAckId = null;
  chatInput.value = '';
  disableInput();
  showTyping();
});

// --- Connection status ---

function setStatus(state: 'connected' | 'connecting' | 'disconnected'): void {
  statusDot.className = state;
}

// --- WebSocket connection with exponential backoff ---

const BACKOFF_INITIAL = 1000;
const BACKOFF_MAX = 30000;
let backoffDelay = BACKOFF_INITIAL;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function teardown(): void {
  if (activeWs) {
    activeWs.onopen = null;
    activeWs.onmessage = null;
    activeWs.onclose = null;
    activeWs.onerror = null;
    activeWs.close();
    activeWs = null;
  }
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffDelay);
  backoffDelay = Math.min(backoffDelay * 2, BACKOFF_MAX);
}

function connect(): void {
  teardown();
  setStatus('connecting');

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/ws`;
  const ws = new WebSocket(wsUrl);
  activeWs = ws;

  ws.onopen = () => {
    console.log(`[${ts()}] WebSocket onopen`);
    setStatus('connected');
    backoffDelay = BACKOFF_INITIAL;
    // Report current viewport size to server
    lastViewportW = 0;
    lastViewportH = 0;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    sendViewportSize(Math.round(rect.width), Math.round(rect.height));
  };

  ws.onmessage = (event) => {
    if (ws !== activeWs) return;
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'connected':
        console.log(`[${ts()}] Connected event received`);
        setStatus('connected');
        break;

      case 'draw':
        console.log(`[${ts()}] Draw received: ${data.instructions.length} instructions`);
        clearIdleTimer();
        isWelcomeScreen = false;
        hideTyping();
        currentInstructions = data.instructions;
        board.addInstructions(data.instructions);
        if (data.slide && data.totalSlides) {
          addSystemMessage(`Slide ${data.slide} of ${data.totalSlides}`);
        }
        if (data.ack_id) {
          pendingAckId = data.ack_id;
          // enableInput() will be called by onQueueEmpty when animation finishes
        }
        break;

      case 'caption':
        console.log(`[${ts()}] Caption received: "${data.text}"`);
        clearIdleTimer();
        currentCaption = data.text || '';
        if (data.text) {
          addAgentMessage(data.text);
        }
        break;

      case 'reset':
        console.log(`[${ts()}] Reset received`);
        board.reset();
        pendingAckId = null;
        disableInput();
        hideTyping();
        // Chat history persists — don't clear messages
        break;
    }
  };

  ws.onclose = () => {
    if (ws !== activeWs) return;
    console.log(`[${ts()}] WebSocket closed, reconnecting...`);
    teardown();
    setStatus('connecting');
    scheduleReconnect();
  };

  ws.onerror = () => {
    if (ws !== activeWs) return;
    console.log(`[${ts()}] WebSocket error`);
  };
}

connect();

// --- Download session ---

const downloadMenu = document.getElementById('download-menu') as HTMLDivElement;

downloadBtn.addEventListener('click', () => {
  downloadMenu.classList.toggle('visible');
});

// Close menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!downloadBtn.contains(e.target as Node) && !downloadMenu.contains(e.target as Node)) {
    downloadMenu.classList.remove('visible');
  }
});

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('dl-json')!.addEventListener('click', () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    slides: sessionLog.map(({ instructions, caption, timestamp }) => ({
      instructions,
      caption,
      timestamp,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadFile(blob, `whiteboard-session-${Date.now()}.json`);
  downloadMenu.classList.remove('visible');
});

document.getElementById('dl-png')!.addEventListener('click', () => {
  if (sessionLog.length === 0) return;
  const last = sessionLog[sessionLog.length - 1];
  const a = document.createElement('a');
  a.href = last.snapshot;
  a.download = `whiteboard-slide-${sessionLog.length}.png`;
  a.click();
  downloadMenu.classList.remove('visible');
});

document.getElementById('dl-all-png')!.addEventListener('click', () => {
  if (sessionLog.length === 0) return;
  if (sessionLog.length === 1) {
    const a = document.createElement('a');
    a.href = sessionLog[0].snapshot;
    a.download = 'whiteboard-slide-1.png';
    a.click();
    downloadMenu.classList.remove('visible');
    return;
  }
  for (let i = 0; i < sessionLog.length; i++) {
    const a = document.createElement('a');
    a.href = sessionLog[i].snapshot;
    a.download = `whiteboard-slide-${i + 1}.png`;
    a.click();
  }
  downloadMenu.classList.remove('visible');
});
