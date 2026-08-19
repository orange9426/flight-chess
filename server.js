// ============================================================
//  飞行棋联机服务器
//  - HTTP 静态文件服务（dist/ 或 src/）
//  - WebSocket 房间系统
//  - 服务端权威游戏引擎
// ============================================================
import http from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, normalize, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const PORT = process.env.PORT || 3000;

// ============================================================
//  游戏常量
// ============================================================
const CELL_TYPES = [
  'start', 'task', 'task', 'event', 'task', 'teleport', 'task', 'task',
  'shop', 'event', 'task', 'task', 'task', 'teleport', 'task', 'task',
  'shop', 'task', 'event', 'task', 'task', 'task', 'teleport', 'task',
  'shop', 'task', 'task', 'event', 'task', 'task', 'teleport', 'task',
  'shop', 'task', 'task', 'task', 'task', 'event', 'task', 'end'
];

const EVENTS = [
  { id: 'redPacket',    name: '红包雨',       desc: '双方各+8积分' },
  { id: 'incomeTax',    name: '个人所得税',   desc: '双方各自失去 floor(当前积分/10) 积分' },
  { id: 'robHood',      name: '劫富济贫',     desc: '积分多的玩家给积分少的玩家3积分；平分则无事' },
  { id: 'povertyRelief',name: '扶贫款',       desc: '积分少的玩家+6积分；平分则双方各+6' },
  { id: 'disasterRelief',name: '救灾款',      desc: '装备少的玩家+6积分；数量相同则双方各+6' },
  { id: 'woodShow',     name: '木秀于林',     desc: '非终点棋子中层数最高的一枚落一层（同列下），并列时随机' },
  { id: 'soaring',      name: '扶摇直上',     desc: '所有棋子中层数最低的一枚上一层（同列上），并列时随机' },
  { id: 'earthquake',   name: '地震',         desc: '双方各随机一枚非第一层且非终点的棋子落一层' },
  { id: 'bigWind',      name: '大风吹',       desc: '双方各随机一枚非终点棋子传送到同层随机空格' },
  { id: 'ghostWall',    name: '鬼打墙',       desc: '双方所有非起点非终点棋子沿路径后退1格' },
  { id: 'hitchhike',    name: '顺风车',       desc: '双方所有非起点非终点棋子沿路径前进2格' },
  { id: 'lookBehind',   name: '你看看你后面', desc: '找到离触发棋子最近的棋子，传送到它身后一格' },
  { id: 'forward',      name: '勇往直前',     desc: '当前触发棋子沿路径前进3格' },
  { id: 'shopFrenzy',   name: '购物狂热',     desc: '当前棋子传送到同层的商店格并触发购物' },
  { id: 'taskFrenzy',   name: '任务狂热',     desc: '当前棋子传送到本层随机一个任务格并触发任务' },
  { id: 'forcedBuy',    name: '强买强卖',     desc: '扣除15积分，随机恢复一件已脱装备' },
  { id: 'smashPot',     name: '砸锅卖铁',     desc: '随机失去一件装备，获得20积分' },
  { id: 'nakedRun',     name: '裸体狂奔',     desc: '随机失去一件装备，当前棋子沿路径前进8格' },
  { id: 'philanthropist', name: '慈善家',     desc: '装备多的玩家给对方一件对方没有的装备，并上一层' },
  { id: 'giftClothes',  name: '天外来衣',     desc: '装备少的玩家随机恢复一件已脱装备' },
  { id: 'thornStorm',   name: '荆棘风暴',     desc: '双方各随机失去一件装备' },
  { id: 'perfectOutfit',name: '天衣无缝',     desc: '双方各随机恢复一件已脱装备' },
  { id: 'sloppy',       name: '衣冠不整',     desc: '双方各随机将一件穿着中的装备替换为另一件已脱装备' },
  { id: 'godRewards',   name: '天道酬勤',     desc: '先随机失去一件装备，完成一个随机任务后恢复两件' },
  { id: 'myTurn',       name: '我的回合',     desc: '扣除3积分，回合结束后获得一个额外回合' },
  { id: 'teleportMagic',name: '传送魔法',     desc: '双方各随机一枚非终点棋子同列上升一层' },
  { id: 'gearUp',       name: '整装待发',     desc: '恢复一件已脱装备，但对方获得两个额外回合' },
  { id: 'emptyTask',    name: '空任务',       desc: '获得积分，数值=当前已脱装备数量×2' },
  { id: 'stockTrade',   name: '炒股',         desc: '随机获得-4到6积分，扣到0为止' },
  { id: 'amnesia',      name: '瞬间失忆',     desc: '双方免脱装备的累计加价立即清零' }
];

const EQUIPMENT_ITEMS = [
  { id: 'top',    name: '上衣',       icon: '👕', desc: '立即恢复上衣装备' },
  { id: 'pants',  name: '裤子',       icon: '👖', desc: '立即恢复裤子装备' },
  { id: 'bra',    name: '内衣（特殊）', icon: '🎀', desc: '立即恢复内衣装备' },
  { id: 'briefs', name: '内裤',       icon: '🩲', desc: '立即恢复内裤装备' }
];

const ITEM_DEFS = {
  cheatDice:   { id: 'cheatDice',   name: '作弊骰子',   icon: '🎲', price: 6,  desc: '接下来2次掷骰结果必定为6', type: 'self',  charges: 2 },
  luckyDice:   { id: 'luckyDice',   name: '幸运骰子',   icon: '🍀', price: 4,  desc: '接下来2次掷骰移动的格数额外+2', type: 'self', charges: 2 },
  curseDice:   { id: 'curseDice',   name: '诅咒骰子',   icon: '💀', price: 5,  desc: '接下来2次对方掷骰移动格数-1~-2（最低1格）', type: 'enemy', charges: 2 },
  autoDice:    { id: 'autoDice',    name: '自动骰子',   icon: '🤖', price: 8,  desc: '接下来2次掷骰自动选择棋子，跨层不触发脱装', type: 'self', charges: 2 },
  doubleScore: { id: 'doubleScore', name: '双倍积分卡', icon: '✨', price: 7,  desc: '下次到达任务格，获得积分翻倍（含装备加成）', type: 'self', charges: 1 },
  freeCard:    { id: 'freeCard',    name: '白嫖卡',     icon: '🎁', price: 8,  desc: '下次到达任务格，自动获得两个任务全部积分', type: 'self', charges: 1 },
  switchCard:  { id: 'switchCard',  name: '调包卡',     icon: '🎭', price: 12, desc: '下次对方完成任务选择后，积分奖励归你', type: 'enemy', charges: 1 },
  restockCard: { id: 'restockCard', name: '补货卡',     icon: '📦', price: 6,  desc: '下次进入商店时刷新为2件装备+6件普通商品', type: 'self', charges: 1 },
  vipCard:     { id: 'vipCard',     name: '会员卡',     icon: '💎', price: 12, desc: '下次进入商店所有商品五折（向下取整）', type: 'self', charges: 1 },
  capitalCard: { id: 'capitalCard', name: '资本卡',     icon: '💰', price: 6,  desc: '下次对方进入商店时所有商品价格+5', type: 'enemy', charges: 1 },
  freeClothes: { id: 'freeClothes', name: '免脱卡',     icon: '🪡', price: 15, desc: '下次跨层脱装备时自动免脱，重置免脱计数', type: 'self', charges: 1 },
  emergencyIns:{ id: 'emergencyIns',name: '应急保险',   icon: '🛡️', price: 8,  desc: '失去最后一件装备时，立即随机获得一件装备', type: 'self', charges: 1 },
  financeIns:  { id: 'financeIns',  name: '金融保险',   icon: '💵', price: 15, desc: '下次失去装备时，立即获得20积分', type: 'self', charges: 1 },
  thornArmor:  { id: 'thornArmor',  name: '荆棘甲',     icon: '🌵', price: 10, desc: '下次被对方踢落时，对方随机失去一件装备', type: 'self', charges: 1 },
  immovable:   { id: 'immovable',   name: '不动甲',     icon: '🗿', price: 18, desc: '下次被踢时自己不动，踢你的棋子反落一层', type: 'self', charges: 1 },
  springArmor: { id: 'springArmor', name: '弹簧甲',     icon: '🌀', price: 6,  desc: '下次己方叠棋时，叠上来的棋子直接上一层', type: 'self', charges: 1 },
  teleportTrap:{ id: 'teleportTrap',name: '传送陷阱',   icon: '🕳️', price: 18, desc: '下次对方传送时改为向下传送一层', type: 'enemy', charges: 1 },
  financeTrap: { id: 'financeTrap', name: '金融陷阱',   icon: '⚠️', price: 16, desc: '下次对方到事件格时，改为失去18积分或一件装备', type: 'enemy', charges: 1 },
  gripGlove:   { id: 'gripGlove',   name: '防滑手套',   icon: '🧤', price: 10, desc: '免疫一次事件导致的棋子跌落或失去装备', type: 'self', charges: 1 },
  thiefGlove:  { id: 'thiefGlove',  name: '窃贼手套',   icon: '🧤', price: 9,  desc: '下次对方主动脱装备时，脱下的装备归你', type: 'enemy', charges: 1 }
};

