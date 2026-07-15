// ===== Mahjong Type Definitions =====

export type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'jian';

export interface Tile {
  suit: Suit;
  value: number;
  id: string;
}

export type MeldType = 'chi' | 'pong' | 'minggang' | 'angang' | 'jiagang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  fromPlayer?: number;
}

export interface Player {
  id: string;
  name: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isAI: boolean;
  isDealer: boolean;
  seatIndex: number;
}

export interface RoomSettings {
  allowChi: boolean;
  allowDianpao: boolean;
  password: string;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface GameState {
  players: Player[];
  wall: Tile[];
  deadWall: Tile[];
  currentPlayerIndex: number;
  roomSettings: RoomSettings;
  phase: GamePhase;
  turnPhase: 'draw' | 'discard' | 'claim' | 'end';
  pendingDiscard: Tile | null;
  pendingClaims: ClaimOption[];
  roundWind: number;
  dealerIndex: number;
  winnerIndex: number | null;
  winResult: WinResult | null;
}

export interface ClaimOption {
  playerIndex: number;
  type: 'chi' | 'pong' | 'minggang' | 'hu';
  tiles?: Tile[];
}

export type FanType = 'base' | 'sevenPairs' | 'thirteenOrphans' | 'allTriplets' | 'pureFlush' | 'mixedFlush';

export const FAN_VALUES: Record<FanType, number> = {
  base: 1,
  sevenPairs: 4,
  thirteenOrphans: 13,
  allTriplets: 2,
  pureFlush: 6,
  mixedFlush: 3,
};

export const FAN_NAMES: Record<FanType, string> = {
  base: '基本胡',
  sevenPairs: '七小对',
  thirteenOrphans: '十三幺',
  allTriplets: '碰碰胡',
  pureFlush: '清一色',
  mixedFlush: '混一色',
};

export const FAN_DESCRIPTIONS: Record<FanType, string> = {
  base: '4副顺子或刻子 + 1对将牌',
  sevenPairs: '7个对子（14张牌组成7对）',
  thirteenOrphans: '13种幺九牌各一张，其中一种成对',
  allTriplets: '4副刻子/杠 + 1对将牌（无顺子）',
  pureFlush: '全部为同一花色（全万、全条或全筒）',
  mixedFlush: '一种花色 + 字牌（风/箭）',
};

export interface WinResult {
  winner: string;
  winningTile: Tile;
  isZimo: boolean;
  fromPlayer?: string;
  fanTypes: FanType[];
  totalFan: number;
  hand: Tile[];
  melds: Meld[];
}

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  settings: RoomSettings;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: number;
}

export type WSMessage =
  | { type: 'create_room'; nickname: string; password: string; allowChi: boolean; allowDianpao: boolean }
  | { type: 'join_room'; roomId: string; nickname: string; password: string }
  | { type: 'toggle_setting'; roomId: string; setting: 'allowChi' | 'allowDianpao'; value: boolean }
  | { type: 'dissolve_room'; roomId: string }
  | { type: 'start_game'; roomId: string }
  | { type: 'discard'; roomId: string; tileId: string }
  | { type: 'pong'; roomId: string }
  | { type: 'chi'; roomId: string; tileIndex1: number; tileIndex2: number }
  | { type: 'minggang'; roomId: string }
  | { type: 'angang'; roomId: string; tileIds: string[] }
  | { type: 'jiagang'; roomId: string; tileId: string }
  | { type: 'pass'; roomId: string }
  | { type: 'win'; roomId: string };

export type ServerMessage =
  | { type: 'room_created'; roomId: string; playerId: string }
  | { type: 'room_joined'; roomId: string; playerId: string; players: RoomPlayer[]; settings: RoomSettings; hostId: string }
  | { type: 'player_list'; players: RoomPlayer[]; hostId: string }
  | { type: 'settings_updated'; settings: RoomSettings }
  | { type: 'game_started'; gameState: SerializedGameState }
  | { type: 'game_state'; gameState: SerializedGameState }
  | { type: 'your_turn'; gameState: SerializedGameState; drawTile?: SerializedTile }
  | { type: 'pending_claims'; claims: ClaimOption[]; discardTile: SerializedTile }
  | { type: 'claim_result'; action: string; playerIndex: number; gameState: SerializedGameState }
  | { type: 'game_over'; winResult: SerializedWinResult; gameState: SerializedGameState }
  | { type: 'error'; message: string }
  | { type: 'room_dissolved'; roomId: string; message: string }
  | { type: 'player_disconnected'; playerId: string };

export interface SerializedTile {
  suit: Suit;
  value: number;
  id: string;
}

export interface SerializedMeld {
  type: MeldType;
  tiles: SerializedTile[];
  fromPlayer?: number;
}

export interface SerializedPlayer {
  id: string;
  name: string;
  handSize: number;
  hand: SerializedTile[];
  melds: SerializedMeld[];
  discards: SerializedTile[];
  isAI: boolean;
  isDealer: boolean;
  seatIndex: number;
}

export interface SerializedGameState {
  players: SerializedPlayer[];
  wallSize: number;
  currentPlayerIndex: number;
  roomSettings: RoomSettings;
  phase: GamePhase;
  turnPhase: string;
  pendingDiscard: SerializedTile | null;
  pendingClaims: ClaimOption[];
  dealerIndex: number;
}

export interface SerializedWinResult {
  winner: string;
  winningTile: SerializedTile;
  isZimo: boolean;
  fromPlayer?: string;
  fanTypes: FanType[];
  totalFan: number;
  hand: SerializedTile[];
  melds: SerializedMeld[];
  playerNames: Record<string, string>;
}

export function tileToString(tile: Tile | SerializedTile): string {
  if (tile.suit === 'wan') return `${tile.value}万`;
  if (tile.suit === 'tiao') return `${tile.value}条`;
  if (tile.suit === 'tong') return `${tile.value}筒`;
  if (tile.suit === 'feng') return ['', '东', '南', '西', '北'][tile.value];
  if (tile.suit === 'jian') return ['', '中', '發', '白'][tile.value];
  return '?';
}

export function serializeTile(tile: Tile): SerializedTile {
  return { suit: tile.suit, value: tile.value, id: tile.id };
}