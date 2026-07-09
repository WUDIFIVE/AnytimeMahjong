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
  const isDraw = winResult?.winType === 'draw';
  const isWinner = !isDraw && winResult?.winnerId === playerId;
  const sortedHand = sortTiles(winningHand);
  const sortedConcealed = sortTiles(concealedHand);

  const winTypeLabel = winResult?.winType === 'draw' ? '流局' : winResult?.winType === 'zimo' ? '自摸' : '点炮';

  async function handleScreenshot() {
    try {
      setShareStatus('正在生成结算长图...');

      const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
      const width = 900;
      const rowHeight = 54;
      const fanRows = isDraw ? 0 : Math.max(1, safeFans.length);
      const height = 420 + ranking.length * rowHeight + safePayouts.length * 38 + fanRows * 34;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.scale(scale, scale);

      const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      const fillText = (text: string, x: number, y: number, size = 24, color = '#f7ead0', weight = 700, align: CanvasTextAlign = 'left') => {
        ctx.fillStyle = color;
        ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
      };

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#143824');
      bg.addColorStop(1, '#071d14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(240,192,64,0.08)';
      ctx.beginPath();
      ctx.arc(width / 2, 160, 330, 0, Math.PI * 2);
      ctx.fill();

      roundedRect(50, 44, 800, height - 88, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,192,64,0.38)';
      ctx.lineWidth = 2;
      ctx.stroke();

      fillText('🀄 Anytime Mahjong 结算', width / 2, 96, 30, '#f0c040', 900, 'center');
      fillText(isDraw ? '荒牌流局，下一把继续！' : isWinner ? '恭喜胡牌！' : `${winner?.name || '某玩家'} 胡牌！`, width / 2, 148, 42, '#fff4d6', 900, 'center');
      fillText(`${isDraw ? '无人胡牌' : winner?.name || '???'} · ${winTypeLabel} · ${winResult?.totalFan ?? 0} 番`, width / 2, 188, 22, '#e8d3a2', 800, 'center');

      let y = 238;
      roundedRect(82, y, 736, 54 + ranking.length * rowHeight, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fill();
      fillText('房间累计积分排名', 110, y + 36, 22, '#f0c040', 900);
      y += 60;
      ranking.forEach(item => {
        const delta = safePayouts.reduce((sum, payout) => {
          if (payout.toId === item.playerId) return sum + payout.amount;
          if (payout.fromId === item.playerId) return sum - payout.amount;
          return sum;
        }, 0);
        fillText(`#${item.rank}`, 112, y + 30, 21, '#f7ead0', 900);
        fillText(item.playerName, 180, y + 30, 21, item.playerId === playerId ? '#f0c040' : '#f7ead0', 800);
        fillText(`${delta >= 0 ? '+' : ''}${delta}`, 620, y + 30, 21, delta >= 0 ? '#6ee08d' : '#ff8075', 900, 'right');
        fillText(`${item.score} 分`, 790, y + 30, 21, '#f7ead0', 800, 'right');
        y += rowHeight;
      });

      if (isDraw) {
        y += 24;
        fillText('牌墙已摸完，无人胡牌。本局不产生输赢积分。', width / 2, y + 34, 22, '#d9ccb0', 700, 'center');
      } else {
        y += 26;
        fillText('番型明细', 110, y, 22, '#f0c040', 900);
        y += 34;
        (safeFans.length ? safeFans : [{ icon: '•', name: '无番型数据', fanValue: 0, description: '' }]).forEach(fan => {
          fillText(`${fan.icon || '•'} ${fan.name}`, 120, y, 19, '#f7ead0', 800);
          fillText(`${fan.fanValue} 番`, 770, y, 19, '#f0c040', 900, 'right');
          y += 34;
        });
      }

      y += 24;
      if (safePayouts.length > 0) {
        fillText('本局结算', 110, y, 22, '#f0c040', 900);
        y += 34;
        safePayouts.forEach(payout => {
          const fromPlayer = safePlayers.find(p => p.id === payout.fromId);
          const toPlayer = safePlayers.find(p => p.id === payout.toId);
          fillText(`${fromPlayer?.name || '???'} → ${toPlayer?.name || '???'}`, 120, y, 18, '#e9dec7', 700);
          fillText(`${payout.amount} 分`, 770, y, 18, '#f7ead0', 800, 'right');
          y += 38;
        });
      }

      fillText(new Date().toLocaleString(), width / 2, height - 48, 16, 'rgba(247,234,208,0.55)', 600, 'center');

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('canvas blob unavailable');
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mahjong-settlement-${Date.now()}.png`;
      link.href = pngUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      setShareStatus('结算长图已下载');
      setTimeout(() => setShareStatus(''), 3000);
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
            {isDraw ? '荒牌流局，下一把继续！' : isWinner ? '🎉 恭喜胡牌！' : `${winner?.name || '某玩家'} 胡牌！`}
          </h1>
          <div className="winner-detail">
            <span className="winner-name">{isDraw ? '无人胡牌' : winner?.name || '???'}</span>
            <span className="win-type-badge">{winTypeLabel}</span>
            <span className="total-fan">{winResult?.totalFan ?? 0} 番</span>
          </div>
        </div>

        {!isDraw && (
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
        )}

        {isDraw && (
          <div className="settlement-section draw-summary">
            <h3>本局流局</h3>
            <p>牌墙已摸完，无人胡牌。本局不产生输赢积分，点击继续下一局即可。</p>
          </div>
        )}

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

        {!isDraw && (
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
        )}

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