const EVENT_EFFECTS = {
  redPacket:      'eventEffect_redPacket',
  incomeTax:      'eventEffect_incomeTax',
  robHood:        'eventEffect_robHood',
  povertyRelief:  'eventEffect_povertyRelief',
  disasterRelief: 'eventEffect_disasterRelief',
  woodShow:       'eventEffect_woodShow',
  soaring:        'eventEffect_soaring',
  earthquake:     'eventEffect_earthquake',
  bigWind:        'eventEffect_bigWind',
  ghostWall:      'eventEffect_ghostWall',
  hitchhike:      'eventEffect_hitchhike',
  lookBehind:     'eventEffect_lookBehind',
  forward:        'eventEffect_forward',
  shopFrenzy:     'eventEffect_shopFrenzy',
  taskFrenzy:     'eventEffect_taskFrenzy',
  forcedBuy:      'eventEffect_forcedBuy',
  smashPot:       'eventEffect_smashPot',
  nakedRun:       'eventEffect_nakedRun',
  philanthropist: 'eventEffect_philanthropist',
  giftClothes:    'eventEffect_giftClothes',
  thornStorm:     'eventEffect_thornStorm',
  perfectOutfit:  'eventEffect_perfectOutfit',
  sloppy:         'eventEffect_sloppy',
  godRewards:     'eventEffect_godRewards',
  myTurn:         'eventEffect_myTurn',
  teleportMagic:  'eventEffect_teleportMagic',
  gearUp:         'eventEffect_gearUp',
  emptyTask:      'eventEffect_emptyTask',
  stockTrade:     'eventEffect_stockTrade',
  amnesia:        'eventEffect_amnesia'
};

const DEFAULT_TASKS = [
  { desc: '大声唱一首歌', reward: 3 },
  { desc: '模仿一种动物叫声', reward: 2 },
  { desc: '说一个笑话', reward: 4 },
  { desc: '夸对方一句', reward: 3 },
  { desc: '原地转三圈', reward: 2 },
  { desc: '做一个鬼脸', reward: 2 },
  { desc: '学猫叫三声', reward: 1 },
  { desc: '模仿班主任说话', reward: 4 },
  { desc: '摆一个最酷的pose', reward: 2 },
  { desc: '做十个俯卧撑', reward: 5 },
  { desc: '用屁股写自己的名字', reward: 6 },
  { desc: '学一段广告台词', reward: 6 },
  { desc: '表演一个才艺', reward: 8 },
  { desc: '做二十个深蹲', reward: 7 },
  { desc: '学一首新歌副歌', reward: 5 },
  { desc: '即兴rap一分钟', reward: 7 },
  { desc: '模仿最讨厌的明星', reward: 5 },
  { desc: '一口气喝完整杯水', reward: 8 }
];

function parseTasks(raw) {
  if (!raw || typeof raw !== "string") return null;
  const tasks = raw.trim().split("\n").map((line, i) => {
    const [desc, r] = line.split("|");
    const reward = parseInt(r, 10);
    if (!desc || !desc.trim() || isNaN(reward)) return null;
    return { desc: desc.trim(), reward: reward };
  }).filter(Boolean);
  if (tasks.length < 4) return null;
  const low = tasks.filter(t => t.reward <= 4);
  const high = tasks.filter(t => t.reward >= 5);
  if (low.length < 2 || high.length < 2) return null;
  return tasks;
}

// ============================================================
//  游戏引擎
// ============================================================
class GameEngine {
  constructor(taskList) {
    this.tasks = taskList || DEFAULT_TASKS;
    this.lowTierTasks = this.tasks.filter(t => t.reward <= 4);
    this.highTierTasks = this.tasks.filter(t => t.reward >= 5);
    this.lowTierDeck = this.shuffleArray([...this.lowTierTasks]);
    this.highTierDeck = this.shuffleArray([...this.highTierTasks]);
    this.eventDeck = this.shuffleArray([...EVENTS]);

    this.listeners = {};
    this.currentTasks = [];
    this.shopItems = [];
    this.pendingCellResolve = null;
    this.godRewardsPending = null;

    const makeEquipment = () => ([
      { id: 'top', name: '上衣', icon: '👕', on: true },
      { id: 'pants', name: '裤子', icon: '👖', on: true },
      { id: 'bra', name: '内衣（特殊）', icon: '🎀', on: true },
      { id: 'briefs', name: '内裤', icon: '🩲', on: true }
    ]);

    this.state = {
      currentPlayer: 0,
      phase: 'idle',
      diceValue: 0,
      diceBonus: 0,
      rerollCount: 0,
      players: [
        { score: 15, pieces: [0, 0], finished: [false, false], equipment: makeEquipment(), skipClothesStreak: 0, allDone: false, inventory: {} },
        { score: 15, pieces: [0, 0], finished: [false, false], equipment: makeEquipment(), skipClothesStreak: 0, allDone: false, inventory: {} }
      ],
      winner: null,
      endgame: false,
      extraTurn: null,
      autoMovePending: false,
      autoMoveSkipClothes: false
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  posToRowCol(pos) {
    const rowFromBottom = Math.floor(pos / 8);
    const colInRow = pos % 8;
    const isEvenRow = rowFromBottom % 2 === 0;
    const col = isEvenRow ? colInRow : (7 - colInRow);
    return { row: rowFromBottom, col };
  }

  rowColToPos(row, col) {
    const isEvenRow = row % 2 === 0;
    const colInRow = isEvenRow ? col : (7 - col);
    return row * 8 + colInRow;
  }

  getRow(pos) { return Math.floor(pos / 8); }

  sameColAbove(pos) {
    const { row, col } = this.posToRowCol(pos);
    if (row >= 4) return null;
    return this.rowColToPos(row + 1, col);
  }

  sameColBelow(pos) {
    const { row, col } = this.posToRowCol(pos);
    if (row <= 0) return 0;
    return this.rowColToPos(row - 1, col);
  }

  drawLowTierTask() {
    if (this.lowTierDeck.length === 0) {
      this.lowTierDeck = this.shuffleArray([...this.lowTierTasks]);
    }
    return this.lowTierDeck.pop();
  }

  drawHighTierTask() {
    if (this.highTierDeck.length === 0) {
      this.highTierDeck = this.shuffleArray([...this.highTierTasks]);
    }
    return this.highTierDeck.pop();
  }

  drawEvent() {
    if (this.eventDeck.length === 0) {
      this.eventDeck = this.shuffleArray([...EVENTS]);
    }
    return this.eventDeck.pop();
  }

  hasItem(player, itemId) {
    const p = this.state.players[player];
    return p.inventory[itemId] && p.inventory[itemId] > 0;
  }

  addItem(player, itemId) {
    const p = this.state.players[player];
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    if (p.inventory[itemId]) return false;
    p.inventory[itemId] = def.charges || 1;
    this.emit('inventoryChange', { player, itemId, action: 'add', charges: p.inventory[itemId] });
    return true;
  }

  useItem(player, itemId) {
    const p = this.state.players[player];
    if (!p.inventory[itemId] || p.inventory[itemId] <= 0) return false;
    p.inventory[itemId] -= 1;
    if (p.inventory[itemId] <= 0) delete p.inventory[itemId];
    this.emit('inventoryChange', { player, itemId, action: 'use', charges: p.inventory[itemId] || 0 });
    return true;
  }

  equipCount(player) {
    return this.state.players[player].equipment.filter(e => e.on).length;
  }

  loseRandomEquip(player, opts = {}) {
    const p = this.state.players[player];
    const onList = p.equipment.filter(e => e.on);
    if (onList.length === 0) return null;

    if (opts.fromEvent && this.hasItem(player, 'gripGlove')) {
      this.useItem(player, 'gripGlove');
      this.emit('itemEffect', { player, itemId: 'gripGlove', detail: '免疫了失去装备' });
      return null;
    }

    const target = onList[Math.floor(Math.random() * onList.length)];
    target.on = false;
    p.skipClothesStreak = 0;
    this.emit('equipmentChange', { player, action: 'lose', equipId: target.id });

    if (this.hasItem(player, 'financeIns')) {
      this.useItem(player, 'financeIns');
      p.score += 20;
      this.emit('scoreChange', { player, delta: 20, score: p.score });
      this.emit('itemEffect', { player, itemId: 'financeIns', detail: '获得20积分' });
    }

    const remaining = p.equipment.filter(e => e.on).length;
    if (remaining === 0 && this.hasItem(player, 'emergencyIns')) {
      this.useItem(player, 'emergencyIns');
      this.restoreRandomEquip(player);
      this.emit('itemEffect', { player, itemId: 'emergencyIns', detail: '应急恢复一件装备' });
    }

    return target.id;
  }

  restoreRandomEquip(player) {
    const p = this.state.players[player];
    const offList = p.equipment.filter(e => !e.on);
    if (offList.length === 0) return null;
    const target = offList[Math.floor(Math.random() * offList.length)];
    target.on = true;
    this.emit('equipmentChange', { player, action: 'restore', equipId: target.id });
    return target.id;
  }

  hasEquip(player, equipId) {
    const eq = this.state.players[player].equipment.find(e => e.id === equipId);
    return eq ? eq.on : false;
  }

  getSkipClothesPrice(player) {
    const streak = this.state.players[player].skipClothesStreak || 0;
    return 10 + streak * 5;
  }

  piecesAtPos(pos, exclude = []) {
    const result = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        if (p.pieces[i] !== pos) continue;
        if (exclude.some(e => e.player === pl && e.index === i)) continue;
        result.push({ player: pl, index: i });
      }
    }
    return result;
  }

  rollDice() {
    if (this.state.phase !== 'idle') return;
    const p = this.state.players[this.state.currentPlayer];
    if (p.allDone) { this.endTurn(); return; }

    this.state.phase = 'rolling';
    this._doDiceRollEffects();
    this.emit('diceRoll', { value: this.state.diceValue, rerollCount: this.state.rerollCount });
    this.emit('stateChange', this.state);
  }

  rerollDice() {
    if (this.state.phase !== 'selecting') return;
    const p = this.state.players[this.state.currentPlayer];
    const cost = (this.state.rerollCount + 1) * 2;
    if (p.score < cost) return;

    p.score -= cost;
    this.state.rerollCount += 1;
    this.emit('scoreChange', { player: this.state.currentPlayer, delta: -cost, score: p.score });

    this.state.phase = 'rolling';
    this._doDiceRollEffects();
    this.emit('diceRoll', { value: this.state.diceValue, rerollCount: this.state.rerollCount, isReroll: true });
    this.emit('stateChange', this.state);
  }

