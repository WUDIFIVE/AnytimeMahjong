import React from 'react';
import { Tile as TileType, tileDisplayChar, getTileColor, getTileSuitSymbol } from '../game/types';
import './Tile.css';

interface TileProps {
  tile: TileType;
  small?: boolean;
  faceDown?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: (tile: TileType) => void;
}

const Tile: React.FC<TileProps> = ({
  tile,
  small = false,
  faceDown = false,
  selected = false,
  highlighted = false,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick && !faceDown) {
      onClick(tile);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick && !faceDown) {
      e.preventDefault();
      onClick(tile);
    }
  };

  const color = getTileColor(tile.suit);
  const displayChar = tileDisplayChar(tile);
  const suitSymbol = tile.suit === 'feng' || tile.suit === 'jian' ? '' : getTileSuitSymbol(tile.suit);

  const classNames = [
    'mahjong-tile',
    `tile-${tile.suit}`,
    small ? 'tile-small' : '',
    faceDown ? 'tile-face-down' : '',
    selected ? 'tile-selected' : '',
    highlighted ? 'tile-highlighted' : '',
    onClick ? 'tile-clickable' : '',
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return (
      <div
        className={classNames}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="tile-back-pattern" />
      </div>
    );
  }

  return (
    <div
      className={classNames}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ borderLeftColor: color }}
    >
      <div className="tile-content">
        <span className="tile-char" style={{ color }}>{displayChar}</span>
        {suitSymbol && (
          <span className="tile-suit" style={{ color }}>{suitSymbol}</span>
        )}
      </div>
      {selected && <div className="tile-selected-indicator" />}
    </div>
  );
};

export default React.memo(Tile);
