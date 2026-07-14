import React from 'react';
import { GameState, PlayerState, Tile as TileType, sortTiles } from '../game/types';
import Tile from './Tile';
import './PlayerArea.css';

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentUser: boolean;
  position: 'bottom' | 'right' | 'top' | 'left';
  onDiscard?: (tile: TileType) => void;
  onTileClick?: (tile: TileType) => void;
  selectedTileId?: string | null;
  lastDraw?: GameState['lastDraw'];
}

const WIND_NAMES: Record<string, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

function getMeldLabel(type: string): string {
  return type === 'chi' ? '吃' :
    type === 'peng' ? '碰' :
    type === 'ming-gang' ? '明杠' :
    type === 'an-gang' ? '暗杠' :
    type === 'jia-gang' ? '加杠' : '';
}

const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  isCurrentUser,
  position,
  onDiscard,
  onTileClick,
  selectedTileId,
  lastDraw,
}) => {
  const hand = player.hand ?? [];
  const drawnTile = isCurrentUser && lastDraw
    ? hand.find(tile => String(tile.id) === String(lastDraw.id)) ?? null
    : null;
  const baseHand = drawnTile ? hand.filter(tile => String(tile.id) !== String(drawnTile.id)) : hand;
  const sortedHand = sortTiles(baseHand);

  const handleTileClick = (tile: TileType) => {
    if (onTileClick) {
      onTileClick(tile);
    }
  };

  const handleDiscard = (tile: TileType) => {
    if (onDiscard) {
      onDiscard(tile);
    }
  };

  const areaClassName = [
    'player-area',
    `position-${position}`,
    player.isCurrentTurn ? 'current-turn' : '',
    isCurrentUser ? 'current-user' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={areaClassName}>
      {/* Player Info */}
      <div className="player-info">
        <span className="player-name">
          {player.isDealer && <span className="dealer-star">★</span>}
          {player.name}
        </span>
        <span className="player-wind">{WIND_NAMES[player.wind] || player.wind}</span>
        {player.score !== undefined && (
          <span className="player-score">{player.score}分</span>
        )}
      </div>

      <div className="player-cards">
        {!isCurrentUser && (
          <div className="opponent-hand-summary" title={`${player.name} 剩余 ${hand.length} 张手牌`}>
            <span className="hand-count-number">{hand.length}</span>
            <span className="hand-count-label">张手牌</span>
            <span className="mini-tile-stack" aria-hidden="true">
              {Array.from({ length: Math.min(6, Math.max(1, hand.length)) }).map((_, i) => (
                <i key={i} />
              ))}
            </span>
          </div>
        )}

        {/* Melds Row */}
        {player.melds.length > 0 && (
          <div className="melds-row">
            {player.melds.map((meld, i) => {
              const isAnGang = meld.type === 'an-gang';
              const showFaceDown = isAnGang && !isCurrentUser;
              return (
                <div key={`meld-${i}`} className="meld-group">
                  {meld.tiles.map((t, j) => {
                    const isHidden = String(t.id).startsWith('hidden-ang');
                    return (
                      <Tile
                        key={`meld-${i}-${j}`}
                        tile={t}
                        small
                        faceDown={showFaceDown || isHidden}
                        highlighted={meld.type.includes('gang') && !isAnGang}
                      />
                    );
                  })}
                  <span className={`meld-type-label ${isAnGang ? 'angang-label' : ''}`}>
                    {showFaceDown ? '暗杠' : getMeldLabel(meld.type)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Hand or Face-down Tiles */}
        {isCurrentUser ? (
          <div className="hand-row">
            {sortedHand.map((tile) => (
              <Tile
                key={tile.id}
                tile={tile}
                selected={tile.id === selectedTileId}
                onClick={handleTileClick}
              />
            ))}
            {drawnTile && (
              <span className="drawn-tile-slot" title="刚摸到的牌，打出后再整理">
                <Tile
                  key={drawnTile.id}
                  tile={drawnTile}
                  selected={drawnTile.id === selectedTileId}
                  onClick={handleTileClick}
                />
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(PlayerArea);
