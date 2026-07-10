import React from 'react';
import { PlayerState, Tile as TileType, sortTiles } from '../game/types';
import Tile from './Tile';
import './PlayerArea.css';

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentUser: boolean;
  position: 'bottom' | 'right' | 'top' | 'left';
  onDiscard?: (tile: TileType) => void;
  onTileClick?: (tile: TileType) => void;
  selectedTileId?: string | null;
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
}) => {
  const hand = player.hand ?? [];
  const sortedHand = sortTiles(hand);

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
            {player.melds.map((meld, i) => (
              <div key={`meld-${i}`} className="meld-group">
                {meld.tiles.map((t, j) => (
                  <Tile
                    key={`meld-${i}-${j}`}
                    tile={t}
                    small
                    highlighted={meld.type.includes('gang')}
                  />
                ))}
                <span className="meld-type-label">{getMeldLabel(meld.type)}</span>
              </div>
            ))}
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
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(PlayerArea);
