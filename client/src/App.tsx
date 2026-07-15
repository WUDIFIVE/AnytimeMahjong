import { useState, useEffect, useCallback, useRef } from 'react';
import { WSMessage, GameState, GameSettings, PlayerState, WinResult, Tile as TileType } from './game/types';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Settlement from './components/Settlement';
import RuleGuide from './components/RuleGuide';
import './App.css';

type AppView = 'lobby' | 'game' | 'settlement';

const STORAGE_KEY_ROOM = 'mahjong_last_room';

function saveRoomToStorage(roomId: string, playerName: string, roomPwd: string) {
  try {
    localStorage.setItem(STORAGE_KEY_ROOM, JSON.stringify({ roomId, playerName, roomPwd, ts: Date.now() }));
  } catch { /* ignore */ }
}

function getRoomFromStorage(): { roomId: string; playerName: string; roomPwd: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROOM);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.roomId && data.playerName && (Date.now() - data.ts) < 24 * 3600_000) {
      return { roomId: data.roomId, playerName: data.playerName, roomPwd: data.roomPwd || '' };
    }
  } catch { /* ignore */ }
  return null;
}

function getRoomIdFromURL(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.trim() || null;
  } catch { /* ignore */ }
  return null;
}

function App() {
  const { send, connected, lastMessage } = useWebSocket();

  const [view, setView] = useState<AppView>('lobby');
  const [playerId, setPlayerId] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomState, setRoomState] = useState<{
    roomId: string;
    players: PlayerState[];
    settings: GameSettings;
    hostId?: string;
  } | null>(null);
  const [showRuleGuide, setShowRuleGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendRef = useRef(send);
  sendRef.current = send;
  const hasAutoJoinedRef = useRef(false);
  const playerNameRef = useRef('');

  // A room-only invitation must never reuse this browser's previous identity.
  // Normal refreshes without an invitation URL still reconnect from localStorage.
  useEffect(() => {
    if (!connected || hasAutoJoinedRef.current) return;
    if (getRoomIdFromURL()) {
      hasAutoJoinedRef.current = true;
      return;
    }
    const stored = getRoomFromStorage();
    if (stored) {
      hasAutoJoinedRef.current = true;
      playerNameRef.current = stored.playerName;
      sendRef.current({ type: 'join_room' as any, payload: { roomId: stored.roomId, nickname: stored.playerName, password: stored.roomPwd } });
    }
  }, [connected]);

  // Handle incoming WS messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, payload: rawPayload } = lastMessage;
    // Server may send flat fields or {type, payload} wrapper
    const payload = rawPayload || lastMessage;

    switch (type) {
      case 'room_state':
      case 'player_join':
      case 'player_left':
      case 'player_leave':
        if (payload.roomId && payload.players) {
          setRoomState({
            roomId: payload.roomId,
            players: payload.players,
            settings: payload.settings,
            hostId: payload.hostId,
          });
          // Only direct room_state carries this client's identity.
          if (type === 'room_state' && (payload.selfPlayerId || payload.playerId)) {
            setPlayerId(payload.selfPlayerId || payload.playerId);
            const p = payload.players.find((p: any) => p.id === (payload.selfPlayerId || payload.playerId));
            const name = p?.name || playerNameRef.current;
            if (name) {
              saveRoomToStorage(payload.roomId, name, '');
              if (getRoomIdFromURL()) {
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
              }
            }
          }
        }
        break;

      case 'game_start':
      case 'game_state':
      case 'turn_change':
      case 'discard':
      case 'pending_claims':
      case 'pong_executed':
      case 'chi_executed':
      case 'minggang_executed':
      case 'angang_executed':
      case 'jiagang_executed':
        if (payload.gameState) {
          if (payload.selfPlayerId || payload.playerId) {
            setPlayerId(payload.selfPlayerId || payload.playerId);
          }
          setGameState(payload.gameState);
          setView('game');
          // Keep room info in storage for reconnection
          if (payload.gameState.roomId && playerNameRef.current) {
            saveRoomToStorage(payload.gameState.roomId, playerNameRef.current, '');
          }
        } else if (payload.roomId && payload.players) {
          setGameState(payload as GameState);
          setView('game');
        }
        break;

      case 'game_over':
      case 'game_end':
      case 'settlement':
        if (payload.gameState) {
          setGameState({ ...payload.gameState, winResult: payload.winResult ?? payload.gameState.winResult ?? null });
        }
        if (payload.winResult || payload.gameState?.winnerIndex !== undefined) {
          setView('settlement');
        }
        break;

      case 'player_disconnected':
        // A player's browser disconnected but can reconnect; no state change needed
        break;

      case 'error':
        setError(payload?.message || '发生错误');
        setTimeout(() => setError(null), 4000);
        break;

      default:
        break;
    }
  }, [lastMessage]);

  // Send helper
  const handleSend = useCallback((type: string, payload: any) => {
    if ((type === 'join_room' || type === 'create_room') && payload.nickname) {
      playerNameRef.current = payload.nickname;
    }
    sendRef.current({ type: type as any, payload });
  }, []);

  // Game actions
  const handleDiscard = useCallback((tile: TileType) => {
    handleSend('discard', { tileId: tile.id, tile });
  }, [handleSend]);

  const handlePong = useCallback(() => {
    handleSend('claim', { type: 'pong' });
  }, [handleSend]);

  const handleChi = useCallback((_tiles: TileType[]) => {
    handleSend('claim', { type: 'chi' });
  }, [handleSend]);

  const handleMingGang = useCallback(() => {
    handleSend('claim', { type: 'ming-gang' });
  }, [handleSend]);

  const handleAnGang = useCallback((_tiles: TileType[]) => {
    handleSend('claim', { type: 'an-gang' });
  }, [handleSend]);

  const handleJiaGang = useCallback((tile: TileType) => {
    handleSend('claim', { type: 'jia-gang', tileId: tile.id });
  }, [handleSend]);

  const handleWin = useCallback(() => {
    handleSend('claim', { type: 'hu' });
  }, [handleSend]);

  const handlePass = useCallback(() => {
    handleSend('claim', { type: 'pass' });
  }, [handleSend]);

  const handleNewGame = useCallback(() => {
    handleSend('start_game', {});
    setView('game');
  }, [handleSend]);

  const handleBackToLobby = useCallback(() => {
    setView('lobby');
    setGameState(null);
  }, []);

  return (
    <div className="app">
      {/* Connection Status */}
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '🟢' : '🔴'}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="error-toast">
          <span>{error}</span>
        </div>
      )}

      {/* Rule Guide FAB */}
      {(view === 'lobby' || view === 'game') && (
        <button
          className="rule-fab"
          onClick={() => setShowRuleGuide(true)}
          title="规则指南"
        >
          ?
        </button>
      )}

      {/* Views */}
      {view === 'lobby' && (
        <Lobby
          onSend={handleSend}
          roomState={roomState}
          playerId={playerId}
        />
      )}

      {view === 'game' && gameState && (
        <GameBoard
          gameState={gameState}
          playerId={playerId}
          onDiscard={handleDiscard}
          onPong={handlePong}
          onChi={handleChi}
          onMingGang={handleMingGang}
          onAnGang={handleAnGang}
          onJiaGang={handleJiaGang}
          onWin={handleWin}
          onPass={handlePass}
        />
      )}

      {view === 'game' && !gameState && (
        <div className="loading-screen">加载游戏中...</div>
      )}

      {view === 'settlement' && gameState?.winResult && (
        <Settlement
          winResult={gameState.winResult}
          players={gameState.players}
          playerId={playerId}
          onNewGame={handleNewGame}
        />
      )}

      {/* Rule Guide Modal */}
      <RuleGuide
        isOpen={showRuleGuide}
        onClose={() => setShowRuleGuide(false)}
      />
    </div>
  );
}

export default App;
