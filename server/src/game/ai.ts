// Mahjong AI
// Rule-based decision-making with situational awareness

import {
  Tile,
  Meld,
  Player,
  GameState,
  GameSettings,
  WinResult,
  Suit,
  tileEquals,
  tileKey,
  tileSort,
  canPong,
  canChi,
  canMingGang,
  canAnGang,
  canJiaGang,
  checkWin,
} from './engine';

// ===== Card Counting =====
// Count how many times a tile has appeared (all players' discards + own hand + melds)
function countVisibleTile(gameState: GameState, suit: Suit, value: number): number {
  let count = 0;
  for (const player of gameState.players) {
    // visible melds
    for (const meld of player.melds) {
      for (const t of meld.tiles) {
        if (t.suit === suit && t.value === value) count++;
      }
    }
    // discards (all players)
    for (const d of player.discards) {
      if (d.suit === suit && d.value === value) count++;
    }
  }
  return count;
}

// Check if a tile is "dead" — all 4 copies already visible
function isTileDead(gameState: GameState, suit: Suit, value: number): boolean {
  return countVisibleTile(gameState, suit, value) >= 4;
}

// Check if a tile is "safe" — has been discarded by any player (so likely won't feed a win)
function isTileSafe(gameState: GameState, suit: Suit, value: number): boolean {
  for (const player of gameState.players) {
    for (const d of player.discards) {
      if (d.suit === suit && d.value === value) return true;
    }
  }
  return false;
}

// ===== Hand analysis =====

// Count how many tiles are needed to complete melds (distance to tenpai)
function distanceToTenpai(hand: Tile[], melds: Meld[]): number {
  // A standard hand needs 4 melds + 1 pair = 14 tiles
  const totalMelds = melds.length;
  const remainingTiles = hand.length;
  
  // Estimate remaining melds needed
  const meldsNeeded = Math.max(0, 4 - totalMelds);
  
  // Very rough estimate: each meld needs 3 tiles, pair needs 2
  // Count pairs we already have
  const sorted = [...hand].sort(tileSort);
  let pairCount = 0;
  let i = 0;
  while (i < sorted.length - 1) {
    if (tileEquals(sorted[i], sorted[i + 1])) {
      pairCount++;
      i += 2;
    } else {
      i++;
    }
  }
  
  // tiles needed: (meldsNeeded * 3) + (pairCount === 0 ? 2 : 0) - remainingTiles
  const needed = (meldsNeeded * 3) + (pairCount > 0 ? 0 : 2) - remainingTiles;
  return Math.max(0, needed);
}

// Get the most common suit in hand (for qingyise / hunyise strategy)
function getDominantSuit(hand: Tile[]): { suit: Suit; count: number } | null {
  const counts: Map<Suit, number> = new Map();
  for (const tile of hand) {
    counts.set(tile.suit, (counts.get(tile.suit) || 0) + 1);
  }
  
  const suits = [Suit.Wan, Suit.Tiao, Suit.Tong];
  let best: { suit: Suit; count: number } | null = null;
  for (const s of suits) {
    const cnt = counts.get(s) || 0;
    if (!best || cnt > best.count) {
      best = { suit: s, count: cnt };
    }
  }
  return best && best.count >= 5 ? best : null;
}

// Check if opponent appears close to winning (many melds, few discards variation)
function isOpponentDangerous(gameState: GameState, playerIndex: number): boolean {
  const player = gameState.players[playerIndex];
  if (player.isAI) return false;
  if (player.melds.length >= 3) return true; // already exposed 3 melds
  if (player.melds.length >= 2 && player.discards.length <= 6) return true; // fast hand
  return false;
}

// ===== Main AI Functions =====

/**
 * Score each tile in hand for discard decision.
 * Higher score = keep. Returns index of lowest scoring tile.
 * 
 * Now considers:
 * - Which tiles are already exhausted (dead tiles)
 * - Which tiles are safe to discard (won't feed opponents)
 * - Dominant suit strategy (hunyise/qingyise)
 * - Distance to tenpai
 * - Opponent danger level
 */
