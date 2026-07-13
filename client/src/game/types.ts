// === Tile Types ===
export type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'jian';

export interface Tile {
  suit: Suit;
  value: number;    // 1-9 for suited, 1-4 for feng (东南西北), 1-3 for jian (中发白)
  id: string;       // unique id e.g. "wan-1-0"
}

export type TileKey = string; // e.g. "wan-1"

// === Meld Types ===
export type MeldType = 'chi' | 'peng' | 'ming-gang' | 'an-gang' | 'jia-gang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  sourcePlayer?: number; // player index who discarded the claimed tile
}

// === Hand Pattern (Fan) Types ===
export type FanType =
  | 'yitiaolong'       // 一条龙
  | 'shisanmeyao'      // 十三幺
  | 'qixiaodui'        // 七小对
  | 'danshuang'        // 单双
  | 'qingyise'         // 清一色
  | 'hunyise'          // 混一色
  | 'pengpenghu'       // 碰碰胡
  | 'quanqiudui'       // 全求对
  | 'quanqiudan'       // 全求单
  | 'qinglongbei'      // 青龙背
  | 'shuanglongxi'     // 双龙戏珠
  | 'longfengpei'      // 龙凤配
  | 'quanshuangke'     // 全双刻
  | 'quandanke'        // 全单刻
  | 'danlongyitiaolong'; // 单龙一条龙

export interface FanInfo {
  type: FanType;
  name: string;
  fanValue: number;
  description: string;
  icon: string;
  exampleTiles?: Tile[];
}

// === Player State ===
export interface PlayerState {
  id: string;
  name: string;
  seatIndex: number;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isDealer: boolean;
  isCurrentTurn: boolean;
  wind: string; // 'east' | 'south' | 'west' | 'north'
  score: number;
}

// === Game State ===
export interface GameState {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerState[];
  wallCount: number;          // remaining tiles in wall
  currentPlayerIndex: number;
  currentWind: string;       // prevailing wind
  lastDiscard: Tile | null;
  lastDiscardBy?: string;
  lastDiscardPlayerName?: string;
  lastDraw?: Tile | null;
  pendingClaims: Claim[];
  settings: GameSettings;
  winResult: WinResult | null;
}

export interface GameSettings {
  allowChi: boolean;
  allowDianpao: boolean;     // 点炮 — if false, only self-draw wins
  password?: string;
  maxPlayers: number;
}

// === Claim Types ===
export type ClaimType = 'pong' | 'chi' | 'ming-gang' | 'jia-gang' | 'an-gang' | 'hu' | 'pass';

export interface Claim {
  playerId: string;
  type: ClaimType;
  tiles?: Tile[];
}

// === Win Result ===
export interface WinResult {
  winnerId?: string;
  winners?: { playerId: string; playerName: string; totalFan: number }[];
  loserId?: string;          // dianpao player, if applicable
  winType: 'zimo' | 'dianpao' | 'draw';
  concealedHand?: Tile[];
  winningTile?: Tile | null;
  winningHand: Tile[];
  melds?: Meld[];
  fans: FanInfo[];
  totalFan: number;
  payouts: PayoutInfo[];
  ranking?: RankingInfo[];
}

export interface PayoutInfo {
  fromId: string;
  toId: string;
  amount: number;
}

export interface RankingInfo {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  isWinner?: boolean;
}

// === WS Message Types ===
export type WSMessageType =
  | 'create_room'
  | 'join_room'
  | 'start_game'
  | 'discard'
  | 'claim'
  | 'game_state'
  | 'room_state'
  | 'error'
  | 'chat'
  | 'player_join'
  | 'player_left'
  | 'player_leave'
  | 'settings_updated'
  | 'game_start'
  | 'turn_change'
  | 'pending_claims'
  | 'pong_executed'
  | 'chi_executed'
  | 'minggang_executed'
  | 'angang_executed'
  | 'jiagang_executed'
  | 'game_over'
  | 'game_end'
  | 'settlement';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
}

// === TILE DISPLAY ===

export const SUIT_NAMES: Record<Suit, string> = {
  wan: '万',
  tiao: '条',
  tong: '筒',
  feng: '风',
  jian: '箭',
};

export const SUIT_COLORS: Record<Suit, string> = {
  wan: '#c0392b',
  tiao: '#27ae60',
  tong: '#2980b9',
  feng: '#8e44ad',
  jian: '#d4a017',
};

const FENG_CHARS = ['东', '南', '西', '北'];
const JIAN_CHARS = ['中', '发', '白'];
const NUMBER_CHARS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function tileToKey(tile: Tile): TileKey {
  return `${tile.suit}-${tile.value}`;
}

export function tileDisplayChar(tile: Tile): string {
  switch (tile.suit) {
    case 'wan': return NUMBER_CHARS[tile.value];
    case 'tiao': return NUMBER_CHARS[tile.value];
    case 'tong': return NUMBER_CHARS[tile.value];
    case 'feng': return FENG_CHARS[tile.value - 1] || '?';
    case 'jian': return JIAN_CHARS[tile.value - 1] || '?';
    default: return '?';
  }
}