  _doDiceRollEffects() {
    const currentPlayer = this.state.currentPlayer;
    const enemy = 1 - currentPlayer;

    let value = Math.floor(Math.random() * 6) + 1;
    let bonusSteps = 0;
    let enemyPenalty = 0;

    if (this.hasItem(currentPlayer, 'cheatDice')) {
      value = 6;
      this.useItem(currentPlayer, 'cheatDice');
      this.emit('itemEffect', { player: currentPlayer, itemId: 'cheatDice', detail: '作弊骰子！必出6点' });
    }
    if (this.hasItem(currentPlayer, 'luckyDice')) {
      bonusSteps += 2;
      this.useItem(currentPlayer, 'luckyDice');
      this.emit('itemEffect', { player: currentPlayer, itemId: 'luckyDice', detail: '幸运骰子！移动+2' });
    }
    if (this.hasItem(enemy, 'curseDice')) {
      enemyPenalty = 1 + Math.floor(Math.random() * 2);
      this.useItem(enemy, 'curseDice');
      this.emit('itemEffect', { player: enemy, itemId: 'curseDice', detail: `诅咒骰子！对方-${enemyPenalty}格` });
    }

    this.state.diceValue = value;
    this.state.diceBonus = bonusSteps - enemyPenalty;

    if (this.hasItem(currentPlayer, 'autoDice')) {
      this.useItem(currentPlayer, 'autoDice');
      this.state.autoMovePending = true;
      this.emit('itemEffect', { player: currentPlayer, itemId: 'autoDice', detail: '自动骰子！自动选择棋子' });
    }
  }

  onDiceAnimationEnd() {
    this.state.phase = 'selecting';
    const p = this.state.players[this.state.currentPlayer];
    const cost = (this.state.rerollCount + 1) * 2;
    this.emit('selectPiece', this.state.diceValue);
    this.emit('showRerollChoice', {
      player: this.state.currentPlayer,
      diceValue: this.state.diceValue,
      rerollCost: cost,
      canAfford: p.score >= cost
    });
    this.emit('stateChange', this.state);
  }

  movePiece(pieceIndex) {
    if (this.state.phase !== 'selecting') return;
    const p = this.state.players[this.state.currentPlayer];
    if (p.finished[pieceIndex]) return;

    this.state.phase = 'moving';
    this.emit('stateChange', this.state);

    const fromPos = p.pieces[pieceIndex];
    const bonus = this.state.diceBonus || 0;
    const steps = Math.max(1, this.state.diceValue + bonus);
    const toPos = Math.min(fromPos + steps, 39);

    if (this.state.autoMovePending) {
      this.state.autoMoveSkipClothes = true;
      this.state.autoMovePending = false;
    }

    this.emit('pieceMove', {
      player: this.state.currentPlayer,
      pieceIndex,
      fromPos,
      toPos
    });
  }

  onDiceAnimEnd() {
    if (this.state.phase !== 'rolling') return;
    this.state.phase = 'selecting';
    const p = this.state.players[this.state.currentPlayer];
    const cost = (this.state.rerollCount + 1) * 2;

    if (this.state.autoMovePending) {
      this.state.autoMovePending = false;
      const choices = [0, 1].filter(i => !p.finished[i]);
      if (choices.length > 0) {
        const idx = choices[Math.floor(Math.random() * choices.length)];
        this.emit('autoSelectPiece', { pieceIndex: idx });
        setTimeout(() => this.movePiece(idx), 600);
        this.emit('stateChange', this.state);
        return;
      }
    }

    this.emit('selectPiece', this.state.diceValue);
    this.emit('showRerollChoice', {
      player: this.state.currentPlayer,
      diceValue: this.state.diceValue,
      rerollCost: cost,
      canAfford: p.score >= cost
    });
    this.emit('stateChange', this.state);
  }

  onMoveComplete(player, pieceIndex, fromPos, toPos) {
    const p = this.state.players[player];
    p.pieces[pieceIndex] = toPos;

    if (toPos >= 39) {
      p.finished[pieceIndex] = true;
      this.emit('pieceFinished', { player, pieceIndex });
      this.emit('stateChange', this.state);

      if (p.finished.every(f => f)) {
        p.allDone = true;
        this.state.endgame = this.state.players.some(x => !x.allDone);

        if (this.state.players.every(x => x.allDone)) {
          this.state.phase = 'over';
          const s0 = this.state.players[0].score;
          const s1 = this.state.players[1].score;
          let winner;
          if (s0 > s1) winner = 0;
          else if (s1 > s0) winner = 1;
          else winner = -1;
          this.state.winner = winner;
          this.emit('victory', { winner, score0: s0, score1: s1 });
          this.emit('stateChange', this.state);
          return;
        }
      }

      this.endTurn();
      return;
    }

    const fromRow = this.posToRowCol(fromPos).row;
    const toRow = this.posToRowCol(toPos).row;
    const onClothes = p.equipment.filter(e => e.on).length;
    const isNormalMove = fromPos !== undefined && fromPos !== toPos;

    if (isNormalMove && toRow > fromRow && onClothes > 0) {
      if (this.state.autoMoveSkipClothes) {
        this.state.autoMoveSkipClothes = false;
        this.resolveCollisionThenCell(player, pieceIndex, toPos);
        return;
      }
      if (this.hasItem(player, 'freeClothes')) {
        this.useItem(player, 'freeClothes');
        p.skipClothesStreak = 0;
        this.emit('itemEffect', { player, itemId: 'freeClothes', detail: '免脱卡生效！' });
        this.resolveCollisionThenCell(player, pieceIndex, toPos);
        return;
      }
      this.state.phase = 'clothesChoice';
      this.emit('stateChange', this.state);
      const price = this.getSkipClothesPrice(player);
      this.emit('showClothesChoice', {
        player,
        pieceIndex,
        pos: toPos,
        price,
        canAfford: p.score >= price
      });
      return;
    }

    this.resolveCollisionThenCell(player, pieceIndex, toPos);
  }

  takeOffEquipment(player, pieceIndex, pos, equipIndex) {
    const p = this.state.players[player];
    if (!p.equipment[equipIndex] || !p.equipment[equipIndex].on) return;
    const equipId = p.equipment[equipIndex].id;
    p.equipment[equipIndex].on = false;
    p.skipClothesStreak = 0;

    const enemy = 1 - player;
    if (this.hasItem(enemy, 'thiefGlove')) {
      const enemyEq = this.state.players[enemy].equipment.find(e => e.id === equipId);
      if (enemyEq && !enemyEq.on) {
        enemyEq.on = true;
        this.useItem(enemy, 'thiefGlove');
        this.emit('equipmentChange', { player: enemy, action: 'steal', equipId });
        this.emit('itemEffect', { player: enemy, itemId: 'thiefGlove', detail: `窃贼手套！获得${equipId}` });
      }
    }

    this.emit('equipmentChange', { player, equipIndex, action: 'takeoff' });
    this.emit('stateChange', this.state);
    this.emit('hideClothesChoice');
    this.resolveCollisionThenCell(player, pieceIndex, pos);
  }

  buySkipClothes(player, pieceIndex, pos) {
    const p = this.state.players[player];
    const price = this.getSkipClothesPrice(player);
    if (p.score < price) return;
    p.score -= price;
    p.skipClothesStreak = (p.skipClothesStreak || 0) + 1;
    this.emit('scoreChange', { player, delta: -price, score: p.score });
    this.emit('equipmentChange', { player, action: 'skip', price });
    this.emit('stateChange', this.state);
    this.emit('hideClothesChoice');
    this.resolveCollisionThenCell(player, pieceIndex, pos);
  }

  resolveCollisionThenCell(player, pieceIndex, pos) {
    this.state.phase = 'resolving';
    this.emit('stateChange', this.state);

    this.checkCollision(player, pieceIndex, pos, (skipCellEffect) => {
      if (skipCellEffect) return;
      this.resolveCellEffect(player, pieceIndex, pos);
    });
  }

  resolveCellEffect(player, pieceIndex, pos) {
    const cellType = CELL_TYPES[pos];
    const finishAndEndTurn = () => { this.endTurn(); };

    switch (cellType) {
      case 'task':
        const task1 = this.drawLowTierTask();
        const task2 = this.drawHighTierTask();
        this.currentTasks = [task1, task2].filter(Boolean);
        this.emit('showTask', { player, tasks: this.currentTasks });
        this.pendingCellResolve = { player, pieceIndex, pos, afterResolve: finishAndEndTurn };
        break;
      case 'event':
        const event = this.drawEvent();
        this.emit('showEvent', { player, event });
        this.pendingCellResolve = { player, pieceIndex, pos, afterResolve: () => {
          this.state.phase = 'resolving';
          this.emit('stateChange', this.state);
          this.triggerEventEffect(event, {
            player, pieceIndex, pos,
            onDone: () => { this.endTurn(); }
          });
        }};
        break;
      case 'teleport':
        this.doTeleport(player, pieceIndex, pos);
        break;
      case 'shop':
        this.openShop(player);
        this.pendingCellResolve = { player, pieceIndex, pos, afterResolve: finishAndEndTurn };
        break;
      default:
        finishAndEndTurn();
    }
  }

