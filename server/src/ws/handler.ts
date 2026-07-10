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
  const aiClaimTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const aiTurnTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  const CLAIM_PRIORITY: Record<Claim['type'], number> = {
    win: 4,
    minggang: 3,
    pong: 2,
    chi: 1,
    angang: 0,
    jiagang: 0,
  };

  function broadcast(roomId: string, message: any): void {
    const data = JSON.stringify(message);
    for (const [ws, info] of clients) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  function broadcastExcept(roomId: string, excludedWs: WebSocket, message: any): void {
    const data = JSON.stringify(message);
    for (const [ws, info] of clients) {
      if (ws !== excludedWs && info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
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


  function getPlayerIndexById(gameState: GameState, playerId: string): number {
    return gameState.players.findIndex(p => p.id === playerId);
  }

  function getNextTurnIndex(gameState: GameState, currentIndex = gameState.currentPlayerIndex): number {
    const players = gameState.players;
    if (players.length === 0) return 0;
    const current = players[currentIndex] ?? players[0];
    const seatOrder = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const currentSeatPos = seatOrder.findIndex(p => p.id === current.id);
    const nextPlayer = seatOrder[(currentSeatPos + 1 + seatOrder.length) % seatOrder.length];
    const nextIndex = getPlayerIndexById(gameState, nextPlayer.id);
    return nextIndex >= 0 ? nextIndex : 0;
  }

  function isCurrentPlayer(gameState: GameState, playerId: string): boolean {
    return gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  }


  function buildDrawResult(gameState: GameState): any {
    const ranking = [...gameState.players]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        playerName: player.name,
        score: player.score ?? 0,
        isWinner: false,
      }));

    return {
      winType: 'draw',
      winningHand: [],
      concealedHand: [],
      winningTile: null,
      melds: [],
      fans: [],
      totalFan: 0,
      payouts: [],
      ranking,
    };
  }

  function buildClientWinResult(
    gameState: GameState,
    winner: Player,
    result: { fans: { type: string; value: number }[]; totalValue: number },
    isZimo: boolean,
    winningTile: Tile | null
  ): any {
    const concealedHand = winner.hand.map(serializeTile);
    const serializedWinningTile = winningTile ? serializeTile(winningTile) : null;
    const winningHand = [...concealedHand];
    if (serializedWinningTile) winningHand.push(serializedWinningTile);

    const loser = !isZimo ? gameState.players[gameState.currentPlayerIndex] : undefined;
    const payers = isZimo
      ? gameState.players.filter(p => p.id !== winner.id)
      : loser && loser.id !== winner.id
        ? [loser]
        : [];
    const amount = Math.max(1, result.totalValue) * 100;
    const payouts = payers.map(p => ({ fromId: p.id, toId: winner.id, amount }));

    for (const payout of payouts) {
      const from = gameState.players.find(p => p.id === payout.fromId);
      const to = gameState.players.find(p => p.id === payout.toId);
      if (from) from.score = (from.score ?? 0) - payout.amount;
      if (to) to.score = (to.score ?? 0) + payout.amount;
    }

    const ranking = [...gameState.players]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        playerName: player.name,
        score: player.score ?? 0,
        isWinner: player.id === winner.id,
      }));

    return {
      winnerId: winner.id,
      loserId: loser?.id,
      winType: isZimo ? 'zimo' : 'dianpao',
      concealedHand,
      winningTile: serializedWinningTile,
      winningHand,
      melds: winner.melds.map(serializeMeld),
      fans: result.fans.map(fan => ({
        type: String(fan.type),
        name: String(fan.type),
        fanValue: fan.value,
        description: `${fan.type} ${fan.value}番`,
        icon: fan.type === '自摸' ? '🀄' : fan.type === '清一色' ? '🎨' : fan.type === '碰碰胡' ? '💥' : '✨',
      })),
      totalFan: result.totalValue,
      payouts,
      ranking,
    };
  }

  function clearAIClaimTimeout(roomId: string): void {
    const timeout = aiClaimTimeouts.get(roomId);
    if (!timeout) return;
    clearTimeout(timeout);
    aiClaimTimeouts.delete(roomId);
  }

  function clearAITurnTimeout(roomId: string): void {
    const timeout = aiTurnTimeouts.get(roomId);
    if (!timeout) return;
    clearTimeout(timeout);
    aiTurnTimeouts.delete(roomId);
  }

  function computeClaims(gameState: GameState, discardTile: Tile): void {
    gameState.pendingDiscard = discardTile;
    gameState.pendingClaims = [];
    const currentIdx = gameState.currentPlayerIndex;

    const playerCount = gameState.players.length;
    for (let i = 0; i < playerCount; i++) {
      if (i === currentIdx) continue;
      const player = gameState.players[i];
      if (!player) continue;

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
        const nextIdx = (currentIdx + 1) % playerCount;
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

  function expectedHandSize(player: Player, gameState: GameState): number {
    // In 13-tile mahjong, concealed hand size after discarding is:
    // 13 - 3 * meldCount. The player whose turn it is, with no pending
    // claims, must have one extra tile before discarding. A kong is still
    // one meld because it is compensated by a replacement draw.
    const base = 13 - player.melds.length * 3;
    const shouldDiscard =
      gameState.phase === 'playing' &&
      gameState.pendingClaims.length === 0 &&
      gameState.players[gameState.currentPlayerIndex]?.id === player.id;
    return base + (shouldDiscard ? 1 : 0);
  }

  function logHandSizeAnomalies(gameState: GameState, context: string): void {
    for (const player of gameState.players) {
      const expected = expectedHandSize(player, gameState);
      if (player.hand.length !== expected) {
        console.warn(
          `[mahjong-state] ${context}: ${player.name} hand=${player.hand.length}, expected=${expected}, melds=${player.melds.length}, current=${gameState.currentPlayerIndex}, pending=${gameState.pendingClaims.length}`
        );
      }
    }
  }

  function drawForCurrentPlayer(gameState: GameState, roomId: string): boolean {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player) return false;

    const tile = drawTile(gameState.wall);
    if (!tile) {
      gameState.phase = 'finished';
      const drawResult = buildDrawResult(gameState);
      broadcast(roomId, {
        type: 'game_over',
        reason: 'draw',
        winResult: drawResult,
        gameState: { ...serializeGameState(gameState), winResult: drawResult },
      });
      return false;
    }

    player.hand.push(tile);
    player.hand.sort(tileSort);
    gameState.lastDraw = tile;
    logHandSizeAnomalies(gameState, `draw:${player.name}`);
    return true;
  }

  function advanceTurnAndDraw(gameState: GameState, roomId: string): boolean {
    gameState.pendingDiscard = null;
    gameState.pendingClaims = [];
    gameState.currentPlayerIndex = getNextTurnIndex(gameState);
    gameState.turnCount++;
    gameState.lastDraw = null;
    return drawForCurrentPlayer(gameState, roomId);
  }

  function enterDiscardTurnAfterClaim(gameState: GameState, roomId: string, playerIndex: number): void {
    gameState.currentPlayerIndex = playerIndex;
    gameState.turnCount++;
    gameState.lastDraw = null;
    clearAIClaimTimeout(roomId);
    clearAITurnTimeout(roomId);
    logHandSizeAnomalies(gameState, `claim:${gameState.players[playerIndex]?.name ?? playerIndex}`);
  }

  function enterDiscardTurnAfterKong(gameState: GameState, roomId: string, playerIndex: number): void {
    gameState.currentPlayerIndex = playerIndex;
    gameState.turnCount++;
    clearAIClaimTimeout(roomId);
    clearAITurnTimeout(roomId);
    logHandSizeAnomalies(gameState, `kong:${gameState.players[playerIndex]?.name ?? playerIndex}`);
  }

  function aiDiscardWithoutDrawing(gameState: GameState, roomId: string, delayMs = 700): void {
    handleAIDiscard(gameState, roomId, delayMs);
  }

  function aiAcceptsClaim(gameState: GameState, claim: Claim): boolean {
    const player = gameState.players[claim.playerIndex];
    const discard = gameState.pendingDiscard;
    if (!player || !player.isAI || !discard) return false;

    if (claim.type === 'win') return true;
    if (claim.type === 'minggang') return shouldKong(player.hand, discard);
    if (claim.type === 'pong') return shouldPong(player.hand, discard, gameState);
    if (claim.type === 'chi') return shouldChi(player.hand, discard);
    return false;
  }

  function handleAIDiscard(gameState: GameState, roomId: string, delayMs = 700): void {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player || !player.isAI || gameState.pendingClaims.length > 0) return;

    clearAITurnTimeout(roomId);
    const scheduledPlayerId = player.id;
    const scheduledTurnCount = gameState.turnCount;
    aiTurnTimeouts.set(roomId, setTimeout(() => {
      aiTurnTimeouts.delete(roomId);
      if (gameState.phase !== 'playing') return;
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (gameState.turnCount !== scheduledTurnCount || currentPlayer?.id !== scheduledPlayerId) return;
      if (!currentPlayer || !currentPlayer.isAI || currentPlayer.hand.length === 0 || gameState.pendingClaims.length > 0) return;

      const discardIdx = evaluateDiscard(currentPlayer.hand, currentPlayer.melds, gameState, gameState.currentPlayerIndex);
      const discardTile = currentPlayer.hand[discardIdx];
      currentPlayer.hand.splice(discardIdx, 1);
      currentPlayer.discards.push(discardTile);
      gameState.lastDiscard = discardTile;
      gameState.lastDiscardBy = currentPlayer.id;
      gameState.lastDiscardPlayerName = currentPlayer.name;

      const discardPlayerIndex = gameState.currentPlayerIndex;
      computeClaims(gameState, discardTile);
      if (gameState.pendingClaims.length === 0) {
        if (!advanceTurnAndDraw(gameState, roomId)) return;
        clearAIClaimTimeout(roomId);
        broadcast(roomId, {
          type: 'discard',
          playerIndex: discardPlayerIndex,
          playerName: currentPlayer.name,
          tile: serializeTile(discardTile),
          gameState: serializeGameState(gameState),
        });
        broadcast(roomId, {
          type: 'turn_change',
          gameState: serializeGameState(gameState),
        });
        checkAndHandleAI(gameState, roomId);
        return;
      }

      logHandSizeAnomalies(gameState, `discard:${currentPlayer.name}`);
      broadcast(roomId, {
        type: 'discard',
        playerIndex: discardPlayerIndex,
        playerName: currentPlayer.name,
        tile: serializeTile(discardTile),
        gameState: serializeGameState(gameState),
      });
      if (resolveAIClaims(gameState, roomId)) return;

      if (gameState.pendingClaims.length > 0) {
        broadcast(roomId, {
          type: 'pending_claims',
          claims: gameState.pendingClaims,
          gameState: serializeGameState(gameState),
        });
        scheduleAIClaimTimeout(roomId, gameState);
      } else {
        if (!advanceTurnAndDraw(gameState, roomId)) return;
        clearAIClaimTimeout(roomId);
        broadcast(roomId, {
          type: 'turn_change',
          gameState: serializeGameState(gameState),
        });
        checkAndHandleAI(gameState, roomId);
      }
    }, delayMs));
  }

  function executeClaim(gameState: GameState, roomId: string, claim: Claim, source: 'ai' | 'human'): boolean {
    const player = gameState.players[claim.playerIndex];
    const discard = gameState.pendingDiscard;
    if (!player || !discard) return false;

    if (claim.type === 'win') {
      const result = checkWin(player.hand, player.melds, discard, false, gameState.settings);
      if (!result) return false;
      clearAIClaimTimeout(roomId);
      clearAITurnTimeout(roomId);
      gameState.winnerIndex = player.seatIndex;
      gameState.phase = 'finished';
      gameState.pendingClaims = [];
      gameState.pendingDiscard = null;
      const clientWinResult = buildClientWinResult(gameState, player, result, false, discard);
      broadcast(roomId, {
        type: 'game_over',
        winnerIndex: player.seatIndex,
        winnerName: player.name,
        isZimo: false,
        winResult: clientWinResult,
        gameState: { ...serializeGameState(gameState), winResult: clientWinResult },
      });
      return true;
    }

    if (claim.type === 'minggang') {
      executeMingGang(player, discard, gameState);
      enterDiscardTurnAfterKong(gameState, roomId, claim.playerIndex);
      broadcast(roomId, {
        type: 'minggang_executed',
        playerIndex: claim.playerIndex,
        playerName: player.name,
        gameState: serializeGameState(gameState),
      });
      if (source === 'ai') aiDiscardWithoutDrawing(gameState, roomId);
      else checkAndHandleAI(gameState, roomId);
      return true;
    }

    if (claim.type === 'pong') {
      executePong(player, discard, gameState);
      enterDiscardTurnAfterClaim(gameState, roomId, claim.playerIndex);
      broadcast(roomId, {
        type: 'pong_executed',
        playerIndex: claim.playerIndex,
        playerName: player.name,
        gameState: serializeGameState(gameState),
      });
      if (source === 'ai') aiDiscardWithoutDrawing(gameState, roomId);
      else checkAndHandleAI(gameState, roomId);
      return true;
    }

    if (claim.type === 'chi' && claim.chiOptions && claim.chiOptions.length > 0) {
      const tiles = claim.chiOptions[0];
      executeChi(player, discard, [tiles[0], tiles[1]], gameState);
      enterDiscardTurnAfterClaim(gameState, roomId, claim.playerIndex);
      broadcast(roomId, {
        type: 'chi_executed',
        playerIndex: claim.playerIndex,
        playerName: player.name,
        gameState: serializeGameState(gameState),
      });
      if (source === 'ai') aiDiscardWithoutDrawing(gameState, roomId);
      else checkAndHandleAI(gameState, roomId);
      return true;
    }

    return false;
  }

  function resolveAIClaims(gameState: GameState, roomId: string): boolean {
    if (gameState.phase !== 'playing' || gameState.pendingClaims.length === 0 || !gameState.pendingDiscard) return false;

    while (gameState.pendingClaims.length > 0) {
      const humanClaims = gameState.pendingClaims.filter(c => !gameState.players[c.playerIndex]?.isAI);
      const maxHumanPriority = humanClaims.reduce((max, c) => Math.max(max, CLAIM_PRIORITY[c.type] ?? 0), 0);
      const executableAIClaims = gameState.pendingClaims
        .filter(c => gameState.players[c.playerIndex]?.isAI)
        .filter(c => humanClaims.length === 0 || (CLAIM_PRIORITY[c.type] ?? 0) > maxHumanPriority)
        .sort((a, b) => (CLAIM_PRIORITY[b.type] ?? 0) - (CLAIM_PRIORITY[a.type] ?? 0));

      if (executableAIClaims.length === 0) break;

      const accepted = executableAIClaims.find(c => aiAcceptsClaim(gameState, c));
      if (accepted) {
        executeClaim(gameState, roomId, accepted, 'ai');
        return true;
      }

      const executableSet = new Set(executableAIClaims);
      gameState.pendingClaims = gameState.pendingClaims.filter(c => !executableSet.has(c));
    }

    if (gameState.pendingClaims.length === 0) {
      if (!advanceTurnAndDraw(gameState, roomId)) return true;
      clearAIClaimTimeout(roomId);
      broadcast(roomId, {
        type: 'turn_change',
        gameState: serializeGameState(gameState),
      });
      checkAndHandleAI(gameState, roomId);
      return true;
    }

    return false;
  }

  function scheduleAIClaimTimeout(roomId: string, gameState: GameState): void {
    clearAIClaimTimeout(roomId);
    const hasAIClaim = gameState.pendingClaims.some(c => gameState.players[c.playerIndex]?.isAI);
    if (!hasAIClaim) return;

    aiClaimTimeouts.set(roomId, setTimeout(() => {
      const current = getGameState(roomId);
      if (!current || current !== gameState || current.pendingClaims.length === 0) return;

      const before = current.pendingClaims.length;
      current.pendingClaims = current.pendingClaims.filter(c => !current.players[c.playerIndex]?.isAI);
      if (current.pendingClaims.length !== before) {
        broadcast(roomId, {
          type: 'pending_claims',
          claims: current.pendingClaims,
          gameState: serializeGameState(current),
        });
      }

      if (current.pendingClaims.length === 0) {
        if (!advanceTurnAndDraw(current, roomId)) return;
        broadcast(roomId, {
          type: 'turn_change',
          gameState: serializeGameState(current),
        });
        checkAndHandleAI(current, roomId);
      }
    }, 20_000));
  }

  function handleAITurn(gameState: GameState, roomId: string): void {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player || !player.isAI) return;

    clearAITurnTimeout(roomId);
    const scheduledPlayerId = player.id;
    const scheduledTurnCount = gameState.turnCount;
    aiTurnTimeouts.set(roomId, setTimeout(() => {
      aiTurnTimeouts.delete(roomId);
      if (gameState.phase !== 'playing' || gameState.pendingClaims.length > 0) return;
      const player = gameState.players[gameState.currentPlayerIndex];
      if (gameState.turnCount !== scheduledTurnCount || player?.id !== scheduledPlayerId) return;
      if (!player || !player.isAI) return;

      const discardHandSize = 14 - player.melds.length * 3;
      if (player.hand.length < discardHandSize) {
        if (!drawForCurrentPlayer(gameState, roomId)) return;
      }

      logHandSizeAnomalies(gameState, `ai-turn:${player.name}`);

      if (aiShouldWin(player.hand, player.melds, null, gameState.settings)) {
        const result = checkWin(player.hand, player.melds, null, true, gameState.settings);
        if (!result) return;
        clearAITurnTimeout(roomId);
        gameState.winnerIndex = gameState.currentPlayerIndex;
        gameState.phase = 'finished';
        const clientWinResult = buildClientWinResult(gameState, player, result, true, null);
        broadcast(roomId, {
          type: 'game_over',
          winnerIndex: gameState.currentPlayerIndex,
          winnerName: player.name,
          isZimo: true,
          winResult: clientWinResult,
          gameState: { ...serializeGameState(gameState), winResult: clientWinResult },
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
          type: 'angang_executed',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          replacementTile: gameState.lastDraw ? serializeTile(gameState.lastDraw) : null,
          gameState: serializeGameState(gameState),
        });
        handleAITurn(gameState, roomId);
        return;
      }

      const drawnTile = gameState.lastDraw;
      if (drawnTile && shouldJiaGang(player, drawnTile)) {
        executeJiaGang(player, drawnTile, gameState);
        broadcast(roomId, {
          type: 'jiagang_executed',
          playerIndex: gameState.currentPlayerIndex,
          playerName: player.name,
          replacementTile: gameState.lastDraw ? serializeTile(gameState.lastDraw) : null,
          gameState: serializeGameState(gameState),
        });
        handleAITurn(gameState, roomId);
        return;
      }

      const discardIdx = evaluateDiscard(player.hand, player.melds, gameState, gameState.currentPlayerIndex);
      const discardTile = player.hand[discardIdx];
      player.hand.splice(discardIdx, 1);
      player.discards.push(discardTile);
      gameState.lastDiscard = discardTile;
      gameState.lastDiscardBy = player.id;
      gameState.lastDiscardPlayerName = player.name;

      broadcast(roomId, {
        type: 'discard',
        playerIndex: gameState.currentPlayerIndex,
        playerName: player.name,
        tile: serializeTile(discardTile),
        gameState: serializeGameState(gameState),
      });

      computeClaims(gameState, discardTile);
      if (resolveAIClaims(gameState, roomId)) return;

      if (gameState.pendingClaims.length > 0) {
        broadcast(roomId, {
          type: 'pending_claims',
          claims: gameState.pendingClaims,
          gameState: serializeGameState(gameState),
        });
        scheduleAIClaimTimeout(roomId, gameState);
      } else {
        if (!advanceTurnAndDraw(gameState, roomId)) return;
        clearAIClaimTimeout(roomId);
        broadcast(roomId, {
          type: 'turn_change',
          gameState: serializeGameState(gameState),
        });
        checkAndHandleAI(gameState, roomId);
      }
    }, 1000));
  }

  function checkAndHandleAI(gameState: GameState, roomId: string): void {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player) return;
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
          selfPlayerId: player.id,
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
          selfPlayerId: player.id,
          players: r.players.map(serializePlayer),
          settings: r.settings,
          hostId: r.hostId,
        }));
        broadcastExcept(roomId, ws, {
          type: 'player_join',
          roomId: r.id,
          joinedPlayerId: player.id,
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
            sp.isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === p.id;
            if (p.id !== player.id) {
              sp.hand = Array.from({ length: p.hand.length }, (_unused, idx) => ({ id: `hidden-${p.id}-${idx}`, suit: 'wan', value: 1 }));
              sp.handSize = p.hand.length;
            }
            return sp;
          });
          sendToPlayer(player.id, info.roomId, {
            type: 'game_start',
            selfPlayerId: player.id,
            playerId: player.id,
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
        const requiredDiscardHandSize = 14 - player.melds.length * 3;
        if (player.hand.length !== requiredDiscardHandSize) {
          console.warn(`[mahjong-state] reject discard: ${player.name} hand=${player.hand.length}, expected=${requiredDiscardHandSize}`);
          ws.send(JSON.stringify({ type: 'error', message: `Invalid hand size for discard: ${player.hand.length}/${requiredDiscardHandSize}` }));
          return;
        }
        const idx = player.hand.findIndex(t => String(t.id) === String(tileId));
        if (idx < 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'Tile not in hand' }));
          return;
        }

        const discardTile = player.hand.splice(idx, 1)[0];
        player.discards.push(discardTile);
        gameState.lastDiscard = discardTile;
        gameState.lastDiscardBy = player.id;
        gameState.lastDiscardPlayerName = player.name;

        const discardPlayerIndex = gameState.currentPlayerIndex;
        computeClaims(gameState, discardTile);
        if (gameState.pendingClaims.length === 0) {
          if (!advanceTurnAndDraw(gameState, info.roomId)) return;
          clearAIClaimTimeout(info.roomId);
          broadcast(info.roomId, {
            type: 'discard',
            playerIndex: discardPlayerIndex,
            playerName: player.name,
            tile: serializeTile(discardTile),
            gameState: serializeGameState(gameState),
          });
          broadcast(info.roomId, {
            type: 'turn_change',
            gameState: serializeGameState(gameState),
          });
          checkAndHandleAI(gameState, info.roomId);
          return;
        }

        logHandSizeAnomalies(gameState, `discard:${player.name}`);
        broadcast(info.roomId, {
          type: 'discard',
          playerIndex: discardPlayerIndex,
          playerName: player.name,
          tile: serializeTile(discardTile),
          gameState: serializeGameState(gameState),
        });
        if (resolveAIClaims(gameState, info.roomId)) return;

        if (gameState.pendingClaims.length > 0) {
          broadcast(info.roomId, {
            type: 'pending_claims',
            claims: gameState.pendingClaims,
            gameState: serializeGameState(gameState),
          });
          scheduleAIClaimTimeout(info.roomId, gameState);
        } else {
          if (!advanceTurnAndDraw(gameState, info.roomId)) return;
          clearAIClaimTimeout(info.roomId);
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
        enterDiscardTurnAfterClaim(gameState, info.roomId, claim.playerIndex);

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
        enterDiscardTurnAfterClaim(gameState, info.roomId, claim.playerIndex);

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
        enterDiscardTurnAfterKong(gameState, info.roomId, claim.playerIndex);

        broadcast(info.roomId, {
          type: 'minggang_executed',
          playerIndex: claim.playerIndex,
          playerName: player.name,
          replacementTile: gameState.lastDraw ? serializeTile(gameState.lastDraw) : null,
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
          replacementTile: gameState.lastDraw ? serializeTile(gameState.lastDraw) : null,
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
          replacementTile: gameState.lastDraw ? serializeTile(gameState.lastDraw) : null,
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
          if (!advanceTurnAndDraw(gameState, info.roomId)) return;
          clearAIClaimTimeout(info.roomId);
          broadcast(info.roomId, {
            type: 'turn_change',
            gameState: serializeGameState(gameState),
          });
          checkAndHandleAI(gameState, info.roomId);
        } else {
          if (resolveAIClaims(gameState, info.roomId)) return;
          broadcast(info.roomId, {
            type: 'pending_claims',
            claims: gameState.pendingClaims,
            gameState: serializeGameState(gameState),
          });
          scheduleAIClaimTimeout(info.roomId, gameState);
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
          isCurrentPlayer(gameState, player.id) &&
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
        clearAIClaimTimeout(info.roomId);
        clearAITurnTimeout(info.roomId);

        const clientWinResult = buildClientWinResult(gameState, player, result, isZimo, newTile);
        broadcast(info.roomId, {
          type: 'game_over',
          winnerIndex: player.seatIndex,
          winnerName: player.name,
          isZimo,
          winResult: clientWinResult,
          gameState: { ...serializeGameState(gameState), winResult: clientWinResult },
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
