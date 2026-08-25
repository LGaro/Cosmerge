// Cosmerge - all rendering: grid, header, panels, modals, toasts, tutorial
"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const dom = {
  grid: $("grid"),
  stardustValue: $("stardustValue"),
  stardustRate: $("stardustRate"),
  gemsValue: $("gemsValue"),
  energyValue: $("energyValue"),
  energyPill: $("energyPill"),
  invokeBtn: $("invokeBtn"),
  invokeCost: $("invokeCost"),
  bigBangBtn: $("bigBangBtn"),
  selectionHint: $("selectionHint"),
  toastContainer: $("toastContainer"),
  fabDailyLogin: $("fabDailyLogin"),
  fabWheel: $("fabWheel"),
  fabFreePlanet: $("fabFreePlanet"),
  bannerAd: $("bannerAd"),
  menuBtn: $("menuBtn"),
  drawerOverlay: $("drawerOverlay"),
  drawerClose: $("drawerClose"),
  panelOverlay: $("panelOverlay"),
  panelTitle: $("panelTitle"),
  panelBody: $("panelBody"),
  panelClose: $("panelClose"),
};

let cellEls = [];
function buildGridDom() {
  dom.grid.innerHTML = "";
  cellEls = [];
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = i;
    dom.grid.appendChild(cell);
    cellEls.push(cell);
  }
}

function tierStyle(tier) {
  const t = TIERS[tier - 1];
  return `background:radial-gradient(circle at 35% 30%, ${t.from}, ${t.to});`;
}

function renderCell(i, opts) {
  opts = opts || {};
  const state = Game.state;
  const cell = cellEls[i];
  const locked = !state.unlocked[i];
  const tileData = state.grid[i];
  cell.className = "cell";
  cell.innerHTML = "";

  if (locked) {
    cell.classList.add("locked");
    if (Game.skipCellArmed) cell.classList.add("skipArmed");
    const label = document.createElement("div");
    label.className = "lockLabel";
    if (Game.skipCellArmed) {
      label.innerHTML = `<span class="emoji">💎</span><span>Sauter</span>`;
    } else {
      const n = state.extraUnlockedCount;
      label.innerHTML = `<span class="emoji">🔒</span><span>${formatNumber(unlockCost(n))}✨</span>`;
    }
    cell.appendChild(label);
    return;
  }

  if (!tileData) {
    cell.classList.add("empty");
    if (Game.selectedIdx === i) cell.classList.add("selectableEmpty");
    return;
  }

  cell.classList.add("filled");
  if (Game.selectedIdx === i) cell.classList.add("selected");

  const tile = document.createElement("div");
  tile.className = "tile";
  if (opts.merged) tile.classList.add("merging");
  if (opts.spawned) tile.classList.add("spawnIn");
  tile.style.cssText += tierStyle(tileData.tier);
  const emoji = document.createElement("div");
  emoji.className = "emoji";
  emoji.textContent = TIERS[tileData.tier - 1].emoji;
  const num = document.createElement("div");
  num.className = "tierNum";
  num.textContent = tileData.tier;
  tile.appendChild(emoji); tile.appendChild(num);
  cell.appendChild(tile);
}

function refreshLockedCellPrices() {
  for (let i = 0; i < TOTAL; i++) {
    if (!Game.state.unlocked[i]) renderCell(i);
  }
}

function renderAll() {
  dom.grid.className = "grid skin-" + (Game.state.equippedSkin === "default" ? "none" : Game.state.equippedSkin);
  for (let i = 0; i < TOTAL; i++) renderCell(i);
  updateHeader();
  updateFabs();
}

let lastHeaderRender = {};
function updateHeader() {
  const state = Game.state;
  const stardustStr = formatNumber(Game.displayedStardust);
  if (stardustStr !== lastHeaderRender.stardust) { dom.stardustValue.textContent = stardustStr; lastHeaderRender.stardust = stardustStr; }

  const rateStr = "+" + formatNumber(totalProduction(state)) + "/s";
  if (rateStr !== lastHeaderRender.rate) { dom.stardustRate.textContent = rateStr; lastHeaderRender.rate = rateStr; }

  const gemsStr = formatNumber(state.gems);
  if (gemsStr !== lastHeaderRender.gems) { dom.gemsValue.textContent = gemsStr; lastHeaderRender.gems = gemsStr; }

  const energyStr = formatNumber(state.cosmicEnergy);
  if (energyStr !== lastHeaderRender.energy) { dom.energyValue.textContent = energyStr; lastHeaderRender.energy = energyStr; }

  const cost = invokeCost(state.manualSpawnCount);
  const costStr = formatNumber(cost);
  if (costStr !== lastHeaderRender.cost) { dom.invokeCost.textContent = costStr; lastHeaderRender.cost = costStr; }
  const disabled = state.stardust < cost;
  if (disabled !== lastHeaderRender.disabled) { dom.invokeBtn.classList.toggle("disabled", disabled); lastHeaderRender.disabled = disabled; }

  const canBB = hasUniverseTile(state);
  if (canBB !== lastHeaderRender.canBB) { dom.bigBangBtn.classList.toggle("hidden", !canBB); lastHeaderRender.canBB = canBB; }

  let hint = "";
  if (Game.skipCellArmed) hint = "Choisis une case verrouillée à débloquer avec des Gems";
  else if (Game.selectedIdx !== null) {
    hint = state.grid[Game.selectedIdx] ? "Sélectionné : glissez/tapez une case adjacente identique" : "Case choisie pour la prochaine invocation";
  }
  if (hint !== lastHeaderRender.hint) { dom.selectionHint.textContent = hint; lastHeaderRender.hint = hint; }
}

