// Cosmerge - Gods of the Cosmos: unlock conditions, equipped-god effects,
// the "choose your first god" ritual, and challenge tracking.
//
// One god is equipped per run (state.gods.currentGodId). Its `effects` are
// read from GODS (config.js) by getGodEffects() and consumed at the call
// sites noted in config.js's comments (state.js production/spawn/offline
// formulas, economy.js's merge gem-chance and Big Bang gain).
"use strict";

function getGod(id) { return GODS.find(g => g.id === id); }
function getGodEffects(state) {
  if (!state.gods || !state.gods.currentGodId) return {};
  const god = getGod(state.gods.currentGodId);
  return god ? god.effects : {};
}
function isGodUnlocked(state, godId) { return state.gods.unlockedIds.includes(godId); }

function unlockGod(state, godId) {
  if (isGodUnlocked(state, godId)) return;
  state.gods.unlockedIds.push(godId);
  Sfx.chest();
  toast(`Nouveau Dieu débloqué : ${getGod(godId).name} ${getGod(godId).emoji}`);
}

// Milestone-type gods unlock themselves the moment their `check` passes -
// same pattern as achievements. Called after every stat-changing event.
function checkGodMilestones(state) {
  GODS.forEach(g => {
    if (g.unlock.type === "milestone" && !isGodUnlocked(state, g.id) && g.unlock.check(state)) {
      unlockGod(state, g.id);
    }
  });
}

// ---- The moon-merge ritual (first god selection) ----
function onFusionForGods(state, newTier) {
  if (newTier === 2) {
    state.moonMergesThisRun += 1;
    if (state.moonMergesThisRun === MOON_MERGES_TO_CHOOSE_GOD && !state.gods.currentGodId) {
      unlockGod(state, "selena");
      Game.pendingGodRitual = true; // main loop opens the picker modal next render
    }
  }

  // Erebus challenge: N fusions in a row without using the manual tap bonus.
  if (!isGodUnlocked(state, "erebus")) {
    state.gods.erebusStreak += 1;
    const erebus = getGod("erebus");
    if (state.gods.erebusStreak >= erebus.unlock.target) unlockGod(state, "erebus");
  }

  // Morgorath challenge: reach the Universe tier without ever buying Fusion Express this run.
  if (newTier === TIERS.length && !state.gods.usedFusionExpressThisRun) {
    state.gods.morgorathChallengeCleared = true;
  }

  checkGodMilestones(state);
}
function resetErebusStreak(state) { state.gods.erebusStreak = 0; }

// ---- Thanatos challenge: checked once, at the moment Big Bang is confirmed ----
function checkThanatosChallenge(state) {
  if (isGodUnlocked(state, "thanatos")) return;
  if (emptyUnlockedIndices(state).length > 0) unlockGod(state, "thanatos");
}

// ---- Choosing / swapping gods ----
// The very first pick applies immediately (there is no "current run" to
// protect yet). Any later pick only takes effect on the *next* Big Bang,
// per the "changer de dieu qu'entre les parties" rule.
function chooseGod(state, godId) {
  if (!isGodUnlocked(state, godId)) return false;
  if (!state.gods.currentGodId) {
    state.gods.currentGodId = godId;
    state.gods.nextGodId = null;
  } else {
    state.gods.nextGodId = (godId === state.gods.currentGodId) ? null : godId;
  }
  return true;
}
function applyPendingGodAtBigBang(state) {
  if (state.gods.currentGodId) {
    const id = state.gods.currentGodId;
    state.gods.usageCount[id] = (state.gods.usageCount[id] || 0) + 1;
  }
  if (state.gods.nextGodId) {
    state.gods.currentGodId = state.gods.nextGodId;
    state.gods.nextGodId = null;
  }
  state.moonMergesThisRun = 0;
  state.gods.erebusStreak = 0;
  state.gods.usedFusionExpressThisRun = false;
}

function buyGodWithGems(state, godId) {
  const god = getGod(godId);
  if (!god || god.unlock.type !== "shop") return { ok: false, reason: "unknown" };
  if (isGodUnlocked(state, godId)) return { ok: false, reason: "owned" };
  if (state.gems < god.unlock.cost) return { ok: false, reason: "funds", cost: god.unlock.cost };
  state.gems -= god.unlock.cost;
  unlockGod(state, godId);
  return { ok: true };
}

// Cosmic Box: rolls any of the 9 gods weighted by rarity, regardless of that
// god's normal unlock path. A duplicate roll pays out Gems instead (scaled
// to the rarity rolled) so the box never feels wasted.
function rollCosmicBox(state) {
  const total = Object.values(BOX_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let pickedRarity = "commun";
  for (const rarity of Object.keys(BOX_RARITY_WEIGHTS)) {
    const weight = BOX_RARITY_WEIGHTS[rarity];
    if (r < weight) { pickedRarity = rarity; break; }
    r -= weight;
  }
  const pool = GODS.filter(g => g.rarity === pickedRarity);
  const god = pool[Math.floor(Math.random() * pool.length)];
  if (isGodUnlocked(state, god.id)) {
    const gems = grantGems(state, BOX_DUPLICATE_GEMS[pickedRarity]);
    return { duplicate: true, god, gems };
  }
  unlockGod(state, god.id);
  return { duplicate: false, god };
}
