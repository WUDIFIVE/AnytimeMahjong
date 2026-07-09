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


const TILE_TYPES: TileType[] = [
  ...(['wan', 'tiao', 'tong'] as const).flatMap(suit => Array.from({ length: 9 }, (_, i) => ({ suit, value: i + 1, id: `hint-${suit}-${i + 1}` }))),
  ...Array.from({ length: 4 }, (_, i) => ({ suit: 'feng' as const, value: i + 1, id: `hint-feng-${i + 1}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ suit: 'jian' as const, value: i + 1, id: `hint-jian-${i + 1}` })),
];

function tileKey(tile: TileType): string {
  return `${tile.suit}-${tile.value}`;
}

function canDecomposeBasic(tiles: TileType[], meldCount: number): boolean {
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tileKey(tile), (counts.get(tileKey(tile)) || 0) + 1);
  const keys = [...counts.keys()].sort();
  const needSets = 4 - meldCount;

  function removeSet(map: Map<string, number>, key: string, n: number): boolean {
    const current = map.get(key) || 0;
    if (current < n) return false;
    current === n ? map.delete(key) : map.set(key, current - n);
    return true;
  }

  function search(map: Map<string, number>, setsLeft: number, pairUsed: boolean): boolean {
    if (setsLeft === 0) {
      if (pairUsed) return [...map.values()].every(v => v === 0);
      return [...map.values()].filter(v => v > 0).length === 1 && [...map.values()][0] === 2;
    }
    const first = [...map.entries()].find(([, v]) => v > 0)?.[0];
    if (!first) return false;
    const [suit, rawValue] = first.split('-');
    const value = Number(rawValue);

    if (!pairUsed && (map.get(first) || 0) >= 2) {
      const next = new Map(map);
      removeSet(next, first, 2);
      if (search(next, setsLeft, true)) return true;
    }

    if ((map.get(first) || 0) >= 3) {
      const next = new Map(map);
      removeSet(next, first, 3);
      if (search(next, setsLeft - 1, pairUsed)) return true;
    }

    if ((suit === 'wan' || suit === 'tiao' || suit === 'tong') && value <= 7) {
      const k2 = `${suit}-${value + 1}`;
      const k3 = `${suit}-${value + 2}`;
      if ((map.get(k2) || 0) > 0 && (map.get(k3) || 0) > 0) {
        const next = new Map(map);
        removeSet(next, first, 1);
        removeSet(next, k2, 1);
        removeSet(next, k3, 1);
        if (search(next, setsLeft - 1, pairUsed)) return true;
      }
    }

    return false;
  }

  return search(counts, needSets, false);
}

function isSevenPairs(tiles: TileType[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tileKey(tile), (counts.get(tileKey(tile)) || 0) + 1);
  return counts.size === 7 && [...counts.values()].every(v => v === 2);
}

function estimateFan(tiles: TileType[], meldCount: number): { fan: number; label: string } {
  const suits = new Set(tiles.map(t => t.suit));
  const numberSuits = ['wan', 'tiao', 'tong'].filter(s => suits.has(s as any));
  const hasHonor = suits.has('feng') || suits.has('jian');
  if (numberSuits.length === 1 && !hasHonor) return { fan: 6, label: '清一色' };
  if (numberSuits.length === 1 && hasHonor) return { fan: 3, label: '混一色' };
  if (meldCount === 0 && isSevenPairs(tiles)) return { fan: 4, label: '七小对' };
  return { fan: 1, label: '基本胡' };
}

function computeTenpaiHints(player?: { hand?: TileType[]; melds?: { tiles: TileType[] }[] }): { tile: TileType; fan: number; label: string }[] {
  if (!player?.hand) return [];
  const hand = player.hand;
  const meldCount = player.melds?.length ?? 0;
  const concealedNeedBeforeWin = 13 - meldCount * 3;
  if (hand.length !== concealedNeedBeforeWin) return [];

  const hints: { tile: TileType; fan: number; label: string }[] = [];
  for (const candidate of TILE_TYPES) {
    const trial = [...hand, candidate];
    if (canDecomposeBasic(trial, meldCount) || (meldCount === 0 && isSevenPairs(trial))) {
      const fan = estimateFan(trial, meldCount);
      hints.push({ tile: candidate, ...fan });
    }
  }
  return hints;
}


function claimTypeLabel(type: ClaimType): string {
  switch (type) {
    case 'pong': return '碰';
    case 'chi': return '吃';
    case 'ming-gang': return '明杠';
    case 'an-gang': return '暗杠';
    case 'jia-gang': return '加杠';
    case 'hu': return '胡';
    default: return type;
  }
}

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
  const selfIndexInList = orderedPlayers.findIndex(p => p.id === playerId);
  if (selfIndexInList > 0) {
    for (let i = 0; i < selfIndexInList; i++) {
      orderedPlayers.push(orderedPlayers.shift()!);
    }
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


  const myPendingClaim = gameState.pendingClaims.find(c => c.playerId === playerId);
  const respondingTile = anyPending ? gameState.lastDiscard : null;
  const lastDiscardPlayerName = gameState.lastDiscardPlayerName
    || gameState.players.find(p => p.id === gameState.lastDiscardBy)?.name
    || '上一家';
  const tenpaiHints = computeTenpaiHints(currentPlayer).slice(0, 8);

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
            <div className="table-dashboard">
              <div className="dashboard-main-row">
                <div className="wall-indicator compact">
                  <div className="wall-icon">🀄</div>
                  <div className="wall-count">{gameState.wallCount}</div>
                  <div className="wall-label">剩余</div>
                </div>

                <div className="turn-indicator">
                  <div className="turn-dot" />
                  {(() => {
                    const turnPlayer = gameState.players[gameState.currentPlayerIndex];
                    return turnPlayer ? (
                      <span className="turn-name">轮到 {turnPlayer.name}</span>
                    ) : null;
                  })()}
                </div>

                {gameState.lastDiscard && (
                  <div className="last-discard-callout">
                    <span className="last-discard-label">刚出</span>
                    <strong>{lastDiscardPlayerName}</strong>
                    <Tile tile={gameState.lastDiscard} small highlighted />
                    <span>{formatTile(gameState.lastDiscard)}</span>
                  </div>
                )}
              </div>

              {(respondingTile || tenpaiHints.length > 0) && (
                <div className="dashboard-sub-row">
                  {respondingTile && (
                    <div className="claim-target-hint">
                      <span>响应</span>
                      <Tile tile={respondingTile} small highlighted />
                      <strong>{formatTile(respondingTile)}</strong>
                      <span>{pendingActionTypes.map(claimTypeLabel).join(' / ')}</span>
                    </div>
                  )}

                  {tenpaiHints.length > 0 && (
                    <div className="tenpai-hint" title="当前手牌已听牌">
                      <span className="tenpai-title">听牌</span>
                      <div className="tenpai-list">
                        {tenpaiHints.map(hint => (
                          <span className="tenpai-item" key={tileKey(hint.tile)}>
                            {formatTile(hint.tile)} · {hint.label}{hint.fan}番
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="central-discards" aria-label="中央弃牌区">
              {orderedPlayers.map((player, idx) => (
                <div key={player.id} className={`central-discard-row discard-row-${POSITIONS[idx]}`}>
                  <div className="central-discard-name">{player.name}</div>
                  <div className="central-discard-tiles">
                    {(player.discards ?? []).slice(-18).map((tile, tileIdx, shown) => (
                      <span className="discard-tile-wrap" key={tile.id} title={`${player.name} 打出 ${formatTile(tile)}`}>
                        <Tile
                          tile={tile}
                          small
                          highlighted={gameState.lastDiscard?.id === tile.id && gameState.lastDiscardBy === player.id}
                        />
                        {tileIdx === shown.length - 1 && <em className="discard-order-dot" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
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
