import { AgentWhiteboard } from '../src/index.js';
import { validateInstructions, formatValidationErrors } from './validate-instructions.js';

const canvas = document.getElementById('whiteboard') as HTMLCanvasElement;
const canvasWrap = document.getElementById('canvas-wrap') as HTMLDivElement;
const grabBar = document.getElementById('grab-bar') as HTMLDivElement;
const messagesEl = document.getElementById('messages') as HTMLDivElement;
const quickReplies = document.getElementById('quick-replies') as HTMLDivElement;
const quickRepliesEnd = document.getElementById('quick-replies-end') as HTMLDivElement;
const slideNav = document.getElementById('slide-nav') as HTMLDivElement;
const navBack = document.getElementById('nav-back') as HTMLButtonElement;
const navForward = document.getElementById('nav-forward') as HTMLButtonElement;
const slideIndicator = document.getElementById('slide-indicator') as HTMLSpanElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendBtn = document.getElementById('btn-send') as HTMLButtonElement;
const statusDot = document.getElementById('status-dot') as HTMLSpanElement;

let pendingAckId: string | null = null;
let pendingValidationErrors: string | null = null;
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
let viewingSlideIndex = -1; // -1 = live view, 0+ = viewing history
let lastSlideInfo = { slide: 0, totalSlides: 0 }; // Track for "last slide" detection
let liveCanvasSnapshot = ''; // Store live canvas state when viewing history
let pendingCaption = ''; // Caption waiting for slide info before rendering
let completedSlide: SlideRecord | null = null; // Stashed until next draw promotes it to history
let isDrawing = false; // True while board is animating instructions
const downloadBtn = document.getElementById('btn-download') as HTMLButtonElement;

function isLastSlide(): boolean {
  return lastSlideInfo.slide > 0 &&
         lastSlideInfo.slide === lastSlideInfo.totalSlides;
}

function showSlideSnapshot(index: number): void {
  if (index < 0 || index >= sessionLog.length) return;
  const snapshot = sessionLog[index].snapshot;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity for raw pixel copy
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };
  img.src = snapshot;
}

function returnToLive(): void {
  viewingSlideIndex = -1;
  if (liveCanvasSnapshot) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity for raw pixel copy
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };
    img.src = liveCanvasSnapshot;
  }
  updateNavUI();
}

function updateNavUI(): void {
  const hasHistory = sessionLog.length > 0;

  if (!hasHistory || isDrawing) {
    slideNav.classList.remove('visible');
    return;
  }

  slideNav.classList.add('visible');

  if (viewingSlideIndex === -1) {
    // Live view
    navBack.disabled = !hasHistory;
    navForward.disabled = true;
    slideIndicator.textContent = 'Live';
  } else {
    // Viewing history
    navBack.disabled = viewingSlideIndex === 0;
    navForward.disabled = false; // Can always go forward to live
    slideIndicator.textContent = `Slide ${viewingSlideIndex + 1}/${sessionLog.length}`;
  }
}

// Promote the stashed completed slide into history.
// Called when new content arrives, so the previous slide becomes "past".
function promoteCompletedSlide(): void {
  if (!completedSlide) return;
  sessionLog.push(completedSlide);
  completedSlide = null;
  updateNavUI();
}

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
    isDrawing = false;
    updateNavUI(); // Re-show nav now that drawing is done
    // Stash completed slide — it will be promoted to history when the next draw arrives
    if (!isWelcomeScreen && currentInstructions.length > 0) {
      completedSlide = {
        instructions: currentInstructions,
        caption: currentCaption,
        snapshot: canvas.toDataURL('image/png'),
        timestamp: Date.now(),
      };
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
    clearMessages(); // Clear chat when entering idle mode
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

// Track if user has manually scrolled up
let isUserScrolledUp = false;

// Check if messages container is scrolled near the bottom (within 50px threshold)
function isNearBottom(): boolean {
  const threshold = 50;
  const scrollBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  return scrollBottom <= threshold;
}

// Scroll to bottom smoothly
function scrollToBottom(smooth = true): void {
  if (smooth) {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// Track user scroll behavior
messagesEl.addEventListener('scroll', () => {
  isUserScrolledUp = !isNearBottom();
});

function addBubble(text: string, type: 'agent' | 'user' | 'system', suffix?: string): void {
  const div = document.createElement('div');
  div.className = `bubble ${type}`;
  div.textContent = text;
  if (suffix) {
    const span = document.createElement('span');
    span.className = 'bubble-suffix';
    span.textContent = suffix;
    div.appendChild(span);
  }
  messagesEl.appendChild(div);
  
  // Auto-scroll if user hasn't manually scrolled up, or if they sent the message
  if (!isUserScrolledUp || type === 'user') {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => scrollToBottom(true));
  }
}

function addAgentMessage(text: string, suffix?: string): void {
  addBubble(text, 'agent', suffix);
}

function addUserMessage(text: string): void {
  addBubble(text, 'user');
}

function addSystemMessage(text: string): void {
  addBubble(text, 'system');
}

function clearMessages(): void {
  messagesEl.innerHTML = '';
  isUserScrolledUp = false;
}

// --- Input state ---

function enableInput(): void {
  chatInput.disabled = false;
  sendBtn.disabled = false;
  // Show different quick-replies on last slide
  if (isLastSlide()) {
    quickReplies.classList.remove('visible');
    quickRepliesEnd.classList.add('visible');
  } else {
    quickReplies.classList.add('visible');
    quickRepliesEnd.classList.remove('visible');
  }
  chatInput.focus();
  // Scroll to bottom after quick-replies appear (they take up space)
  // Use setTimeout to ensure DOM has fully updated and laid out
  setTimeout(() => scrollToBottom(true), 100);
}

function disableInput(): void {
  chatInput.disabled = true;
  sendBtn.disabled = true;
  quickReplies.classList.remove('visible');
  quickRepliesEnd.classList.remove('visible');
  slideNav.classList.remove('visible');
}

function showTyping(): void {
  sendBtn.classList.add('loading');
  startIdleTimer();
}

function hideTyping(): void {
  sendBtn.classList.remove('loading');
}

// --- Send ---

function sendAck(id: string, message: string): void {
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    const msg: Record<string, string> = { type: 'ack', id };
    let fullMessage = message;
    if (pendingValidationErrors) {
      fullMessage = pendingValidationErrors + (fullMessage ? '\n' + fullMessage : '');
      pendingValidationErrors = null;
    }
    if (fullMessage) {
      msg.message = fullMessage;
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
  // Reset scroll tracking when user sends a message
  isUserScrolledUp = false;
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
  // Reset scroll tracking when user clicks quick reply
  isUserScrolledUp = false;
  sendAck(pendingAckId, message);
  pendingAckId = null;
  chatInput.value = '';
  disableInput();
  showTyping();
});

// Quick-reply chips for last slide ("Ok thanks")
quickRepliesEnd.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.chip') as HTMLButtonElement | null;
  if (!chip || chip.disabled || !pendingAckId) return;

  const message = chip.dataset.message || '';
  if (message) {
    addUserMessage(message);
  }
  // Reset scroll tracking when user clicks quick reply
  isUserScrolledUp = false;
  sendAck(pendingAckId, message);
  pendingAckId = null;
  chatInput.value = '';
  disableInput();
  showTyping();
});

