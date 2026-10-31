(function(){
  const root = document.documentElement;

  // ---------------- State ----------------
  let state = {
    focusMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    mode: 'focus',        // 'focus' | 'break' | 'longBreak'
    secondsLeft: 25*60,
    running: false,
    sessionsToday: 0,
    cycleCount: 0          // focus sessions completed since last long break (0-3)
  };
  let items = [];
  let intervalId = null;
  let musicLoaded = false;

  const STORAGE_KEY_SETTINGS = 'foco-settings';
  const STORAGE_KEY_ITEMS = 'foco-checklist-items';

  const els = {
    timeDisplay: document.getElementById('timeDisplay'),
    focusVal: document.getElementById('focusVal'),
    breakVal: document.getElementById('breakVal'),
    longBreakVal: document.getElementById('longBreakVal'),
    startBtn: document.getElementById('startBtn'),
    resetBtn: document.getElementById('resetBtn'),
    sessionCount: document.getElementById('sessionCount'),
    cycleLabel: document.getElementById('cycleLabel'),
    cycleDots: document.getElementById('cycleDots'),
    ticks: document.getElementById('ticks'),
    modePills: document.querySelectorAll('.mode-pill'),
    brandMark: document.getElementById('brandMark'),
    tabs: document.querySelectorAll('.tab'),
    views: document.querySelectorAll('.view'),
    checklist: document.getElementById('checklist'),
    addForm: document.getElementById('addForm'),
    newItemInput: document.getElementById('newItemInput'),
    progressLabel: document.getElementById('progressLabel'),
    emptyState: document.getElementById('emptyState'),
    musicToggle: document.getElementById('musicToggle'),
    musicPanel: document.getElementById('musicPanel'),
    musicFrame: document.getElementById('musicFrame'),
    treeEmoji: document.getElementById('treeEmoji'),
    treeTitle: document.getElementById('treeTitle'),
    treeMessage: document.getElementById('treeMessage')
  };

  // ---------------- Storage helpers ----------------
  async function loadSettings(){
    try{
      const res = await window.storage.get(STORAGE_KEY_SETTINGS, false);
      if(res && res.value){
        const saved = JSON.parse(res.value);
        state.focusMin = saved.focusMin ?? 25;
        state.breakMin = saved.breakMin ?? 5;
        state.longBreakMin = saved.longBreakMin ?? 15;
        state.sessionsToday = saved.sessionsToday ?? 0;
        state.cycleCount = saved.cycleCount ?? 0;
      }
    }catch(e){ /* no saved settings yet */ }
    state.secondsLeft = durationFor(state.mode) * 60;
  }

  async function saveSettings(){
    try{
      await window.storage.set(STORAGE_KEY_SETTINGS, JSON.stringify({
        focusMin: state.focusMin,
        breakMin: state.breakMin,
        longBreakMin: state.longBreakMin,
        sessionsToday: state.sessionsToday,
        cycleCount: state.cycleCount
      }), false);
    }catch(e){ console.error('Falha ao salvar configurações', e); }
  }

  async function loadItems(){
    try{
      const res = await window.storage.get(STORAGE_KEY_ITEMS, false);
      if(res && res.value){ items = JSON.parse(res.value); }
    }catch(e){ items = []; }
  }

  async function saveItems(){
    try{
      await window.storage.set(STORAGE_KEY_ITEMS, JSON.stringify(items), false);
    }catch(e){ console.error('Falha ao salvar checklist', e); }
  }

  // ---------------- Timer rendering ----------------
  function durationFor(mode){
    if(mode === 'focus') return state.focusMin;
    if(mode === 'break') return state.breakMin;
    return state.longBreakMin;
  }
  function totalSecondsForMode(mode){ return durationFor(mode) * 60; }

  function formatTime(sec){
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = Math.floor(sec%60).toString().padStart(2,'0');
    return m+':'+s;
  }

  function applyAccent(){
    const varName = state.mode === 'focus' ? '--focus' : (state.mode === 'break' ? '--break' : '--long');
    const accent = getComputedStyle(root).getPropertyValue(varName);
    root.style.setProperty('--accent', accent.trim());
  }

  function renderTicks(){
    const totalMinutes = Math.ceil(totalSecondsForMode(state.mode)/60);
    const elapsedSeconds = totalSecondsForMode(state.mode) - state.secondsLeft;
    els.ticks.innerHTML = '';
    for(let i=0; i<totalMinutes; i++){
      const tick = document.createElement('div');
      tick.className = 'tick';
      const fill = document.createElement('div');
      fill.className = 'fill';
      const minuteStartSec = i*60;
      if(elapsedSeconds >= minuteStartSec + 60){
        tick.classList.add('filled');
      } else if(elapsedSeconds > minuteStartSec){
        const pct = ((elapsedSeconds - minuteStartSec)/60)*100;
        fill.style.width = pct+'%';
      }
      tick.appendChild(fill);
      els.ticks.appendChild(tick);
    }
  }

  function renderCycle(){
    const displayCount = state.cycleCount === 0 && state.mode !== 'focus' ? 4 : state.cycleCount + (state.mode==='focus' ? 1 : 0);
    els.cycleLabel.textContent = Math.min(displayCount, 4);
    els.cycleDots.innerHTML = '';
    for(let i=0;i<4;i++){
      const dot = document.createElement('span');
      dot.className = 'cycle-dot' + (i < state.cycleCount ? ' filled' : '');
      els.cycleDots.appendChild(dot);
    }
  }

  function renderTree(){
    if(state.mode !== 'focus'){
      els.treeEmoji.textContent = '☕';
      els.treeTitle.textContent = 'Momento de Descanso';
      els.treeMessage.textContent = 'Relaxe para o próximo ciclo de foco.';
      return;
    }

    const total = totalSecondsForMode('focus');
    const progress = (total - state.secondsLeft) / total;

    if(progress < 0.25){
      els.treeEmoji.textContent = '🌱';
      els.treeTitle.textContent = 'Semente Plantada';
      els.treeMessage.textContent = 'Mantenha o foco para a árvore crescer.';
    } else if(progress < 0.50){
      els.treeEmoji.textContent = '🌿';
      els.treeTitle.textContent = 'Broto Crescendo';
      els.treeMessage.textContent = 'Ótimo ritmo! Continue firme.';
    } else if(progress < 0.75){
      els.treeEmoji.textContent = '🌲';
      els.treeTitle.textContent = 'Árvore em Desenvolvimento';
      els.treeMessage.textContent = 'Mais da metade do caminho percorrida.';
    } else {
      els.treeEmoji.textContent = '🌳';
      els.treeTitle.textContent = 'Árvore Frondosa';
      els.treeMessage.textContent = 'Quase concluindo o ciclo de foco!';
    }
  }

  function renderTimer(){
    els.timeDisplay.textContent = formatTime(state.secondsLeft);
    els.focusVal.textContent = state.focusMin;
    els.breakVal.textContent = state.breakMin;
    els.longBreakVal.textContent = state.longBreakMin;
    els.sessionCount.textContent = state.sessionsToday;
    els.startBtn.textContent = state.running ? 'Pausar' : (state.secondsLeft === totalSecondsForMode(state.mode) ? 'Iniciar' : 'Continuar');

    els.modePills.forEach(p=>{
      const isActive = p.dataset.mode === state.mode;
      p.classList.toggle('active', isActive);
      p.disabled = state.running;
    });

    document.querySelectorAll('[data-adjust]').forEach(btn=>{
      const key = btn.dataset.adjust;
      btn.disabled = state.running && key === state.mode;
    });

    applyAccent();
    renderTicks();
    renderCycle();
    renderTree();
    document.title = (state.running ? formatTime(state.secondsLeft)+' · ' : '') + 'foco.';
  }

  // ---------------- Timer logic ----------------
  function playChime(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.9);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime+0.9);
    }catch(e){ /* audio not available */ }
  }

  function tick(){
    state.secondsLeft -= 1;
    if(state.secondsLeft <= 0){
      playChime();
      if(state.mode === 'focus'){
        state.sessionsToday += 1;
        state.cycleCount += 1;
        els.treeEmoji.textContent = '🌳';
        els.treeTitle.textContent = 'Ciclo Concluído!';
        els.treeMessage.textContent = 'Parabéns, você cultivou sua árvore com sucesso.';
        if(state.cycleCount >= 4){
          state.mode = 'longBreak';
        } else {
          state.mode = 'break';
        }
      } else {
        if(state.mode === 'longBreak'){ state.cycleCount = 0; }
        state.mode = 'focus';
      }
      state.secondsLeft = totalSecondsForMode(state.mode);
      saveSettings();
    }
    renderTimer();
  }

  function startPause(){
    if(state.running){
      state.running = false;
      clearInterval(intervalId);
    } else {
      state.running = true;
      intervalId = setInterval(tick, 1000);
    }
    renderTimer();
  }

  function reset(){
    state.running = false;
    clearInterval(intervalId);
    state.secondsLeft = totalSecondsForMode(state.mode);
    renderTimer();
  }

  function switchMode(mode){
    if(state.running) return;
    state.mode = mode;
    state.secondsLeft = totalSecondsForMode(mode);
    renderTimer();
  }

  function adjustDuration(key, delta){
    if(state.running && key === state.mode) return;
    const field = key === 'focus' ? 'focusMin' : (key === 'break' ? 'breakMin' : 'longBreakMin');
    let val = state[field] + delta;
    val = Math.max(1, Math.min(120, val));
    state[field] = val;
    if(state.mode === key){
      state.secondsLeft = totalSecondsForMode(state.mode);
    }
    saveSettings();
    renderTimer();
  }

  // 🛡️ Page Visibility API: Detecta se o usuário abandonou a aba durante o foco
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && state.running && state.mode === 'focus'){
      state.running = false;
      clearInterval(intervalId);
      
      els.treeEmoji.textContent = '🥀';
      els.treeTitle.textContent = 'Árvore Murchou';
      els.treeMessage.textContent = 'Você abandonou a aba e perdeu o foco!';
      renderTimer();
    }
  });

  // ---------------- Music (Spotify) ----------------
  els.musicToggle.addEventListener('click', ()=>{
    const isOpen = els.musicPanel.classList.toggle('open');
    els.musicToggle.classList.toggle('open', isOpen);
    if(isOpen && !musicLoaded){
      els.musicFrame.src = els.musicFrame.dataset.src;
      musicLoaded = true;
    }
  });

  // ---------------- Checklist logic ----------------
  function uid(){ return 'i'+Date.now()+Math.random().toString(36).slice(2,7); }

  function renderChecklist(){
    els.checklist.innerHTML = '';
    els.emptyState.style.display = items.length ? 'none' : 'block';

    items.forEach(item=>{
      const li = document.createElement('li');
      li.className = 'item' + (item.done ? ' done' : '');
      li.dataset.id = item.id;

      const box = document.createElement('div');
      box.className = 'box';
      box.setAttribute('role','checkbox');
      box.setAttribute('aria-checked', item.done);
      box.tabIndex = 0;
      box.addEventListener('click', ()=> toggleItem(item.id));
      box.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggleItem(item.id); }});

      const text = document.createElement('div');
      text.className = 'text';
      text.contentEditable = 'true';
      text.spellcheck = false;
      text.textContent = item.text;
      text.addEventListener('blur', ()=> updateItemText(item.id, text.textContent));
      text.addEventListener('keydown', e=>{
        if(e.key === 'Enter'){ e.preventDefault(); text.blur(); }
      });

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.setAttribute('aria-label','Remover tarefa');
      del.addEventListener('click', ()=> deleteItem(item.id));

      li.appendChild(box);
      li.appendChild(text);
      li.appendChild(del);
      els.checklist.appendChild(li);
    });

    const doneCount = items.filter(i=>i.done).length;
    els.progressLabel.textContent = doneCount+' de '+items.length;
  }

  function addItem(text){
    const clean = text.trim();
    if(!clean) return;
    items.unshift({ id: uid(), text: clean, done:false });
    saveItems();
    renderChecklist();
  }

  function toggleItem(id){
    const it = items.find(i=>i.id===id);
    if(it){ it.done = !it.done; saveItems(); renderChecklist(); }
  }

  function updateItemText(id, text){
    const it = items.find(i=>i.id===id);
    if(!it) return;
    const clean = text.trim();
    if(!clean){ deleteItem(id); return; }
    it.text = clean;
    saveItems();
  }

  function deleteItem(id){
    items = items.filter(i=>i.id!==id);
    saveItems();
    renderChecklist();
  }

  // ---------------- Tabs ----------------
  function switchTab(tabName){
    els.tabs.forEach(t=> t.classList.toggle('active', t.dataset.tab===tabName));
    els.views.forEach(v=> v.classList.toggle('active', v.id === 'view-'+tabName));
  }

  // ---------------- Event bindings ----------------
  els.tabs.forEach(t=> t.addEventListener('click', ()=> switchTab(t.dataset.tab)));
  els.modePills.forEach(p=> p.addEventListener('click', ()=> switchMode(p.dataset.mode)));
  els.startBtn.addEventListener('click', startPause);
  els.resetBtn.addEventListener('click', reset);
  document.querySelectorAll('[data-adjust]').forEach(btn=>{
    btn.addEventListener('click', ()=> adjustDuration(btn.dataset.adjust, parseInt(btn.dataset.delta,10)));
  });
  els.addForm.addEventListener('submit', e=>{
    e.preventDefault();
    addItem(els.newItemInput.value);
    els.newItemInput.value = '';
    els.newItemInput.focus();
  });

  // ---------------- Init ----------------
  (async function init(){
    await loadSettings();
    await loadItems();
    renderTimer();
    renderChecklist();
  })();
})();
