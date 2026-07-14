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
  const winnerIds = new Set([...(winResult?.winners?.map(w => w.playerId) ?? []), ...(winResult?.winnerId ? [winResult.winnerId] : [])]);
  const winnersText = winResult?.winners?.length
    ? winResult.winners.map(w => w.playerName).join('、')
    : '';
  const winner = safePlayers.find(p => p.id === winResult?.winnerId);
  const melds = winResult?.melds ?? winner?.melds ?? [];
  const ranking = winResult?.ranking ?? safePlayers
    .map((p) => ({ rank: 0, playerId: p.id, playerName: p.name, score: p.score ?? 0, isWinner: winnerIds.has(p.id) }))
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({ ...p, rank: index + 1 }));
  const isDraw = winResult?.winType === 'draw';
  const isWinner = !isDraw && winnerIds.has(playerId);
  const isMultiWin = !isDraw && (winResult?.winners?.length ?? 0) > 1;
  const sortedHand = sortTiles(winningHand);
  const sortedConcealed = sortTiles(concealedHand);

  const winTypeLabel = winResult?.winType === 'draw' ? '流局' : winResult?.winType === 'zimo' ? '自摸' : isMultiWin ? '一炮多响' : '点炮';
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

    setShareStatus('正在生成长图...');

    try {
      // Canvas-based text rendering: stable, no DOM/CORS issues
      const width = 800;
      const padding = 40;
      const lineHeight = 32;
      const scale = 2;

      const lines: string[] = [];
      lines.push('中国大众麻将 · 本局结算');
      lines.push('');
      lines.push(isDraw ? '荒牌流局' : `${winner?.name || '玩家'} ${winTypeLabel}`);
      if (isMultiWin) lines.push(`一炮多响: ${winnersText}`);
      lines.push(`总番：${winResult?.totalFan ?? 0} 番`);
      lines.push('');
      lines.push('排名');
      for (const r of ranking) {
        lines.push(`  ${r.rank}. ${r.playerName}  ${r.score}分${r.isWinner ? '  胡牌' : ''}`);
      }
      lines.push('');
      if (!isDraw && completeHandText) {
        lines.push(`完整牌型：${completeHandText}`);
        lines.push('');
      }
      if (!isDraw && safeFans.length > 0) {
        lines.push('番型明细');
        for (const f of safeFans) {
          lines.push(`  ${f.icon || '•'} ${f.name}  ${f.fanValue}番`);
        }
        lines.push('');
      }
      if (safePayouts.length > 0) {
        lines.push('本局结算');
        for (const payout of safePayouts) {
          const fromPlayer = safePlayers.find(p => p.id === payout.fromId);
          const toPlayer = safePlayers.find(p => p.id === payout.toId);
          lines.push(`  ${fromPlayer?.name || '???'} → ${toPlayer?.name || '???'}  ${payout.amount}分`);
        }
      }
      lines.push('');
      lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

      const height = padding * 2 + lines.length * lineHeight + 80;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.scale(scale, scale);

      // Background
      const rr = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
      };
      ctx.fillStyle = '#faf8f0';
      rr(10, 10, width - 20, height - 20, 16);
      ctx.fill();
      ctx.strokeStyle = '#d4c89a';
      ctx.lineWidth = 2;
      rr(10, 10, width - 20, height - 20, 16);
      ctx.stroke();

      // Title
      ctx.fillStyle = '#2a4a2a';
      ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('中国大众麻将 · 本局结算', width / 2, padding + 24);

      // Content
      ctx.textAlign = 'left';
      ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#333';
      let y = padding + 64;
      for (const line of lines) {
        if (line === '') {
          y += 12;
        } else {
          ctx.fillText(line, padding, y);
          y += lineHeight;
        }
      }

      const dataUrl = canvas.toDataURL('image/png');
      downloadImage(dataUrl);
      setShareStatus('✅ 已保存结算长图');
    } catch (error) {
      console.error('Settlement screenshot failed', error);
      try {
        setShareStatus('请在弹窗中选择当前标签页以保存真实界面截图...');
        const dataUrl = await captureVisibleSettlementFromScreen(node);
        downloadImage(dataUrl);
        setShareStatus('✅ 已保存当前界面截图');
      } catch (screenError) {
        console.error('Settlement screen capture failed', screenError);
        setShareStatus('截图失败，请使用系统截图');
      }
    }
  }

  return (
    <div className="settlement-overlay">
      <div className="settlement-container" ref={cardRef}>
        <div className="winner-banner">
          <div className="winner-stars">✨✨✨</div>
          <h1 className="winner-announcement">
            {isDraw ? '荒牌流局，下一把继续！' : isWinner ? '🎉 恭喜胡牌！' : isMultiWin ? `${winnersText || '多位玩家'} 胡牌！` : `${winner?.name || '某玩家'} 胡牌！`}
          </h1>
          <div className="winner-detail">
            <span className="winner-name">{isDraw ? '无人胡牌' : isMultiWin ? winnersText || '多位玩家' : winner?.name || '???'}</span>
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
            <p>牌墙已摸完，无人胡牌。若有听牌玩家，将执行荒庄查听积分结算。</p>
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