export function formatTile(tile: Tile): string {
  const char = tileDisplayChar(tile);
  const suit = SUIT_NAMES[tile.suit];
  if (tile.suit === 'feng' || tile.suit === 'jian') {
    return char;
  }
  return `${char}${suit}`;
}

export function getTileColor(suit: Suit): string {
  return SUIT_COLORS[suit];
}

export function getTileSuitSymbol(suit: Suit): string {
  return SUIT_NAMES[suit];
}

// Sort tiles by suit then value
export function sortTiles(tiles: Tile[] = []): Tile[] {
  const safeTiles = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  const suitOrder: Record<Suit, number> = { wan: 0, tiao: 1, tong: 2, feng: 3, jian: 4 };
  return [...safeTiles].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return a.value - b.value;
  });
}

// === FAN DEFINITIONS ===
export const FAN_DEFINITIONS: FanInfo[] = [
  {
    type: 'yitiaolong',
    name: '一条龙',
    fanValue: 3,
    description: '同花色1-9各一张，组成完整的一条龙',
    icon: '🐉',
  },
  {
    type: 'shisanmeyao',
    name: '十三幺',
    fanValue: 13,
    description: '十三种幺九牌各一张，其中一种成对',
    icon: '🌟',
  },
  {
    type: 'qixiaodui',
    name: '七小对',
    fanValue: 7,
    description: '七个对子组成的牌型',
    icon: '💎',
  },
  {
    type: 'danshuang',
    name: '单双',
    fanValue: 2,
    description: '全手牌均为单数或均为双数',
    icon: '🎯',
  },
  {
    type: 'qingyise',
    name: '清一色',
    fanValue: 6,
    description: '全部由同一花色组成',
    icon: '🎨',
  },
  {
    type: 'hunyise',
    name: '混一色',
    fanValue: 3,
    description: '由一种花色加字牌组成',
    icon: '🌈',
  },
  {
    type: 'pengpenghu',
    name: '碰碰胡',
    fanValue: 3,
    description: '由四组刻子/杠子加一对将牌组成',
    icon: '💥',
  },
  {
    type: 'quanqiudui',
    name: '全求对',
    fanValue: 6,
    description: '全部由对子组成，吃碰后手牌全是对子',
    icon: '🔮',
  },
  {
    type: 'quanqiudan',
    name: '全求单',
    fanValue: 8,
    description: '全部由单张组成，听牌时手中只剩一张',
    icon: '⚡',
  },
  {
    type: 'qinglongbei',
    name: '青龙背',
    fanValue: 10,
    description: '七小对中有一杠（四张相同），其余为对子',
    icon: '🐲',
  },
  {
    type: 'shuanglongxi',
    name: '双龙戏珠',
    fanValue: 12,
    description: '两条花色不同的龙，加一对将牌',
    icon: '🐉🐉',
  },
  {
    type: 'longfengpei',
    name: '龙凤配',
    fanValue: 8,
    description: '一条龙加七小对中的三个对子',
    icon: '🐉🦅',
  },
  {
    type: 'quanshuangke',
    name: '全双刻',
    fanValue: 4,
    description: '全部刻子由双数组成',
    icon: '🎪',
  },
  {
    type: 'quandanke',
    name: '全单刻',
    fanValue: 4,
    description: '全部刻子由单数组成',
    icon: '🎭',
  },
  {
    type: 'danlongyitiaolong',
    name: '单龙一条龙',
    fanValue: 5,
    description: '单数一条龙（1,3,5,7,9）',
    icon: '🐍',
  },
];

export function getFanInfo(type: FanType): FanInfo | undefined {
  return FAN_DEFINITIONS.find(f => f.type === type);
}

// Generate example tiles for 十三幺
export function getShisanmeyaoExample(): Tile[] {
  const tiles: Tile[] = [];
  // One of each terminal/honor
  for (const suit of ['wan', 'tiao', 'tong'] as Suit[]) {
    tiles.push({ suit, value: 1, id: `${suit}-1-ex` });
    tiles.push({ suit, value: 9, id: `${suit}-9-ex` });
  }
  for (let i = 1; i <= 4; i++) {
    tiles.push({ suit: 'feng', value: i, id: `feng-${i}-ex` });
  }
  for (let i = 1; i <= 3; i++) {
    tiles.push({ suit: 'jian', value: i, id: `jian-${i}-ex` });
  }
  return tiles;
}

// Generate example tiles for 七小对
export function getQixiaoduiExample(): Tile[][] {
  // 7 random-ish pairs
  const pairs: [Suit, number][] = [
    ['wan', 2], ['wan', 2],
    ['wan', 5], ['wan', 5],
    ['tiao', 3], ['tiao', 3],
    ['tiao', 7], ['tiao', 7],
    ['tong', 4], ['tong', 4],
    ['tong', 8], ['tong', 8],
    ['feng', 1], ['feng', 1],
  ];
  const result: Tile[][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    result.push([
      { suit: pairs[i][0], value: pairs[i][1], id: `pair-${i}-0` },
      { suit: pairs[i + 1][0], value: pairs[i + 1][1], id: `pair-${i}-1` },
    ]);
  }
  return result;
}
