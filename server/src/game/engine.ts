// Mahjong Game Engine
// 136 tiles: 万(wan) 1-9, 条(tiao) 1-9, 筒(tong) 1-9, 风(wind) 东1南2西3北4, 箭(dragon) 中1发2白3
// 34 kinds × 4 copies each

export enum Suit {
  Wan = 'wan',
  Tiao = 'tiao',
  Tong = 'tong',
  Wind = 'wind',
  Dragon = 'dragon',
}

export interface Tile {
  id: number; // unique id 0-135
  suit: Suit;
  value: number; // 1-9 for wan/tiao/tong, 1-4 for wind (东南西北), 1-3 for dragon (中发白)
  name: string; // display name
}

export type MeldType = 'pong' | 'chi' | 'minggang' | 'angang' | 'jiagang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  sourcePlayer?: number;
}

export type WindPosition = 'east' | 'south' | 'west' | 'north';

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  isAI: boolean;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isDealer: boolean;
  windPosition: WindPosition;
  score: number;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export type FanType =
  | '基本胡'
  | '七小对'
  | '十三幺'
  | '碰碰胡'
  | '清一色'
  | '混一色'
  | '杠上开花'
  | '海底捞月'
  | '自摸'
  | '门清'
  | '平胡';

export interface Fan {
  type: FanType;
  value: number;
}

export const FAN_VALUES: Record<FanType, number> = {
  '基本胡': 1,
  '七小对': 4,
  '十三幺': 13,
  '碰碰胡': 2,
  '清一色': 6,
  '混一色': 3,
  '杠上开花': 8,
  '海底捞月': 8,
  '自摸': 1,
  '门清': 1,
  '平胡': 1,
};

export interface WinResult {
  fans: Fan[];
  totalValue: number;
}

export interface SerializedWinResult {
  fans: Fan[];
  totalValue: number;
}

export interface GameSettings {
  allowChi: boolean;
  allowDianpao: boolean;
  maxPlayers: number;
  password?: string;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  wall: Tile[];
  deadWall: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  turnCount: number;
  settings: GameSettings;
  pendingDiscard: Tile | null;
  pendingClaims: Claim[];
  lastDraw: Tile | null;
  lastDrawFromGang: boolean;
  lastDiscard: Tile | null;
  lastDiscardBy?: string;
  lastDiscardPlayerName?: string;
  winnerIndex: number | null;
}

export interface Claim {
  playerIndex: number;
  type: 'pong' | 'chi' | 'minggang' | 'angang' | 'jiagang' | 'win';
  chiOptions?: Tile[][];
}

export interface Room {
  id: string;
  roomKey: string;
  hostId: string;
  players: Player[];
  settings: GameSettings;
  gameState: GameState | null;
  createdAt: number;
  maxPlayers: number;
  nextDealerSeatIndex: number;
}

// --- Tile helpers ---

const WAN_NAMES = ['', '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'];
const TIAO_NAMES = ['', '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'];
const TONG_NAMES = ['', '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'];
const WIND_NAMES = ['', '东', '南', '西', '北'];
const DRAGON_NAMES = ['', '中', '发', '白'];

function tileName(suit: Suit, value: number): string {
  switch (suit) {
    case Suit.Wan: return WAN_NAMES[value];
    case Suit.Tiao: return TIAO_NAMES[value];
    case Suit.Tong: return TONG_NAMES[value];
    case Suit.Wind: return WIND_NAMES[value];
    case Suit.Dragon: return DRAGON_NAMES[value];
  }
}

function createAllTiles(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;

  for (let v = 1; v <= 9; v++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: id++, suit: Suit.Wan, value: v, name: tileName(Suit.Wan, v) });
    }
  }
  for (let v = 1; v <= 9; v++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: id++, suit: Suit.Tiao, value: v, name: tileName(Suit.Tiao, v) });
    }
  }
  for (let v = 1; v <= 9; v++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: id++, suit: Suit.Tong, value: v, name: tileName(Suit.Tong, v) });
    }
  }
  for (let v = 1; v <= 4; v++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: id++, suit: Suit.Wind, value: v, name: tileName(Suit.Wind, v) });
    }
  }
  for (let v = 1; v <= 3; v++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: id++, suit: Suit.Dragon, value: v, name: tileName(Suit.Dragon, v) });
    }
  }

  return tiles;
}

