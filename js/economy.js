// Cosmerge - prestige (Big Bang), permanent skill tree, shop logic
"use strict";

function hasUniverseTile(state) {
  return state.grid.some(t => t && t.tier === TIERS.length);
}
function previewBigBangGain(state) {
  return bigBangGain(state.runStardustEarned, state.maxTierThisRun);
}

function performBigBang(state) {
  checkThanatosChallenge(state); // must run before the grid resets - it checks the current grid's fill state
  const minEnergy = getGodEffects(state).bigBangMinEnergy || 0;
  const gain = Math.max(previewBigBangGain(state), minEnergy);
  state.cosmicEnergy += gain;
  state.lifetime.bigBangCount += 1;

  applyPendingGodAtBigBang(state);
  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;

  checkAchievements(state);
  return gain;
}

// Voluntary reset, available anytime (unlike Big Bang, which needs a
// Universe tile). No Cosmic Energy is granted and lifetime.bigBangCount is
// NOT incremented - this is giving up on a run, not completing one.
function restartRun(state) {
  if (state.gods.nextGodId) {
    state.gods.currentGodId = state.gods.nextGodId;
    state.gods.nextGodId = null;
  }
  state.moonMergesThisRun = 0;
  state.gods.erebusStreak = 0;
  state.gods.usedFusionExpressThisRun = false;

  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;
}

function buySkill(state, key) {
  const branch = SKILL_TREE[key];
  const level = state.skills[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = skillCost(key, level + 1);
  if (state.cosmicEnergy < cost) return { ok: false, reason: "funds", cost };
  state.cosmicEnergy -= cost;
  state.skills[key] += 1;
  return { ok: true, cost, newLevel: state.skills[key] };
}

function buyGemShopItem(state, itemId, opts) {
  const item = SHOP_GEM_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: "unknown" };
  if (state.gems < item.cost) return { ok: false, reason: "funds", cost: item.cost };

  if (itemId === "skipCell") {
    const idx = opts && opts.cellIndex;
    if (idx === undefined || state.unlocked[idx]) return { ok: false, reason: "target" };
    state.gems -= item.cost;
    state.unlocked[idx] = true;
    state.extraUnlockedCount += 1;
    return { ok: true };
  }
  if (itemId === "fusionExpress") {
    state.gems -= item.cost;
    state.gods.usedFusionExpressThisRun = true;
    const merges = resolveAllMerges(state);
    return { ok: true, merges };
  }
  if (itemId === "streakFreeze") {
    state.gems -= item.cost;
    state.dailyLogin.streakFreezeCharges += 1;
    return { ok: true };
  }
  if (itemId === "cosmicBox") {
    state.gems -= item.cost;
    const result = rollCosmicBox(state);
    return { ok: true, box: result };
  }
  return { ok: false, reason: "unhandled" };
}

// Repeatedly merges any adjacent equal-tier pair until none remain.
// Returns the list of {toIdx, newTier} events so the caller can animate them.
function resolveAllMerges(state) {
  const events = [];
  let changed = true;
  let guard = 0;
  while (changed && guard < 200) {
    changed = false;
    guard++;
    for (let i = 0; i < TOTAL; i++) {
      const a = state.grid[i];
      if (!a || a.tier >= TIERS.length) continue;
      const neighbours = [i + 1, i - 1, i + COLS, i - COLS].filter(j => j >= 0 && j < TOTAL && areAdjacent(i, j));
      for (const j of neighbours) {
        const b = state.grid[j];
        if (b && b.tier === a.tier) {
          const result = performMerge(state, i, j);
          if (result) events.push({ toIdx: j, newTier: result.newTier });
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return events;
}

// Single pair merge used by tap/drag input and by Fusion Express.
function performMerge(state, fromIdx, toIdx) {
  const a = state.grid[fromIdx], b = state.grid[toIdx];
  if (!a || !b || a.tier !== b.tier || a.tier >= TIERS.length) return null;
  const newTier = a.tier + 1;
  state.grid[fromIdx] = null;
  state.grid[toIdx] = { tier: newTier };
  state.lifetime.fusions += 1;
  state.maxTierThisRun = Math.max(state.maxTierThisRun, newTier);
  state.lifetime.maxTierEver = Math.max(state.lifetime.maxTierEver, newTier);

  let gemBonus = 0;
  const luckChance = state.skills.luck * 0.01 + (getGodEffects(state).gemChanceBonus || 0);
  if (Math.random() < luckChance) {
    gemBonus = grantGems(state, 1);
  }

  trackFusionEvent(state, newTier);
  return { newTier, gemBonus };
}

function buySkinWithGems(state, skinId) {
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin || skin.cost === 0) return { ok: false, reason: "unknown" };
  if (state.ownedSkins.includes(skinId)) return { ok: false, reason: "owned" };
  if (state.gems < skin.cost) return { ok: false, reason: "funds" };
  state.gems -= skin.cost;
  state.ownedSkins.push(skinId);
  return { ok: true };
}
function unlockSkinFree(state, skinId) {
  if (!state.ownedSkins.includes(skinId)) state.ownedSkins.push(skinId);
}
function equipSkin(state, skinId) {
  if (state.ownedSkins.includes(skinId)) { state.equippedSkin = skinId; return true; }
  return false;
}

function activateProdBoost(state) {
  const now = Date.now();
  state.cooldowns.prodBoostActiveUntil = now + PROD_BOOST_DURATION_MS;
  state.cooldowns.prodBoostUntil = now + PROD_BOOST_COOLDOWN_MS;
}

const FREE_PLANET_TIER = 4; // matches TIERS[3] = "Planète" 🌍 - keep in sync with the fab's label/emoji
function grantFreePlanet(state) {
  const empties = emptyUnlockedIndices(state);
  if (empties.length === 0) return { ok: false, reason: "full" };
  const idx = empties[Math.floor(Math.random() * empties.length)];
  state.grid[idx] = { tier: FREE_PLANET_TIER };
  state.cooldowns.freePlanetUntil = Date.now() + FREE_PLANET_COOLDOWN_MS;
  return { ok: true, idx };
}

// Ad-based relief valve for unlockCost's 1.5x-per-cell growth, which is what
// makes the last few cells of a run cost tens of thousands of Stardust.
function grantFreeCellUnlock(state) {
  const locked = [];
  for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
  if (locked.length === 0) return { ok: false, reason: "full" };
  const idx = locked[Math.floor(Math.random() * locked.length)];
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  state.cooldowns.unlockCellAdUntil = Date.now() + UNLOCK_CELL_AD_COOLDOWN_MS;
  return { ok: true, idx };
}
