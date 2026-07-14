import React, { useEffect, useRef, useState } from 'react';
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

function getMeldTypeClass(type: string): string {
  return `meld-type-${type.replace(/-/g, '')}`;
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

  const handTileCount = sortedHand.length + (drawnTile ? 1 : 0);
  const handRowRef = useRef<HTMLDivElement | null>(null);
  const [handMetrics, setHandMetrics] = useState({ tileWidth: 52, gap: 4 });

  useEffect(() => {
    if (!isCurrentUser || handTileCount <= 0) return;

    const updateHandMetrics = () => {
      const row = handRowRef.current;
      const availableWidth = row?.clientWidth ? Math.max(0, row.clientWidth - 8) : window.innerWidth - 28;
      const desiredTileWidth = Math.min(52, Math.max(38, availableWidth / 15));
      const minTileWidth = availableWidth < 430 ? 24 : availableWidth < 720 ? 28 : 32;
      const desiredGap = Math.min(5, Math.max(1, availableWidth / 260));
      const minGap = availableWidth < 520 ? 0 : 1;
      const drawnTileBreathingRoom = drawnTile ? Math.min(10, availableWidth * 0.012) : 0;
      const desiredTotal = handTileCount * desiredTileWidth + Math.max(0, handTileCount - 1) * desiredGap + drawnTileBreathingRoom;

      let nextGap = desiredGap;
      let nextTileWidth = desiredTileWidth;
      if (desiredTotal > availableWidth) {
        const noGapTotal = handTileCount * desiredTileWidth + Math.max(0, handTileCount - 1) * minGap + drawnTileBreathingRoom;
        nextGap = noGapTotal <= availableWidth
          ? Math.max(minGap, (availableWidth - drawnTileBreathingRoom - handTileCount * desiredTileWidth) / Math.max(1, handTileCount - 1))
          : minGap;
        nextTileWidth = Math.max(minTileWidth, Math.floor((availableWidth - drawnTileBreathingRoom - Math.max(0, handTileCount - 1) * nextGap) / handTileCount));
      }

      setHandMetrics(prev => {
        const rounded = { tileWidth: Math.round(nextTileWidth * 10) / 10, gap: Math.round(nextGap * 10) / 10 };
        return prev.tileWidth === rounded.tileWidth && prev.gap === rounded.gap ? prev : rounded;
      });
    };

    updateHandMetrics();
    const row = handRowRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && row ? new ResizeObserver(updateHandMetrics) : null;
    observer?.observe(row!);
    window.addEventListener('resize', updateHandMetrics);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHandMetrics);
    };
  }, [drawnTile, handTileCount, isCurrentUser]);

  const areaStyle = {
    ['--hand-tile-count' as string]: handTileCount,
    ['--hand-tile-width' as string]: `${handMetrics.tileWidth}px`,
    ['--hand-gap-dynamic' as string]: `${handMetrics.gap}px`,
    ['--meld-count' as string]: player.melds.length,
  } as React.CSSProperties;

  const renderMeldTiles = (meld: PlayerState['melds'][number], meldIndex: number, showFaceDown: boolean, isAnGang: boolean) => {
    const tiles = meld.tiles ?? [];
    const displayTiles = meld.type === 'jia-gang' && tiles.length >= 4
      ? [tiles[0], tiles[1], tiles[2], tiles[3]]
      : tiles;

    return displayTiles.map((t, j) => {
      const isHidden = String(t.id).startsWith('hidden-ang');
      const isJiaGangTopTile = meld.type === 'jia-gang' && j === 3;
      return (
        <span
          className={`meld-tile-slot ${isJiaGangTopTile ? 'jia-gang-top-tile' : ''}`}
          key={`meld-${meldIndex}-${j}`}
        >
          <Tile
            tile={t}
            small
            faceDown={showFaceDown || isHidden}
            highlighted={meld.type.includes('gang') && !isAnGang}
          />
        </span>
      );
    });
  };

  return (
    <div className={areaClassName} style={areaStyle} data-hand-count={handTileCount} data-meld-count={player.melds.length}>
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
          <div className="melds-row" aria-label={`${player.name} 副露区`}>
            {player.melds.map((meld, i) => {
              const isAnGang = meld.type === 'an-gang';
              const showFaceDown = isAnGang && !isCurrentUser;
              return (
                <div
                  key={`meld-${i}`}
                  className={`meld-group meld-${meld.type}`}
                  data-meld-type={meld.type}
                  data-tile-count={meld.tiles.length}
                >
                  <div className="meld-tiles">
                    {renderMeldTiles(meld, i, showFaceDown, isAnGang)}
                  </div>
                  <span className={`meld-type-label ${getMeldTypeClass(meld.type)} ${isAnGang ? 'angang-label' : ''}`}>
                    {showFaceDown ? '暗杠' : getMeldLabel(meld.type)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Hand or Face-down Tiles */}
        {isCurrentUser ? (
          <div className="hand-row" ref={handRowRef}>
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