function updateFabs() {
  const state = Game.state;
  dom.fabDailyLogin.classList.toggle("hidden", !isDailyLoginAvailable(state));
  ensureDailySpin(state);
  dom.fabWheel.classList.toggle("hidden", state.dailySpin.freeUsed && state.dailySpin.bonusUsed);
  const fpReady = Date.now() >= state.cooldowns.freePlanetUntil;
  dom.fabFreePlanet.classList.toggle("ready", fpReady);
  dom.fabFreePlanet.disabled = false;
  const now = Date.now();
  const boostActive = state.cooldowns.prodBoostActiveUntil > now;
  const boostReady = now >= state.cooldowns.prodBoostUntil && !boostActive;
  $("fabBoost").classList.toggle("ready", boostReady);
  $("fabBoost").classList.toggle("active", boostActive);
  const boostLabel = boostActive ? formatDuration(state.cooldowns.prodBoostActiveUntil - now)
    : (boostReady ? "Boost x2" : formatDuration(state.cooldowns.prodBoostUntil - now));
  if ($("fabBoostLabel").textContent !== boostLabel) $("fabBoostLabel").textContent = boostLabel;
  dom.bannerAd.classList.toggle("hidden", adsRemoved(state));
  updateQuestNotifDot();
}

function hasClaimableQuest(state) {
  ensureDailyQuests(state);
  return state.quests.active.some(q => q.done && !q.claimed) || (state.quests.bonusAd.done && !state.quests.bonusAd.claimed);
}
let lastNotifDotState = null;
function updateQuestNotifDot() {
  const has = hasClaimableQuest(Game.state);
  if (has !== lastNotifDotState) {
    $("questsNotifDot").classList.toggle("hidden", !has);
    lastNotifDotState = has;
  }
}

function spawnParticles(idx) {
  const cell = cellEls[idx];
  for (let k = 0; k < 7; k++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 18;
    p.style.setProperty("--dx", (Math.cos(angle) * dist) + "px");
    p.style.setProperty("--dy", (Math.sin(angle) * dist) + "px");
    p.style.left = "50%"; p.style.top = "50%";
    cell.appendChild(p);
    setTimeout(() => p.remove(), 520);
  }
}