function shuffle(tiles: Tile[]): Tile[] {
  const arr = [...tiles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createWall(): { wall: Tile[]; deadWall: Tile[] } {
  const allTiles = createAllTiles();
  const shuffled = shuffle(allTiles);
  const deadWall = shuffled.slice(-14);
  const wall = shuffled.slice(0, -14);
  return { wall, deadWall };
}

export function deal(wall: Tile[], dealerIndex = 0): Tile[][] {
  const hands: Tile[][] = [[], [], [], []];
  const safeDealerIndex = dealerIndex >= 0 && dealerIndex < hands.length ? dealerIndex : 0;
  const tiles = [...wall];

  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < 4; p++) {
      for (let t = 0; t < 4; t++) {
        hands[p].push(tiles.shift()!);
      }
    }
  }
  for (let p = 0; p < 4; p++) {
    hands[p].push(tiles.shift()!);
  }
  hands[safeDealerIndex].push(tiles.shift()!);

  wall.length = 0;
  wall.push(...tiles);

  return hands;
}

export function drawTile(wall: Tile[]): Tile | null {
  if (wall.length === 0) return null;
  return wall.pop()!;
}

export function drawReplacementTile(deadWall: Tile[]): Tile | null {
  if (deadWall.length === 0) return null;
  return deadWall.pop()!;
}

