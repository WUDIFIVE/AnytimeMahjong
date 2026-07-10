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

  async function captureVisibleSettlementFromScreen(node: HTMLElement): Promise<string> {
    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
    };
    if (!mediaDevices?.getDisplayMedia) {
      throw new Error('当前浏览器不支持屏幕捕获');
    }

    const stream = await mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as MediaTrackConstraints,
      audio: false,
    });

    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise(resolve => requestAnimationFrame(resolve));

      const rect = node.getBoundingClientRect();
      const scaleX = video.videoWidth / window.innerWidth;
      const scaleY = video.videoHeight / window.innerHeight;
      const cropX = Math.max(0, Math.round(rect.left * scaleX));
      const cropY = Math.max(0, Math.round(rect.top * scaleY));
      const cropWidth = Math.min(video.videoWidth - cropX, Math.round(rect.width * scaleX));
      const cropHeight = Math.min(video.videoHeight - cropY, Math.round(rect.height * scaleY));
      if (cropWidth <= 0 || cropHeight <= 0) throw new Error('截图裁剪区域无效');

      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      return canvas.toDataURL('image/png');
    } finally {
      stream.getTracks().forEach(track => track.stop());
    }
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
      console.error('Settlement DOM screenshot failed', error);
      try {
        setShareStatus('页面截图失败，请在弹窗中选择当前标签页以保存真实界面截图...');
        const dataUrl = await captureVisibleSettlementFromScreen(node);
        downloadImage(dataUrl);
        setShareStatus('已保存当前界面截图');
      } catch (screenError) {
        console.error('Settlement screen capture failed', screenError);
        setShareStatus('当前界面截图失败，请使用系统截图；不会再生成兼容版');
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
