// Room Manager
// Manages game rooms: creation, joining, leaving, starting games

import {
  Player,
  Room,
  GameState,
  GameSettings,
  WindPosition,
  createWall,
  deal,
  GamePhase,
} from '../game/engine';

const WIND_POSITIONS: WindPosition[] = ['east', 'south', 'west', 'north'];

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Generate random 6-char alphanumeric room ID
   */
  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(id)) return this.generateRoomId();
    return id;
  }

  /**
   * Create a new room
   */
  createRoom(hostName: string, roomKey: string, allowChi: boolean, allowDianpao: boolean, maxPlayers: number = 4): Room {
    const id = this.generateRoomId();
    const hostId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const host: Player = {
      id: hostId,
      name: hostName,
      seatIndex: 0,
      isAI: false,
      hand: [],
      melds: [],
      discards: [],
      isDealer: true,
      windPosition: 'east',
      score: 0,
    };

    const settings: GameSettings = {
      allowChi,
      allowDianpao,
      maxPlayers,
    };

    const room: Room = {
      id,
      roomKey,
      hostId,
      players: [host],
      settings,
      maxPlayers,
      gameState: null,
      createdAt: Date.now(),
      nextDealerSeatIndex: 0,
    };

    this.rooms.set(id, room);
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(roomId: string, playerName: string, roomKey: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null; // room not found

    if (room.roomKey && room.roomKey !== roomKey) return null; // wrong roomKey

    // Reconnection: if a player with the same name already exists, return them.
    // This allows refreshing the page and rejoining a running game.
    const existing = room.players.find(p => p.name === playerName && !p.isAI);
    if (existing) {
      return existing;
    }

    // Check if game already started
    if (room.gameState && room.gameState.phase === 'playing') return null;

    // Max players as per room settings, count non-AI
    const humanCount = room.players.filter(p => !p.isAI).length;
    if (humanCount >= room.maxPlayers) return null;

    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const seatIndex = room.players.length; // next available seat

    const player: Player = {
      id: playerId,
      name: playerName,
      seatIndex,
      isAI: false,
      hand: [],
      melds: [],
      discards: [],
      isDealer: seatIndex === 0,
      windPosition: WIND_POSITIONS[seatIndex],
      score: 0,
    };

    room.players.push(player);
    return player;
  }

  /**
   * Remove a player from a room
   */
  removePlayer(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx < 0) return false;

    room.players.splice(idx, 1);

    // If host left, reassign host to first remaining human
    if (playerId === room.hostId) {
      const humanPlayers = room.players.filter(p => !p.isAI);
      if (humanPlayers.length > 0) {
        room.hostId = humanPlayers[0].id;
      } else {
        // No players left, remove room
        this.rooms.delete(roomId);
        return true;
      }
    }

    // Reassign seat indices. If the stored next dealer left, fall back to East/seat 0.
    room.players.forEach((p, i) => {
      p.seatIndex = i;
      p.windPosition = WIND_POSITIONS[i];
    });
    if (!room.players.some(p => p.seatIndex === room.nextDealerSeatIndex)) {
      room.nextDealerSeatIndex = 0;
    }
    room.players.forEach(p => {
      p.isDealer = p.seatIndex === room.nextDealerSeatIndex;
    });

    // If no human players left, remove room
    if (room.players.filter(p => !p.isAI).length === 0) {
      this.rooms.delete(roomId);
      return true;
    }

    return true;
  }

  /**
   * Start the game in a room (host only)
   */
  startGame(roomId: string, hostId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.hostId !== hostId) return null; // only host can start

    // Mahjong is always a 4-player game; fill missing seats with AI.
    const targetPlayerCount = 4;
    const aiNames = ['AI-小张', 'AI-小李', 'AI-小王', 'AI-小陈'];
    let aiIndex = 0;
    while (room.players.length < targetPlayerCount) {
      const seatIndex = room.players.length;
      room.players.push({
        id: `ai_${roomId}_${seatIndex}`,
        name: aiNames[aiIndex++],
        seatIndex,
        isAI: true,
        hand: [],
        melds: [],
        discards: [],
        isDealer: seatIndex === 0,
        windPosition: WIND_POSITIONS[seatIndex],
        score: 0,
      });
    }

    const dealerSeatIndex = room.players.some(p => p.seatIndex === room.nextDealerSeatIndex)
      ? room.nextDealerSeatIndex
      : 0;
    room.nextDealerSeatIndex = dealerSeatIndex;
    room.players.forEach(player => {
      player.isDealer = player.seatIndex === dealerSeatIndex;
      player.windPosition = WIND_POSITIONS[player.seatIndex];
    });
    const dealerPlayerIndex = room.players.findIndex(player => player.seatIndex === dealerSeatIndex);

    // Create wall and deal. The dealer receives the 14th tile and discards first.
    const { wall, deadWall } = createWall();
    const safeDealerPlayerIndex = dealerPlayerIndex >= 0 ? dealerPlayerIndex : 0;
    const hands = deal(wall, safeDealerPlayerIndex);

    // Assign hands to players
    room.players.forEach((player, i) => {
      player.hand = hands[i].sort((a, b) => {
        const so: Record<string, number> = { wan: 0, tiao: 1, tong: 2, wind: 3, dragon: 4 };
        return so[a.suit] - so[b.suit] || a.value - b.value;
      });
      player.melds = [];
      player.discards = [];
    });

    // Keep the public setting aligned with the actual game size.
    room.settings.maxPlayers = targetPlayerCount;
    room.maxPlayers = targetPlayerCount;

    const gameState: GameState = {
      roomId,
      phase: 'playing',
      wall,
      deadWall,
      players: room.players,
      currentPlayerIndex: safeDealerPlayerIndex, // dealer starts
      turnCount: 0,
      settings: room.settings,
      pendingDiscard: null,
      pendingClaims: [],
      lastDraw: null,
      lastDiscard: null,
      lastDiscardBy: undefined,
      lastDiscardPlayerName: undefined,
      winnerIndex: null,
    };

    room.gameState = gameState;
    return gameState;
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get all rooms (for listing)
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}