  selectTask(taskIndex) {
    const task = this.currentTasks[taskIndex];
    if (!task) return;
    const currentPlayer = this.state.currentPlayer;
    const p = this.state.players[currentPlayer];
    const enemy = 1 - currentPlayer;
    const missingEquip = p.equipment.filter(e => !e.on).length;
    const bonus = missingEquip * 2;
    let totalReward = task.reward + bonus;

    if (this.hasItem(currentPlayer, 'freeCard') && this.currentTasks.length >= 2) {
      this.useItem(currentPlayer, 'freeCard');
      const otherTask = this.currentTasks[1 - taskIndex];
      if (otherTask) totalReward += otherTask.reward + bonus;
      this.emit('itemEffect', { player: currentPlayer, itemId: 'freeCard', detail: '白嫖卡！两个任务都给' });
    }

    if (this.hasItem(currentPlayer, 'doubleScore')) {
      this.useItem(currentPlayer, 'doubleScore');
      totalReward *= 2;
      this.emit('itemEffect', { player: currentPlayer, itemId: 'doubleScore', detail: '双倍积分！' });
    }

    let rewardPlayer = currentPlayer;
    if (this.hasItem(enemy, 'switchCard')) {
      this.useItem(enemy, 'switchCard');
      rewardPlayer = enemy;
      this.emit('itemEffect', { player: enemy, itemId: 'switchCard', detail: '调包卡！积分归我' });
    }

    this.state.players[rewardPlayer].score += totalReward;
    this.emit('scoreChange', { player: rewardPlayer, delta: totalReward, score: this.state.players[rewardPlayer].score });
    this.emit('stateChange', this.state);
    this.emit('taskSelected', { taskIndex, desc: task.desc, reward: totalReward });
    setTimeout(() => {
      this.emit('hideTask');
      this.finishCellResolve();
    }, 1200);
  }

  closeEvent() {
    this.emit('hideEvent');
    this.finishCellResolve();
  }

  finishCellResolve() {
    if (this.pendingCellResolve) {
      const { player, pieceIndex, pos, afterResolve } = this.pendingCellResolve;
      this.pendingCellResolve = null;
      afterResolve();
    }
  }

  doTeleport(player, pieceIndex, pos) {
    const { row, col } = this.posToRowCol(pos);
    const enemy = 1 - player;
    let dir = 1;
    if (this.hasItem(enemy, 'teleportTrap')) {
      this.useItem(enemy, 'teleportTrap');
      dir = -1;
      this.emit('itemEffect', { player: enemy, itemId: 'teleportTrap', detail: '传送陷阱！改为向下传送' });
    }
    const newRow = row + dir;
    if (newRow > 4 || newRow < 0) { this.resolveCollisionThenCell(player, pieceIndex, pos); return; }

    const newPos = this.rowColToPos(newRow, col);
    const p = this.state.players[player];
    p.pieces[pieceIndex] = newPos;
    this.emit('teleport', { player, pieceIndex, fromPos: pos, toPos: newPos });
    this.emit('stateChange', this.state);

    setTimeout(() => {
      if (newPos >= 39) {
        this.onMoveComplete(player, pieceIndex, newPos, newPos);
      } else if (CELL_TYPES[newPos] === 'teleport' && dir === 1) {
        this.checkCollision(player, pieceIndex, newPos, (skip) => {
          if (!skip) { this.doTeleport(player, pieceIndex, newPos); }
        });
      } else {
        this.resolveCollisionThenCell(player, pieceIndex, newPos);
      }
    }, 600);
  }

  checkCollision(moverPlayer, moverPiece, pos, callback) {
    if (pos === 0 || pos >= 39) { callback(false); return; }

    const otherPlayer = 1 - moverPlayer;
    const otherP = this.state.players[otherPlayer];
    const moverP = this.state.players[moverPlayer];

    const enemyPiecesHere = [];
    for (let i = 0; i < 2; i++) {
      if (!otherP.finished[i] && otherP.pieces[i] === pos) {
        enemyPiecesHere.push(i);
      }
    }

    if (enemyPiecesHere.length > 0) {
      if (this.hasItem(moverPlayer, 'immovable')) { callback(false); return; }
      const victim = otherPlayer;
      const attacker = moverPlayer;

      if (this.hasItem(victim, 'immovable')) {
        this.useItem(victim, 'immovable');
        this.emit('itemEffect', { player: victim, itemId: 'immovable', detail: '不动甲！反踢对方' });
        const { row, col } = this.posToRowCol(pos);
        const newRow = row - 1;
        const newPos = newRow < 0 ? 0 : this.rowColToPos(newRow, col);
        this.kickPiecesDown([{ player: attacker, index: moverPiece }], newPos, () => {
          callback(false);
        });
        return;
      }

      if (this.hasItem(victim, 'thornArmor')) {
        this.useItem(victim, 'thornArmor');
        this.emit('itemEffect', { player: victim, itemId: 'thornArmor', detail: '荆棘甲！对方失一件装备' });
        this.loseRandomEquip(attacker);
      }

      const { row, col } = this.posToRowCol(pos);
      const newRow = row - 1;
      const newPos = newRow < 0 ? 0 : this.rowColToPos(newRow, col);

      const pieces = enemyPiecesHere.map(i => ({ player: otherPlayer, index: i }));
      this.kickPiecesDown(pieces, newPos, () => {
        callback(false);
      });
      return;
    }

    let friendlyHere = false;
    for (let i = 0; i < 2; i++) {
      if (i !== moverPiece && !moverP.finished[i] && moverP.pieces[i] === pos) {
        friendlyHere = true;
        break;
      }
    }

    if (friendlyHere) {
      if (this.hasItem(moverPlayer, 'springArmor')) {
        this.useItem(moverPlayer, 'springArmor');
        this.emit('itemEffect', { player: moverPlayer, itemId: 'springArmor', detail: '弹簧甲！叠棋变上一层' });
        const { row } = this.posToRowCol(pos);
        if (row >= 4) { callback(false); return; }
        const newPos = this.sameColAbove(pos);
        moverP.pieces[moverPiece] = newPos;
        this.emit('pieceMoved', { player: moverPlayer, pieceIndex: moverPiece, fromPos: pos, toPos: newPos });
        this.emit('stateChange', this.state);
        setTimeout(() => {
          this.checkCollision(moverPlayer, moverPiece, newPos, (skip) => {
            if (skip) return;
            this.resolveCellEffect(moverPlayer, moverPiece, newPos);
          });
        }, 300);
        callback(true);
        return;
      }

      this.emit('stackBonus', { player: moverPlayer, pieceIndex: moverPiece, pos });
      this.state.phase = 'idle';
      this.state.diceValue = 0;
      this.state.rerollCount = 0;
      this.emit('stateChange', this.state);
      callback(true);
      return;
    }

    callback(false);
  }