function spawnFloatingBonus(idx, amount) {
  const cell = cellEls[idx];
  const el = document.createElement("div");
  el.className = "floatBonus";
  el.textContent = "+" + formatNumber(amount) + " ✨";
  cell.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  dom.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ---------------- Drawer & generic panel ----------------
function renderDrawerHead() {
  const state = Game.state;
  $("drawerLevel").textContent = `Niveau Cosmique ${state.lifetime.bigBangCount}`;
  $("drawerHeadLogo").textContent = state.profile.emoji;
  $("drawerHeadLogo").style.background = `radial-gradient(circle at 35% 30%, #fff, ${state.profile.color})`;
  $("drawerHeadTitle").textContent = state.profile.name;
}
function openDrawer() {
  dom.drawerOverlay.classList.remove("hidden");
  renderDrawerHead();
  requestAnimationFrame(() => dom.drawerOverlay.classList.add("open"));
}

// ---------------- Profile editor modal ----------------
let profileDraft = null;
function openProfileModal() {
  profileDraft = { ...Game.state.profile };
  $("profileNameInput").value = profileDraft.name;

  const emojiPicker = $("profileEmojiPicker");
  emojiPicker.innerHTML = "";
  PROFILE_EMOJI_CHOICES.forEach(emoji => {
    const btn = el("button", "profileEmojiBtn" + (emoji === profileDraft.emoji ? " selected" : ""), emoji);
    btn.addEventListener("click", () => { profileDraft.emoji = emoji; openProfileModal.refresh(); });
    emojiPicker.appendChild(btn);
  });

  const colorPicker = $("profileColorPicker");
  colorPicker.innerHTML = "";
  PROFILE_COLOR_CHOICES.forEach(color => {
    const btn = el("button", "profileColorBtn" + (color === profileDraft.color ? " selected" : ""));
    btn.style.background = color;
    btn.addEventListener("click", () => { profileDraft.color = color; openProfileModal.refresh(); });
    colorPicker.appendChild(btn);
  });

  $("profileModal").classList.remove("hidden");
}
openProfileModal.refresh = function () {
  $$("#profileEmojiPicker .profileEmojiBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_EMOJI_CHOICES[i] === profileDraft.emoji));
  $$("#profileColorPicker .profileColorBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_COLOR_CHOICES[i] === profileDraft.color));
};
function closeProfileModal() { $("profileModal").classList.add("hidden"); }
function closeDrawer() {
  dom.drawerOverlay.classList.remove("open");
  setTimeout(() => dom.drawerOverlay.classList.add("hidden"), 300);
}

const PANEL_RENDERERS = {
  shop: { title: "Boutique", render: renderShopPanel },
  gods: { title: "Dieux du Cosmos", render: renderGodsPanel },
  skills: { title: "Ascension ⚡", render: renderSkillsPanel },
  quests: { title: "Quêtes quotidiennes", render: renderQuestsPanel },
  achievements: { title: "Succès", render: renderAchievementsPanel },
  progression: { title: "Progression", render: renderProgressionPanel },
  story: { title: "Histoire", render: renderStoryPanel },
  settings: { title: "Réglages", render: renderSettingsPanel },
};
let currentPanel = null;
function openPanel(name) {
  closeDrawer();
  const def = PANEL_RENDERERS[name];
  if (!def) return;
  currentPanel = name;
  dom.panelTitle.textContent = def.title;
  def.render();
  dom.panelOverlay.classList.remove("hidden");
}
function refreshCurrentPanel() { if (currentPanel) PANEL_RENDERERS[currentPanel].render(); }
function closePanel() { dom.panelOverlay.classList.add("hidden"); currentPanel = null; }

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

// ---------------- Shop panel ----------------
function renderShopPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  dom.panelBody.appendChild(el("h3", null, "Boosts publicitaires"));
  const boostReady = Date.now() >= state.cooldowns.prodBoostUntil;
  const boostActive = state.cooldowns.prodBoostActiveUntil > Date.now();
  const boostCard = el("div", "card");
  boostCard.innerHTML = `<div class="rowBetween"><h3>Boost x2 production (10 min)</h3></div>
    <p class="desc">${boostActive ? `Actif encore ${formatDuration(state.cooldowns.prodBoostActiveUntil - Date.now())}` :
      (boostReady ? "Disponible maintenant." : `Disponible dans ${formatDuration(state.cooldowns.prodBoostUntil - Date.now())}`)}</p>`;
  const boostBtn = el("button", "btn primary full", adsRemoved(state) ? "Activer" : "Regarder une pub");
  boostBtn.disabled = !boostReady || boostActive;
  boostBtn.addEventListener("click", onWatchProdBoostAd);
  boostCard.appendChild(boostBtn);
  dom.panelBody.appendChild(boostCard);

  dom.panelBody.appendChild(el("h3", null, "Cases & boosts (Gems)"));
  SHOP_GEM_ITEMS.forEach(item => {
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${item.name}</h3><span class="tag">${item.cost} 💎</span></div>
      <p class="desc">${item.desc}</p>`;
    const btn = el("button", "btn primary full", item.id === "skipCell" ? "Activer le mode Sauter" : "Acheter");
    btn.disabled = state.gems < item.cost;
    btn.addEventListener("click", () => onBuyGemItem(item.id));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  dom.panelBody.appendChild(el("h3", null, "Skins cosmétiques"));
  SKINS.filter(s => s.cost > 0).forEach(skin => {
    const owned = state.ownedSkins.includes(skin.id);
    const equipped = state.equippedSkin === skin.id;
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${skin.name}</h3>
      ${equipped ? '<span class="tag equipped">Équipé</span>' : (owned ? '<span class="tag owned">Possédé</span>' : `<span class="tag">${skin.cost} 💎</span>`)}
      </div>`;
    const btn = el("button", "btn full", equipped ? "Équipé" : (owned ? "Équiper" : "Acheter"));
    btn.disabled = equipped || (!owned && state.gems < skin.cost);
    btn.addEventListener("click", () => onSkinAction(skin.id, owned));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  dom.panelBody.appendChild(el("h3", null, "Boutique premium (achats intégrés)"));
  const daysSinceFirst = daysBetween(state.firstPlayedDay, todayStr());
  IAP_CATALOG.forEach(product => {
    if (product.startersOnly && daysSinceFirst > 2) return;
    if (product.id === "remove_ads" && state.iap.removeAds) return;
    if (product.id === "stardust_boost" && state.iap.stardustBoost) return;
    if (product.skinId && state.iap.ownedSkinPacks.includes(product.skinId)) return;
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${product.name}</h3><span class="iapPrice">${product.price}</span></div>
      ${product.desc ? `<p class="desc">${product.desc}</p>` : ""}`;
    const btn = el("button", "btn primary full", product.type === "subscription" ? "S'abonner" : "Acheter");
    btn.addEventListener("click", () => onBuyIAP(product.id));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  const restoreBtn = el("button", "btn ghost full", "Restaurer mes achats");
  restoreBtn.addEventListener("click", onRestorePurchases);
  dom.panelBody.appendChild(restoreBtn);
}

// ---------------- Skills panel ----------------
function renderSkillsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  dom.panelBody.appendChild(el("p", "desc", `Dépense ton Énergie Cosmique (⚡ ${formatNumber(state.cosmicEnergy)}) gagnée à chaque Big Bang dans des bonus permanents.`));
  Object.keys(SKILL_TREE).forEach(key => {
    const branch = SKILL_TREE[key];
    const level = state.skills[key];
    const maxed = level >= branch.maxLevel;
    const cost = maxed ? null : skillCost(key, level + 1);
    const card = el("div", "card skillRow");
    card.innerHTML = `<div class="rowBetween"><h3>${branch.name}</h3><span class="skillLevel">Niv. ${level}/${branch.maxLevel}</span></div>
      <p class="desc">${branch.desc}</p>
      <div class="progressBar"><div class="fill" style="width:${(level / branch.maxLevel * 100).toFixed(1)}%"></div></div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ⚡`);
    btn.disabled = maxed || state.cosmicEnergy < cost;
    if (!maxed) btn.addEventListener("click", () => onBuySkill(key));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Quests panel ----------------
function renderQuestsPanel() {
  const state = Game.state;
  ensureDailyQuests(state);
  dom.panelBody.innerHTML = "";
  state.quests.active.forEach(q => {
    const template = QUEST_POOL.find(t => t.id === q.id);
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${template.desc}</h3><span class="tag">${template.reward} 💎</span></div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, q.progress / template.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(q.progress, template.target)} / ${template.target}</p>`;
    const btn = el("button", "btn primary full", q.claimed ? "Réclamée" : (q.done ? "Réclamer" : "En cours"));
    btn.disabled = q.claimed || !q.done;
    btn.addEventListener("click", () => onClaimQuest(q.id));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  const bonusCard = el("div", "card");
  bonusCard.innerHTML = `<div class="rowBetween"><h3>${BONUS_AD_QUEST.desc} (bonus)</h3><span class="tag">${BONUS_AD_QUEST.reward} 💎</span></div>
    <p class="desc">Quête bonus optionnelle, disponible chaque jour.</p>`;
  const bonusBtn = el("button", "btn primary full",
    state.quests.bonusAd.claimed ? "Réclamée" : (state.quests.bonusAd.done || adsRemoved(state) ? "Réclamer" : "Regarder une pub"));
  bonusBtn.disabled = state.quests.bonusAd.claimed;
  bonusBtn.addEventListener("click", onBonusAdQuest);
  bonusCard.appendChild(bonusBtn);
  dom.panelBody.appendChild(bonusCard);
}

// ---------------- Achievements panel ----------------
function renderAchievementsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const unlocked = state.achievements.unlockedIds.includes(a.id);
    const value = achievementValue(state, a.cat);
    const card = el("div", "card achCard" + (unlocked ? "" : " locked"));
    card.innerHTML = `<div class="rowBetween">
        <div><span class="achBadge">${unlocked ? "🏆" : "🔒"}</span> <strong>${a.name}</strong></div>
        <span class="tag">${a.reward} 💎</span>
      </div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, value / a.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(value, a.target)} / ${a.target}</p>`;
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Settings panel ----------------
// ---------------- Story panel ----------------
function renderStoryPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  const card = el("div", "card");
  card.innerHTML = `
    <h3>La Rupture</h3>
    <p class="desc">Il y eut un temps où le Cosmos ne connaissait pas le mot « chaos ».
    Un ordre parfait le régissait, tenu par une poignée de Dieux qui en étaient à la
    fois les gardiens et l'incarnation. Puis vint la Rupture — nul ne sait si elle fut
    un accident ou un choix — et cet ordre se brisa en une poussière infinie
    d'astéroïdes muets, dérivant sans but dans le vide.</p>
    <p class="desc">Les Dieux ne moururent pas. Ils se dispersèrent, endormis, chacun
    au cœur d'un fragment parmi des milliards d'autres, attendant qu'une conscience
    assez patiente pour rapprocher deux fragments identiques les réveille un jour.</p>
    <h3 style="margin-top:16px;">L'Étincelle</h3>
    <p class="desc">Cette conscience, c'est toi. Chaque fusion recompose un peu de
    l'ordre perdu ; chaque palier franchi — Lune, Planète, Étoile, jusqu'à
    l'Univers — rapproche le Cosmos de ce qu'il fut. Mais un Univers reconstitué ne
    peut que se replier sur lui-même : c'est le Big Bang, la fin d'un cycle et le
    début du suivant, un peu plus vite, un peu plus loin à chaque fois.</p>
    <h3 style="margin-top:16px;">Deux camps, un seul Cosmos</h3>
    <p class="desc">Certains Dieux réveillés se souviennent de l'ordre ancien et
    désirent le restaurer : on les dit <strong>bienveillants</strong>. D'autres se
    sont épris du chaos de la Rupture et refusent de servir à nouveau un ordre
    qu'ils jugent stérile : on les dit <strong>déchus</strong>. Aucun n'est
    entièrement bon ni mauvais - seulement fidèle à ce que la Rupture a fait de lui.</p>`;
  dom.panelBody.appendChild(card);

  if (state.gods.currentGodId) {
    const god = getGod(state.gods.currentGodId);
    const godCard = el("div", "card");
    godCard.innerHTML = `<h3>${god.emoji} ${god.name}, ${god.title}</h3>
      <p class="desc">${god.lore}</p>`;
    dom.panelBody.appendChild(godCard);
  }
}

// ---------------- Gods panel ----------------
function renderGodsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  if (state.gods.currentGodId) {
    const pendingId = state.gods.nextGodId || state.gods.currentGodId;
    const pending = getGod(pendingId);
    const note = el("p", "desc",
      state.gods.nextGodId
        ? `${pending.name} prendra le relais au prochain Big Bang.`
        : `${pending.name} t'accompagne pour cette partie.`);
    dom.panelBody.appendChild(note);
  } else {
    dom.panelBody.appendChild(el("p", "desc", "Fusionne 4 Lunes en une partie pour éveiller ton premier Dieu."));
  }

  GODS.forEach(god => {
    const unlocked = isGodUnlocked(state, god.id);
    const equipped = state.gods.currentGodId === god.id;
    const queued = state.gods.nextGodId === god.id;
    const rarity = RARITY[god.rarity];
    const level = state.gods.powerLevel[god.id] || 0;
    const card = el("div", "godCard" + (equipped ? " equipped" : "") + (unlocked ? "" : " locked"));
    const statusTag = equipped ? '<span class="equippedTag">En jeu</span>'
      : (queued ? '<span class="equippedTag queued">Prochaine partie</span>' : "");
    card.innerHTML = `
      <div class="godTop">
        <div class="godEmoji">${unlocked ? god.emoji : "❓"}</div>
        <div class="godNames">
          <div class="godName">${unlocked ? god.name : "???"}</div>
          <div class="godTitle">${unlocked ? god.title : "Non éveillé"}</div>
        </div>
        <div class="godTagsCol">
          <span class="alignTag">${god.alignment === "bienveillant" ? "🕊️" : "🔥"}</span>
          <span class="rarityTag" style="background:${rarity.color}22;color:${rarity.color};">${rarity.label}</span>
          ${statusTag}
        </div>
      </div>
      <p class="godDesc">${unlocked ? describeGodEffect(god, level) : "Débloque ce Dieu pour découvrir son pouvoir."}</p>`;

    if (unlocked) {
      const detailsBtn = el("button", "btn ghost full godDetailsBtn", "ℹ️ Détails et histoire");
      detailsBtn.addEventListener("click", () => openGodDetailModal(god.id));
      card.appendChild(detailsBtn);
    }

    if (!unlocked) {
      const info = el("div", "godUnlockInfo");
      if (god.unlock.type === "milestone") info.textContent = "🔒 " + god.unlock.label;
      else if (god.unlock.type === "challenge") {
        const progress = god.unlock.challengeId === "erebus" ? state.gods.erebusStreak : 0;
        info.textContent = `⚔️ ${god.unlock.label}` + (god.unlock.challengeId === "erebus" ? ` (${Math.min(progress, god.unlock.target)}/${god.unlock.target})` : "");
      } else if (god.unlock.type === "shop") {
        info.textContent = `🔒 Boutique : ${god.unlock.cost} 💎 ${god.unlock.altLabel ? "(" + god.unlock.altLabel + ")" : ""}`;
      } else {
        info.textContent = "🔒 Éveille ton premier Dieu via le rituel des lunes.";
      }
      card.appendChild(info);
      if (god.unlock.type === "shop") {
        const btn = el("button", "btn primary full", `Débloquer — ${god.unlock.cost} 💎`);
        btn.style.marginTop = "8px";
        btn.disabled = state.gems < god.unlock.cost;
        btn.addEventListener("click", () => onBuyGod(god.id));
        card.appendChild(btn);
      }
    } else if (queued) {
      const btn = el("button", "btn ghost full", "✕ Annuler ce choix");
      btn.style.marginTop = "8px";
      btn.addEventListener("click", () => onChooseGod(state.gods.currentGodId));
      card.appendChild(btn);
    } else if (!equipped) {
      const btn = el("button", "btn full", "Choisir pour le prochain Big Bang");
      btn.style.marginTop = "8px";
      btn.addEventListener("click", () => onChooseGod(god.id));
      card.appendChild(btn);
    }

    if (unlocked) {
      const level = state.gods.powerLevel[god.id] || 0;
      const maxed = level >= GOD_POWER_MAX_LEVEL;
      const cost = maxed ? null : godPowerCost(level + 1);
      const power = el("div", "godPower");
      power.innerHTML = `<div class="rowBetween"><span class="godPowerLabel">Niveau de pouvoir</span><span class="skillLevel">${level}/${GOD_POWER_MAX_LEVEL}</span></div>
        <div class="progressBar"><div class="fill" style="width:${(level / GOD_POWER_MAX_LEVEL * 100).toFixed(1)}%"></div></div>`;
      const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} 💎`);
      btn.style.marginTop = "6px";
      btn.disabled = maxed || state.gems < cost;
      if (!maxed) btn.addEventListener("click", () => onBuyGodPower(god.id));
      power.appendChild(btn);
      card.appendChild(power);
    }
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Progression panel ----------------
function renderProgressionPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  const summary = el("div", "card progressCard");
  summary.innerHTML = `<h3>Ton voyage</h3>
    <p class="rowBetween"><span>Niveau Cosmique (Big Bang)</span><strong>${state.lifetime.bigBangCount}</strong></p>
    <p class="rowBetween"><span>Palier le plus élevé atteint</span><strong>${TIERS[state.lifetime.maxTierEver - 1].name} ${TIERS[state.lifetime.maxTierEver - 1].emoji}</strong></p>
    <p class="rowBetween"><span>Stardust généré à vie</span><strong>${formatNumber(state.lifetime.stardustEarned)}</strong></p>
    <p class="rowBetween"><span>Dieux éveillés</span><strong>${state.gods.unlockedIds.length} / ${GODS.length}</strong></p>`;
  dom.panelBody.appendChild(summary);

  dom.panelBody.appendChild(el("h3", null, "Ton parcours"));

  // Ordered by actual prerequisite structure, not by data declaration order.
  // Astréos (fusion count), Erebus (fusion streak), Hélios (reach tier 7) and
  // Nyx (20 cells in one run) don't require a Big Bang at all - reaching
  // tier 7 in particular happens *on the way* to tier 10, so it belongs
  // before "Atteindre l'Univers", not after "Premier Big Bang". Within that
  // group, ordered by rarity/typical difficulty (matches config.js's own
  // commun -> rare -> épique ladder): Astréos (commun, 180 lifetime fusions -
  // accumulates passively) before the two rares Hélios (tier 7, usually hit
  // on the way to a first Universe) and Nyx (20 cells unlocked in one run, a
  // deliberate Stardust sink) before Erebus (épique, a deliberate hidden
  // challenge most players won't stumble into by accident).
  const godById = (id) => GODS.find(g => g.id === id);
  const godStep = (id) => { const g = godById(id); return { emoji: g.emoji, done: isGodUnlocked(state, id), text: g.name, sub: g.unlock.label }; };
  const steps = [];
  steps.push({ emoji: "🔱", done: !!state.gods.currentGodId, text: "Éveiller ton premier Dieu" });
  steps.push(godStep("astreos"));
  steps.push(godStep("helios"));
  steps.push(godStep("nyx"));
  steps.push(godStep("erebus"));
  steps.push({ emoji: TIERS[TIERS.length - 1].emoji, done: state.lifetime.maxTierEver >= TIERS.length, text: "Atteindre l'Univers" });
  steps.push({ emoji: "💥", done: state.lifetime.bigBangCount >= 1, text: "Premier Big Bang" });
  steps.push(godStep("thanatos"));
  steps.push(godStep("chronos"));
  steps.push({ emoji: "🏆", done: state.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    text: "Tous les succès", sub: `${state.achievements.unlockedIds.length}/${ACHIEVEMENTS.length}` });

  const nextIdx = steps.findIndex(s => !s.done);
  const roadmap = el("div", "roadmap");
  steps.forEach((s, i) => {
    const state2 = s.done ? "done" : (i === nextIdx ? "next" : "locked");
    const node = el("div", "roadNode " + state2);
    node.innerHTML = `<div class="roadIcon"><span class="roadIconGlyph">${s.done ? "✓" : s.emoji}</span></div>
      <div class="roadText"><div class="roadLabel">${s.text}</div>${s.sub ? `<div class="roadSub">${s.sub}</div>` : ""}</div>`;
    roadmap.appendChild(node);
  });
  dom.panelBody.appendChild(roadmap);
}

// ---------------- God ritual & selection actions ----------------
function openGodPickerModal() {
  const state = Game.state;
  const list = $("godRitualList");
  list.innerHTML = "";
  const available = GODS.filter(g => isGodUnlocked(state, g.id));
  available.forEach(god => {
    const card = el("button", "godRitualCard");
    card.innerHTML = `<div class="godEmoji">${god.emoji}</div>
      <div class="godNames"><div class="godName">${god.name}</div>
      <div class="godTitle">${god.title}</div>
      <p class="godDesc" style="margin:4px 0 0;">${god.desc}</p></div>`;
    card.addEventListener("click", () => {
      chooseGod(state, god.id);
      Sfx.purchase();
      toast(`${god.name} t'accompagne désormais !`);
      $("godRitualModal").classList.add("hidden");
      saveState(state);
      renderAll();
    });
    list.appendChild(card);
  });
  $("godRitualModal").classList.remove("hidden");
}

function openGodDetailModal(godId) {
  const state = Game.state;
  const god = getGod(godId);
  const rarity = RARITY[god.rarity];
  const level = state.gods.powerLevel[god.id] || 0;
  $("godDetailCard").innerHTML = `
    <div class="godTop">
      <div class="godEmoji" style="width:52px;height:52px;font-size:26px;">${god.emoji}</div>
      <div class="godNames">
        <div class="godName" style="font-size:18px;">${god.name}</div>
        <div class="godTitle">${god.title}</div>
      </div>
      <div class="godTagsCol">
        <span class="alignTag">${god.alignment === "bienveillant" ? "🕊️ Bienveillant" : "🔥 Déchu"}</span>
        <span class="rarityTag" style="background:${rarity.color}22;color:${rarity.color};">${rarity.label}</span>
      </div>
    </div>
    <p class="godDesc" style="font-style:italic;">${god.lore}</p>
    <p class="godDesc"><strong>Pouvoir actuel (niveau ${level}/${GOD_POWER_MAX_LEVEL}) :</strong> ${describeGodEffect(god, level)}</p>
    <button class="btn full" id="godDetailClose">Fermer</button>`;
  $("godDetailClose").addEventListener("click", () => $("godDetailModal").classList.add("hidden"));
  $("godDetailModal").classList.remove("hidden");
}

function renderSettingsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  [["sound", "Son"], ["music", "Musique"], ["notifications", "Notifications"]].forEach(([key, label]) => {
    const row = el("div", "settingsRow");
    row.innerHTML = `<span>${label}</span>`;
    const sw = el("div", "switch" + (state.settings[key] ? " on" : ""), '<div class="knob"></div>');
    sw.addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      Game.settings = state.settings;
      if (key === "music") MusicService.setEnabled(state.settings.music);
      saveState(state);
      renderSettingsPanel();
    });
    row.appendChild(sw);
    dom.panelBody.appendChild(row);
  });

  const restoreBtn = el("button", "btn full", "Restaurer mes achats");
  restoreBtn.addEventListener("click", onRestorePurchases);
  dom.panelBody.appendChild(restoreBtn);

  const backupCard = el("div", "card");
  backupCard.innerHTML = `<h3>Sauvegarde manuelle</h3>
    <p class="desc">Utile si la sauvegarde automatique ne tient pas sur cet appareil : copie un code de ta progression avant de fermer, colle-le pour la restaurer.</p>`;
  const exportBtn = el("button", "btn full", "📤 Exporter ma sauvegarde");
  exportBtn.style.marginBottom = "8px";
  exportBtn.addEventListener("click", () => openSaveCodeModal("export"));
  const importBtn = el("button", "btn ghost full", "📥 Importer une sauvegarde");
  importBtn.addEventListener("click", () => openSaveCodeModal("import"));
  backupCard.appendChild(exportBtn);
  backupCard.appendChild(importBtn);
  dom.panelBody.appendChild(backupCard);

  const restartCard = el("div", "card");
  restartCard.innerHTML = `<h3>Recommencer</h3>
    <p class="desc">Repars de zéro sur cette partie sans attendre l'Univers. L'Énergie Cosmique, les Gems, l'Ascension, les Dieux et les succès restent acquis.</p>`;
  const restartBtn = el("button", "btn danger full", "🔄 Recommencer la partie");
  restartBtn.addEventListener("click", openRestartModal);
  restartCard.appendChild(restartBtn);
  dom.panelBody.appendChild(restartCard);

  const status = el("p", "desc", state.iap.removeAds || isVipActive(state) ?
    "✅ Publicités désactivées sur cet appareil." : "Les publicités sont actives (retirables dans la Boutique).");
  dom.panelBody.appendChild(status);

  const priv = el("a", "btn ghost full", "Politique de confidentialité");
  priv.href = "privacy.html"; priv.target = "_blank"; priv.style.textDecoration = "none"; priv.style.justifyContent = "center";
  dom.panelBody.appendChild(priv);

  const support = el("a", "btn ghost full", "Contacter le support");
  support.href = "mailto:support@cosmerge.example"; support.style.textDecoration = "none"; support.style.justifyContent = "center";
  dom.panelBody.appendChild(support);

  dom.panelBody.appendChild(el("p", "desc", "Cosmerge — v1.0.0 (prototype)"));
}