export function tileEquals(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

export function tileKey(tile: Tile): string {
  return `${tile.suit}-${tile.value}`;
}

export function tileSort(a: Tile, b: Tile): number {
  const suitOrder: Record<Suit, number> = {
    [Suit.Wan]: 0,
    [Suit.Tiao]: 1,
    [Suit.Tong]: 2,
    [Suit.Wind]: 3,
    [Suit.Dragon]: 4,
  };
  const sa = suitOrder[a.suit];
  const sb = suitOrder[b.suit];
  if (sa !== sb) return sa - sb;
  return a.value - b.value;
}

export function canPong(hand: Tile[], tile: Tile): boolean {
  let count = 0;
  for (const t of hand) {
    if (tileEquals(t, tile)) count++;
  }
  return count >= 2;
}

export function canChi(hand: Tile[], tile: Tile): Tile[][] {
  if (tile.suit === Suit.Wind || tile.suit === Suit.Dragon) return [];

  const results: Tile[][] = [];
  const v = tile.value;
  const suit = tile.suit;

  const handValues = new Set<number>();
  for (const t of hand) {
    if (t.suit === suit) handValues.add(t.value);
  }

  const patterns: [number, number][] = [];
  if (v >= 3) patterns.push([v - 2, v - 1]);
  if (v >= 2 && v <= 8) patterns.push([v - 1, v + 1]);
  if (v <= 7) patterns.push([v + 1, v + 2]);

  for (const [a, b] of patterns) {
    if (handValues.has(a) && handValues.has(b)) {
      let tileA: Tile | null = null, tileB: Tile | null = null;
      for (const t of hand) {
        if (!tileA && t.suit === suit && t.value === a) tileA = t;
        else if (!tileB && t.suit === suit && t.value === b) tileB = t;
        if (tileA && tileB) break;
      }
      if (tileA && tileB) results.push([tileA, tileB]);
    }
  }

  return results;
}

export function canMingGang(hand: Tile[], tile: Tile): boolean {
  let count = 0;
  for (const t of hand) {
    if (tileEquals(t, tile)) count++;
  }
  return count >= 3;
}

export function canAnGang(hand: Tile[]): Tile[] {
  const countMap = new Map<string, number>();
  for (const t of hand) {
    const key = tileKey(t);
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }
  const result: Tile[] = [];
  const seen = new Set<string>();
  for (const t of hand) {
    const key = tileKey(t);
    if (countMap.get(key) === 4 && !seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}

export function canJiaGang(player: Player, drawnTile: Tile): boolean {
  for (const meld of player.melds) {
    if (meld.type === 'pong' && tileEquals(meld.tiles[0], drawnTile)) {
      return true;
    }
  }
  return false;
}

export function executePong(player: Player, tile: Tile, gameState: GameState): void {
  const toRemove: number[] = [];
  for (let i = 0; i < player.hand.length && toRemove.length < 2; i++) {
    if (tileEquals(player.hand[i], tile)) toRemove.push(i);
  }
  for (const idx of toRemove.sort((a, b) => b - a)) {
    player.hand.splice(idx, 1);
  }

  player.melds.push({
    type: 'pong',
    tiles: [{ ...tile }, { ...tile }, { ...tile }],
    sourcePlayer: gameState.currentPlayerIndex,
  });

  if (gameState.pendingDiscard) {
    const discIdx = gameState.players[gameState.currentPlayerIndex].discards
      .findIndex(d => tileEquals(d, gameState.pendingDiscard!));
    if (discIdx >= 0) gameState.players[gameState.currentPlayerIndex].discards.splice(discIdx, 1);
  }
  gameState.lastDiscard = null;
  gameState.lastDiscardBy = undefined;
  gameState.lastDiscardPlayerName = undefined;
  gameState.pendingDiscard = null;
  gameState.pendingClaims = [];
}

export function executeChi(player: Player, tile: Tile, tiles: [Tile, Tile], gameState: GameState): void {
  for (const t of tiles) {
    const idx = player.hand.findIndex(h => tileEquals(h, t));
    if (idx >= 0) player.hand.splice(idx, 1);
  }

  const allTiles = [tile, ...tiles];
  allTiles.sort(tileSort);

  player.melds.push({
    type: 'chi',
    tiles: allTiles,
    sourcePlayer: gameState.currentPlayerIndex,
  });

  if (gameState.pendingDiscard) {
    const discIdx = gameState.players[gameState.currentPlayerIndex].discards
      .findIndex(d => tileEquals(d, gameState.pendingDiscard!));
    if (discIdx >= 0) gameState.players[gameState.currentPlayerIndex].discards.splice(discIdx, 1);
  }
  gameState.lastDiscard = null;
  gameState.lastDiscardBy = undefined;
  gameState.lastDiscardPlayerName = undefined;
  gameState.pendingDiscard = null;
  gameState.pendingClaims = [];
}

export function executeMingGang(player: Player, tile: Tile, gameState: GameState): void {
  const toRemove: number[] = [];
  for (let i = 0; i < player.hand.length && toRemove.length < 3; i++) {
    if (tileEquals(player.hand[i], tile)) toRemove.push(i);
  }
  for (const idx of toRemove.sort((a, b) => b - a)) {
    player.hand.splice(idx, 1);
  }

  player.melds.push({
    type: 'minggang',
    tiles: [{ ...tile }, { ...tile }, { ...tile }, { ...tile }],
    sourcePlayer: gameState.currentPlayerIndex,
  });

  if (gameState.pendingDiscard) {
    const discIdx = gameState.players[gameState.currentPlayerIndex].discards
      .findIndex(d => tileEquals(d, gameState.pendingDiscard!));
    if (discIdx >= 0) gameState.players[gameState.currentPlayerIndex].discards.splice(discIdx, 1);
  }
  gameState.lastDiscard = null;
  gameState.lastDiscardBy = undefined;
  gameState.lastDiscardPlayerName = undefined;
  gameState.pendingDiscard = null;
  gameState.pendingClaims = [];

  const replacement = drawReplacementTile(gameState.deadWall);
  if (replacement) {
    player.hand.push(replacement);
    gameState.lastDraw = replacement;
    gameState.lastDrawFromGang = true;
  }
}

export function executeAnGang(player: Player, tileIds: number[], gameState: GameState): void {
  const tiles: Tile[] = [];
  const toRemove: number[] = [];
  for (const id of tileIds) {
    const idx = player.hand.findIndex(t => t.id === id);
    if (idx >= 0) {
      toRemove.push(idx);
      tiles.push(player.hand[idx]);
    }
  }
  for (const idx of toRemove.sort((a, b) => b - a)) {
    player.hand.splice(idx, 1);
  }

  player.melds.push({
    type: 'angang',
    tiles: tiles.map(t => ({ ...t })),
    sourcePlayer: undefined,
  });
  gameState.pendingDiscard = null;
  gameState.pendingClaims = [];

  const replacement = drawReplacementTile(gameState.deadWall);
  if (replacement) {
    player.hand.push(replacement);
    gameState.lastDraw = replacement;
    gameState.lastDrawFromGang = true;
  }
}

export function executeJiaGang(player: Player, tile: Tile, gameState: GameState): void {
  const meld = player.melds.find(
    m => m.type === 'pong' && tileEquals(m.tiles[0], tile)
  );
  if (meld) {
    meld.type = 'jiagang';
    meld.tiles.push({ ...tile });
  }

  const idx = player.hand.findIndex(t => tileEquals(t, tile));
  if (idx >= 0) player.hand.splice(idx, 1);

  gameState.pendingDiscard = null;
  gameState.pendingClaims = [];

  const replacement = drawReplacementTile(gameState.deadWall);
  if (replacement) {
    player.hand.push(replacement);
    gameState.lastDraw = replacement;
    gameState.lastDrawFromGang = true;
  }
}

// --- Win Detection ---

function decomposeTiles(
  tiles: Tile[],
  meldCount: number,
  hasPair: boolean,
  onlyTriplets: boolean = false
): boolean {
  if (tiles.length === 0) {
    return meldCount === 4 && hasPair;
  }

  const sorted = [...tiles].sort(tileSort);
  const first = sorted[0];

  // Try pair
  if (!hasPair) {
    const matching = sorted.filter(t => tileEquals(t, first));
    if (matching.length >= 2) {
      let removed = 0;
      const rest: Tile[] = [];
      for (const t of sorted) {
        if (removed < 2 && tileEquals(t, first)) {
          removed++;
        } else {
          rest.push(t);
        }
      }
      if (decomposeTiles(rest, meldCount, true, onlyTriplets)) return true;
    }
  }

  // Try triplet
  {
    const matching = sorted.filter(t => tileEquals(t, first));
    if (matching.length >= 3) {
      let removed = 0;
      const rest: Tile[] = [];
      for (const t of sorted) {
        if (removed < 3 && tileEquals(t, first)) {
          removed++;
        } else {
          rest.push(t);
        }
      }
      if (decomposeTiles(rest, meldCount + 1, hasPair, onlyTriplets)) return true;
    }
  }

  // Try sequence (only for wan/tiao/tong, and only if not onlyTriplets)
  if (
    !onlyTriplets &&
    (first.suit === Suit.Wan || first.suit === Suit.Tiao || first.suit === Suit.Tong)
  ) {
    const v = first.value;
    if (v <= 7) {
      const has1 = sorted.some(t => t.suit === first.suit && t.value === v);
      const has2 = sorted.some(t => t.suit === first.suit && t.value === v + 1);
      const has3 = sorted.some(t => t.suit === first.suit && t.value === v + 2);
      if (has1 && has2 && has3) {
        let r1 = false, r2 = false, r3 = false;
        const rest: Tile[] = [];
        for (const t of sorted) {
          if (!r1 && t.suit === first.suit && t.value === v) {
            r1 = true;
          } else if (!r2 && t.suit === first.suit && t.value === v + 1) {
            r2 = true;
          } else if (!r3 && t.suit === first.suit && t.value === v + 2) {
            r3 = true;
          } else {
            rest.push(t);
          }
        }
        if (decomposeTiles(rest, meldCount + 1, hasPair, onlyTriplets)) return true;
      }
    }
  }

  return false;
}

function allOneSuit(tiles: Tile[]): Suit | null {
  const suits = new Set(tiles.map(t => t.suit));
  if (suits.size !== 1) return null;
  const suit = suits.values().next().value;
  if (suit === Suit.Wan || suit === Suit.Tiao || suit === Suit.Tong) return suit;
  return null;
}

function isMixedOneSuit(tiles: Tile[]): boolean {
  const suits = new Set(tiles.map(t => t.suit));
  const hasHonor = suits.has(Suit.Wind) || suits.has(Suit.Dragon);
  const numberSuits = [Suit.Wan, Suit.Tiao, Suit.Tong].filter(s => suits.has(s));
  return hasHonor && numberSuits.length === 1;
}

function isSevenPairs(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const countMap = new Map<string, number>();
  for (const t of tiles) {
    const key = tileKey(t);
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }
  for (const count of countMap.values()) {
    if (count !== 0 && count !== 2) return false;
  }
  let uniqueCount = 0;
  for (const count of countMap.values()) {
    if (count === 2) uniqueCount++;
  }
  return uniqueCount === 7;
}

function isThirteenOrphans(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;

  const required: { suit: Suit; value: number }[] = [
    { suit: Suit.Wan, value: 1 }, { suit: Suit.Wan, value: 9 },
    { suit: Suit.Tiao, value: 1 }, { suit: Suit.Tiao, value: 9 },
    { suit: Suit.Tong, value: 1 }, { suit: Suit.Tong, value: 9 },
    { suit: Suit.Wind, value: 1 }, { suit: Suit.Wind, value: 2 },
    { suit: Suit.Wind, value: 3 }, { suit: Suit.Wind, value: 4 },
    { suit: Suit.Dragon, value: 1 }, { suit: Suit.Dragon, value: 2 },
    { suit: Suit.Dragon, value: 3 },
  ];

  const used = new Set<number>();
  for (const req of required) {
    const idx = tiles.findIndex(
      (t, i) => !used.has(i) && t.suit === req.suit && t.value === req.value
    );
    if (idx < 0) return false;
    used.add(idx);
  }

  for (let i = 0; i < tiles.length; i++) {
    if (!used.has(i)) {
      const t = tiles[i];
      if (required.some(r => r.suit === t.suit && r.value === t.value)) {
        used.add(i);
        return used.size === 14;
      }
    }
  }

  return false;
}

function isPengPengHu(tiles: Tile[]): boolean {
  return decomposeTiles(tiles, 0, false, true);
}

function isQingYiSe(tiles: Tile[]): boolean {
  return allOneSuit(tiles) !== null;
}

export function checkWin(
  hand: Tile[],
  melds: Meld[],
  newTile: Tile | null,
  isZimo: boolean,
  settings: GameSettings,
  context: { isGangShangKaiHua?: boolean; isHaidiLaoyue?: boolean } = {}
): WinResult | null {
  const allTiles: Tile[] = [...hand];
  if (newTile) allTiles.push(newTile);
  for (const meld of melds) {
    allTiles.push(...meld.tiles);
  }

  const totalMelds = melds.length;
  const remainingHandTiles = [...hand];
  if (newTile) remainingHandTiles.push(newTile);

  const fans: Fan[] = [];

  let basicWin = decomposeTiles(remainingHandTiles, totalMelds, false, false);

  let isSevenPairsWin = false;
  let isThirteenOrphansWin = false;
  let isPengPengHuWin = false;

  if (melds.length === 0) {
    isSevenPairsWin = isSevenPairs(allTiles);
    isThirteenOrphansWin = isThirteenOrphans(allTiles);

    if (isSevenPairsWin) fans.push({ type: '七小对', value: FAN_VALUES['七小对'] });
    if (isThirteenOrphansWin) {
      fans.push({ type: '十三幺', value: FAN_VALUES['十三幺'] });
      // 十三幺 includes 基本胡 — max value already achieved
    }

    // For 碰碰胡 without melds
    isPengPengHuWin = isPengPengHu(allTiles);
    if (isPengPengHuWin) fans.push({ type: '碰碰胡', value: FAN_VALUES['碰碰胡'] });
  } else {
    const allTriplets = melds.every(
      m => m.type === 'pong' || m.type === 'minggang' || m.type === 'angang' || m.type === 'jiagang'
    );
    if (allTriplets && decomposeTiles(remainingHandTiles, totalMelds, false, true)) {
      isPengPengHuWin = true;
      fans.push({ type: '碰碰胡', value: FAN_VALUES['碰碰胡'] });
    }
  }

  if (!basicWin && !isSevenPairsWin && !isThirteenOrphansWin && !isPengPengHuWin) {
    return null;
  }

  if (basicWin) fans.push({ type: '基本胡', value: FAN_VALUES['基本胡'] });

  if (isQingYiSe(allTiles)) {
    fans.push({ type: '清一色', value: FAN_VALUES['清一色'] });
  }

  if (!isQingYiSe(allTiles) && isMixedOneSuit(allTiles)) {
    fans.push({ type: '混一色', value: FAN_VALUES['混一色'] });
  }

  if (isZimo) fans.push({ type: '自摸', value: FAN_VALUES['自摸'] });
  if (isZimo && context.isGangShangKaiHua) {
    fans.push({ type: '杠上开花', value: FAN_VALUES['杠上开花'] });
  }
  if (isZimo && context.isHaidiLaoyue) {
    fans.push({ type: '海底捞月', value: FAN_VALUES['海底捞月'] });
  }

  const hasOpenMelds = melds.some(
    m => m.type === 'pong' || m.type === 'chi' || m.type === 'minggang'
  );
  if (!hasOpenMelds) fans.push({ type: '门清', value: FAN_VALUES['门清'] });

  const totalValue = fans.reduce((sum, f) => sum + f.value, 0);
  return { fans, totalValue };
}

export function isTing(hand: Tile[], melds: Meld[]): boolean {
  const allPossibleTiles: { suit: Suit; value: number }[] = [];
  for (const suit of [Suit.Wan, Suit.Tiao, Suit.Tong]) {
    for (let v = 1; v <= 9; v++) allPossibleTiles.push({ suit, value: v });
  }
  for (let v = 1; v <= 4; v++) allPossibleTiles.push({ suit: Suit.Wind, value: v });
  for (let v = 1; v <= 3; v++) allPossibleTiles.push({ suit: Suit.Dragon, value: v });

  const settings: GameSettings = { allowChi: true, allowDianpao: true, maxPlayers: 4 };

  const candidateHands = hand.length % 3 === 1
    ? [hand]
    : hand.map((_, discardIndex) => hand.filter((_tile, idx) => idx !== discardIndex));

  for (const candidate of candidateHands) {
    for (const { suit, value } of allPossibleTiles) {
      const testTile: Tile = { id: -1, suit, value, name: '' };
      if (checkWin(candidate, melds, testTile, true, settings)) return true;
    }
  }

  return false;
}

// --- Serialization helpers ---

function serializeSuit(suit: Suit): string {
  if (suit === Suit.Wind) return 'feng';
  if (suit === Suit.Dragon) return 'jian';
  return suit;
}

function serializeMeldType(type: MeldType): string {
  if (type === 'pong') return 'peng';
  if (type === 'minggang') return 'ming-gang';
  if (type === 'angang') return 'an-gang';
  if (type === 'jiagang') return 'jia-gang';
  return type;
}

function serializeClaimType(type: Claim['type']): string {
  if (type === 'minggang') return 'ming-gang';
  if (type === 'angang') return 'an-gang';
  if (type === 'jiagang') return 'jia-gang';
  if (type === 'win') return 'hu';
  return type;
}

export function serializeTile(tile: Tile): any {
  return { id: String(tile.id), suit: serializeSuit(tile.suit), value: tile.value, name: tile.name };
}

export function serializeMeld(meld: Meld): any {
  return {
    type: serializeMeldType(meld.type),
    tiles: meld.tiles.map(serializeTile),
    sourcePlayer: meld.sourcePlayer,
  };
}

export function serializePlayer(player: Player): any {
  return {
    id: player.id,
    name: player.name,
    seatIndex: player.seatIndex,
    isAI: player.isAI,
    wind: player.windPosition,
    windPosition: player.windPosition,
    hand: player.hand.map(serializeTile),
    handSize: player.hand.length,
    melds: player.melds.map(serializeMeld),
    discards: player.discards.map(serializeTile),
    isDealer: player.isDealer,
    isCurrentTurn: false,
    score: player.score ?? 0,
  };
}

export function serializeGameState(state: GameState): any {
  return {
    roomId: state.roomId,
    phase: state.phase,
    status: state.phase,
    currentWind: 'east',
    wallCount: state.wall.length,
    deadWallSize: state.deadWall.length,
    players: state.players.map((player, index) => ({
      ...serializePlayer(player),
      isCurrentTurn: index === state.currentPlayerIndex,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    turnCount: state.turnCount,
    settings: state.settings,
    pendingDiscard: state.pendingDiscard ? serializeTile(state.pendingDiscard) : null,
    lastDiscard: state.lastDiscard ? serializeTile(state.lastDiscard) : null,
    lastDiscardBy: state.lastDiscardBy,
    lastDiscardPlayerName: state.lastDiscardPlayerName,
    pendingClaims: state.pendingClaims.map(c => ({
      ...c,
      type: serializeClaimType(c.type),
      playerId: state.players[c.playerIndex]?.id,
      chiOptions: c.chiOptions?.map(option => option.map(serializeTile)),
    })),
    lastDraw: state.lastDraw ? serializeTile(state.lastDraw) : null,
    lastDrawFromGang: state.lastDrawFromGang,
    winnerIndex: state.winnerIndex,
  };
}
