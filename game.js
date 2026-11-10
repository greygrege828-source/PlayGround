(() => {
  'use strict';
  const SAVE_KEY = 'crumb-crown-save-v1';
  const OWNER_CODE = '2257';
  const buildings = [
    { id: 'cursor', name: 'Little helper', icon: '☝', description: 'A tiny tap on the shoulder', base: 15, cps: 0.2 },
    { id: 'grandma', name: 'Cookie grandma', icon: '♧', description: 'Her recipe is a family secret', base: 100, cps: 1 },
    { id: 'oven', name: 'Copper oven', icon: '♨', description: 'Bakes while you dream', base: 500, cps: 5 },
    { id: 'farm', name: 'Dough garden', icon: '❀', description: 'Fresh ingredients, all day long', base: 2500, cps: 20 },
    { id: 'truck', name: 'Cookie cart', icon: '♧', description: 'Delivering warmth around town', base: 12000, cps: 80 },
    { id: 'factory', name: 'Sugar works', icon: '⚙', description: 'A deliciously clever machine', base: 65000, cps: 350 },
    { id: 'patisserie', name: 'Skyline patisserie', icon: '⌂', description: 'A little slice of the high life', base: 350000, cps: 1800 },
    { id: 'portal', name: 'Dough portal', icon: '✧', description: 'Cookies from another dimension', base: 2000000, cps: 10000 }
  ];
  const achievements = [
    { id: 'first', icon: '✦', name: 'First batch', detail: 'Bake your very first cookie', test: s => s.allTime >= 1 },
    { id: 'hundred', icon: '◉', name: 'Sweet hundred', detail: 'Bake 100 cookies in total', test: s => s.allTime >= 100 },
    { id: 'thousand', icon: '♨', name: 'A proper bakery', detail: 'Bake 1,000 cookies in total', test: s => s.allTime >= 1000 },
    { id: 'crew', icon: '♧', name: 'The whole crew', detail: 'Own 10 bakery helpers', test: s => s.buildings.reduce((a, n) => a + n, 0) >= 10 },
    { id: 'rush', icon: '⚡', name: 'Sugar rush', detail: 'Bake 1,000 cookies per second', test: s => cps(s) >= 1000 }
  ];
  const defaults = () => ({ cookies: 0, allTime: 0, runCount: 0, buildings: buildings.map(() => 0), crowns: 0, lastSaved: Date.now(), lastDaily: 0, achievements: [], boostUntil: 0, sound: true });
  let state = loadState();
  let lastTick = Date.now();
  let toastTimer;
  let ownerUnlocked = false;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved || !Array.isArray(saved.buildings)) return defaults();
      const base = defaults();
      return { ...base, ...saved, buildings: buildings.map((_, i) => Math.max(0, Number(saved.buildings[i]) || 0)), achievements: Array.isArray(saved.achievements) ? saved.achievements : [] };
    } catch { return defaults(); }
  }
  function save() {
    state.lastSaved = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Storage may be unavailable in private mode. */ }
  }
  function cps(s = state) {
    return buildings.reduce((sum, item, i) => sum + item.cps * (s.buildings[i] || 0), 0) * (1 + (s.crowns || 0) * 0.1);
  }
  function clickValue() {
    const base = Math.max(1, Math.floor(1 + cps() * 0.05)) * (1 + state.crowns * 0.1);
    const now = Date.now();
    return base * (now < (state.ownerMultiplierUntil || 0) ? 5 : now < state.boostUntil ? 2 : 1);
  }
  function price(item, index) { return Math.ceil(item.base * Math.pow(1.15, state.buildings[index])); }
  function fmt(value) {
    if (!Number.isFinite(value)) return '∞';
    const n = Math.floor(Math.max(0, value));
    if (n < 1000) return n.toLocaleString('en-US');
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [size, label] of units) if (n >= size) {
      const result = n / size;
      return `${result >= 100 ? Math.floor(result) : result >= 10 ? result.toFixed(1) : result.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}${label}`;
    }
    return String(n);
  }
  function exact(value) { return Math.floor(value).toLocaleString('en-US'); }
  function showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function maybeAchievements() {
    let changed = false;
    for (const item of achievements) {
      if (!state.achievements.includes(item.id) && item.test(state)) {
        state.achievements.push(item.id);
        changed = true;
        showToast(`Milestone unlocked: ${item.name}`);
      }
    }
    if (changed) save();
  }
  function gain(amount, countForRun = true) {
    const n = Math.max(0, Number(amount) || 0);
    state.cookies += n;
    state.allTime += n;
    if (countForRun) state.runCount += n;
    maybeAchievements();
  }
  function renderShop() {
    const list = document.getElementById('shopList');
    list.innerHTML = buildings.map((item, i) => {
      const cost = price(item, i);
      const canBuy = state.cookies >= cost;
      return `<div class="shop-item ${canBuy ? 'affordable' : 'locked'}" data-index="${i}">
        <div class="shop-icon">${item.icon}</div><div class="shop-info"><div class="shop-name">${item.name}</div><div class="shop-description">${item.description}</div></div>
        <div class="shop-buy"><button data-buy="${i}" ${canBuy ? '' : 'disabled'} aria-label="Buy ${item.name} for ${exact(cost)} cookies">${canBuy ? 'BUY' : 'NEED'}</button><div class="shop-owned">Owned · <b>${fmt(state.buildings[i])}</b></div><div class="shop-price">🍪 ${fmt(cost)}</div></div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => buy(Number(button.dataset.buy))));
    const owned = state.buildings.reduce((sum, n) => sum + n, 0);
    document.getElementById('shopCount').textContent = `${owned} helper${owned === 1 ? '' : 's'} / 8`;
  }
  function renderAchievements() {
    const list = document.getElementById('achievementList');
    list.innerHTML = achievements.map(item => {
      const done = state.achievements.includes(item.id);
      return `<div class="achievement ${done ? 'done' : ''}"><div class="achievement-icon">${item.icon}</div><div class="achievement-copy"><b>${item.name}</b><small>${item.detail}</small></div><span class="achievement-check">${done ? '✓' : '· · ·'}</span></div>`;
    }).join('');
    const count = state.achievements.length;
    document.getElementById('achievementCount').textContent = `${count} of ${achievements.length} complete`;
    document.getElementById('achievementPct').textContent = `${Math.round(count / achievements.length * 100)}%`;
    document.getElementById('achievementBar').style.width = `${count / achievements.length * 100}%`;
  }
  function render() {
    document.getElementById('cookieCount').textContent = fmt(state.cookies);
    document.getElementById('cookieCount').title = exact(state.cookies);
    document.getElementById('allTime').textContent = fmt(state.allTime);
    document.getElementById('allTime').title = exact(state.allTime);
    const now = Date.now();
    const activeMultiplier = now < (state.ownerMultiplierUntil || 0) ? 5 : now < state.boostUntil ? 2 : 1;
    document.getElementById('perSecond').textContent = fmt(cps() * activeMultiplier);
    document.getElementById('clickPower').textContent = fmt(clickValue());
    document.getElementById('bakerCount').textContent = fmt(state.buildings.reduce((a, n) => a + n, 0));
    document.getElementById('runCount').textContent = fmt(state.runCount);
    document.getElementById('level').textContent = Math.max(1, Math.floor(Math.sqrt(state.allTime / 100)) + 1);
    document.getElementById('prestigeBtn').disabled = state.allTime < 100000;
    document.getElementById('prestigeBtn').innerHTML = `<span>♛</span> ASCEND <small>${state.crowns} CROWN${state.crowns === 1 ? '' : 'S'}${state.allTime >= 100000 ? ` · +${Math.max(1, Math.floor(Math.sqrt(state.allTime / 100000)))}` : ''}</small>`;
    const boost = Date.now() < state.boostUntil;
    const boostBtn = document.getElementById('boostBtn');
    boostBtn.disabled = !boost && state.cookies < 2500;
    boostBtn.innerHTML = boost ? `ACTIVE · ${Math.ceil((state.boostUntil - Date.now()) / 1000)}s` : 'ACTIVATE <span>· 2,500</span>';
    document.getElementById('boostMeter').style.width = boost ? `${Math.max(0, Math.min(100, (state.boostUntil - Date.now()) / 300))}%` : '0%';
    renderShop();
    renderAchievements();
  }
  function buy(index) {
    const item = buildings[index];
    const cost = price(item, index);
    if (!item || state.cookies < cost) return;
    state.cookies -= cost;
    state.buildings[index]++;
    maybeAchievements();
    save(); render();
    showToast(`${item.name} joined the bakery!`);
  }
  function bake(event) {
    const amount = clickValue();
    gain(amount);
    save(); render();
    const button = document.getElementById('bigCookie');
    button.classList.remove('pressed');
    void button.offsetWidth;
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 120);
    if (event) {
      const rect = button.getBoundingClientRect();
      const float = document.createElement('span');
      float.className = 'float-number';
      float.textContent = `+${fmt(amount)}`;
      float.style.left = `${event.clientX || rect.left + rect.width / 2}px`;
      float.style.top = `${event.clientY || rect.top + rect.height / 2}px`;
      document.body.appendChild(float);
      setTimeout(() => float.remove(), 800);
    }
  }
  function activateBoost(free = false, duration = 30000) {
    if (!free && state.cookies < 2500) { showToast('You need 2,500 cookies for a sugar rush.'); return false; }
    if (!free) state.cookies -= 2500;
    state.boostUntil = Date.now() + duration;
    save(); render();
    showToast(free ? 'The owner activated a golden bake!' : 'Sugar rush! Double cookies for 30 seconds.');
    return true;
  }
  function ascend() {
    if (state.allTime < 100000) return;
    const crowns = Math.max(1, Math.floor(Math.sqrt(state.allTime / 100000)));
    if (!confirm(`Ascend for ${crowns} crown${crowns === 1 ? '' : 's'}? Your cookies and helpers reset, but your crown bonus stays forever.`)) return;
    state.crowns += crowns;
    state.cookies = 0;
    state.runCount = 0;
    state.buildings = buildings.map(() => 0);
    state.boostUntil = 0;
    save(); render(); showToast(`A new chapter begins: +${crowns} crown${crowns === 1 ? '' : 's'}!`);
  }
  function commandResult(message) {
    document.getElementById('commandOutput').innerHTML = `<span class="terminal-prompt">›</span> ${message}`;
  }
  function runCommand(raw) {
    const input = raw.trim().toLowerCase().replace(/^\//, '');
    const [cmd] = input.split(/\s+/);
    if (!cmd) return;
    if (cmd === 'help') commandResult('<b>help</b> · <b>daily</b> · <b>stats</b> · <b>bake</b> · <b>boost</b> · <b>hello</b>');
    else if (cmd === 'daily') {
      const remaining = 86400000 - (Date.now() - state.lastDaily);
      if (remaining > 0) commandResult(`Daily treat ready in <b>${Math.ceil(remaining / 3600000)}h</b>. Come back tomorrow!`);
      else { state.lastDaily = Date.now(); gain(100); save(); render(); commandResult('A little daily treat: <b>+100 cookies</b>. Enjoy!'); showToast('Daily treat collected: +100 cookies'); }
    } else if (cmd === 'stats') commandResult(`<b>${fmt(state.cookies)}</b> cookies · <b>${fmt(cps())}</b> / sec · <b>${state.crowns}</b> crowns`);
    else if (cmd === 'bake') { gain(1); save(); render(); commandResult('One fresh cookie, right from the console. <b>+1</b>'); }
    else if (cmd === 'boost') {
      if (Date.now() < state.boostUntil) commandResult('Sugar rush is already active. Keep baking!');
      else if (activateBoost(false)) commandResult('Sugar rush activated. <b>2× production for 30 seconds!</b>');
      else commandResult('A sugar rush costs <b>2,500 cookies</b>.');
    } else if (cmd === 'hello') commandResult('The oven says hello. <b>Keep those cookies coming!</b>');
    else commandResult(`Unknown command. Type <b>help</b> for the mini admin list.`);
  }
  function openModal() {
    const backdrop = document.getElementById('modalBackdrop');
    backdrop.hidden = false;
    document.getElementById('ownerCode').value = '';
    document.getElementById('ownerCode').hidden = ownerUnlocked;
    document.querySelector('#ownerCodeForm button').hidden = ownerUnlocked;
    document.getElementById('ownerCodeForm').hidden = ownerUnlocked;
    document.getElementById('modalTitle').textContent = ownerUnlocked ? 'Owner command suite' : "Owner's entrance";
    document.getElementById('modalDescription').textContent = ownerUnlocked ? 'Big bakery commands are ready. These tools only affect this local game.' : 'Enter the owner code to unlock the command suite.';
    document.getElementById('modalEmblem').textContent = ownerUnlocked ? '♛' : '✦';
    document.getElementById('modalEyebrow').textContent = ownerUnlocked ? 'FULL BAKERY CONTROL' : 'BAKERY ACCESS';
    document.getElementById('ownerPanel').hidden = !ownerUnlocked;
    if (ownerUnlocked) renderOwnerPanel();
    if (!ownerUnlocked) setTimeout(() => document.getElementById('ownerCode').focus(), 30);
  }
  function renderOwnerPanel() {
    const panel = document.getElementById('ownerPanel');
    panel.innerHTML = `<div class="owner-badge">OWNER ACCESS <span>● VERIFIED · LOCAL GAME</span></div><div class="owner-command-grid">
      <button class="owner-action" data-owner="100k"><b>+100,000 cookies</b><small>Give the bakery a boost</small></button>
      <button class="owner-action" data-owner="1m"><b>+1,000,000 cookies</b><small>A very big batch</small></button>
      <button class="owner-action" data-owner="rush"><b>Golden oven · 2 min</b><small>5× production and clicks</small></button>
      <button class="owner-action" data-owner="helpers"><b>Stock every station</b><small>Add 10 of each helper</small></button>
      <button class="owner-action" data-owner="crowns"><b>Grant 5 crowns</b><small>Permanent 50% bonus</small></button>
      <button class="owner-action" data-owner="milestones"><b>Unlock milestones</b><small>Complete all achievements</small></button>
      <button class="owner-action danger" data-owner="reset"><b>Reset bakery</b><small>Start this save from scratch</small></button>
      <button class="owner-action danger" data-owner="close"><b>Lock command suite</b><small>Close owner access</small></button>
    </div><div class="owner-footer">Owner commands are cheats for this single-player bakery.<br>Your progress is saved in this browser.</div>`;
    panel.querySelectorAll('[data-owner]').forEach(button => button.addEventListener('click', () => ownerCommand(button.dataset.owner)));
  }
  function ownerCommand(action) {
    if (action === '100k' || action === '1m') {
      const n = action === '100k' ? 100000 : 1000000;
      gain(n); save(); render(); showToast(`Owner command: +${fmt(n)} cookies`); renderOwnerPanel();
    } else if (action === 'rush') {
      state.boostUntil = Date.now() + 120000;
      state.ownerMultiplierUntil = Date.now() + 120000;
      save(); render(); showToast('Golden oven activated for 2 minutes!');
      // A separate multiplier is applied by the production loop and click handler.
    } else if (action === 'helpers') {
      buildings.forEach((item, i) => { state.buildings[i] += 10; });
      maybeAchievements(); save(); render(); showToast('Ten of every helper are on the way!'); renderOwnerPanel();
    } else if (action === 'crowns') {
      state.crowns += 5; save(); render(); showToast('Five royal crowns added!'); renderOwnerPanel();
    } else if (action === 'milestones') {
      for (const item of achievements) if (!state.achievements.includes(item.id)) state.achievements.push(item.id);
      save(); render(); showToast('Every milestone unlocked!'); renderOwnerPanel();
    } else if (action === 'reset') {
      if (!confirm('Reset all cookies, helpers, crowns, and milestones in this browser? This cannot be undone.')) return;
      state = defaults(); save(); render(); showToast('Bakery reset. A fresh start!'); renderOwnerPanel();
    } else if (action === 'close') {
      ownerUnlocked = false;
      document.getElementById('modalBackdrop').hidden = true;
      showToast('Owner command suite locked.');
    }
  }
  function handleOwnerCode(event) {
    event.preventDefault();
    if (document.getElementById('ownerCode').value.trim() !== OWNER_CODE) {
      document.getElementById('modalDescription').textContent = 'That code did not work. Try again, baker.';
      document.getElementById('ownerCode').value = '';
      document.getElementById('ownerCode').focus();
      return;
    }
    ownerUnlocked = true;
    openModal();
    showToast('Owner command suite unlocked.');
  }

  document.getElementById('bigCookie').addEventListener('click', bake);
  document.getElementById('commandForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('commandInput');
    runCommand(input.value); input.value = '';
  });
  document.getElementById('commandHelp').addEventListener('click', () => commandResult('Commands: <b>daily</b> · <b>stats</b> · <b>bake</b> · <b>boost</b> · <b>hello</b>'));
  document.getElementById('boostBtn').addEventListener('click', () => activateBoost());
  document.getElementById('prestigeBtn').addEventListener('click', ascend);
  document.getElementById('ownerEntry').addEventListener('click', openModal);
  document.getElementById('ownerCodeForm').addEventListener('submit', handleOwnerCode);
  document.getElementById('modalClose').addEventListener('click', () => { document.getElementById('modalBackdrop').hidden = true; });
  document.getElementById('modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') event.currentTarget.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.getElementById('modalBackdrop').hidden = true; });
  document.getElementById('soundToggle').addEventListener('click', event => {
    state.sound = !state.sound; event.currentTarget.style.color = state.sound ? '' : '#7b6f5f';
    showToast(state.sound ? 'Sound effects enabled.' : 'Sound effects muted.'); save();
  });
  document.getElementById('settingsBtn').addEventListener('click', () => showToast('Your bakery saves automatically in this browser.'));

  // A capped eight-hour offline bake keeps the bakery lively without runaway totals.
  const awaySeconds = Math.min(8 * 60 * 60, Math.max(0, (Date.now() - (state.lastSaved || Date.now())) / 1000));
  if (awaySeconds > 60 && cps() > 0) {
    const bonus = cps() * awaySeconds;
    gain(bonus);
    showToast(`Welcome back! Your bakery made ${fmt(bonus)} cookies while you were away.`);
  }
  if (state.sound === false) document.getElementById('soundToggle').style.color = '#7b6f5f';
  render();
  setInterval(() => {
    const now = Date.now();
    const delta = Math.min(1, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (delta > 0 && cps() > 0) {
      const multiplier = now < (state.ownerMultiplierUntil || 0) ? 5 : now < state.boostUntil ? 2 : 1;
      gain(cps() * multiplier * delta, true);
    }
    render();
  }, 250);
  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
})();
