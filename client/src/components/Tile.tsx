import React from 'react';
import { Tile as TileType, tileDisplayChar, getTileColor } from '../game/types';
import tiao1 from '../assets/tiles/tiao-1.svg';
import tiao2 from '../assets/tiles/tiao-2.svg';
import tiao3 from '../assets/tiles/tiao-3.svg';
import tiao4 from '../assets/tiles/tiao-4.svg';
import tiao5 from '../assets/tiles/tiao-5.svg';
import tiao6 from '../assets/tiles/tiao-6.svg';
import tiao7 from '../assets/tiles/tiao-7.svg';
import tiao8 from '../assets/tiles/tiao-8.svg';
import tiao9 from '../assets/tiles/tiao-9.svg';
import tong1 from '../assets/tiles/tong-1.svg';
import tong2 from '../assets/tiles/tong-2.svg';
import tong3 from '../assets/tiles/tong-3.svg';
import tong4 from '../assets/tiles/tong-4.svg';
import tong5 from '../assets/tiles/tong-5.svg';
import tong6 from '../assets/tiles/tong-6.svg';
import tong7 from '../assets/tiles/tong-7.svg';
import tong8 from '../assets/tiles/tong-8.svg';
import tong9 from '../assets/tiles/tong-9.svg';
import whiteDragon from '../assets/tiles/jian-3.svg';
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

const TIAO_SVG: Record<number, string> = {
  1: tiao1,
  2: tiao2,
  3: tiao3,
  4: tiao4,
  5: tiao5,
  6: tiao6,
  7: tiao7,
  8: tiao8,
  9: tiao9,
};

const TONG_SVG: Record<number, string> = {
  1: tong1,
  2: tong2,
  3: tong3,
  4: tong4,
  5: tong5,
  6: tong6,
  7: tong7,
  8: tong8,
  9: tong9,
};

function renderTileImage(src: string, alt: string) {
  return <img className="tile-model-image" src={src} alt={alt} draggable={false} />;
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

  const art = safeSuit === 'tong' && TONG_SVG[tile.value]
    ? renderTileImage(TONG_SVG[tile.value], tileDisplayChar(tile))
    : safeSuit === 'tiao' && TIAO_SVG[tile.value]
      ? renderTileImage(TIAO_SVG[tile.value], tileDisplayChar(tile))
      : safeSuit === 'jian' && tile.value === 3
        ? renderTileImage(whiteDragon, tileDisplayChar(tile))
        : safeSuit === 'tong'
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
      <div className="tile-content">{art}</div>
      {selected && <div className="tile-selected-indicator" />}
    </div>
  );
};

export default React.memo(Tile);
