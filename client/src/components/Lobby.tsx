import React, { useState, useCallback } from 'react';
import { GameSettings, PlayerState } from '../game/types';
import './Lobby.css';

type LobbyMode = 'create' | 'join' | 'room';

interface LobbyProps {
  onSend: (type: string, payload: any) => void;
  roomState: {
    roomId: string;
    players: PlayerState[];
    settings: GameSettings;
    hostId?: string;
  } | null;
  playerId: string;
}

const Lobby: React.FC<LobbyProps> = ({ onSend, roomState, playerId }) => {
  const [mode, setMode] = useState<LobbyMode>('create');
  const [nickname, setNickname] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<GameSettings>({
    allowChi: true,
    allowDianpao: true,
    password: '',
    maxPlayers: 4,
  });
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const isHost = roomState?.hostId === playerId;

  const handleCreate = useCallback(() => {
    if (!nickname.trim()) return;
    onSend('create_room', {
      nickname: nickname.trim(),
      password: password || undefined,
      settings: {
        ...settings,
        password: password || undefined,
      },
    });
  }, [nickname, password, settings, onSend]);

  const handleJoin = useCallback(() => {
    if (!nickname.trim() || !roomIdInput.trim()) return;
    onSend('join_room', {
      roomId: roomIdInput.trim(),
      nickname: nickname.trim(),
      password: password || undefined,
    });
  }, [nickname, roomIdInput, password, onSend]);

  const handleStartGame = useCallback(() => {
    onSend('start_game', {});
  }, [onSend]);

  const handleCopyRoomId = useCallback(async () => {
    const roomId = roomState?.roomId?.trim();
    if (!roomId || !roomState) return;

    // Build a shareable URL that auto-joins the room
    const playerName = roomState.players.find(p => p.id === playerId)?.name || '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();
    params.set('room', roomId);
    if (playerName) params.set('player', playerName);
    const text = `${base}?${params.toString()}`;

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
      return ok;
    };

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopy()) {
        throw new Error('fallback copy failed');
      }
      setCopyStatus('success');
    } catch {
      setCopyStatus(fallbackCopy() ? 'success' : 'failed');
    }

    window.setTimeout(() => setCopyStatus('idle'), 2000);
  }, [roomState?.roomId, roomState?.players, playerId]);

  // Room view (after joining/creating)
  if (roomState) {
    return (
      <div className="lobby">
        <div className="lobby-card room-view">
          <h1 className="lobby-title">🀄 麻将室</h1>

          {/* Room ID */}
          <div className="room-id-section">
            <span className="room-id-label">房间号</span>
            <div className="room-id-display" onClick={handleCopyRoomId}>
              <span className="room-id-text">{roomState.roomId}</span>
              <span className={`copy-hint copy-${copyStatus}`}>
                {copyStatus === 'success' ? '已复制链接 ✓' : copyStatus === 'failed' ? '复制失败，长按手动复制' : '点击复制链接'}
              </span>
            </div>
            {(() => {
              const playerName = roomState.players.find(p => p.id === playerId)?.name || '';
              const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomState.roomId)}&player=${encodeURIComponent(playerName)}`;
              return (
                <div className="share-url-hint" title={shareUrl}>
                  <span className="share-url-text">{shareUrl}</span>
                </div>
              );
            })()}
          </div>

          {/* Settings */}
          <div className="room-settings">
            <h3>房间设置</h3>
            <div className="settings-grid">
              <div className={`setting-item ${roomState.settings.allowChi ? 'on' : 'off'}`}>
                吃牌: {roomState.settings.allowChi ? '允许' : '禁止'}
              </div>
              <div className={`setting-item ${roomState.settings.allowDianpao ? 'on' : 'off'}`}>
                点炮: {roomState.settings.allowDianpao ? '允许' : '禁止'}
              </div>
              <div className="setting-item">
                {roomState.settings.maxPlayers}人局
              </div>
              {roomState.settings.password && (
                <div className="setting-item protected">
                  有密码保护
                </div>
              )}
            </div>
          </div>

          {/* Player List */}
          <div className="player-list-section">
            <h3>玩家 ({roomState.players.length}/{roomState.settings.maxPlayers})</h3>
            <div className="player-list">
              {roomState.players.map((p, i) => (
                <div key={p.id || i} className={`player-list-item ${p.id === roomState.hostId ? 'host' : ''}`}>
                  <span className="player-seat">P{i + 1}</span>
                  <span className="player-list-name">{p.name}</span>
                  {p.id === roomState.hostId && <span className="host-badge">房主</span>}
                  {p.id === playerId && <span className="self-badge">你</span>}
                </div>
              ))}
              {/* Empty slots */}
              {Array.from({ length: roomState.settings.maxPlayers - roomState.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="player-list-item empty">
                  <span className="player-seat">P{roomState.players.length + i + 1}</span>
                  <span className="player-list-name">等待中...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="lobby-actions">
            {isHost && roomState.players.length >= 2 && (
              <button className="btn-primary btn-start" onClick={handleStartGame}>
                开始游戏
              </button>
            )}
            {isHost && roomState.players.length < 2 && (
              <p className="waiting-hint">至少需要2名玩家才能开始</p>
            )}
            {!isHost && (
              <p className="waiting-hint">等待房主开始游戏...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Create/Join view
  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">🀄 麻将</h1>
        <p className="lobby-subtitle">多人在线对战</p>

        {/* Mode Tabs */}
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            创建房间
          </button>
          <button
            className={`mode-tab ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >
            加入房间
          </button>
        </div>

        {/* Nickname (common) */}
        <div className="form-group">
          <label htmlFor="nickname">昵称</label>
          <input
            id="nickname"
            type="text"
            placeholder="输入你的昵称"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={12}
            autoComplete="off"
          />
        </div>

        {/* Create Form */}
        {mode === 'create' && (
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="password-create">房间密码 (可选)</label>
              <input
                id="password-create"
                type="text"
                placeholder="留空则无密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                maxLength={16}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label>游戏设置</label>
              <div className="toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.allowChi}
                    onChange={e => setSettings(s => ({ ...s, allowChi: e.target.checked }))}
                  />
                  <span>允许吃牌</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.allowDianpao}
                    onChange={e => setSettings(s => ({ ...s, allowDianpao: e.target.checked }))}
                  />
                  <span>允许点炮</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="maxPlayers">人数</label>
              <select
                id="maxPlayers"
                value={settings.maxPlayers}
                onChange={e => setSettings(s => ({ ...s, maxPlayers: Number(e.target.value) }))}
              >
                <option value={2}>2人</option>
                <option value={3}>3人</option>
                <option value={4}>4人</option>
              </select>
            </div>

            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={!nickname.trim()}
            >
              创建房间
            </button>
          </div>
        )}

        {/* Join Form */}
        {mode === 'join' && (
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="roomId">房间号</label>
              <input
                id="roomId"
                type="text"
                placeholder="输入房间号"
                value={roomIdInput}
                onChange={e => setRoomIdInput(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password-join">房间密码</label>
              <input
                id="password-join"
                type="text"
                placeholder="有密码则输入"
                value={password}
                onChange={e => setPassword(e.target.value)}
                maxLength={16}
                autoComplete="off"
              />
            </div>

            <button
              className="btn-primary"
              onClick={handleJoin}
              disabled={!nickname.trim() || !roomIdInput.trim()}
            >
              加入房间
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(Lobby);