  kickPiecesDown(pieces, targetPos, done) {
    if (targetPos === 0) {
      pieces.forEach(p => {
        const tp = this.state.players[p.player];
        if (!tp.finished[p.index]) tp.pieces[p.index] = targetPos;
      });
      this.emit('kicked', { pieces, toPos: targetPos });
      this.emit('stateChange', this.state);
      setTimeout(done, 400);
      return;
    }

    const existing = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const tp = this.state.players[pl];
        if (tp.finished[i]) continue;
        if (tp.pieces[i] !== targetPos) continue;
        if (!pieces.some(p => p.player === pl && p.index === i)) {
          existing.push({ player: pl, index: i });
        }
      }
    }

    pieces.forEach(p => {
      const tp = this.state.players[p.player];
      if (!tp.finished[p.index]) tp.pieces[p.index] = targetPos;
    });
    this.emit('kicked', { pieces, toPos: targetPos });
    this.emit('stateChange', this.state);

    if (existing.length === 0) {
      setTimeout(done, 400);
      return;
    }

    const { row, col } = this.posToRowCol(targetPos);
    const newRow = row - 1;
    const newPos = newRow < 0 ? 0 : this.rowColToPos(newRow, col);

    setTimeout(() => {
      this.kickPiecesDown(existing, newPos, done);
    }, 400);
  }

  endTurn() {
    if (this.state.extraTurn && this.state.extraTurn.player === this.state.currentPlayer && this.state.extraTurn.count > 0) {
      this.state.extraTurn.count -= 1;
      const remaining = this.state.extraTurn.count;
      if (remaining <= 0) this.state.extraTurn = null;
      this.state.rerollCount = 0;
      this.state.phase = 'idle';
      this.state.diceValue = 0;
      this.emit('extraTurn', { player: this.state.currentPlayer, remaining });
      this.emit('turnChange', this.state.currentPlayer);
      this.emit('stateChange', this.state);
      return;
    }

    let next = 1 - this.state.currentPlayer;
    const nextP = this.state.players[next];

    if (nextP.allDone) {
      this.state.rerollCount = 0;
      this.state.phase = 'idle';
      this.state.diceValue = 0;

      const curP = this.state.players[this.state.currentPlayer];
      if (!curP.allDone && this.state.endgame) {
        const penalty = Math.min(10, curP.score);
        curP.score -= penalty;
        this.emit('scoreChange', { player: this.state.currentPlayer, delta: -penalty, score: curP.score });
        this.emit('endgamePenalty', { player: this.state.currentPlayer, penalty });
      }

      this.emit('turnChange', this.state.currentPlayer);
      this.emit('stateChange', this.state);
      return;
    }

    this.state.currentPlayer = next;
    this.state.rerollCount = 0;
    this.state.phase = 'idle';
    this.state.diceValue = 0;

    const curP = this.state.players[next];
    if (!curP.allDone && this.state.endgame) {
      const penalty = Math.min(10, curP.score);
      curP.score -= penalty;
      this.emit('scoreChange', { player: next, delta: -penalty, score: curP.score });
      this.emit('endgamePenalty', { player: next, penalty });
    }

    this.emit('turnChange', this.state.currentPlayer);
    this.emit('stateChange', this.state);
  }

  raisePiecesUp(pieces, done) {
    pieces.forEach(p => {
      const newPos = this.sameColAbove(this.state.players[p.player].pieces[p.index]);
      if (newPos !== null) {
        this.state.players[p.player].pieces[p.index] = newPos;
      }
    });
    this.emit('piecesRaised', { pieces });
    this.emit('stateChange', this.state);
    this.collideForPieces(pieces, 0, done);
  }

  collideForPieces(pieces, idx, done) {
    if (idx >= pieces.length) { done(); return; }
    const p = pieces[idx];
    const pos = this.state.players[p.player].pieces[p.index];
    if (pos === 0 || pos >= 39) { this.collideForPieces(pieces, idx+1, done); return; }
    this.checkCollision(p.player, p.index, pos, () => {
      this.collideForPieces(pieces, idx + 1, done);
    });
  }

  processMultiDrop(pieces, idx, done) {
    if (idx >= pieces.length) { done(); return; }
    const { player, index } = pieces[idx];
    const fromPos = this.state.players[player].pieces[index];
    const targetPos = this.sameColBelow(fromPos);
    this.kickPiecesDown([{ player, index }], targetPos, () => {
      this.processMultiDrop(pieces, idx + 1, done);
    });
  }

  processEventMovers(movers, steps, triggerClothes, done) {
    const doNext = (i) => {
      if (i >= movers.length) { done(); return; }
      const m = movers[i];
      const fromPos = this.state.players[m.player].pieces[m.index];
      const toPos = Math.min(39, fromPos + steps);
      if (toPos === fromPos || this.state.players[m.player].finished[m.index]) {
        doNext(i + 1); return;
      }
      const fromRow = this.getRow(fromPos);
      const toRow = this.getRow(toPos);
      const p = this.state.players[m.player];
      const onClothes = this.equipCount(m.player);

      const afterMove = () => {
        this.state.players[m.player].pieces[m.index] = toPos;
        this.emit('pieceMoved', { player: m.player, pieceIndex: m.index, fromPos, toPos });
        this.emit('stateChange', this.state);
        if (toPos >= 39) {
          this.state.players[m.player].finished[m.index] = true;
          this.emit('pieceFinished', { player: m.player, pieceIndex: m.index });
          doNext(i + 1);
          return;
        }
        this.checkCollision(m.player, m.index, toPos, () => {
          doNext(i + 1);
        });
      };

      if (triggerClothes && toRow > fromRow && onClothes > 0) {
        if (this.hasItem(m.player, 'freeClothes')) {
          this.useItem(m.player, 'freeClothes');
          p.skipClothesStreak = 0;
          this.emit('itemEffect', { player: m.player, itemId: 'freeClothes', detail: '免脱卡生效' });
          afterMove();
        } else {
          this.state.phase = 'clothesChoice';
          this.pendingCellResolve = {
            player: m.player, pieceIndex: m.index, pos: toPos,
            afterResolve: () => {
              this.state.players[m.player].pieces[m.index] = toPos;
              if (toPos >= 39) {
                this.state.players[m.player].finished[m.index] = true;
                this.emit('pieceFinished', { player: m.player, pieceIndex: m.index });
                doNext(i + 1);
                return;
              }
              this.checkCollision(m.player, m.index, toPos, () => {
                doNext(i + 1);
              });
            }
          };
          this.state.players[m.player].pieces[m.index] = fromPos;
          this.emit('showClothesChoice', {
            player: m.player, pieceIndex: m.index, pos: toPos,
            price: this.getSkipClothesPrice(m.player),
            canAfford: p.score >= this.getSkipClothesPrice(m.player)
          });
          this.emit('stateChange', this.state);
          return;
        }
      } else {
        afterMove();
      }
    };
    doNext(0);
    this.emit('stateChange', this.state);
  }

  // ===== 事件效果 =====
  triggerEventEffect(event, ctx) {
    const { player, pieceIndex, pos } = ctx;
    const effectName = EVENT_EFFECTS[event.id];
    const effect = this[effectName];
    if (!effect) { ctx.onDone && ctx.onDone(); return; }
    const enemy = 1 - player;
    if (this.hasItem(enemy, 'financeTrap') && CELL_TYPES[pos] === 'event') {
      this.useItem(enemy, 'financeTrap');
      this.emit('itemEffect', { player: enemy, itemId: 'financeTrap', detail: '触发金融陷阱！' });
      this.eventEffect_financeTrap(player, ctx);
      return;
    }
    effect.call(this, player, pieceIndex, pos, ctx);
  }

  eventEffect_redPacket(player, pieceIndex, pos, ctx) {
    for (let pl = 0; pl < 2; pl++) {
      this.state.players[pl].score += 8;
      this.emit('scoreChange', { player: pl, delta: 8, score: this.state.players[pl].score });
    }
    this.emit('eventEffect', { event: 'redPacket', detail: '双方各+8积分' });
    ctx.onDone();
  }

  eventEffect_incomeTax(player, pieceIndex, pos, ctx) {
    for (let pl = 0; pl < 2; pl++) {
      const p = this.state.players[pl];
      const tax = Math.floor(p.score / 10);
      if (tax > 0) {
        p.score -= tax;
        this.emit('scoreChange', { player: pl, delta: -tax, score: p.score });
      }
    }
    this.emit('eventEffect', { event: 'incomeTax', detail: '缴纳个人所得税' });
    ctx.onDone();
  }

  eventEffect_robHood(player, pieceIndex, pos, ctx) {
    const s0 = this.state.players[0].score;
    const s1 = this.state.players[1].score;
    if (s0 === s1) {
      this.emit('eventEffect', { event: 'robHood', detail: '平分，无事发生' });
      ctx.onDone(); return;
    }
    const rich = s0 > s1 ? 0 : 1;
    const poor = 1 - rich;
    const amount = Math.min(3, this.state.players[rich].score);
    this.state.players[rich].score -= amount;
    this.state.players[poor].score += amount;
    this.emit('scoreChange', { player: rich, delta: -amount, score: this.state.players[rich].score });
    this.emit('scoreChange', { player: poor, delta: amount, score: this.state.players[poor].score });
    this.emit('eventEffect', { event: 'robHood', detail: `玩家${rich+1}给玩家${poor+1} ${amount}积分` });
    ctx.onDone();
  }

  eventEffect_povertyRelief(player, pieceIndex, pos, ctx) {
    const s0 = this.state.players[0].score;
    const s1 = this.state.players[1].score;
    if (s0 === s1) {
      for (let pl = 0; pl < 2; pl++) {
        this.state.players[pl].score += 6;
        this.emit('scoreChange', { player: pl, delta: 6, score: this.state.players[pl].score });
      }
      this.emit('eventEffect', { event: 'povertyRelief', detail: '平分，双方各+6' });
    } else {
      const poor = s0 < s1 ? 0 : 1;
      this.state.players[poor].score += 6;
      this.emit('scoreChange', { player: poor, delta: 6, score: this.state.players[poor].score });
      this.emit('eventEffect', { event: 'povertyRelief', detail: `玩家${poor+1}获得6积分` });
    }
    ctx.onDone();
  }

  eventEffect_disasterRelief(player, pieceIndex, pos, ctx) {
    const e0 = this.equipCount(0);
    const e1 = this.equipCount(1);
    if (e0 === e1) {
      for (let pl = 0; pl < 2; pl++) {
        this.state.players[pl].score += 6;
        this.emit('scoreChange', { player: pl, delta: 6, score: this.state.players[pl].score });
      }
      this.emit('eventEffect', { event: 'disasterRelief', detail: '装备数相同，双方各+6' });
    } else {
      const poor = e0 < e1 ? 0 : 1;
      this.state.players[poor].score += 6;
      this.emit('scoreChange', { player: poor, delta: 6, score: this.state.players[poor].score });
      this.emit('eventEffect', { event: 'disasterRelief', detail: `玩家${poor+1}装备少，+6积分` });
    }
    ctx.onDone();
  }

  eventEffect_woodShow(player, pieceIndex, pos, ctx) {
    let maxRow = -1;
    const candidates = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        const row = this.getRow(p.pieces[i]);
        if (row === 0) continue;
        if (row > maxRow) { maxRow = row; candidates.length = 0; candidates.push({player: pl, index: i}); }
        else if (row === maxRow) { candidates.push({player: pl, index: i}); }
      }
    }
    if (candidates.length === 0) {
      this.emit('eventEffect', { event: 'woodShow', detail: '无事发生' });
      ctx.onDone(); return;
    }
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const targetPos = this.sameColBelow(this.state.players[chosen.player].pieces[chosen.index]);
    this.kickPiecesDown([chosen], targetPos, () => {
      this.emit('eventEffect', { event: 'woodShow', detail: `最高层棋子落一层` });
      ctx.onDone();
    });
  }

  eventEffect_soaring(player, pieceIndex, pos, ctx) {
    let minRow = 99;
    const candidates = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        const row = this.getRow(p.pieces[i]);
        if (row >= 4) continue;
        if (row < minRow) { minRow = row; candidates.length = 0; candidates.push({player: pl, index: i}); }
        else if (row === minRow) { candidates.push({player: pl, index: i}); }
      }
    }
    if (candidates.length === 0) {
      this.emit('eventEffect', { event: 'soaring', detail: '无事发生' });
      ctx.onDone(); return;
    }
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.raisePiecesUp([chosen], () => {
      this.emit('eventEffect', { event: 'soaring', detail: `最低层棋子上一层` });
      ctx.onDone();
    });
  }

  eventEffect_earthquake(player, pieceIndex, pos, ctx) {
    const toDrop = [];
    for (let pl = 0; pl < 2; pl++) {
      const choices = [];
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        const row = this.getRow(p.pieces[i]);
        if (row > 0) choices.push(i);
      }
      if (choices.length > 0) {
        const idx = choices[Math.floor(Math.random() * choices.length)];
        toDrop.push({ player: pl, index: idx });
      }
    }
    if (toDrop.length === 0) { ctx.onDone(); return; }
    this.processMultiDrop(toDrop, 0, () => {
      this.emit('eventEffect', { event: 'earthquake', detail: '地震！棋子落一层' });
      ctx.onDone();
    });
  }

  eventEffect_bigWind(player, pieceIndex, pos, ctx) {
    const toTeleport = [];
    for (let pl = 0; pl < 2; pl++) {
      const choices = [];
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        choices.push(i);
      }
      if (choices.length > 0) {
        toTeleport.push({ player: pl, index: choices[Math.floor(Math.random() * choices.length)] });
      }
    }
    const doNext = (i) => {
      if (i >= toTeleport.length) {
        this.emit('eventEffect', { event: 'bigWind', detail: '大风吹！棋子被吹走' });
        this.emit('stateChange', this.state);
        this.collideForPieces(toTeleport, 0, () => ctx.onDone());
        return;
      }
      const { player: pl, index: idx } = toTeleport[i];
      const curPos = this.state.players[pl].pieces[idx];
      const row = this.getRow(curPos);
      const rowStart = row * 8;
      const empty = [];
      for (let c = 0; c < 8; c++) {
        const cp = rowStart + c;
        if (cp === curPos) continue;
        if (this.piecesAtPos(cp).length === 0) empty.push(cp);
      }
      if (empty.length > 0) {
        const newPos = empty[Math.floor(Math.random() * empty.length)];
        this.state.players[pl].pieces[idx] = newPos;
      }
      doNext(i + 1);
    };
    doNext(0);
  }

  eventEffect_ghostWall(player, pieceIndex, pos, ctx) {
    const movers = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        if (p.pieces[i] === 0) continue;
        movers.push({ player: pl, index: i, fromPos: p.pieces[i] });
      }
    }
    const beforeCounts = {};
    movers.forEach(m => { beforeCounts[m.fromPos] = (beforeCounts[m.fromPos]||0) + 1; });
    movers.forEach(m => {
      const newPos = Math.max(0, m.fromPos - 1);
      this.state.players[m.player].pieces[m.index] = newPos;
      m.toPos = newPos;
    });
    const needCollision = movers.filter(m => {
      const sameBefore = beforeCounts[m.fromPos] >= 2;
      const afterSame = movers.filter(x => x !== m && x.toPos === m.toPos).length >= 1;
      return !(sameBefore && afterSame);
    });
    this.emit('piecesRetreated', { pieces: movers });
    this.emit('stateChange', this.state);
    this.collideForPieces(needCollision.map(m => ({player: m.player, index: m.index})), 0, () => {
      this.emit('eventEffect', { event: 'ghostWall', detail: '鬼打墙！棋子后退1格' });
      ctx.onDone();
    });
  }

  eventEffect_hitchhike(player, pieceIndex, pos, ctx) {
    const movers = [];
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        if (p.pieces[i] === 0) continue;
        if (p.pieces[i] >= 39) continue;
        movers.push({ player: pl, index: i, fromPos: p.pieces[i] });
      }
    }
    this.processEventMovers(movers, 2, true, () => {
      this.emit('eventEffect', { event: 'hitchhike', detail: '顺风车！棋子前进2格' });
      ctx.onDone();
    });
  }

  eventEffect_lookBehind(player, pieceIndex, pos, ctx) {
    let minDist = 999;
    let targetIdx = -1;
    let targetPlayer = -1;
    for (let pl = 0; pl < 2; pl++) {
      for (let i = 0; i < 2; i++) {
        if (pl === player && i === pieceIndex) continue;
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        const dist = Math.abs(p.pieces[i] - pos);
        if (dist < minDist || (dist === minDist && p.pieces[i] > (targetIdx >= 0 ? this.state.players[targetPlayer].pieces[targetIdx] : -1))) {
          minDist = dist; targetIdx = i; targetPlayer = pl;
        }
      }
    }
    if (targetIdx < 0) { ctx.onDone(); return; }
    const targetPos = Math.max(0, this.state.players[targetPlayer].pieces[targetIdx] - 1);
    this.state.players[player].pieces[pieceIndex] = targetPos;
    this.emit('pieceMoved', { player, pieceIndex, fromPos: pos, toPos: targetPos });
    this.emit('stateChange', this.state);
    this.checkCollision(player, pieceIndex, targetPos, () => {
      this.emit('eventEffect', { event: 'lookBehind', detail: '传送到最近棋子身后' });
      ctx.onDone();
    });
  }

  eventEffect_forward(player, pieceIndex, pos, ctx) {
    const movers = [{ player, index: pieceIndex, fromPos: pos }];
    this.processEventMovers(movers, 3, true, () => {
      this.emit('eventEffect', { event: 'forward', detail: '勇往直前！前进3格' });
      ctx.onDone();
    });
  }

  eventEffect_shopFrenzy(player, pieceIndex, pos, ctx) {
    const row = this.getRow(pos);
    const shopPos = [];
    for (let c = 0; c < 8; c++) {
      const cp = row * 8 + c;
      if (CELL_TYPES[cp] === 'shop') shopPos.push(cp);
    }
    if (shopPos.length === 0) { ctx.onDone(); return; }
    const target = shopPos[Math.floor(Math.random() * shopPos.length)];
    this.state.players[player].pieces[pieceIndex] = target;
    this.emit('pieceMoved', { player, pieceIndex, fromPos: pos, toPos: target });
    this.emit('stateChange', this.state);
    this.emit('eventEffect', { event: 'shopFrenzy', detail: '购物狂热！传送至商店' });
    this.checkCollision(player, pieceIndex, target, (skip) => {
      if (skip) { ctx.onDone(); return; }
      this.openShop(player);
      this.pendingCellResolve = { player, pieceIndex, pos: target, afterResolve: () => ctx.onDone() };
    });
  }

  eventEffect_taskFrenzy(player, pieceIndex, pos, ctx) {
    const row = this.getRow(pos);
    const taskPos = [];
    for (let c = 0; c < 8; c++) {
      const cp = row * 8 + c;
      if (CELL_TYPES[cp] === 'task') taskPos.push(cp);
    }
    if (taskPos.length === 0) {
      this.emit('eventEffect', { event: 'taskFrenzy', detail: '本层无任务格' });
      ctx.onDone(); return;
    }
    const target = taskPos[Math.floor(Math.random() * taskPos.length)];
    this.state.players[player].pieces[pieceIndex] = target;
    this.emit('pieceMoved', { player, pieceIndex, fromPos: pos, toPos: target });
    this.emit('stateChange', this.state);
    this.emit('eventEffect', { event: 'taskFrenzy', detail: '任务狂热！传送至任务格' });
    this.checkCollision(player, pieceIndex, target, (skip) => {
      if (skip) { ctx.onDone(); return; }
      const tfTask1 = this.drawLowTierTask();
      const tfTask2 = this.drawHighTierTask();
      this.currentTasks = [tfTask1, tfTask2].filter(Boolean);
      this.emit('showTask', { player, tasks: this.currentTasks });
      this.pendingCellResolve = { player, pieceIndex, pos: target, afterResolve: () => ctx.onDone() };
    });
  }

  eventEffect_forcedBuy(player, pieceIndex, pos, ctx) {
    const p = this.state.players[player];
    const cost = Math.min(15, p.score);
    p.score -= cost;
    this.emit('scoreChange', { player, delta: -cost, score: p.score });
    const restored = this.restoreRandomEquip(player);
    this.emit('eventEffect', { event: 'forcedBuy', detail: restored ? `花${cost}分恢复${restored}` : `花${cost}分但装备已满` });
    ctx.onDone();
  }

  eventEffect_smashPot(player, pieceIndex, pos, ctx) {
    const hadEquip = this.loseRandomEquip(player, { fromEvent: true }) !== null;
    const p = this.state.players[player];
    p.score += 20;
    this.emit('scoreChange', { player, delta: 20, score: p.score });
    this.emit('eventEffect', { event: 'smashPot', detail: hadEquip ? '卖了一件装备得20分' : '无装备可卖，仍得20分' });
    ctx.onDone();
  }

  eventEffect_nakedRun(player, pieceIndex, pos, ctx) {
    const lost = this.loseRandomEquip(player, { fromEvent: true });
    const fromPos = this.state.players[player].pieces[pieceIndex];
    const toPos = Math.min(39, fromPos + 8);
    this.state.players[player].pieces[pieceIndex] = toPos;
    this.emit('pieceMoved', { player, pieceIndex, fromPos, toPos });
    this.emit('stateChange', this.state);
    const p = this.state.players[player];
    if (toPos >= 39) {
      p.finished[pieceIndex] = true;
      this.emit('pieceFinished', { player, pieceIndex });
      this.emit('eventEffect', { event: 'nakedRun', detail: '裸体狂奔冲到终点！' });
      ctx.onDone(); return;
    }
    this.checkCollision(player, pieceIndex, toPos, () => {
      this.emit('eventEffect', { event: 'nakedRun', detail: `裸体狂奔！${lost ? '失去一件装备，' : ''}前进8格` });
      ctx.onDone();
    });
  }

  eventEffect_philanthropist(player, pieceIndex, pos, ctx) {
    const e0 = this.equipCount(0);
    const e1 = this.equipCount(1);
    if (e0 === e1) {
      this.emit('eventEffect', { event: 'philanthropist', detail: '装备数相同，无事' });
      ctx.onDone(); return;
    }
    const giver = e0 > e1 ? 0 : 1;
    const receiver = 1 - giver;
    const giveable = [];
    this.state.players[giver].equipment.forEach(eq => {
      if (eq.on) {
        const recEq = this.state.players[receiver].equipment.find(e => e.id === eq.id);
        if (recEq && !recEq.on) giveable.push(eq.id);
      }
    });
    if (giveable.length === 0) {
      this.emit('eventEffect', { event: 'philanthropist', detail: '无可赠送装备' });
      ctx.onDone(); return;
    }
    const giveId = giveable[Math.floor(Math.random() * giveable.length)];
    const gEq = this.state.players[giver].equipment.find(e => e.id === giveId);
    const rEq = this.state.players[receiver].equipment.find(e => e.id === giveId);
    gEq.on = false;
    rEq.on = true;
    this.emit('equipmentChange', { player: giver, action: 'give', equipId: giveId });
    this.emit('equipmentChange', { player: receiver, action: 'receive', equipId: giveId });

    const choices = [];
    for (let i = 0; i < 2; i++) {
      if (this.state.players[giver].finished[i]) continue;
      const row = this.getRow(this.state.players[giver].pieces[i]);
      if (row < 4) choices.push(i);
    }
    if (choices.length > 0) {
      const idx = choices[Math.floor(Math.random() * choices.length)];
      this.raisePiecesUp([{player: giver, index: idx}], () => {
        this.emit('eventEffect', { event: 'philanthropist', detail: `玩家${giver+1}赠送${giveId}并上一层` });
        ctx.onDone();
      });
    } else {
      this.emit('eventEffect', { event: 'philanthropist', detail: `玩家${giver+1}赠送${giveId}` });
      ctx.onDone();
    }
  }

  eventEffect_giftClothes(player, pieceIndex, pos, ctx) {
    const e0 = this.equipCount(0);
    const e1 = this.equipCount(1);
    if (e0 === e1) {
      this.restoreRandomEquip(0);
      this.restoreRandomEquip(1);
      this.emit('eventEffect', { event: 'giftClothes', detail: '装备数相同，双方各恢复一件' });
    } else {
      const poor = e0 < e1 ? 0 : 1;
      this.restoreRandomEquip(poor);
      this.emit('eventEffect', { event: 'giftClothes', detail: `玩家${poor+1}恢复一件装备` });
    }
    ctx.onDone();
  }

  eventEffect_thornStorm(player, pieceIndex, pos, ctx) {
    this.loseRandomEquip(0, { fromEvent: true });
    this.loseRandomEquip(1, { fromEvent: true });
    this.emit('eventEffect', { event: 'thornStorm', detail: '荆棘风暴！双方各失一件装备' });
    ctx.onDone();
  }

  eventEffect_perfectOutfit(player, pieceIndex, pos, ctx) {
    this.restoreRandomEquip(0);
    this.restoreRandomEquip(1);
    this.emit('eventEffect', { event: 'perfectOutfit', detail: '天衣无缝！双方各恢复一件装备' });
    ctx.onDone();
  }

  eventEffect_sloppy(player, pieceIndex, pos, ctx) {
    for (let pl = 0; pl < 2; pl++) {
      const p = this.state.players[pl];
      const onList = p.equipment.filter(e => e.on);
      const offList = p.equipment.filter(e => !e.on);
      if (onList.length > 0 && offList.length > 0) {
        const lose = onList[Math.floor(Math.random() * onList.length)];
        let gain = offList[Math.floor(Math.random() * offList.length)];
        lose.on = false;
        gain.on = true;
        this.emit('equipmentChange', { player: pl, action: 'swap', from: lose.id, to: gain.id });
      }
    }
    this.emit('eventEffect', { event: 'sloppy', detail: '衣冠不整！装备被替换' });
    ctx.onDone();
  }

  eventEffect_godRewards(player, pieceIndex, pos, ctx) {
    this.loseRandomEquip(player, { fromEvent: true });
    const grTask = this.drawHighTierTask();
    this.currentTasks = grTask ? [grTask] : [];
    this.godRewardsPending = { player, pieceIndex, pos };
    this.emit('showTask', { player, tasks: this.currentTasks, label: '天道酬勤' });
    this.pendingCellResolve = { player, pieceIndex, pos, afterResolve: () => {
      this.restoreRandomEquip(player);
      this.restoreRandomEquip(player);
      this.emit('eventEffect', { event: 'godRewards', detail: '完成任务，恢复两件装备' });
      this.godRewardsPending = null;
      ctx.onDone();
    }};
  }

  eventEffect_myTurn(player, pieceIndex, pos, ctx) {
    const p = this.state.players[player];
    const cost = Math.min(3, p.score);
    p.score -= cost;
    this.emit('scoreChange', { player, delta: -cost, score: p.score });
    if (this.state.extraTurn && this.state.extraTurn.player === player) {
      this.state.extraTurn.count += 1;
    } else {
      this.state.extraTurn = { player, count: 1 };
    }
    this.emit('eventEffect', { event: 'myTurn', detail: `花费${cost}分，获得额外回合` });
    ctx.onDone();
  }

  eventEffect_teleportMagic(player, pieceIndex, pos, ctx) {
    const toRaise = [];
    for (let pl = 0; pl < 2; pl++) {
      const choices = [];
      for (let i = 0; i < 2; i++) {
        const p = this.state.players[pl];
        if (p.finished[i]) continue;
        const row = this.getRow(p.pieces[i]);
        if (row < 4) choices.push(i);
      }
      if (choices.length > 0) {
        toRaise.push({ player: pl, index: choices[Math.floor(Math.random() * choices.length)] });
      }
    }
    if (toRaise.length === 0) {
      this.emit('eventEffect', { event: 'teleportMagic', detail: '无事发生' });
      ctx.onDone(); return;
    }
    this.raisePiecesUp(toRaise, () => {
      this.emit('eventEffect', { event: 'teleportMagic', detail: '传送魔法！棋子上升一层' });
      ctx.onDone();
    });
  }

  eventEffect_gearUp(player, pieceIndex, pos, ctx) {
    const p = this.state.players[player];
    const restored = this.restoreRandomEquip(player);
    const enemy = 1 - player;
    if (this.state.extraTurn && this.state.extraTurn.player === enemy) {
      this.state.extraTurn.count += 2;
    } else {
      this.state.extraTurn = { player: enemy, count: 2 };
    }
    this.emit('eventEffect', {
      event: 'gearUp',
      detail: restored ? `恢复${restored}，对方获得2个额外回合` : `装备已满，对方获得2个额外回合`
    });
    ctx.onDone();
  }

  eventEffect_emptyTask(player, pieceIndex, pos, ctx) {
    const p = this.state.players[player];
    const offCount = p.equipment.filter(e => !e.on).length;
    const reward = offCount * 2;
    p.score += reward;
    this.emit('scoreChange', { player, delta: reward, score: p.score });
    this.emit('eventEffect', { event: 'emptyTask', detail: `空任务！获得${reward}积分（脱${offCount}件×2）` });
    ctx.onDone();
  }

  eventEffect_stockTrade(player, pieceIndex, pos, ctx) {
    const p = this.state.players[player];
    const delta = Math.floor(Math.random() * 11) - 4;
    let actualDelta = delta;
    if (delta < 0) {
      const loss = Math.min(-delta, p.score);
      p.score -= loss;
      actualDelta = -loss;
    } else {
      p.score += delta;
    }
    this.emit('scoreChange', { player, delta: actualDelta, score: p.score });
    const desc = delta >= 0 ? `炒股！赚了${delta}积分` : `炒股！亏了${-actualDelta}积分`;
    this.emit('eventEffect', { event: 'stockTrade', detail: desc });
    ctx.onDone();
  }

  eventEffect_amnesia(player, pieceIndex, pos, ctx) {
    for (let pl = 0; pl < 2; pl++) {
      this.state.players[pl].skipClothesStreak = 0;
    }
    this.emit('eventEffect', { event: 'amnesia', detail: '瞬间失忆！免脱累计价格重置' });
    this.emit('stateChange', this.state);
    ctx.onDone();
  }

  eventEffect_financeTrap(victimPlayer, ctx) {
    const p = this.state.players[victimPlayer];
    if (p.score >= 18) {
      p.score -= 18;
      this.emit('scoreChange', { player: victimPlayer, delta: -18, score: p.score });
      this.emit('eventEffect', { event: 'financeTrap', detail: `金融陷阱！失去18积分` });
    } else {
      const lost = this.loseRandomEquip(victimPlayer, { fromEvent: true });
      p.score = 0;
      this.emit('scoreChange', { player: victimPlayer, delta: -p.score, score: 0 });
      this.emit('eventEffect', { event: 'financeTrap', detail: `金融陷阱！积分清零${lost ? '并失去一件装备' : ''}` });
    }
    ctx.onDone();
  }

  openShop(player) {
    const p = this.state.players[player];
    const enemy = 1 - player;

    const hasRestock = this.hasItem(player, 'restockCard');
    const equipCount = hasRestock ? 2 : 1;
    const normalCount = hasRestock ? 6 : 4;

    const equipShuffled = this.shuffleArray([...EQUIPMENT_ITEMS]);
    const equipItems = equipShuffled.slice(0, equipCount).map(eq => {
      const playerEq = p.equipment.find(e => e.id === eq.id);
      const owned = playerEq ? playerEq.on : false;
      let price = 10 + Math.floor(Math.random() * 6);
      if (this.hasItem(player, 'vipCard')) price = Math.floor(price / 2);
      if (this.hasItem(enemy, 'capitalCard')) price += 5;
      return {
        id: 'equip_' + eq.id,
        type: 'equipment',
        equipId: eq.id,
        name: eq.name,
        icon: eq.icon,
        desc: eq.desc,
        price,
        owned,
        purchased: false
      };
    });

    const available = Object.values(ITEM_DEFS).filter(item => !p.inventory[item.id]);
    const normalShuffled = this.shuffleArray(available);
    const normalItems = normalShuffled.slice(0, normalCount).map(item => {
      let price = item.price;
      if (this.hasItem(player, 'vipCard')) price = Math.floor(price / 2);
      if (this.hasItem(enemy, 'capitalCard')) price += 5;
      return {
        id: 'normal_' + item.id,
        type: 'normal',
        itemId: item.id,
        name: item.name,
        icon: item.icon,
        desc: item.desc,
        price,
        purchased: false
      };
    });

    this.shopItems = [...equipItems, ...normalItems];

    if (hasRestock) {
      this.useItem(player, 'restockCard');
      this.emit('itemEffect', { player, itemId: 'restockCard', detail: '补货卡生效！2件装备+6件普通商品' });
    }
    if (this.hasItem(enemy, 'capitalCard')) {
      this.useItem(enemy, 'capitalCard');
      this.emit('itemEffect', { player: enemy, itemId: 'capitalCard', detail: '资本卡生效！对方商品价格+5' });
    }
    if (this.hasItem(player, 'vipCard')) {
      this.useItem(player, 'vipCard');
      this.emit('itemEffect', { player, itemId: 'vipCard', detail: '会员卡生效！全场五折' });
    }

    this.emit('showShop', { player, items: this.shopItems, score: p.score });
  }

  buyItem(itemId) {
    const item = this.shopItems.find(i => i.id === itemId);
    if (!item || item.purchased) return;
    const p = this.state.players[this.state.currentPlayer];
    if (p.score < item.price) return;

    if (item.type === 'equipment' && item.owned) return;
    if (item.type === 'normal' && p.inventory[item.itemId]) return;

    p.score -= item.price;
    item.purchased = true;

    if (item.type === 'equipment') {
      const eq = p.equipment.find(e => e.id === item.equipId);
      if (eq) { eq.on = true; item.owned = true; }
    } else if (item.type === 'normal') {
      this.addItem(this.state.currentPlayer, item.itemId);
    }

    this.emit('scoreChange', { player: this.state.currentPlayer, delta: -item.price, score: p.score });
    this.emit('itemPurchased', { item });
    this.emit('stateChange', this.state);
  }

  closeShop() {
    this.emit('hideShop');
    this.finishCellResolve();
  }
}

