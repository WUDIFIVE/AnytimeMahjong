// Mahjong AI
// Simple decision-making for AI players

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

/**
 * Score each tile in hand for discard decision.
 * Higher score = keep. Returns index of lowest scoring tile.
 */
export function evaluateDiscard(hand: Tile[], melds: Meld[]): number {
  const scores: number[] = hand.map((tile, i) => {
    let score = 0;

    // Check for pairs
    let sameCount = 0;
    for (const other of hand) {
      if (tileEquals(tile, other)) sameCount++;
    }
    if (sameCount >= 2) score += 6; // part of a pair
    else if (sameCount === 1) {
      // Near-pair: check if there's a tile one away
      if (tile.suit !== Suit.Wind && tile.suit !== Suit.Dragon) {
        for (const other of hand) {
          if (other.suit === tile.suit && Math.abs(other.value - tile.value) === 1) {
            score += 3; // near-pair (one away)
            break;
          }
        }
      }
    }

    // Part of a sequence or near-sequence
    if (tile.suit === Suit.Wan || tile.suit === Suit.Tiao || tile.suit === Suit.Tong) {
      const v = tile.value;
      for (const other of hand) {
        if (other.id !== tile.id && other.suit === tile.suit) {
          const diff = Math.abs(other.value - v);
          if (diff === 1 || diff === 2) {
            score += 5;
            break;
          }
        }
      }
    }

    // Honor tiles
    if (tile.suit === Suit.Wind) {
      score += 4; // wind tile
    }
    if (tile.suit === Suit.Dragon) {
      score += 6; // dragon tile (valuable)
    }

    // Standalone honor (no pair, no near-pair) gets less
    if ((tile.suit === Suit.Wind || tile.suit === Suit.Dragon) && sameCount === 1) {
      score = 2; // standalone honor — low priority to keep
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

/**
 * Whether AI should pong
 */
export function shouldPong(hand: Tile[], tile: Tile): boolean {
  if (!canPong(hand, tile)) return false;

  // Ponging helps reduce hand size and increases triplet count
  // Only skip pong if tile is part of a promising sequence
  let inSequence = false;
  if (tile.suit === Suit.Wan || tile.suit === Suit.Tiao || tile.suit === Suit.Tong) {
    const v = tile.value;
    let seqCount = 0;
    for (const other of hand) {
      if (other.suit === tile.suit && Math.abs(other.value - v) <= 2 && other.value !== v) {
        seqCount++;
      }
    }
    if (seqCount >= 2) inSequence = true; // tile is key part of a sequence
  }

  // Pong unless it destroys a good sequence
  // Also pong more aggressively when close to winning
  return !inSequence || hand.length <= 5;
}

/**
 * Whether AI should chi
 */
export function shouldChi(hand: Tile[], tile: Tile): boolean {
  if (!canChi(hand, tile).length) return false;

  // Chi when it clearly helps form melds
  // Be more selective — only chi if the resulting meld doesn't break other sequences
  const options = canChi(hand, tile);
  if (options.length === 0) return false;

  // Check if the chi uses tiles that are not part of pairs
  for (const [a, b] of options) {
    let aCount = 0, bCount = 0;
    for (const h of hand) {
      if (tileEquals(h, a)) aCount++;
      if (tileEquals(h, b)) bCount++;
    }
    // Only chi if tiles are not part of pairs (count === 1)
    if (aCount === 1 && bCount === 1) return true;
  }

  return false;
}

/**
 * Whether AI should kong (ming gang or an gang)
 */
export function shouldKong(hand: Tile[], tile: Tile): boolean {
  if (canMingGang(hand, tile)) return true;
  return false;
}

/**
 * Whether AI should declare an gang
 */
export function shouldAnGang(hand: Tile[]): Tile[] {
  return canAnGang(hand);
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
