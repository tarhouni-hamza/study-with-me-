var $ = function (id) { return document.getElementById(id); };
var KEY = 'study-timer-v1';
var C = 2 * Math.PI * 122;            
var MIN = 60000, HOUR = 3600000;

var QUOTES = ["Boring is the price of mastery. Stay in the chair.", "One block. Nothing else exists.",
  "Future you is watching. Make them proud.", "Discipline beats motivation. Keep going.",
  "Every finished block compounds.", "Phone down. Eyes on the page.", "Hard now, easy later.",
  "You're not tired. You're warming up."];
var BREAKS = ["Stand up. Drink water. Look far away.", "Walk and stretch. No phone scrolling.",
  "Rest your eyes. The next block needs you."];

function fresh(f, b, h) {
  f = f || 50; b = b || 10; h = h || 8;
  return { focus: f, brk: b, hours: h, phase: 'focus', left: f * MIN, totalLeft: h * HOUR,
           focusMs: 0, done: 0, running: false, started: false, finished: false, last: 0 };
}
var st;
try { st = JSON.parse(localStorage.getItem(KEY)); if (!st || !st.focus) st = null; else st.running = false; }
catch (e) { st = null; }
st = st || fresh();

function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

function p2(n) { return String(n).padStart(2, '0'); }
function fmt(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000));
  var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return h ? h + ':' + p2(m) + ':' + p2(r) : p2(m) + ':' + p2(r);
}
function fmtHM(ms) { return Math.floor(ms / HOUR) + 'h ' + p2(Math.floor(ms % HOUR / MIN)) + 'm'; }

var ac = null;
function initAudio() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) {}
}
function beep(times) {
  if (!ac) return;
  for (var i = 0; i < (times || 2); i++) {
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.35;
    o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t); o.stop(t + 0.26);
  }
}

function nextPhase(skipped) {
  if (st.phase === 'focus') { if (!skipped) st.done++; st.phase = 'break'; st.left = st.brk * MIN; }
  else { st.phase = 'focus'; st.left = st.focus * MIN; }
  if (!skipped) beep(2);
}
function finish() {
  st.running = false; st.finished = true; st.left = 0; st.totalLeft = 0; beep(3);
}
function advance(dt) {
  while (dt > 0 && st.totalLeft > 0 && !st.finished) {
    var step = Math.min(dt, st.left, st.totalLeft);
    st.left -= step; st.totalLeft -= step; dt -= step;
    if (st.phase === 'focus') st.focusMs += step;
    if (st.totalLeft <= 0) { finish(); return; }
    if (st.left <= 0) nextPhase(false);
  }
}
function tick() {
  if (st.running) {
    var now = Date.now();
    advance(now - st.last);
    st.last = now;
    save();
  }
  render();
}

function build() {
  var n = Math.ceil(st.hours * 60 / (st.focus + st.brk));
  $('ledger').innerHTML = '<div class="seg"><div class="fill"></div></div>'.repeat(n);
}
function render() {
  var focus = st.phase === 'focus';
  var len = (focus ? st.focus : st.brk) * MIN;
  $('app').dataset.phase = st.phase;
  $('bar').style.strokeDasharray = C;
  $('bar').style.strokeDashoffset = C * (1 - (st.finished ? 0 : st.left / len));
  $('clock').textContent = fmt(st.left);
  $('time').classList.toggle('long', st.left >= HOUR);
  $('sub').textContent = focus ? 'left in this block' : 'break time';
  $('phase').textContent = st.finished ? 'Session complete' : focus ? 'Focus block ' + (st.done + 1) : 'Break';
  var list = focus ? QUOTES : BREAKS;
  $('quote').textContent = st.finished
    ? fmtHM(st.focusMs) + ' of real focus. That is how habits are built.'
    : list[st.done % list.length];
  $('tleft').textContent = fmt(st.totalLeft);
  $('focused').textContent = fmtHM(st.focusMs);
  $('done').textContent = st.done;

  var cycle = st.focus + st.brk, elapsed = (st.hours * HOUR - st.totalLeft) / MIN;
  var fills = document.querySelectorAll('.fill');
  for (var i = 0; i < fills.length; i++) {
    fills[i].style.width = Math.min(100, Math.max(0, (elapsed - i * cycle) / cycle * 100)) + '%';
  }
  $('go').textContent = st.finished ? 'Done' : st.running ? 'Pause' : st.started ? 'Resume' : 'Start';
  $('go').disabled = st.finished; $('skip').disabled = st.finished;
  var chips = document.querySelectorAll('.chip');
  for (var j = 0; j < chips.length; j++) {
    chips[j].setAttribute('aria-pressed', String(+chips[j].dataset.f === st.focus));
    chips[j].disabled = st.running;
  }
  $('hours').value = st.hours; $('hours').disabled = st.running;
  document.title = fmt(st.left) + ' · ' + (focus ? 'Focus' : 'Break');
}

$('go').onclick = function () {
  if (st.finished) return;
  if (st.running) { st.running = false; }
  else { st.running = true; st.started = true; st.last = Date.now(); initAudio(); }
  save(); render();
};
$('skip').onclick = function () { if (!st.finished) { nextPhase(true); save(); render(); } };
$('reset').onclick = function () { st = fresh(st.focus, st.brk, st.hours); build(); save(); render(); };
document.querySelectorAll('.chip').forEach(function (c) {
  c.onclick = function () { st = fresh(+c.dataset.f, +c.dataset.b, st.hours); build(); save(); render(); };
});
$('hours').onchange = function (e) { st = fresh(st.focus, st.brk, +e.target.value); build(); save(); render(); };
document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

build(); render();
setInterval(tick, 250);
