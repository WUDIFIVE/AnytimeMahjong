import React, { useState, useCallback } from 'react';
import { GameState, Tile as TileType, ClaimType, sortTiles, formatTile } from '../game/types';
import PlayerArea from './PlayerArea';
import Tile from './Tile';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  playerId: string;
  onDiscard: (tile: TileType) => void;
  onPong: () => void;
  onChi: (tiles: TileType[]) => void;
  onMingGang: () => void;
  onAnGang: (tiles: TileType[]) => void;
  onJiaGang: (tile: TileType) => void;
  onWin: () => void;
  onPass: () => void;
}

const POSITIONS: ('bottom' | 'right' | 'top' | 'left')[] = ['bottom', 'right', 'top', 'left'];

const WIND_NAMES: Record<string, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  playerId,
  onDiscard,
  onPong,
  onChi,
  onMingGang,
  onAnGang,
  onJiaGang,
  onWin,
  onPass,
}) => {
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const playerIndex = currentPlayer?.seatIndex ?? 0;

  // Reorder players so current user is at bottom
  const orderedPlayers = [...gameState.players];
  // Rotate so player is at position 0 (bottom)
  while (orderedPlayers[0]?.id !== playerId && orderedPlayers.length > 0) {
    orderedPlayers.push(orderedPlayers.shift()!);
  }

  const handleTileClick = useCallback((tile: TileType) => {
    setSelectedTileId(prev => prev === tile.id ? null : tile.id);
  }, []);

  const handleDiscard = useCallback((tile: TileType) => {
    onDiscard(tile);
    setSelectedTileId(null);
  }, [onDiscard]);

  const handleAction = useCallback((action: string) => {
    switch (action) {
      case 'discard': {
        const player = gameState.players.find(p => p.id === playerId);
        const selectedTile = player?.hand.find(t => t.id === selectedTileId);
        if (selectedTile) {
          onDiscard(selectedTile);
          setSelectedTileId(null);
        }
        break;
      }
      case 'pong': onPong(); break;
      case 'chi': onChi([]); break;
      case 'ming-gang': onMingGang(); break;
      case 'an-gang': onAnGang([]); break;
      case 'jia-gang': {
        const player = gameState.players.find(p => p.id === playerId);
        const selectedTile = player?.hand.find(t => t.id === selectedTileId);
        if (selectedTile) {
          onJiaGang(selectedTile);
          setSelectedTileId(null);
        }
        break;
      }
      case 'hu': onWin(); break;
      case 'pass': onPass(); break;
    }
  }, [gameState, playerId, selectedTileId, onDiscard, onPong, onChi, onMingGang, onAnGang, onJiaGang, onWin, onPass]);

  // Compute available actions based on pending claims
  const pendingActionTypes = gameState.pendingClaims
    .filter(c => c.playerId === playerId)
    .map(c => c.type);

  const hasPong = pendingActionTypes.includes('pong');
  const hasChi = pendingActionTypes.includes('chi');
  const hasMingGang = pendingActionTypes.includes('ming-gang');
  const hasHu = pendingActionTypes.includes('hu');
  const anyPending = pendingActionTypes.length > 0;

  const isMyTurn = gameState.currentPlayerIndex === currentPlayer?.seatIndex;
  const canDiscard = isMyTurn && !anyPending;

  // Check if can an-gang (4 same tiles in hand)
  const canAnGang = isMyTurn && !anyPending && (() => {
    if (!currentPlayer) return false;
    const sorted = sortTiles(currentPlayer.hand);
    const counts = new Map<string, number>();
    sorted.forEach(t => {
      const key = `${t.suit}-${t.value}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.values()).some(c => c >= 4);
  })();

  // Check if can jia-gang (hand tile matches existing peng meld)
  const canJiaGang = isMyTurn && !anyPending && (() => {
    if (!currentPlayer) return false;
    return currentPlayer.melds.some(m => m.type === 'peng');
  })();

  return (
    <div className="game-board">
      {/* Info Bar */}
      <div className="game-info-bar">
        <span className="info-room">房间: {gameState.roomId}</span>
        <span className="info-wind">场风: {WIND_NAMES[gameState.currentWind] || gameState.currentWind}</span>
        <span className="info-wall">剩余: {gameState.wallCount}张</span>
      </div>

      {/* Game Table */}
      <div className="game-table">
        {/* Top Player */}
        {orderedPlayers[2] && (
          <div className="player-slot slot-top">
            <PlayerArea
              player={orderedPlayers[2]}
              isCurrentUser={orderedPlayers[2].id === playerId}
              position="top"
              selectedTileId={selectedTileId}
            />
          </div>
        )}

        <div className="table-middle">
          {/* Left Player */}
          {orderedPlayers[3] && (
            <div className="player-slot slot-left">
              <PlayerArea
                player={orderedPlayers[3]}
                isCurrentUser={orderedPlayers[3].id === playerId}
                position="left"
                selectedTileId={selectedTileId}
              />
            </div>
          )}

          {/* Center Area */}
          <div className="table-center">
            {/* Last Discard */}
            {gameState.lastDiscard && (
              <div className="last-discard-display">
                <span className="discard-label">最新弃牌</span>
                <Tile tile={gameState.lastDiscard} />
                {(() => {
                  const discarder = gameState.players.find(p =>
                    p.discards.some(d => d.id === gameState.lastDiscard!.id)
                  );
                  return discarder ? (
                    <span className="discard-by">by {discarder.name}</span>
                  ) : null;
                })()}
              </div>
            )}

            {/* Wall Indicator */}
            <div className="wall-indicator">
              <div className="wall-icon">🀄</div>
              <div className="wall-count">{gameState.wallCount}</div>
              <div className="wall-label">剩余</div>
            </div>

            {/* Turn Indicator */}
            <div className="turn-indicator">
              <div className="turn-dot" />
              {(() => {
                const turnPlayer = gameState.players[gameState.currentPlayerIndex];
                return turnPlayer ? (
                  <span className="turn-name">{turnPlayer.name} 的回合</span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Right Player */}
          {orderedPlayers[1] && (
            <div className="player-slot slot-right">
              <PlayerArea
                player={orderedPlayers[1]}
                isCurrentUser={orderedPlayers[1].id === playerId}
                position="right"
                selectedTileId={selectedTileId}
              />
            </div>
          )}
        </div>

        {/* Bottom Player (Current User) */}
        {orderedPlayers[0] && (
          <div className="player-slot slot-bottom">
            <PlayerArea
              player={orderedPlayers[0]}
              isCurrentUser={orderedPlayers[0].id === playerId}
              position="bottom"
              onDiscard={handleDiscard}
              onTileClick={handleTileClick}
              selectedTileId={selectedTileId}
            />
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        {canDiscard && selectedTileId && (
          <button className="action-btn btn-discard" onClick={() => handleAction('discard')}>
            出牌
          </button>
        )}
        {hasPong && (
          <button className="action-btn btn-claim" onClick={() => handleAction('pong')}>
            碰
          </button>
        )}
        {hasChi && (
          <button className="action-btn btn-claim" onClick={() => handleAction('chi')}>
            吃
          </button>
        )}
        {hasMingGang && (
          <button className="action-btn btn-claim" onClick={() => handleAction('ming-gang')}>
            明杠
          </button>
        )}
        {canAnGang && (
          <button className="action-btn btn-gang" onClick={() => handleAction('an-gang')}>
            暗杠
          </button>
        )}
        {canJiaGang && selectedTileId && (
          <button className="action-btn btn-gang" onClick={() => handleAction('jia-gang')}>
            加杠
          </button>
        )}
        {hasHu && (
          <button className="action-btn btn-win" onClick={() => handleAction('hu')}>
            胡
          </button>
        )}
        {anyPending && (
          <button className="action-btn btn-pass" onClick={() => handleAction('pass')}>
            过
          </button>
        )}
      </div>

      {/* Settings info tooltip */}
      <div className="settings-hint">
        {!gameState.settings.allowChi && <span>无吃 | </span>}
        {!gameState.settings.allowDianpao && <span>无点炮 | </span>}
        <span>{gameState.settings.maxPlayers}人局</span>
      </div>
    </div>
  );
};

export default React.memo(GameBoard);