// ============================================================
//  房间管理
// ============================================================
class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [null, null];
    this.engine = null;
    this.started = false;
  }

  addPlayer(ws) {
    if (this.players[0] === null) {
      this.players[0] = ws;
      return 0;
    } else if (this.players[1] === null) {
      this.players[1] = ws;
      return 1;
    }
    return -1;
  }

  removePlayer(ws) {
    for (let i = 0; i < 2; i++) {
      if (this.players[i] === ws) {
        this.players[i] = null;
        return i;
      }
    }
    return -1;
  }

  get playerCount() {
    return this.players.filter(p => p !== null).length;
  }

  isFull() {
    return this.players[0] !== null && this.players[1] !== null;
  }

  sendToAll(type, data) {
    const msg = JSON.stringify({ type, data });
    this.players.forEach(p => {
      if (p && p.readyState === 1) p.send(msg);
    });
  }

  sendToPlayer(playerIndex, type, data) {
    const p = this.players[playerIndex];
    if (p && p.readyState === 1) {
      p.send(JSON.stringify({ type, data }));
    }
  }

  broadcastGameEvent(event, data) {
    this.sendToAll('gameEvent', { event, data });
  }

  startGame(taskList) {
    if (this.started) return;
    this.started = true;
    const tasks = parseTasks(taskList);
    this.engine = new GameEngine(tasks);

    // 公开事件：双方都能看到
    const publicEvents = [
      'stateChange', 'diceRoll', 'selectPiece', 'autoSelectPiece', 'pieceMove',
      'pieceFinished', 'showTask', 'taskSelected', 'hideTask', 'showEvent', 'hideEvent',
      'scoreChange', 'teleport', 'kicked', 'stackBonus',
      'equipmentChange', 'inventoryChange', 'itemEffect', 'eventEffect',
      'extraTurn', 'showRerollChoice', 'endgamePenalty', 'turnChange',
      'victory', 'piecesRaised', 'piecesRetreated', 'pieceMoved'
    ];
    // 私密事件：仅操作玩家可见
    const privateEvents = ['showShop', 'hideShop', 'itemPurchased', 'showClothesChoice', 'hideClothesChoice'];

    publicEvents.forEach(evt => {
      this.engine.on(evt, (data) => this.broadcastGameEvent(evt, data));
    });
    privateEvents.forEach(evt => {
      this.engine.on(evt, (data) => {
        this.sendGameEventTo(this.engine.state.currentPlayer, evt, data);
      });
    });

    this.sendToAll('gameStart', {});
    this.broadcastGameEvent('stateChange', this.engine.state);
    this.broadcastGameEvent('turnChange', this.engine.state.currentPlayer);
  }

  sendGameEventTo(playerIndex, event, data) {
    this.sendToPlayer(playerIndex, 'gameEvent', { event, data });
  }
}