export function evaluateDiscard(
  hand: Tile[],
  melds: Meld[],
  gameState: GameState,
  ownPlayerIndex: number
): number {
  const dominantSuit = getDominantSuit(hand);
  const tenpaiDist = distanceToTenpai(hand, melds);
  
  const scores: number[] = hand.map((tile, i) => {
    let score = 0;
    const v = tile.value;
    const s = tile.suit;

    // --- Base hand quality ---
    // Count how many of this tile in hand
    let sameCount = 0;
    for (const other of hand) {
      if (tileEquals(tile, other)) sameCount++;
    }

    if (sameCount >= 3) score += 12;  // triplet — very valuable
    else if (sameCount >= 2) score += 8;  // pair — valuable
    else if (sameCount === 1) {
      // Check adjacency for sequence potential
      if (s !== Suit.Wind && s !== Suit.Dragon) {
        for (const other of hand) {
          if (other.id !== tile.id && other.suit === s && Math.abs(other.value - v) === 1) {
            score += 5; // part of a potential straight
            break;
          }
        }
      }
    }

    // Check for two-step sequences (e.g. 1-3 pattern, need 2)
    if (s === Suit.Wan || s === Suit.Tiao || s === Suit.Tong) {
      for (const other of hand) {
        if (other.id !== tile.id && other.suit === s) {
          const diff = Math.abs(other.value - v);
          if (diff === 2) {
            // Check if middle tile is available (gap pattern like 1+3 need 2)
            const middleVal = v + (other.value - v) / 2;
            if (!isTileDead(gameState, s, middleVal)) {
              score += 4; // two-step gap, middle tile still alive
            } else {
              score -= 2; // two-step gap but middle tile is DEAD
            }
            break;
          }
          if (diff === 1) {
            // Adjacent — check both directions for three-tile straight
            const minV = Math.min(v, other.value);
            const maxV = Math.max(v, other.value);
            // Check if min-1 or max+1 is available to complete 3-tile straight
            const lowMissing = minV > 1 && !isTileDead(gameState, s, minV - 1);
            const highMissing = maxV < 9 && !isTileDead(gameState, s, maxV + 1);
            if (lowMissing || highMissing) {
              score += 3; // adjacent pair with expansion potential
            }
            break;
          }
        }
      }
    }

    // --- Honours ---
    if (s === Suit.Wind) {
      if (sameCount >= 2) score += 6; // paired wind
      else score += 2; // lone wind — marginal
    }
    if (s === Suit.Dragon) {
      if (sameCount >= 2) score += 8; // paired dragon
      else score += 4; // lone dragon — can be useful
    }

    // --- Dead tile penalty ---
    // A tile is "dead" if all 4 copies are visible — it can never form a meld
    if (isTileDead(gameState, s, v)) {
      score -= 8; // heavily penalize dead tiles
    }

    // --- Safety bonus for discard ---
    // When close to tenpai and opponents are dangerous, prioritize safe tiles
    const anyDangerous = gameState.players.some((_, idx) => isOpponentDangerous(gameState, idx));
    
    if (isTileSafe(gameState, s, v)) {
      if (tenpaiDist <= 2 && anyDangerous) score += 6; // defensive play
      else if (tenpaiDist <= 3) score += 3;
    }

    // --- Dominant suit strategy (hunyise/qingyise) ---
    if (dominantSuit) {
      if (s === dominantSuit.suit) {
        // This tile belongs to our dominant suit — keep it
        score += 4;
        // If we're close to qingyise (pure suit), boost further
        const nonSuitInHand = hand.filter(t => t.suit !== dominantSuit!.suit && t.suit !== Suit.Wind && t.suit !== Suit.Dragon).length;
        if (nonSuitInHand <= 3) {
          score += 3; // near qingyise, aggressive keep
        }
      } else if (s !== Suit.Wind && s !== Suit.Dragon) {
        // Off-suit number tile — penalty
        score -= 3;
        // If far from tenpai, more aggressive about shedding off-suit
        if (tenpaiDist > 3) score -= 3;
      }
    }

    // --- Terminal edges (1 and 9 are harder to sequence) ---
    if (s === Suit.Wan || s === Suit.Tiao || s === Suit.Tong) {
      if ((v === 1 || v === 9) && sameCount === 1) {
        score -= 2; // lone terminal — harder to use
      }
      // Middle tiles (4-6) are most versatile
      if (v >= 4 && v <= 6) score += 2;
    }

    return score;
  });

  // Return index of lowest scoring tile
  let minScore = Infinity;
  let minIndex = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] < minScore) {
      minScore = scores[i];
      minIndex = i;
    }
  }
  return minIndex;
}

