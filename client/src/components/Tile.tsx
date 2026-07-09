import React from 'react';
import { Tile as TileType, tileDisplayChar, getTileColor } from '../game/types';
import './Tile.css';

interface TileProps {
  tile: TileType;
  small?: boolean;
  faceDown?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: (tile: TileType) => void;
}

const NUMBER_CHARS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function formatClassicCorner(tile: TileType): string {
  if (!tile) return '';
  if (tile.suit === 'wan') return `${NUMBER_CHARS[tile.value] || tile.value}萬`;
  if (tile.suit === 'tiao') return `${tile.value}索`;
  if (tile.suit === 'tong') return `${tile.value}筒`;
  return tileDisplayChar(tile);
}

function renderDots(value: number) {
  return (
    <div className={`tile-art dots dots-${value}`}>
      {Array.from({ length: Math.max(1, Math.min(9, value)) }).map((_, i) => (
        <span key={i} className={`dot dot-${i} ${i % 3 === 0 ? 'dot-red' : i % 3 === 1 ? 'dot-blue' : 'dot-green'}`}>
          <i />
        </span>
      ))}
    </div>
  );
}

function renderBamboo(value: number) {
  if (value === 1) {
    return (
      <div className="tile-art bamboo bamboo-1">
        <span className="bird-body" />
        <span className="bird-wing wing-left" />
        <span className="bird-wing wing-right" />
        <span className="bird-head" />
        <span className="bird-tail" />
      </div>
    );
  }

  return (
    <div className={`tile-art bamboo bamboo-${value}`}>
      {Array.from({ length: Math.max(1, Math.min(9, value)) }).map((_, i) => (
        <span key={i} className={`bamboo-stick stick-${i}`}>
          <i />
        </span>
      ))}
    </div>
  );
}

function renderWan(value: number) {
  return (
    <div className="tile-art wan-art classic-wan">
      <span className="wan-number">{NUMBER_CHARS[value] || value}</span>
      <span className="wan-cloud">萬</span>
    </div>
  );
}

function renderHonor(tile: TileType) {
  const char = tileDisplayChar(tile);
  const isDragon = tile.suit === 'jian';
  return (
    <div className={`tile-art honor-art ${isDragon ? 'dragon-art' : 'wind-art'}`}>
      <span className="honor-halo" />
      <span className="honor-char">{char}</span>
      <span className="honor-label">{isDragon ? '箭' : '风'}</span>
    </div>
  );
}

const Tile: React.FC<TileProps> = ({
  tile,
  small = false,
  faceDown = false,
  selected = false,
  highlighted = false,
  onClick,
}) => {
  const safeSuit = tile?.suit ?? 'wan';
  const color = getTileColor(safeSuit);

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

  const classNames = [
    'mahjong-tile',
    `tile-${safeSuit}`,
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
        <div className="tile-back-pattern">
          <span className="back-flower">✿</span>
        </div>
      </div>
    );
  }

  const art = safeSuit === 'tong'
    ? renderDots(tile.value)
    : safeSuit === 'tiao'
      ? renderBamboo(tile.value)
      : safeSuit === 'wan'
        ? renderWan(tile.value)
        : renderHonor(tile);

  return (
    <div
      className={classNames}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ ['--tile-accent' as string]: color }}
      aria-label={tileDisplayChar(tile)}
    >
      <div className="tile-face-plate" />
      <div className="tile-corner corner-top">{formatClassicCorner(tile)}</div>
      <div className="tile-content">{art}</div>
      <div className="tile-corner corner-bottom">{formatClassicCorner(tile)}</div>
      {selected && <div className="tile-selected-indicator" />}
    </div>
  );
};

export default React.memo(Tile);
