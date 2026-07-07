// WebSocket Handler
// Handles all game communication via WebSocket messages

import * as WebSocket from 'ws';
import { RoomManager } from '../room/manager';
import {
  Player,
  GameState,
  GameSettings,
  Claim,
  Tile,
  Meld,
  Suit,
  tileEquals,
  tileSort,
  canPong,
  canChi,
  canMingGang,
  canAnGang,
  canJiaGang,
  executePong,
  executeChi,
  executeMingGang,
  executeAnGang,
  executeJiaGang,
  drawTile,
  drawReplacementTile,
  checkWin,
  serializeGameState,
  serializeTile,
  serializePlayer,
  serializeMeld,
  GamePhase,
} from '../game/engine';
import {
  evaluateDiscard,
  shouldPong,
  shouldChi,
  shouldKong,
  shouldAnGang,
  shouldJiaGang,
  shouldWin as aiShouldWin,
} from '../game/ai';

interface ClientInfo {
  ws: WebSocket;
  playerId: string;
  roomId: string;
}

export function setupWebSocketHandler(
  wss: WebSocket.Server,
  roomManager: RoomManager
): void {
  const clients = new Map<WebSocket, ClientInfo>();

  function broadcast(roomId: string, message: any): void {
    const data = JSON.stringify(message);
    for (const [ws, info] of clients) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  function sendToPlayer(playerId: string, roomId: string, message: any): void {
    const data = JSON.stringify(message);
    for (const [ws, info] of clients) {
      if (info.roomId === roomId && info.playerId === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        return;
      }
    }
  }

  function getGameState(roomId: string): GameState | null {
    const room = roomManager.getRoom(roomId);
    return room?.gameState ?? null;
  }

  function computeClaims(gameState: GameState, discardTile: Tile): void {
    gameState.pendingDiscard = discardTile;
    gameState.pendingClaims = [];
    const currentIdx = gameState.currentPlayerIndex;

    for (let i = 0; i < 4; i++) {
      if (i === currentIdx) continue;
      const player = gameState.players[i];

      if (checkWin(player.hand, player.melds, discardTile, false, gameState.settings)) {
        gameState.pendingClaims.push({ playerIndex: i, type: 'win' });
        continue;
      }
      if (canMingGang(player.hand, discardTile)) {
        gameState.pendingClaims.push({ playerIndex: i, type: 'minggang' });
      }
      if (canPong(player.hand, discardTile)) {
        gameState.pendingClaims.push({ playerIndex: i, type: 'pong' });
      }
      if (gameState.settings.allowChi) {
        const nextIdx = (currentIdx + 1) % 4;
        if (i === nextIdx) {
          const chiOptions = canChi(player.hand, discardTile);
          if (chiOptions.length > 0) {
            gameState.pendingClaims.push({ playerIndex: i, type: 'chi', chiOptions });
          }
        }
      }
    }

    if (gameState.pendingClaims.length === 0) {
      gameState.pendingDiscard = null;
    }
  }

  function advanceTurn(gameState: GameState): void {
    gameState.pendingDiscard = null;
    gameState.pendingClaims = [];
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % 4;
    gameState.turnCount++;
    gameState.lastDraw = null;
  }

  function handleAITurn(gameState: GameState, roomId: string): void {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player.isAI) return;

    setTimeout(() => {
      const tile = drawTile(gameState.wall);
      if (!tile) {
        broadcast(roomId, {
          type: 'game_over',
          reason: 'draw',
          gameState: serializeGameState(gameState),
        });
        gameState.phase = 'finished';
        return;
      }

      player.hand.push(tile);
      player.hand.sort(tileSort);
      gameState.lastDraw = tile;
      gameState.turnCount++;

      if (aiShouldWin(player.hand, player.melds, null, gameState.settings)) {
        const result = checkWin(player.hand, player.melds, null, true, gameState.settings);
        gameState.winnerIndex = gameState.currentPlayerIndex;
        gameState.phase = 'finished';
        broadcast(roomId, {
          type: 'game_over',
          winnerIndex: gameState.currentPlayerIndex,
          winnerName: player.name,
          isZimo: true,
          winResult: result,
          gameState: serializeGameState(gameState),
        });
        return;
      }

      const anGangOptions = shouldAnGang(player.hand);
      if (anGangOptions.length > 0) {
        const tileIds = player.hand
          .filter(t => tileEquals(t, anGangOptions[0]))
          .map(t => t.id);
        executeAnGang(player, tileIds.map((id: number | string) => Number(id)), gameState);
        broadcast(roomId, {
          type: 'angang',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });
        handleAITurn(gameState, roomId);
        return;
      }

      const drawnTile = gameState.lastDraw;
      if (drawnTile && shouldJiaGang(player, drawnTile)) {
        executeJiaGang(player, drawnTile, gameState);
        broadcast(roomId, {
          type: 'jiagang',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });
        handleAITurn(gameState, roomId);
        return;
      }

      const discardIdx = evaluateDiscard(player.hand, player.melds, gameState, gameState.currentPlayerIndex);
      const discardTile = player.hand[discardIdx];
      player.hand.splice(discardIdx, 1);
      player.discards.push(discardTile);

      broadcast(roomId, {
        type: 'discard',
        playerIndex: gameState.currentPlayerIndex,
        playerName: player.name,
        tile: serializeTile(discardTile),
        gameState: serializeGameState(gameState),
      });

      computeClaims(gameState, discardTile);

      if (gameState.pendingClaims.length > 0) {
        broadcast(roomId, {
          type: 'pending_claims',
          claims: gameState.pendingClaims,
          gameState: serializeGameState(gameState),
        });
      } else {
        advanceTurn(gameState);
        broadcast(roomId, {
          type: 'turn_change',
          gameState: serializeGameState(gameState),
        });
        handleAITurn(gameState, roomId);
      }
    }, 1000);
  }

  function checkAndHandleAI(gameState: GameState, roomId: string): void {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.isAI) {
      handleAITurn(gameState, roomId);
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: WebSocket.Data) => {
      let message: any;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      let { type, payload = {} } = message;
      if (type === 'claim') {
        const claimType = payload.type;
        type = claimType === 'ming-gang' ? 'minggang'
          : claimType === 'an-gang' ? 'angang'
          : claimType === 'jia-gang' ? 'jiagang'
          : claimType === 'hu' ? 'win'
          : claimType;
      }

      if (type === 'create_room') {
        const playerName = payload.nickname || payload.playerName;
        const roomPwd = payload.password || payload.roomPwd || '';
        const allowChi = (payload.settings && payload.settings.allowChi) ?? payload.allowChi ?? true;
        const allowDianpao = (payload.settings && payload.settings.allowDianpao) ?? payload.allowDianpao ?? true;
        const maxPlayers = (payload.settings && payload.settings.maxPlayers) ?? payload.maxPlayers ?? 4;
        const key = roomPwd;
        
        
        if (!playerName) {
          ws.send(JSON.stringify({ type: 'error', message: 'playerName required' }));
          return;
        }
        const room = roomManager.createRoom(playerName, key, allowChi, allowDianpao, maxPlayers);
        const player = room.players[0];
        clients.set(ws, { ws, playerId: player.id, roomId: room.id });
        ws.send(JSON.stringify({
          type: 'room_state',
          roomId: room.id,
          playerId: player.id,
          players: room.players.map(serializePlayer),
          settings: room.settings,
          hostId: room.hostId,
        }));
        return;
      }

      if (type === 'join_room') {
        const roomId = payload.roomId;
        const playerName = payload.nickname || payload.playerName;
        const roomPwd = payload.password || payload.roomPwd || '';
        const key = roomPwd || '';
        if (!roomId || !playerName) {
          ws.send(JSON.stringify({ type: 'error', message: 'roomId and playerName required' }));
          return;
        }
        const player = roomManager.joinRoom(roomId, playerName, key);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to join room' }));
          return;
        }
        clients.set(ws, { ws, playerId: player.id, roomId });
        const r = roomManager.getRoom(roomId)!;
        ws.send(JSON.stringify({
          type: 'room_state',
          roomId: r.id,
          playerId: player.id,
          players: r.players.map(serializePlayer),
          settings: r.settings,
          hostId: r.hostId,
        }));
        broadcast(roomId, {
          type: 'player_join',
          roomId: r.id,
          playerId: player.id,
          playerName: player.name,
          players: r.players.map(serializePlayer),
          settings: r.settings,
          hostId: r.hostId,
        });
        return;
      }

      if (type === 'toggle_setting') {
        const info = clients.get(ws);
        if (!info) return;
        const r = roomManager.getRoom(info.roomId);
        if (!r) return;
        if (r.hostId !== info.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Only host can change settings' }));
          return;
        }
        const { setting, value } = payload;
        if (setting === 'allowChi') r.settings.allowChi = value;
        if (setting === 'allowDianpao') r.settings.allowDianpao = value;
        broadcast(info.roomId, {
          type: 'settings_updated',
          settings: r.settings,
        });
        return;
      }

      if (type === 'start_game') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = roomManager.startGame(info.roomId, info.playerId);
        if (!gameState) {
          ws.send(JSON.stringify({ type: 'error', message: 'Cannot start game' }));
          return;
        }

        for (const player of gameState.players) {
          const playerView = serializeGameState(gameState);
          playerView.players = gameState.players.map((p) => {
            const sp = serializePlayer(p);
            sp.isCurrentTurn = p.seatIndex === gameState.currentPlayerIndex;
            if (p.id !== player.id) {
              sp.hand = Array.from({ length: p.hand.length }, (_unused, idx) => ({ id: `hidden-${p.id}-${idx}`, suit: 'wan', value: 1 }));
              sp.handSize = p.hand.length;
            }
            return sp;
          });
          sendToPlayer(player.id, info.roomId, {
            type: 'game_start',
            gameState: playerView,
          });
        }

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'discard') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || gameState.phase !== 'playing') return;
        if (gameState.players[gameState.currentPlayerIndex].id !== info.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }
        if (gameState.pendingClaims.length > 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'Claims pending' }));
          return;
        }

        const { tileId } = payload;
        const player = gameState.players[gameState.currentPlayerIndex];
        const idx = player.hand.findIndex(t => String(t.id) === String(tileId));
        if (idx < 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'Tile not in hand' }));
          return;
        }

        const discardTile = player.hand.splice(idx, 1)[0];
        player.discards.push(discardTile);

        broadcast(info.roomId, {
          type: 'discard',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          tile: serializeTile(discardTile),
          gameState: serializeGameState(gameState),
        });

        computeClaims(gameState, discardTile);

        if (gameState.pendingClaims.length > 0) {
          broadcast(info.roomId, {
            type: 'pending_claims',
            claims: gameState.pendingClaims,
            gameState: serializeGameState(gameState),
          });
        } else {
          advanceTurn(gameState);
          broadcast(info.roomId, {
            type: 'turn_change',
            gameState: serializeGameState(gameState),
          });
          checkAndHandleAI(gameState, info.roomId);
        }
        return;
      }

      if (type === 'pong') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || !gameState.pendingDiscard) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nothing to pong' }));
          return;
        }

        const claim = gameState.pendingClaims.find(
          c => c.type === 'pong' && gameState.players[c.playerIndex].id === info.playerId
        );
        if (!claim) {
          ws.send(JSON.stringify({ type: 'error', message: 'Cannot pong' }));
          return;
        }

        const player = gameState.players[claim.playerIndex];
        executePong(player, gameState.pendingDiscard!, gameState);
        gameState.currentPlayerIndex = claim.playerIndex;
        gameState.turnCount++;

        broadcast(info.roomId, {
          type: 'pong_executed',
          playerIndex: claim.playerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'chi') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || !gameState.pendingDiscard) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nothing to chi' }));
          return;
        }

        const claim = gameState.pendingClaims.find(
          c => c.type === 'chi' && gameState.players[c.playerIndex].id === info.playerId
        );
        if (!claim || !claim.chiOptions || claim.chiOptions.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'Cannot chi' }));
          return;
        }

        const { optionIndex = 0 } = payload;
        if (optionIndex >= claim.chiOptions.length) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid chi option' }));
          return;
        }

        const tiles = claim.chiOptions[optionIndex];
        const player = gameState.players[claim.playerIndex];
        executeChi(player, gameState.pendingDiscard!, [tiles[0], tiles[1]], gameState);
        gameState.currentPlayerIndex = claim.playerIndex;
        gameState.turnCount++;

        broadcast(info.roomId, {
          type: 'chi_executed',
          playerIndex: claim.playerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'minggang') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || !gameState.pendingDiscard) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nothing to gang' }));
          return;
        }

        const claim = gameState.pendingClaims.find(
          c => c.type === 'minggang' && gameState.players[c.playerIndex].id === info.playerId
        );
        if (!claim) {
          ws.send(JSON.stringify({ type: 'error', message: 'Cannot ming gang' }));
          return;
        }

        const player = gameState.players[claim.playerIndex];
        executeMingGang(player, gameState.pendingDiscard!, gameState);
        gameState.currentPlayerIndex = claim.playerIndex;
        gameState.turnCount++;

        broadcast(info.roomId, {
          type: 'minggang_executed',
          playerIndex: claim.playerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'angang') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || gameState.phase !== 'playing') return;
        if (gameState.players[gameState.currentPlayerIndex].id !== info.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }

        const player = gameState.players[gameState.currentPlayerIndex];
        let { tileIds } = payload;
        if (!tileIds) {
          const option = canAnGang(player.hand);
          if (option.length > 0) {
            tileIds = player.hand.filter(t => tileEquals(t, option[0])).map(t => t.id);
          }
        }
        if (!tileIds || !Array.isArray(tileIds) || tileIds.length !== 4) {
          ws.send(JSON.stringify({ type: 'error', message: 'Need 4 tile IDs' }));
          return;
        }

        const tiles: Tile[] = tileIds.map((id: number | string) => player.hand.find(t => String(t.id) === String(id))).filter(Boolean) as Tile[];
        if (tiles.length !== 4) {
          ws.send(JSON.stringify({ type: 'error', message: 'Tiles not found' }));
          return;
        }
        const first = tiles[0]; if (!first || !tiles.every((t: Tile) => t.suit === first.suit && t.value === first.value)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Tiles must be identical' }));
          return;
        }

        executeAnGang(player, tileIds.map((id: number | string) => Number(id)), gameState);
        broadcast(info.roomId, {
          type: 'angang_executed',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'jiagang') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || gameState.phase !== 'playing') return;
        if (gameState.players[gameState.currentPlayerIndex].id !== info.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }

        const player = gameState.players[gameState.currentPlayerIndex];
        const { tileId } = payload;
        const drawnTile = gameState.lastDraw;
        if (!drawnTile || String(drawnTile.id) !== String(tileId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Can only jia gang drawn tile' }));
          return;
        }
        if (!canJiaGang(player, drawnTile)) {
          ws.send(JSON.stringify({ type: 'error', message: 'No matching pong meld' }));
          return;
        }

        executeJiaGang(player, drawnTile, gameState);
        broadcast(info.roomId, {
          type: 'jiagang_executed',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          gameState: serializeGameState(gameState),
        });

        checkAndHandleAI(gameState, info.roomId);
        return;
      }

      if (type === 'pass') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState || gameState.pendingClaims.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'No claims to pass on' }));
          return;
        }

        gameState.pendingClaims = gameState.pendingClaims.filter(
          c => gameState.players[c.playerIndex].id !== info.playerId
        );

        if (gameState.pendingClaims.length === 0) {
          advanceTurn(gameState);
          broadcast(info.roomId, {
            type: 'turn_change',
            gameState: serializeGameState(gameState),
          });
          checkAndHandleAI(gameState, info.roomId);
        } else {
          broadcast(info.roomId, {
            type: 'pending_claims',
            claims: gameState.pendingClaims,
            gameState: serializeGameState(gameState),
          });
        }
        return;
      }

      if (type === 'win') {
        const info = clients.get(ws);
        if (!info) return;
        const gameState = getGameState(info.roomId);
        if (!gameState) return;

        const player = gameState.players.find(p => p.id === info.playerId);
        if (!player) return;

        const isZimo =
          gameState.currentPlayerIndex === player.seatIndex &&
          gameState.pendingClaims.length === 0 &&
          gameState.lastDraw !== null;

        const hasWinClaim = gameState.pendingClaims.some(
          c => c.type === 'win' && gameState.players[c.playerIndex].id === info.playerId
        );

        if (!isZimo && !hasWinClaim) {
          ws.send(JSON.stringify({ type: 'error', message: 'Cannot win now' }));
          return;
        }

        let newTile: Tile | null = null;
        if (!isZimo && gameState.pendingDiscard) {
          newTile = gameState.pendingDiscard;
        }

        const result = checkWin(player.hand, player.melds, newTile, isZimo, gameState.settings);
        if (!result) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not a winning hand' }));
          return;
        }

        gameState.winnerIndex = player.seatIndex;
        gameState.phase = 'finished';

        broadcast(info.roomId, {
          type: 'game_over',
          winnerIndex: player.seatIndex,
          winnerName: player.name,
          isZimo,
          winResult: result,
          gameState: serializeGameState(gameState),
        });
        return;
      }

      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type: ' + type }));
    });

    ws.on('close', () => {
      const info = clients.get(ws);
      if (info) {
        roomManager.removePlayer(info.roomId, info.playerId);
        broadcast(info.roomId, {
          type: 'player_left',
          playerId: info.playerId,
        });
        clients.delete(ws);
      }
    });

    ws.on('error', () => {
      const info = clients.get(ws);
      if (info) {
        clients.delete(ws);
      }
    });
  });
}
