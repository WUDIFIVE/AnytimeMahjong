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
  const meldText = melds.length > 0
    ? melds.map((meld) => meld.tiles.map(formatTile).join('、')).join(' / ')
    : '';
  const completeHandText = [
    sortedHand.length > 0 ? `手牌：${sortedHand.map(formatTile).join('、')}` : '手牌：暂无',
    meldText ? `副露：${meldText}` : '',
  ].filter(Boolean).join('　');

  function downloadImage(dataUrl: string) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `mahjong-settlement-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function drawFallbackSettlementImage(): string {
    const width = 900;
    const padding = 44;
    const lineHeight = 34;
    const rows = [
      '中国大众麻将 · 本局结算',
      isDraw ? '荒牌流局' : `${winner?.name || '玩家'} ${winTypeLabel}`,
      `总番：${winResult?.totalFan ?? 0} 番`,
      '',
      '排名',
      ...ranking.map(r => `${r.rank}. ${r.playerName}　${r.score}分${r.isWinner ? '　胡牌' : ''}`),
      '',
      !isDraw ? `完整牌型：${completeHandText}` : '牌墙摸完，无人胡牌。',
      '',
      ...(!isDraw && safeFans.length > 0 ? ['番型明细', ...safeFans.map(f => `${f.icon || '•'} ${f.name}　${f.fanValue}番　${f.description}`)] : []),
      '',
      ...(safePayouts.length > 0 ? ['本局结算', ...safePayouts.map(payout => {
        const fromPlayer = safePlayers.find(p => p.id === payout.fromId);
        const toPlayer = safePlayers.find(p => p.id === payout.toId);
        return `${fromPlayer?.name || '???'} → ${toPlayer?.name || '???'}　${payout.amount}分`;
      })] : []),
    ].filter((line, idx, arr) => line !== '' || (arr[idx - 1] !== '' && arr[idx + 1] !== ''));

    const height = Math.max(760, padding * 2 + rows.length * lineHeight + 90);
    const scale = Math.min(2.5, Math.max(2, window.devicePixelRatio || 2));
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context unavailable');
    ctx.scale(scale, scale);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#1e321e');
    bg.addColorStop(1, '#0f2318');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(240,192,64,.56)';
    ctx.lineWidth = 3;
    roundRect(18, 18, width - 36, height - 36, 24);
    ctx.stroke();

    ctx.fillStyle = '#f0c040';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🀄 本局结算', width / 2, 74);

    let y = 126;
    ctx.textAlign = 'left';
    for (const raw of rows) {
      if (raw === '') { y += 12; continue; }
      const isHeading = ['排名', '番型明细', '本局结算'].includes(raw);
      const isTitle = raw.includes('中国大众麻将') || raw.includes('荒牌流局') || raw.includes(winTypeLabel);
      ctx.font = isHeading ? '900 25px -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
        : isTitle ? '900 28px -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
        : '600 21px -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif';
      ctx.fillStyle = isHeading ? '#f0c040' : isTitle ? '#fff2c6' : '#eadfcb';

      const maxTextWidth = width - padding * 2;
      let line = raw;
      while (ctx.measureText(line).width > maxTextWidth && line.length > 18) {
        let cut = line.length;
        while (ctx.measureText(line.slice(0, cut) + '…').width > maxTextWidth && cut > 18) cut--;
        ctx.fillText(line.slice(0, cut) + '…', padding, y);
        line = line.slice(cut);
        y += lineHeight;
      }
      ctx.fillText(line, padding, y);
      y += isHeading ? lineHeight + 4 : lineHeight;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(234,223,203,.62)';
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif';
    ctx.fillText(`生成时间 ${new Date().toLocaleString()}`, width / 2, height - 34);
    return canvas.toDataURL('image/png');
  }

  async function handleScreenshot() {
    const node = cardRef.current;
    if (!node) return;

    try {
      setShareStatus('正在按当前结算页面生成长图...');

      const previousScrollTop = node.scrollTop;
      node.classList.add('exporting-settlement');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const rect = node.getBoundingClientRect();
      const width = Math.ceil(Math.max(rect.width, node.scrollWidth));
      const height = Math.ceil(Math.max(node.scrollHeight, rect.height));
      const scale = Math.min(2.5, Math.max(2, window.devicePixelRatio || 2));

      const clone = node.cloneNode(true) as HTMLElement;
      clone.classList.add('exporting-settlement', 'export-clone');
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.boxSizing = 'border-box';

      const styleSheets = Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch {
            return '';
          }
        })
        .join('\n');

      const serialized = new XMLSerializer().serializeToString(clone);
      const xhtml = `
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>
            ${styleSheets}
            body { margin: 0; }
            .exporting-settlement { max-height: none !important; overflow: visible !important; }
            .exporting-settlement .settlement-actions,
            .exporting-settlement .share-status { display: none !important; }
            .export-clone { position: static !important; }
          </style>
          ${serialized}
        </div>
      `;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <foreignObject x="0" y="0" width="100%" height="100%">
            ${xhtml}
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('页面截图渲染失败'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL('image/png');
      downloadImage(dataUrl);
      setShareStatus('已按当前结算页面保存长图');
      node.scrollTop = previousScrollTop;
    } catch (error) {
      console.error('Settlement screenshot failed, using canvas fallback', error);
      try {
        setShareStatus('页面截图失败，正在生成兼容版结算长图...');
        downloadImage(drawFallbackSettlementImage());
        setShareStatus('已保存兼容版结算长图');
      } catch (fallbackError) {
        console.error('Settlement fallback image failed', fallbackError);
        setShareStatus('结算长图生成失败，请使用系统截图');
      }
    } finally {
      cardRef.current?.classList.remove('exporting-settlement');
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
            完整牌型：{completeHandText}
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