const rooms = new Map();

function generateRoomId() {
  let id;
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(id));
  return id;
}

// ============================================================
//  WebSocket 处理
// ============================================================
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.roomId = null;
    ws.playerIndex = -1;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch (e) {
        console.error('Invalid message:', e);
      }
    });

    ws.on('close', () => {
      if (ws.roomId && rooms.has(ws.roomId)) {
        const room = rooms.get(ws.roomId);
        const idx = room.removePlayer(ws);
        if (room.started) {
          room.sendToAll('opponentDisconnected', {});
        } else {
          if (idx === 0 && room.players[1]) {
            room.players[1].send(JSON.stringify({ type: 'roomLeft' }));
          } else if (idx === 1) {
            room.sendToPlayer(0, 'playerLeft', {});
          }
        }
        if (room.playerCount === 0) {
          rooms.delete(ws.roomId);
        }
      }
    });
  });

  function handleMessage(ws, msg) {
    const { type, data } = msg;

    switch (type) {
      case 'createRoom':
        handleCreateRoom(ws);
        break;
      case 'joinRoom':
        handleJoinRoom(ws, data?.roomId);
        break;
      case 'leaveRoom':
        handleLeaveRoom(ws);
        break;
      case 'startGame':
        handleStartGame(ws, data);
        break;
      case 'gameAction':
        handleGameAction(ws, data);
        break;
    }
  }

  function handleCreateRoom(ws) {
    const roomId = generateRoomId();
    const room = new Room(roomId);
    const idx = room.addPlayer(ws);
    ws.roomId = roomId;
    ws.playerIndex = idx;
    rooms.set(roomId, room);
    ws.send(JSON.stringify({
      type: 'roomCreated',
      data: { roomId, playerIndex: idx, isHost: idx === 0 }
    }));
  }

  function handleJoinRoom(ws, roomId) {
    if (!roomId || !rooms.has(roomId)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
      return;
    }
    const room = rooms.get(roomId);
    if (room.isFull()) {
      ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
      return;
    }
    const idx = room.addPlayer(ws);
    ws.roomId = roomId;
    ws.playerIndex = idx;
    ws.send(JSON.stringify({
      type: 'roomJoined',
      data: { roomId, playerIndex: idx, isHost: idx === 0 }
    }));
    room.sendToPlayer(0, 'playerJoined', { playerIndex: idx });
  }

  function handleLeaveRoom(ws) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    const room = rooms.get(ws.roomId);
    room.removePlayer(ws);
    ws.roomId = null;
    ws.playerIndex = -1;
    ws.send(JSON.stringify({ type: 'roomLeft' }));
    if (room.playerCount === 0) {
      rooms.delete(room.roomId);
    }
  }

  function handleStartGame(ws, data) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    const room = rooms.get(ws.roomId);
    if (ws.playerIndex !== 0) return;
    if (!room.isFull()) return;
    room.startGame(data?.tasks);
  }

  function handleGameAction(ws, data) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    const room = rooms.get(ws.roomId);
    if (!room.engine || !room.started) return;

    const { action, payload } = data || {};
    const engine = room.engine;
    const state = engine.state;

    const selfActions = [
      'rollDice', 'rerollDice', 'movePiece', 'selectTask',
      'closeEvent', 'takeOffEquipment', 'buySkipClothes',
      'buyItem', 'closeShop', 'diceAnimEnd', 'moveAnimEnd'
    ];

    if (selfActions.includes(action) && state.currentPlayer !== ws.playerIndex) {
      ws.send(JSON.stringify({ type: 'actionRejected', data: { reason: 'not your turn', action } }));
      return;
    }

    switch (action) {
      case 'rollDice':
        engine.rollDice();
        break;
      case 'rerollDice':
        engine.rerollDice();
        break;
      case 'diceAnimEnd':
        engine.onDiceAnimEnd();
        break;
      case 'movePiece':
        engine.movePiece(payload?.pieceIndex);
        break;
      case 'moveAnimEnd':
        engine.onMoveComplete(ws.playerIndex, payload?.pieceIndex, payload?.fromPos, payload?.toPos);
        break;
      case 'selectTask':
        engine.selectTask(payload?.taskIndex);
        break;
      case 'closeEvent':
        engine.closeEvent();
        break;
      case 'takeOffEquipment':
        engine.takeOffEquipment(ws.playerIndex, payload?.pieceIndex, payload?.pos, payload?.equipIndex);
        break;
      case 'buySkipClothes':
        engine.buySkipClothes(ws.playerIndex, payload?.pieceIndex, payload?.pos);
        break;
      case 'buyItem':
        engine.buyItem(payload?.itemId);
        break;
      case 'closeShop':
        engine.closeShop();
        break;
    }
  }
}

