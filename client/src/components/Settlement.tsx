import React, { useRef, useState } from 'react';
import { WinResult, PlayerState, sortTiles, formatTile } from '../game/types';
import Tile from './Tile';
import './Settlement.css';

interface SettlementProps {
  winResult: WinResult;
  players: PlayerState[];
  playerId: string;
  onNewGame: () => void;
}

const Settlement: React.FC<SettlementProps> = ({
  winResult,
  players,
  playerId,
  onNewGame,
}) => {
  const [shareStatus, setShareStatus] = useState('');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const safePlayers = players ?? [];
  const safeFans = winResult?.fans ?? [];
  const safePayouts = winResult?.payouts ?? [];
  const concealedHand = winResult?.concealedHand ?? winResult?.winningHand ?? [];
  const winningTile = winResult?.winningTile ?? null;
  const winningHand = winResult?.winningHand ?? [...concealedHand, ...(winningTile ? [winningTile] : [])];
  const winner = safePlayers.find(p => p.id === winResult?.winnerId);
  const melds = winResult?.melds ?? winner?.melds ?? [];
  const ranking = winResult?.ranking ?? safePlayers
    .map((p) => ({ rank: 0, playerId: p.id, playerName: p.name, score: p.score ?? 0, isWinner: p.id === winResult?.winnerId }))
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({ ...p, rank: index + 1 }));
  const isWinner = winResult?.winnerId === playerId;
  const sortedHand = sortTiles(winningHand);
  const sortedConcealed = sortTiles(concealedHand);

  const winTypeLabel = winResult?.winType === 'zimo' ? '自摸' : '点炮';

  async function handleScreenshot() {
    const node = cardRef.current;
    if (!node) return;

    const width = Math.ceil(node.getBoundingClientRect().width);
    const height = Math.ceil(node.scrollHeight);
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.width = `${width}px`;
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.querySelectorAll('.settlement-actions, .share-status').forEach(el => el.remove());

    const cssText = Array.from(document.styleSheets).map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      } catch {
        return '';
      }
    }).join('\n');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${cssText}</style>
            ${new XMLSerializer().serializeToString(clone)}
          </div>
        </foreignObject>
      </svg>`;

    try {
      setShareStatus('正在生成结算长图...');
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          setShareStatus('生成失败，可以使用系统截图');
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(async blob => {
          if (!blob) {
            setShareStatus('生成失败，可以使用系统截图');
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `mahjong-settlement-${Date.now()}.png`;
          link.href = pngUrl;
          link.click();
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
          try {
            const ClipboardItemCtor = (window as any).ClipboardItem;
            if (navigator.clipboard && ClipboardItemCtor) {
              await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
              setShareStatus('结算长图已下载并复制到剪贴板');
            } else {
              setShareStatus('结算长图已下载');
            }
          } catch {
            setShareStatus('结算长图已下载');
          }
          setTimeout(() => setShareStatus(''), 3000);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setShareStatus('生成失败，可以使用系统截图');
      };
      image.src = svgUrl;
    } catch {
      setShareStatus('生成失败，可以使用系统截图');
    }
  }

  return (
    <div className="settlement-overlay">
      <div className="settlement-container" ref={cardRef}>
        <div className="winner-banner">
          <div className="winner-stars">✨✨✨</div>
          <h1 className="winner-announcement">
            {isWinner ? '🎉 恭喜胡牌！' : `${winner?.name || '某玩家'} 胡牌！`}
          </h1>
          <div className="winner-detail">
            <span className="winner-name">{winner?.name || '???'}</span>
            <span className="win-type-badge">{winTypeLabel}</span>
            <span className="total-fan">{winResult?.totalFan ?? 0} 番</span>
          </div>
        </div>

        <div className="settlement-section">
          <h3>完整胡牌</h3>
          <div className="winning-hand-display">
            {sortedConcealed.length > 0 ? sortedConcealed.map((tile) => (
              <Tile key={tile.id} tile={tile} />
            )) : (
              <div className="missing-hand-note">胡牌手牌数据缺失，本局结果仍已记录。</div>
            )}
            {winningTile && (
              <div className="winning-tile-wrap" title={`胡 ${formatTile(winningTile)}`}>
                <span className="winning-plus">+</span>
                <Tile tile={winningTile} highlighted />
                <span className="winning-label">胡牌张</span>
              </div>
            )}
          </div>
          {melds.length > 0 && (
            <div className="winning-melds">
              <span className="melds-label">副露</span>
              {melds.map((meld, idx) => (
                <div key={idx} className="settlement-meld">
                  {meld.tiles.map(tile => <Tile key={tile.id} tile={tile} small />)}
                </div>
              ))}
            </div>
          )}
          <div className="winning-hand-summary">
            完整牌型：{sortedHand.map(formatTile).join('、') || '暂无'}
          </div>
        </div>

        <div className="settlement-section">
          <h3>房间累计积分排名</h3>
          <div className="ranking-list">
            {ranking.map((item) => {
              const delta = safePayouts.reduce((sum, payout) => {
                if (payout.toId === item.playerId) return sum + payout.amount;
                if (payout.fromId === item.playerId) return sum - payout.amount;
                return sum;
              }, 0);
              return (
                <div key={item.playerId} className={`ranking-item ${item.playerId === playerId ? 'self' : ''} ${item.isWinner ? 'winner' : ''}`}>
                  <span className="ranking-rank">#{item.rank}</span>
                  <span className="ranking-name">{item.playerName}</span>
                  <span className={`ranking-delta ${delta >= 0 ? 'positive' : 'negative'}`}>{delta >= 0 ? '+' : ''}{delta}</span>
                  <span className="ranking-score">{item.score} 分</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="settlement-section">
          <h3>番型明细</h3>
          <table className="fan-breakdown-table">
            <thead>
              <tr>
                <th>图标</th>
                <th>番型</th>
                <th>番数</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {safeFans.map((fan, i) => (
                <tr key={i}>
                  <td className="fan-icon-cell">{fan.icon}</td>
                  <td className="fan-name-cell">{fan.name}</td>
                  <td className="fan-value-cell">{fan.fanValue}</td>
                  <td className="fan-desc-cell">{fan.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {safePayouts.length > 0 && (
          <div className="settlement-section">
            <h3>本局结算</h3>
            <div className="payouts-list">
              {safePayouts.map((payout, i) => {
                const fromPlayer = safePlayers.find(p => p.id === payout.fromId);
                const toPlayer = safePlayers.find(p => p.id === payout.toId);
                const isInvolved = payout.fromId === playerId || payout.toId === playerId;
                return (
                  <div key={i} className={`payout-item ${isInvolved ? 'involved' : ''}`}>
                    <span className="payout-from">{fromPlayer?.name || '???'}</span>
                    <span className="payout-arrow">→</span>
                    <span className="payout-to">{toPlayer?.name || '???'}</span>
                    <span className="payout-amount">{payout.amount} 分</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="settlement-actions">
          <button className="settlement-btn btn-new-game" onClick={onNewGame}>
            继续下一局
          </button>
          <button className="settlement-btn btn-share" onClick={handleScreenshot}>
            保存结算长图
          </button>
        </div>
        {shareStatus && <div className="share-status">{shareStatus}</div>}
      </div>
    </div>
  );
};

export default React.memo(Settlement);