// ---------------- Tutorial ----------------
const TUT_STEPS = [
  { title: "Invoquer", text: "Appuie sur « Invoquer » pour faire apparaître un Météorite ☄️ sur une case vide de la grille.", target: () => dom.invokeBtn },
  { title: "Fusionner", text: "Glisse un astéroïde sur une case adjacente identique (ou tape les deux l'une après l'autre) pour les fusionner en une Lune 🌙.", target: () => cellEls[8] },
  { title: "Progresser", text: "Continue à fusionner pour atteindre Planète 🌍, Étoile ⭐, Trou noir 🕳️... jusqu'à l'Univers ✨, puis déclenche un Big Bang pour recommencer plus fort !", target: () => dom.grid },
];
let tutIndex = 0;
let currentHighlight = null;
function showTutStep(i) {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  const step = TUT_STEPS[i];
  $("tutStep").textContent = `Étape ${i + 1} / ${TUT_STEPS.length}`;
  $("tutTitle").textContent = step.title;
  $("tutText").textContent = step.text;
  $("tutNext").textContent = (i === TUT_STEPS.length - 1) ? "C'est parti !" : "Suivant";
  currentHighlight = step.target();
  if (currentHighlight) currentHighlight.classList.add("tutorial-highlight");
}
function endTutorial() {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  $("tutOverlay").classList.add("hidden");
  Game.state.tutorialSeen = true;
  saveState(Game.state);
}

