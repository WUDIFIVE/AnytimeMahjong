import { useState, useEffect, useCallback, useRef } from 'react';
import { WSMessage, GameState, GameSettings, PlayerState, WinResult, Tile as TileType } from './game/types';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Settlement from './components/Settlement';
import RuleGuide from './components/RuleGuide';
import './App.css';

type AppView = 'lobby' | 'game' | 'settlement';

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
          // Only set playerId once (from the server response to OUR action)
          if (type === 'room_state' && payload.playerId) {
            setPlayerId(payload.playerId);
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
          setGameState(payload.gameState);
          setView('game');
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
    setView('lobby');
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
          onBackToLobby={handleBackToLobby}
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
