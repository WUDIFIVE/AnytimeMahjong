import React, { useState, useCallback } from 'react';
import { FanType, FanInfo, FAN_DEFINITIONS, getShisanmeyaoExample, getQixiaoduiExample, Tile as TileType, sortTiles } from '../game/types';
import Tile from './Tile';
import './RuleGuide.css';

interface RuleGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAN_TABS: { type: FanType; label: string }[] = [
  { type: 'shisanmeyao', label: '十三幺' },
  { type: 'qixiaodui', label: '七小对' },
  { type: 'yitiaolong', label: '一条龙' },
  { type: 'qingyise', label: '清一色' },
  { type: 'pengpenghu', label: '碰碰胡' },
  { type: 'gangshangkaihua', label: '杠上开花' },
  { type: 'haidilaoyue', label: '海底捞月' },
  { type: 'danshuang', label: '单双' },
];

const RuleGuide: React.FC<RuleGuideProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<FanType>('shisanmeyao');

  const fan = FAN_DEFINITIONS.find(f => f.type === activeTab);

  if (!isOpen) return null;

  return (
    <div className="rule-guide-overlay" onClick={onClose}>
      <div className="rule-guide-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rule-guide-header">
          <h2 className="rule-guide-title">📖 胡牌规则指南</h2>
          <button className="rule-guide-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="rule-guide-tabs">
          {FAN_TABS.map(tab => (
            <button
              key={tab.type}
              className={`rule-tab ${activeTab === tab.type ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.type)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {fan && (
          <div className="rule-guide-content">
            {/* Fan Header */}
            <div className="fan-header">
              <span className="fan-icon">{fan.icon}</span>
              <div className="fan-title-group">
                <h3 className="fan-name">{fan.name}</h3>
                <span className="fan-value">{fan.fanValue} 番</span>
              </div>
            </div>

            <p className="fan-description">{fan.description}</p>

            {/* Visual Example */}
            <div className="fan-example">
              <h4>示例牌型</h4>
              <div className="example-tiles">
                {activeTab === 'shisanmeyao' && <ShisanmeyaoExample />}
                {activeTab === 'qixiaodui' && <QixiaoduiExample />}
                {activeTab === 'yitiaolong' && <YitiaolongExample />}
                {activeTab === 'qingyise' && <QingyiseExample />}
                {activeTab === 'pengpenghu' && <PengpenghuExample />}
                {activeTab === 'gangshangkaihua' && <GangshangKaihuaExample />}
                {activeTab === 'haidilaoyue' && <HaidiLaoyueExample />}
                {activeTab === 'danshuang' && <DanshuangExample />}
              </div>
            </div>

            {/* All Fans Summary */}
            <div className="fans-summary">
              <h4>所有番型一览</h4>
              <div className="fans-table">
                {FAN_DEFINITIONS.map(f => (
                  <div key={f.type} className="fan-row">
                    <span className="fan-row-icon">{f.icon}</span>
                    <span className="fan-row-name">{f.name}</span>
                    <span className="fan-row-value">{f.fanValue}番</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rule-extra-section">
          <h4>和牌方式补充</h4>
          <ul>
            <li><strong>自摸：</strong>自己摸进的牌组成合法胡牌，按钮显示“自摸胡”。</li>
            <li><strong>点炮：</strong>他人打出的牌使你成胡，开启点炮规则时可响应“胡”。</li>
            <li><strong>杠上开花：</strong>明杠、暗杠或加杠后摸补牌，若补牌成胡，按自摸结算，并额外计大胡。</li>
            <li><strong>海底捞月：</strong>牌墙最后一张牌自摸成胡，按自摸结算，并额外计大胡。</li>
            <li><strong>门清：</strong>未吃、未碰、未明杠可计门清；暗杠不破门清。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Example components for each fan type
const ShisanmeyaoExample: React.FC = () => {
  const tiles = getShisanmeyaoExample();
  const [paired, setPaired] = useState(0);

  const cyclePair = useCallback(() => {
    setPaired(p => (p + 1) % 13);
  }, []);

  return (
    <div className="example-container">
      <div className="example-grid shisanmeyao-grid">
        {tiles.map((tile, i) => (
          <Tile
            key={tile.id}
            tile={tile}
            small
            highlighted={i === paired}
          />
        ))}
      </div>
      <p className="example-hint">
        高亮牌为对子（点击切换） 
        <button className="cycle-btn" onClick={cyclePair}>切换对子</button>
      </p>
      <p className="example-note">
        十三种幺九牌（1/9万条筒 + 东南西北中发白）各一张，其中一种成对即可胡牌。
      </p>
    </div>
  );
};

const QixiaoduiExample: React.FC = () => {
  const pairs = getQixiaoduiExample();
  return (
    <div className="example-container">
      <div className="qixiaodui-grid">
        {pairs.map((pair, i) => (
          <div key={i} className="pair-group">
            <Tile tile={pair[0]} small />
            <Tile tile={pair[1]} small />
          </div>
        ))}
      </div>
      <p className="example-note">
        七个对子，不需要顺子或刻子。全是对子即可。
      </p>
    </div>
  );
};

const YitiaolongExample: React.FC = () => {
  const dragon: TileType[] = [
    { suit: 'wan', value: 1, id: 'dragon-1' },
    { suit: 'wan', value: 2, id: 'dragon-2' },
    { suit: 'wan', value: 3, id: 'dragon-3' },
    { suit: 'wan', value: 4, id: 'dragon-4' },
    { suit: 'wan', value: 5, id: 'dragon-5' },
    { suit: 'wan', value: 6, id: 'dragon-6' },
    { suit: 'wan', value: 7, id: 'dragon-7' },
    { suit: 'wan', value: 8, id: 'dragon-8' },
    { suit: 'wan', value: 9, id: 'dragon-9' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {dragon.map(t => <Tile key={t.id} tile={t} small />)}
      </div>
      <p className="example-note">
        同花色1-9各一张，加上任意其他三组面子（顺子或刻子）和一对将牌。
      </p>
    </div>
  );
};

const QingyiseExample: React.FC = () => {
  const tiles: TileType[] = [
    { suit: 'wan', value: 1, id: 'qs-1' },
    { suit: 'wan', value: 2, id: 'qs-2' },
    { suit: 'wan', value: 3, id: 'qs-3' },
    { suit: 'wan', value: 5, id: 'qs-5' },
    { suit: 'wan', value: 6, id: 'qs-6' },
    { suit: 'wan', value: 7, id: 'qs-7' },
    { suit: 'wan', value: 8, id: 'qs-8' },
    { suit: 'wan', value: 8, id: 'qs-8b' },
    { suit: 'wan', value: 8, id: 'qs-8c' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {tiles.map(t => <Tile key={t.id} tile={t} small />)}
      </div>
      <p className="example-note">
        全部由同一种花色组成，不含字牌。
      </p>
    </div>
  );
};

const PengpenghuExample: React.FC = () => {
  const tiles: TileType[] = [
    { suit: 'wan', value: 2, id: 'pp-2a' },
    { suit: 'wan', value: 2, id: 'pp-2b' },
    { suit: 'wan', value: 2, id: 'pp-2c' },
    { suit: 'tiao', value: 5, id: 'pp-5a' },
    { suit: 'tiao', value: 5, id: 'pp-5b' },
    { suit: 'tiao', value: 5, id: 'pp-5c' },
    { suit: 'tong', value: 7, id: 'pp-7a' },
    { suit: 'tong', value: 7, id: 'pp-7b' },
    { suit: 'tong', value: 7, id: 'pp-7c' },
    { suit: 'feng', value: 1, id: 'pp-d1a' },
    { suit: 'feng', value: 1, id: 'pp-d1b' },
    { suit: 'feng', value: 1, id: 'pp-d1c' },
    { suit: 'jian', value: 1, id: 'pp-zhong1' },
    { suit: 'jian', value: 1, id: 'pp-zhong2' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {tiles.map(t => <Tile key={t.id} tile={t} small />)}
      </div>
      <p className="example-note">
        四组刻子（三张相同）或杠子，加一对将牌。
      </p>
    </div>
  );
};

const GangshangKaihuaExample: React.FC = () => {
  const tiles: TileType[] = [
    { suit: 'tong', value: 3, id: 'gskh-3a' },
    { suit: 'tong', value: 3, id: 'gskh-3b' },
    { suit: 'tong', value: 3, id: 'gskh-3c' },
    { suit: 'tiao', value: 4, id: 'gskh-4' },
    { suit: 'tiao', value: 5, id: 'gskh-5' },
    { suit: 'tiao', value: 6, id: 'gskh-6' },
    { suit: 'wan', value: 7, id: 'gskh-7' },
    { suit: 'wan', value: 8, id: 'gskh-8' },
    { suit: 'wan', value: 9, id: 'gskh-9' },
    { suit: 'jian', value: 2, id: 'gskh-fa1' },
    { suit: 'jian', value: 2, id: 'gskh-fa2' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {tiles.map(t => <Tile key={t.id} tile={t} small />)}
        <span className="example-plus">杠后补牌</span>
        <Tile tile={{ suit: 'jian', value: 2, id: 'gskh-win' }} small highlighted />
      </div>
      <p className="example-note">
        例如开杠后摸到“发”，正好组成将牌或完成最后一组牌，即为杠上开花；它本质是自摸胡，并额外计大胡。
      </p>
    </div>
  );
};

const HaidiLaoyueExample: React.FC = () => {
  const tiles: TileType[] = [
    { suit: 'wan', value: 1, id: 'hdl-1' },
    { suit: 'wan', value: 2, id: 'hdl-2' },
    { suit: 'wan', value: 3, id: 'hdl-3' },
    { suit: 'tong', value: 4, id: 'hdl-4' },
    { suit: 'tong', value: 5, id: 'hdl-5' },
    { suit: 'tong', value: 6, id: 'hdl-6' },
    { suit: 'tiao', value: 7, id: 'hdl-7' },
    { suit: 'tiao', value: 8, id: 'hdl-8' },
    { suit: 'tiao', value: 9, id: 'hdl-9' },
    { suit: 'feng', value: 1, id: 'hdl-dong1' },
    { suit: 'feng', value: 1, id: 'hdl-dong2' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {tiles.map(t => <Tile key={t.id} tile={t} small />)}
        <span className="example-plus">海底牌</span>
        <Tile tile={{ suit: 'feng', value: 1, id: 'hdl-win' }} small highlighted />
      </div>
      <p className="example-note">
        牌墙剩最后一张时摸牌，如果这张牌正好成胡，就是海底捞月；按自摸结算，并额外计大胡。
      </p>
    </div>
  );
};

const DanshuangExample: React.FC = () => {
  const tiles: TileType[] = [
    { suit: 'wan', value: 1, id: 'ds-1' },
    { suit: 'wan', value: 3, id: 'ds-3' },
    { suit: 'wan', value: 5, id: 'ds-5' },
    { suit: 'tiao', value: 1, id: 'ds-t1' },
    { suit: 'tiao', value: 3, id: 'ds-t3' },
    { suit: 'tiao', value: 5, id: 'ds-t5' },
    { suit: 'tong', value: 7, id: 'ds-7' },
    { suit: 'tong', value: 9, id: 'ds-9' },
  ];
  return (
    <div className="example-container">
      <div className="example-grid">
        {tiles.map(t => <Tile key={t.id} tile={t} small />)}
      </div>
      <p className="example-note">
        全手牌均为单数（奇数）或均为双数（偶数），不含字牌。
      </p>
    </div>
  );
};

export default React.memo(RuleGuide);