// ---------------- Offline modal ----------------
function openOfflineModal(gainInfo) {
  Game.pendingOfflineGain = gainInfo;
  const capNote = gainInfo.wasCapped ? ` (plafonné à ${offlineCapHours(Game.state)}h)` : "";
  $("offlineText").textContent = `Temps écoulé : ${formatDuration(gainInfo.cappedMs)}${capNote}\n+${formatNumber(gainInfo.gain)} Stardust`;
  $("offlineDouble").textContent = adsRemoved(Game.state) ? "Doubler" : "Doubler (pub)";
  $("offlineModal").classList.remove("hidden");
}

// ---------------- Daily login modal ----------------
function openDailyModal() {
  const state = Game.state;
  const grid = $("dailyGrid");
  grid.innerHTML = "";
  DAILY_REWARDS.forEach(r => {
    const claimedAlready = r.day < state.dailyLogin.cycleDay || (r.day === state.dailyLogin.cycleDay && !isDailyLoginAvailable(state));
    const isToday = r.day === state.dailyLogin.cycleDay;
    const cellDiv = el("div", "dayCell" + (claimedAlready ? " claimed" : "") + (isToday ? " today" : ""));
    cellDiv.innerHTML = `<div class="dNum">Jour ${r.day}</div><div>${r.label}</div>`;
    grid.appendChild(cellDiv);
  });
  $("dailyClaim").disabled = !isDailyLoginAvailable(state);
  $("dailyModal").classList.remove("hidden");
}
function closeDailyModal() { $("dailyModal").classList.add("hidden"); }