// --- Slide navigation ---

navBack.addEventListener('click', () => {
  if (sessionLog.length === 0) return;

  if (viewingSlideIndex === -1) {
    // Entering history from live view — save live state
    liveCanvasSnapshot = canvas.toDataURL('image/png');
    viewingSlideIndex = sessionLog.length - 1;
  } else if (viewingSlideIndex > 0) {
    viewingSlideIndex--;
  }
  showSlideSnapshot(viewingSlideIndex);
  updateNavUI();
});

navForward.addEventListener('click', () => {
  if (viewingSlideIndex === -1) return; // Already at live

  if (viewingSlideIndex < sessionLog.length - 1) {
    viewingSlideIndex++;
    showSlideSnapshot(viewingSlideIndex);
    updateNavUI();
  } else {
    // At last history slide, go to live
    returnToLive();
  }
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

      case 'draw': {
        // Promote previous slide to history before drawing new content
        promoteCompletedSlide();
        const rawInstructions: unknown[] = data.instructions;
        const { valid, errors } = validateInstructions(rawInstructions);
        console.log(`[${ts()}] Draw received: ${rawInstructions.length} instructions (${valid.length} valid, ${errors.length} invalid)`);
        clearIdleTimer();
        isWelcomeScreen = false;
        hideTyping();
        // Auto-return to live view when agent draws new content
        viewingSlideIndex = -1;
        // Store slide info for last slide detection
        lastSlideInfo = {
          slide: data.slide || 0,
          totalSlides: data.totalSlides || 0,
        };
        currentInstructions = valid;
        isDrawing = true;
        updateNavUI(); // Hide nav while drawing
        board.addInstructions(valid);
        // Render caption with slide info as inline suffix
        if (pendingCaption) {
          let suffix = '';
          if (data.slide && data.totalSlides) {
            suffix = `${data.slide}/${data.totalSlides}`;
          }
          if (isLastSlide()) {
            suffix += suffix ? ' · fin' : 'fin';
          }
          addAgentMessage(pendingCaption, suffix || undefined);
          pendingCaption = '';
        }
        if (errors.length > 0) {
          addSystemMessage(`Warning: ${errors.length} of ${rawInstructions.length} instructions were invalid and skipped`);
          pendingValidationErrors = formatValidationErrors(errors, rawInstructions.length);
        } else {
          pendingValidationErrors = null;
        }
        if (data.ack_id) {
          if (valid.length === 0 && errors.length > 0) {
            // All instructions invalid — send errors back to agent immediately
            sendAck(data.ack_id, '');
          } else {
            pendingAckId = data.ack_id;
            // enableInput() will be called by onQueueEmpty when animation finishes
          }
        }
        break;
      }

      case 'caption':
        console.log(`[${ts()}] Caption received: "${data.text}"`);
        clearIdleTimer();
        currentCaption = data.text || '';
        // Slide suffix is set by the draw handler (arrives after caption)
        pendingCaption = data.text || '';
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

// Collect all slides: history + current live slide (if any)
function allSlides(): SlideRecord[] {
  const slides = [...sessionLog];
  if (completedSlide) {
    slides.push(completedSlide);
  }
  return slides;
}

document.getElementById('dl-json')!.addEventListener('click', () => {
  const slides = allSlides();
  if (slides.length === 0) return;
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    slides: slides.map(({ instructions, caption, timestamp }) => ({
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
  // Download current canvas directly
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `whiteboard-current.png`;
  a.click();
  downloadMenu.classList.remove('visible');
});

document.getElementById('dl-all-png')!.addEventListener('click', () => {
  const slides = allSlides();
  if (slides.length === 0) return;
  for (let i = 0; i < slides.length; i++) {
    const a = document.createElement('a');
    a.href = slides[i].snapshot;
    a.download = `whiteboard-slide-${i + 1}.png`;
    a.click();
  }
  downloadMenu.classList.remove('visible');
});