// ===== Decision Functions with Game State =====

/**
 * Whether AI should pong — now considers game situation
 */
export function shouldPong(hand: Tile[], tile: Tile, gameState: GameState): boolean {
  if (!canPong(hand, tile)) return false;

  // Ponging helps reduce hand size
  let inSequence = false;
  if (tile.suit === Suit.Wan || tile.suit === Suit.Tiao || tile.suit === Suit.Tong) {
    const v = tile.value;
    let seqAdjacent = 0;
    for (const other of hand) {
      if (other.suit === tile.suit && Math.abs(other.value - v) <= 2 && other.value !== v) {
        seqAdjacent++;
      }
    }
    if (seqAdjacent >= 2) inSequence = true;
  }

  // More aggressive pong when close to winning
  const tenpaiDist = distanceToTenpai(hand, []);
  if (tenpaiDist <= 2) return true; // close to win, pong everything useful
  
  // Don't pong if it breaks a perfect sequence
  if (inSequence && hand.length > 7) return false;

  // Pong is generally good — reduces hand, exposes meld
  return true;
}

/**
 * Whether AI should chi — selective
 */
export function shouldChi(hand: Tile[], tile: Tile): boolean {
  const options = canChi(hand, tile);
  if (options.length === 0) return false;

  // Only chi if the two needed tiles are NOT part of pairs
  for (const [a, b] of options) {
    let aCount = 0, bCount = 0;
    for (const h of hand) {
      if (tileEquals(h, a)) aCount++;
      if (tileEquals(h, b)) bCount++;
    }
    // Safe to chi: neither tile is a pair
    if (aCount === 1 && bCount === 1) return true;
    // Also chi if one is a pair but extra tile exists
    if (aCount >= 2 && bCount >= 3) return true;
  }

  return false;
}

/**
 * Whether AI should ming gang
 */
export function shouldKong(hand: Tile[], tile: Tile): boolean {
  if (canMingGang(hand, tile)) return true;
  return false;
}

/**
 * Whether AI should an gang — more selective to avoid destroying hand potential
 */
export function shouldAnGang(hand: Tile[]): Tile[] {
  const candidates = canAnGang(hand);
  if (candidates.length === 0) return [];

  // Only an-gang if we have enough tiles remaining
  // 4 identical tiles could be used for 2 pairs instead of 1 kong
  // Only do an-gang if we have at least one other pair
  const sorted = [...hand].sort(tileSort);
  let otherPairCount = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (tileEquals(sorted[i], sorted[i + 1]) && candidates.every(c => !tileEquals(c, sorted[i]))) {
      otherPairCount++;
    }
  }

  if (otherPairCount >= 1) return candidates; // have backup pair, safe to kong
  if (hand.length >= 11) return candidates; // early game, can afford it
  
  return []; // risky — don't an-gang when hand is small and no backup pair
}

/**
 * Whether AI should jia gang
 */
export function shouldJiaGang(player: Player, drawnTile: Tile): boolean {
  return canJiaGang(player, drawnTile);
}

/**
 * Check if AI should declare win
 */
export function shouldWin(
  hand: Tile[],
  melds: Meld[],
  newTile: Tile | null,
  settings: GameSettings
): boolean {
  const result = checkWin(hand, melds, newTile, newTile !== null, settings);
  return result !== null;
}
