(() => {
  'use strict';
  const SAVE_KEY = 'crumb-kingdom-save-v1';
  const helpers = [
    { id: 'cursor', name: 'Sugar sprite', emoji: '🧚', description: 'A tiny friend who never gets tired.', baseCost: 15, cps: 1 },
    { id: 'grandma', name: 'Cookie grandma', emoji: '👵', description: 'Her secret recipe is legendary.', baseCost: 100, cps: 5 },
    { id: 'oven', name: 'Copper oven', emoji: '♨️', description: 'Keeps a whole tray warm at once.', baseCost: 500, cps: 25 },
    { id: 'bakery', name: 'Corner bakery', emoji: '🏠', description: 'The neighborhood smells amazing.', baseCost: 2500, cps: 120 },
    { id: 'factory', name: 'Cookie factory', emoji: '🏭', description: 'A very, very large mixing bowl.', baseCost: 12000, cps: 600 },
    { id: 'portal', name: 'Dough portal', emoji: '🌀', description: 'Fresh cookies from another realm.', baseCost: 100000, cps: 5000 }
  ];
  const milestones = [
    { amount: 12, title: 'First dozen', description: 'Bake 12 cookies to earn your first badge.', icon: '🏅' },
    { amount: 100, title: 'Cookie curious', description: 'Bake 100 cookies and keep the good times rolling.', icon: '🍪' },
    { amount: 1000, title: 'A proper batch', description: 'Bake 1,000 cookies. That’s a lot of crumbs!', icon: '🥣' },
    { amount: 10000, title: 'The neighborhood baker', description: 'Bake 10,000 cookies for your growing kingdom.', icon: '🏠' },
    { amount: 100000, title: 'Crumb royalty', description: 'Bake 100,000 cookies. Long live the baker!', icon: '👑' }
  ];
  const achievements = [
    { id: 'first', name: 'Fresh out the oven', text: 'Bake your first cookie', icon: '🍪', check: s => s.lifetime >= 1 },
    { id: 'dozen', name: 'First dozen', text: 'Bake 12 cookies', icon: '🏅', check: s => s.lifetime >= 12 },
    { id: 'hundred', name: 'Cookie curious', text: 'Bake 100 cookies', icon: '✨', check: s => s.lifetime >= 100 },
    { id: 'thousand', name: 'Big batch energy', text: 'Bake 1,000 cookies', icon: '🥣', check: s => s.lifetime >= 1000 },
    { id: 'firstHelper', name: 'Helpful hands', text: 'Hire your first helper', icon: '🧚', check: s => s.helpers.cursor > 0 || s.helpers.grandma > 0 || s.helpers.oven > 0 || s.helpers.bakery > 0 || s.helpers.factory > 0 || s.helpers.portal > 0 },
    { id: 'team', name: 'Dream team', text: 'Own 10 helpers in total', icon: '👩‍🍳', check: s => totalHelpers(s) >= 10 },
    { id: 'million', name: 'A sweet million', text: 'Bake 1,000,000 cookies', icon: '👑', check: s => s.lifetime >= 1000000 }
  ];
  const defaultState = () => ({ cookies: 0, lifetime: 0, clicks: 0, clickPower: 1, helpers: Object.fromEntries(helpers.map(h => [h.id, 0])), lastDaily: '', goldenUntil: 0, lastSaved: Date.now(), achievements: [], sound: false });
  let state = defaultState();
  let toastTimer, saveTimer, audioContext;
  const $ = id => document.getElementById(id);
  const fmt = n => {
    if (!Number.isFinite(n)) return '0';
    if (n < 1000) return Math.floor(n).toLocaleString('en-US');
    const units = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];
    for (const [unit, value] of units) if (n >= value) return (n / value).toFixed(n >= value * 100 ? 0 : n >= value * 10 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9])0+$/g, '') + unit;
    return Math.floor(n).toLocaleString('en-US');
  };
  const totalHelpers = s => Object.values(s.helpers).reduce((a, b) => a + b, 0);
  const helperCps = () => helpers.reduce((sum, h) => sum + h.cps * state.helpers[h.id], 0);
  const currentCps = () => helperCps() * (Date.now() < state.goldenUntil ? 2 : 1);
  const upgradeCost = h => Math.floor(h.baseCost * Math.pow(1.16, state.helpers[h.id]));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      const fresh = defaultState();
      state = { ...fresh, ...saved, helpers: { ...fresh.helpers, ...(saved.helpers || {}) } };
      state.cookies = Math.max(0, Number(state.cookies) || 0);
      state.lifetime = Math.max(state.cookies, Number(state.lifetime) || 0);
      state.clickPower = Math.max(1, Number(state.clickPower) || 1);
      state.clicks = Math.max(0, Number(state.clicks) || 0);
      const away = Math.min(8 * 60 * 60, Math.max(0, (Date.now() - (Number(state.lastSaved) || Date.now())) / 1000));
      const bonus = currentCps() * away;
      if (bonus > 1) {
        state.cookies += bonus;
        state.lifetime += bonus;
        setTimeout(() => showToast(`Welcome back! Your helpers baked ${fmt(bonus)} cookies while you were away.`), 600);
      }
    } catch { state = defaultState(); }
  }
  function save() {
    state.lastSaved = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); $('saveLabel').textContent = 'ALL PROGRESS SAVED'; }
    catch { $('saveLabel').textContent = 'SAVE UNAVAILABLE'; }
  }
  function markUnsaved() { $('saveLabel').textContent = 'SAVING…'; clearTimeout(saveTimer); saveTimer = setTimeout(save, 350); }
  function render() {
    $('cookieCount').textContent = fmt(state.cookies);
    $('cpsCount').textContent = fmt(currentCps());
    $('clickCount').textContent = fmt(state.clickPower);
    $('lifetimeCount').textContent = fmt(state.lifetime);
    $('clickTotal').textContent = fmt(state.clicks);
    $('helperCount').textContent = `${fmt(totalHelpers(state))} owned`;
    $('soundToggle').classList.toggle('muted', !state.sound);
    renderUpgrades(); renderMilestone(); renderAchievements();
    $('dailyCaption').textContent = hasDaily() ? 'Come back tomorrow for more' : 'Claim your welcome bonus';
    $('dailyButton').classList.toggle('claimed', hasDaily());
  }
  function renderUpgrades() {
    $('upgradeList').innerHTML = helpers.map(h => {
      const cost = upgradeCost(h), can = state.cookies >= cost;
      return `<div class="upgrade-item ${can ? 'affordable' : ''}"><div class="upgrade-emoji">${h.emoji}</div><div class="upgrade-info"><b>${h.name}</b><small>+${fmt(h.cps)} cookies / sec</small></div><span class="upgrade-owned">×${fmt(state.helpers[h.id])}</span><button class="buy-button ${can ? 'can-buy' : ''}" data-buy="${h.id}" ${can ? '' : 'disabled'}>🍪 ${fmt(cost)}</button></div>`;
    }).join('');
  }
  function renderMilestone() {
    const next = milestones.find(m => state.lifetime < m.amount) || milestones[milestones.length - 1];
    const previous = milestones[milestones.indexOf(next) - 1]?.amount || 0;
    $('milestoneTitle').textContent = state.lifetime >= next.amount ? 'All-time crumb legend' : next.title;
    $('milestoneDescription').textContent = state.lifetime >= next.amount ? 'You baked every milestone. What a kingdom!' : next.description;
    const currentTarget = state.lifetime >= next.amount ? next.amount : next.amount;
    $('milestoneProgressText').textContent = `${fmt(Math.min(state.lifetime, currentTarget))} / ${fmt(currentTarget)}`;
    $('milestoneProgress').style.width = `${Math.min(100, state.lifetime / currentTarget * 100)}%`;
    $('milestone-icon');
    document.querySelector('.milestone-icon').textContent = next.icon;
  }
  function renderAchievements() {
    const earned = achievements.filter(a => a.check(state));
    const newly = earned.map(a => a.id).filter(id => !state.achievements.includes(id));
    if (newly.length) {
      state.achievements = [...new Set([...state.achievements, ...newly])];
      const first = achievements.find(a => a.id === newly[0]);
      if (first) showToast(`Badge earned: ${first.name}!`);
      markUnsaved();
    }
    $('achievementCount').textContent = `${earned.length} earned`;
    $('achievementGrid').innerHTML = achievements.map(a => `<div class="achievement ${a.check(state) ? 'earned' : ''}"><span class="achievement-icon">${a.icon}</span><span><b>${a.name}</b><small>${a.text}</small></span></div>`).join('');
  }
  function bake(amount = state.clickPower, byHand = true, source = null) {
    state.cookies += amount; state.lifetime += amount;
    if (byHand) state.clicks += 1;
    render(); markUnsaved();
    if (source) floatText(source, `+${fmt(amount)}`);
  }
  function buy(id) {
    const h = helpers.find(item => item.id === id); if (!h) return;
    const cost = upgradeCost(h);
    if (state.cookies < cost) { showToast('Not quite enough cookies yet. Keep baking!'); return; }
    state.cookies -= cost; state.helpers[id] += 1;
    render(); markUnsaved(); playSound(); showToast(`${h.name} is ready to help!`);
  }
  function floatText(el, text) {
    const parent = $('cookieStage'), rect = el.getBoundingClientRect(), box = parent.getBoundingClientRect();
    const node = document.createElement('span'); node.className = 'float-number'; node.textContent = text;
    node.style.left = `${rect.left - box.left + rect.width / 2}px`; node.style.top = `${rect.top - box.top + rect.height / 3}px`;
    parent.append(node); setTimeout(() => node.remove(), 850);
  }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2700);
  }
  function hasDaily() { return state.lastDaily === new Date().toISOString().slice(0, 10); }
  function claimDaily() {
    if (hasDaily()) { showToast('Your daily dough is already claimed. See you tomorrow!'); return; }
    const reward = Math.max(100, Math.floor(100 + helperCps() * 60));
    state.lastDaily = new Date().toISOString().slice(0, 10); bake(reward, false); playSound();
    showToast(`Daily dough claimed: +${fmt(reward)} cookies!`);
  }
  function playSound() {
    if (!state.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 620;
      gain.gain.setValueAtTime(.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .09);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .1);
    } catch { /* sound is optional */ }
  }
  function openAdmin(tab = 'mini') {
    $('adminPanel').classList.add('open'); $('mobileOverlay').classList.add('visible'); switchTab(tab);
  }
  function closeAdmin() { $('adminPanel').classList.remove('open'); $('mobileOverlay').classList.remove('visible'); }
  function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('selected', button.dataset.tab === tab));
    $('miniTab').classList.toggle('hidden', tab !== 'mini'); $('ownerTab').classList.toggle('hidden', tab !== 'owner');
  }
  function outputCommand(html) { $('terminalOutput').innerHTML = html; }
  function runMiniCommand(raw) {
    const command = raw.trim().toLowerCase().replace(/^\//, '');
    if (!command) return;
    switch (command) {
      case 'help': outputCommand('<span class="terminal-mark">✦</span> <b>Available commands</b><br><span class="muted-terminal">/stats · /daily · /bake · /help</span>'); break;
      case 'stats': outputCommand(`<span class="terminal-mark">✦</span> <b>Your bakery report</b><br><span class="muted-terminal">Cookies: ${fmt(state.cookies)} · Helpers: ${fmt(totalHelpers(state))}<br>Production: ${fmt(currentCps())}/sec · Hand-baked: ${fmt(state.clicks)}</span>`); break;
      case 'daily': claimDaily(); outputCommand(`<span class="terminal-mark">✦</span> ${hasDaily() ? 'Your daily dough is all yours!' : 'Come back tomorrow for your next batch.'}`); break;
      case 'bake': bake(10, false); playSound(); outputCommand('<span class="terminal-mark">✦</span> A warm little bonus: <b>+10 cookies!</b>'); break;
      default: outputCommand(`<span class="terminal-mark">✦</span> Hmm, I don’t know <b>/${escapeHtml(command)}</b>.<br><span class="muted-terminal">Try /help for the small commands.</span>`);
    }
  }
  function escapeHtml(text) { return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  function unlockOwner(event) {
    event.preventDefault();
    const code = $('ownerCode').value.trim().toLowerCase();
    if (['2257', 'riparmypika'].includes(code)) {
      $('ownerControls').classList.remove('hidden'); $('ownerLocked').classList.add('hidden');
      $('codeMessage').textContent = 'Access granted. Welcome to the owner’s oven!'; $('codeMessage').style.color = '#718a76';
      $('ownerCode').value = ''; showToast('Owner controls unlocked!');
    } else {
      $('codeMessage').textContent = 'That code didn’t open the oven. Try again.'; $('codeMessage').style.color = '#b87874';
      $('ownerCode').value = ''; $('ownerCode').focus();
    }
  }
  function runOwnerCommand(command) {
    if ($('ownerControls').classList.contains('hidden')) return;
    switch (command) {
      case 'bonus': bake(10000, false); showToast('The royal reserve added 10,000 cookies!'); break;
      case 'golden': state.goldenUntil = Date.now() + 60000; render(); markUnsaved(); showToast('Golden hour! Production doubled for 60 seconds.'); break;
      case 'helpers': helpers.forEach(h => state.helpers[h.id] += 1); render(); markUnsaved(); showToast('Your dream team is ready! One of every helper.'); break;
      case 'clickboost': state.clickPower += 10; render(); markUnsaved(); showToast(`Magic mittens! Click power is now ${fmt(state.clickPower)}.`); break;
      case 'reset':
        if (window.confirm('Start a fresh bakery? This will erase all progress on this device.')) {
          state = defaultState(); save(); render(); $('ownerControls').classList.add('hidden'); $('ownerLocked').classList.remove('hidden'); $('codeMessage').textContent = 'Your secret stays on this device.'; $('codeMessage').style.color = ''; outputCommand('<span class="terminal-mark">✦</span> A fresh new bakery. Let’s bake!'); showToast('Fresh start! Your bakery is ready.');
        }
        break;
    }
  }
  function nav(view) {
    const collection = view === 'collection';
    $('dashboardView').classList.toggle('hidden', collection); $('collectionView').classList.toggle('hidden', !collection);
    $('headerSection').textContent = collection ? 'LITTLE VICTORIES' : view === 'upgrades' ? 'LITTLE HELPERS' : 'OVERVIEW';
    document.querySelectorAll('.rail-link[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view || (view === 'upgrades' && button.dataset.view === 'bakery')));
    if (view === 'upgrades') { $('upgradesPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('bigCookie').addEventListener('click', event => { bake(state.clickPower, true, event.currentTarget); playSound(); });
  $('upgradeList').addEventListener('click', event => { const button = event.target.closest('[data-buy]'); if (button) buy(button.dataset.buy); });
  $('dailyButton').addEventListener('click', claimDaily);
  $('adminShortcut').addEventListener('click', () => openAdmin()); $('closeAdmin').addEventListener('click', closeAdmin); $('mobileOverlay').addEventListener('click', closeAdmin);
  document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  $('goOwner').addEventListener('click', () => { switchTab('owner'); $('ownerCode').focus(); });
  $('commandForm').addEventListener('submit', event => { event.preventDefault(); runMiniCommand($('commandInput').value); $('commandInput').value = ''; });
  document.querySelectorAll('.command-row').forEach(button => button.addEventListener('click', () => runMiniCommand(button.dataset.command)));
  $('codeForm').addEventListener('submit', unlockOwner);
  document.querySelectorAll('.owner-command').forEach(button => button.addEventListener('click', () => runOwnerCommand(button.dataset.owner)));
  $('soundToggle').addEventListener('click', () => { state.sound = !state.sound; render(); markUnsaved(); if (state.sound) playSound(); showToast(state.sound ? 'Sound on — a little kitchen chime!' : 'Sound off.'); });
  $('profileButton').addEventListener('click', () => openAdmin('mini'));
  document.querySelectorAll('.rail-link[data-view]').forEach(button => button.addEventListener('click', () => nav(button.dataset.view)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAdmin(); });
  window.addEventListener('beforeunload', save);
  load(); render();
  setInterval(() => {
    const rate = currentCps();
    if (rate > 0) { const amount = rate / 10; state.cookies += amount; state.lifetime += amount; }
    render();
    if (Date.now() >= state.goldenUntil && state.goldenUntil) { state.goldenUntil = 0; showToast('Golden hour has ended.'); markUnsaved(); }
  }, 100);
  setInterval(save, 10000);
  const hour = new Date().getHours(); $('greeting').firstChild.textContent = hour < 12 ? 'Good morning, baker' : hour < 18 ? 'Good afternoon, baker' : 'Good evening, baker';
  $('dateLabel').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase() + ' · A FRESH BATCH, EVERY DAY';
})();