// ============================================================
//  HTTP 静态文件服务
// ============================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8'
};

function resolveStaticPath(urlPath) {
  const distPath = join(__dirname, 'dist', urlPath);
  if (existsSync(distPath) && statSync(distPath).isFile()) return distPath;
  const srcPath = join(__dirname, 'src', urlPath);
  if (existsSync(srcPath) && statSync(srcPath).isFile()) return srcPath;
  return null;
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const normalized = normalize(urlPath);
  if (normalized.startsWith('..') || normalized.startsWith(sep + '..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = resolveStaticPath(urlPath);
  if (!filePath) {
    if (!urlPath.startsWith('/api/') && !urlPath.startsWith('/ws')) {
      const indexPath = resolveStaticPath('/index.html');
      if (indexPath) {
        const content = readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        return;
      }
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

// ============================================================
//  启动服务器
// ============================================================
const server = http.createServer((req, res) => {
  if (req.url === '/ws') {
    res.writeHead(426);
    res.end('Upgrade Required');
    return;
  }
  serveStatic(req, res);
});

setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`飞行棋服务器运行在 http://localhost:${PORT}`);
  console.log(`本地双人模式：直接打开 http://localhost:${PORT}`);
  console.log(`联机模式：一人创建房间，另一人输入房间号加入`);
});
