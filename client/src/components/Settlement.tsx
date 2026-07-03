import React from 'react';
import { WinResult, PlayerState, sortTiles, formatTile } from '../game/types';
import Tile from './Tile';
import './Settlement.css';

interface SettlementProps {
  winResult: WinResult;
  players: PlayerState[];
  playerId: string;
  onNewGame: () => void;
  onBackToLobby: () => void;
}

const Settlement: React.FC<SettlementProps> = ({
  winResult,
  players,
  playerId,
  onNewGame,
  onBackToLobby,
}) => {
  const winner = players.find(p => p.id === winResult.winnerId);
  const isWinner = winResult.winnerId === playerId;
  const sortedHand = sortTiles(winResult.winningHand);

  const winTypeLabel = winResult.winType === 'zimo' ? '自摸' : '点炮';

  return (
    <div className="settlement-overlay">
      <div className="settlement-container">
        {/* Winner Banner */}
        <div className="winner-banner">
          <div className="winner-stars">✨✨✨</div>
          <h1 className="winner-announcement">
            {isWinner ? '🎉 恭喜胡牌！' : `${winner?.name || '某玩家'} 胡牌！`}
          </h1>
          <div className="winner-detail">
            <span className="winner-name">{winner?.name || '???'}</span>
            <span className="win-type-badge">{winTypeLabel}</span>
            <span className="total-fan">{winResult.totalFan} 番</span>
          </div>
        </div>

        {/* Winning Hand */}
        <div className="settlement-section">
          <h3>胡牌手牌</h3>
          <div className="winning-hand-display">
            {sortedHand.map((tile) => (
              <Tile key={tile.id} tile={tile} />
            ))}
          </div>
        </div>

        {/* Fan Breakdown */}
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
              {winResult.fans.map((fan, i) => (
                <tr key={i}>
                  <td className="fan-icon-cell">{fan.icon}</td>
                  <td className="fan-name-cell">{fan.name}</td>
                  <td className="fan-value-cell">{fan.fanValue}番</td>
                  <td className="fan-desc-cell">{fan.description}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={2}>合计</td>
                <td className="fan-value-cell">{winResult.totalFan} 番</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payouts */}
        {winResult.payouts.length > 0 && (
          <div className="settlement-section">
            <h3>结算</h3>
            <div className="payouts-list">
              {winResult.payouts.map((payout, i) => {
                const fromPlayer = players.find(p => p.id === payout.fromId);
                const toPlayer = players.find(p => p.id === payout.toId);
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

        {/* Actions */}
        <div className="settlement-actions">
          <button className="settlement-btn btn-new-game" onClick={onNewGame}>
            再来一局
          </button>
          <button className="settlement-btn btn-back-lobby" onClick={onBackToLobby}>
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Settlement);