// ---------------- Wheel modal ----------------
function openWheelModal() {
  ensureDailySpin(Game.state);
  $("wheelResult").textContent = "";
  $("wheelEl").style.transform = "rotate(0deg)";
  refreshWheelButtons();
  $("wheelModal").classList.remove("hidden");
}
function refreshWheelButtons() {
  const s = Game.state.dailySpin;
  $("wheelSpinFree").disabled = s.freeUsed;
  $("wheelSpinAd").disabled = s.bonusUsed;
  $("wheelSpinAd").textContent = adsRemoved(Game.state) ? "Spin bonus" : "Spin bonus (pub)";
}
function closeWheelModal() { $("wheelModal").classList.add("hidden"); }

// ---------------- Big Bang modal ----------------
function openBigBangModal() {
  const gain = previewBigBangGain(Game.state);
  $("bigBangText").textContent = `Tu vas gagner ${gain} ⚡ Énergie Cosmique.`;
  $("bigBangModal").classList.remove("hidden");
}
function closeBigBangModal() { $("bigBangModal").classList.add("hidden"); }

function openRestartModal() { $("restartModal").classList.remove("hidden"); }
function closeRestartModal() { $("restartModal").classList.add("hidden"); }

// ---------------- Remove-ads soft prompt (shown once, after the 5th rewarded ad) ----------------
function openRemoveAdsPromptModal() {
  const product = IAP_CATALOG.find(p => p.id === "remove_ads");
  $("removeAdsPromptBuy").textContent = `${product.name} — ${product.price}`;
  $("removeAdsPromptModal").classList.remove("hidden");
}
function closeRemoveAdsPromptModal() { $("removeAdsPromptModal").classList.add("hidden"); }

