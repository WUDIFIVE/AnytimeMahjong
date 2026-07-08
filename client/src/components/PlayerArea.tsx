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
                <span className="meld-type-label">
                  {meld.type === 'chi' ? '吃' :
                   meld.type === 'peng' ? '碰' :
                   meld.type === 'ming-gang' ? '明杠' :
                   meld.type === 'an-gang' ? '暗杠' :
                   meld.type === 'jia-gang' ? '加杠' : ''}
                </span>
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
                onClick={handleDiscard}
              />
            ))}
          </div>
        ) : (
          <div className="hand-row face-down-row">
            {hand.map((_, i) => (
              <Tile
                key={`fd-${i}`}
                tile={{ suit: 'wan', value: 1, id: `fd-${i}` }}
                faceDown
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PlayerArea);