// ---------------- Manual save backup modal ----------------
function openSaveCodeModal(mode) {
  Game.saveCodeMode = mode;
  const textarea = $("saveCodeText");
  if (mode === "export") {
    $("saveCodeTitle").textContent = "📤 Exporter ma sauvegarde";
    $("saveCodeHelp").textContent = "Sélectionne tout le texte ci-dessous et copie-le (garde-le dans tes Notes, par exemple). Colle-le dans « Importer une sauvegarde » pour la restaurer plus tard.";
    textarea.value = exportSaveCode(Game.state);
    textarea.readOnly = true;
    $("saveCodeAction").textContent = "Copier";
  } else {
    $("saveCodeTitle").textContent = "📥 Importer une sauvegarde";
    $("saveCodeHelp").textContent = "Colle ici un code exporté précédemment. Cela remplacera ta progression actuelle sur cet appareil.";
    textarea.value = "";
    textarea.readOnly = false;
    $("saveCodeAction").textContent = "Restaurer";
  }
  $("saveCodeModal").classList.remove("hidden");
  if (mode === "export") { textarea.focus(); textarea.select(); }
}
function closeSaveCodeModal() { $("saveCodeModal").classList.add("hidden"); }

function buildStars() {
  const bg = $("starsBg");
  for (let i = 0; i < 50; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 1;
    s.style.width = size + "px"; s.style.height = size + "px";
    s.style.left = (Math.random() * 100) + "%";
    s.style.top = (Math.random() * 100) + "%";
    s.style.animationDelay = (Math.random() * 3) + "s";
    bg.appendChild(s);
  }
}
