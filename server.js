const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ============ 静态文件服务 ============
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

// ============ 游戏常量 ============
const CELL_TYPES = [
  'start','task','task','event','task','teleport','task','task',
  'shop','task','event','task','task','teleport','task','task',
  'shop','task','event','task','task','task','teleport','task',
  'shop','task','task','event','task','task','teleport','task',
  'shop','task','task','task','task','event','task','end'
];

const EQUIP_NAMES = { top:'上衣', pants:'裤子', underwear:'内衣（特殊）', brief:'内裤' };
const EQUIP_KEYS = ['top','pants','underwear','brief'];

const DEFAULT_TASKS_LOW = [
  ['大声唱一首歌',2],['模仿一种动物叫声',1],['说一个冷笑话',3],['夸对方一句',2],
  ['原地转三圈',1],['做一个鬼脸',2],['学一段广告台词',3],['用屁股写自己名字',4],
  ['表演一个才艺',4],['做五个深蹲',3]
];
const DEFAULT_TASKS_HIGH = [
  ['做十个俯卧撑',5],['跳一段舞',7],['讲一个感人故事',6],['模仿名人说话',5],
  ['单脚站立30秒',6],['即兴说唱一段',8],['做20个高抬腿',7],['闭眼画一只猫',5],
  ['用方言读一段文字',6],['连续做3个波比跳',8]
];

const EVENTS = [
  ['红包雨','双方各获得8积分'],['个人所得税','每拥有10积分失去1积分'],['劫富济贫','积分多的给少的3积分'],
  ['扶贫款','积分少的玩家获得6积分'],['救灾款','装备少的玩家获得6积分'],['木秀于林','层数最高的棋子落一层'],
  ['扶摇直上','层数最低的棋子上一层'],['地震','双方各随机一枚棋子落一层'],['大风吹','双方各随机一枚棋子传送到同层随机格'],
  ['鬼打墙','双方所有棋子后退1格'],['顺风车','双方所有棋子前进2格'],['你看看你后面','传送到最近棋子身后一格'],
  ['勇往直前','前进3格'],['购物狂热','传送到同层商店购物'],['任务狂热','传送到本层随机任务格'],
  ['强买强卖','支付15积分获得一件装备'],['砸锅卖铁','失去一件装备获得20积分'],['裸体狂奔','失去一件装备前进8格'],
  ['慈善家','装备多的给对方一件并上升一层'],['天外来衣','装备少的恢复一件装备'],['荆棘风暴','双方各失去一件装备'],
  ['天衣无缝','双方各恢复一件装备'],['衣冠不整','双方各替换一件装备'],['天道酬勤','失一件装备做任务恢复两件'],
  ['我的回合','支付3积分获得额外回合'],['传送魔法','双方各随机一枚棋子上升一层'],['整装待发','恢复一件装备对方获得两回合'],
  ['空任务','获得已脱装备数×2积分'],['炒股','随机获得-4~6积分'],['瞬间失忆','双方清空免脱连续购买计数']
];

const SHOP_ITEMS = [
  {id:'cheatDice',name:'作弊骰子',price:6,desc:'下2次投骰必定6点'},
  {id:'luckyDice',name:'幸运骰子',price:4,desc:'下2次移动+2格'},
  {id:'curseDice',name:'诅咒骰子',price:5,desc:'下2次对方移动-1~2格'},
  {id:'autoDice',name:'自动骰子',price:8,desc:'下2次自动选棋且跨层不脱装'},
  {id:'doubleScore',name:'双倍积分卡',price:7,desc:'下次任务奖励翻倍'},
  {id:'freeTask',name:'白嫖卡',price:8,desc:'下次任务获得两张全部奖励'},
  {id:'swapTask',name:'调包卡',price:12,desc:'下次对方任务奖励归你'},
  {id:'restock',name:'补货卡',price:6,desc:'下次商店2装备+6商品'},
  {id:'memberCard',name:'会员卡',price:12,desc:'下次商店五折'},
  {id:'capitalCard',name:'资本卡',price:6,desc:'下次对方商店价格+5'},
  {id:'freeClothes',name:'免脱卡',price:15,desc:'下次跨层免费免脱并重置计数'},
  {id:'emergencyIns',name:'应急保险',price:8,desc:'失最后一件时再得一件'},
  {id:'financeIns',name:'金融保险',price:15,desc:'失装备时获得20积分'},
  {id:'thornArmor',name:'荆棘甲',price:10,desc:'被踢时对方失一件装备'},
  {id:'immovableArmor',name:'不动甲',price:18,desc:'被踢时自己不跌对方反落'},
  {id:'springArmor',name:'弹簧甲',price:6,desc:'叠棋时直接上一层'},
  {id:'tpTrap',name:'传送陷阱',price:18,desc:'对方下次传送改为向下'},
  {id:'financeTrap',name:'金融陷阱',price:16,desc:'对方下次事件格-18积分'},
  {id:'gripGloves',name:'防滑手套',price:10,desc:'免疫一次事件跌落/失装备'},
  {id:'thiefGloves',name:'窃贼手套',price:9,desc:'对方下次脱装时获得该装备'}
];

// ============ 工具函数 ============
function posToRC(pos) { const row = Math.floor(pos/8); const col = row%2===0 ? pos%8 : 7-(pos%8); return {row,col}; }
function rcToPos(row,col) { if (row<0||row>4) return null; return row%2===0 ? row*8+col : row*8+(7-col); }
function sameColAbove(pos) { const {row,col} = posToRC(pos); return row>=4 ? null : rcToPos(row+1,col); }
function sameColBelow(pos) { const {row,col} = posToRC(pos); return row<=0 ? 0 : rcToPos(row-1,col); }
function getRow(pos) { return Math.floor(pos/8); }
function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function randInt(n) { return Math.floor(Math.random()*n); }
function randRange(a,b) { return a+Math.floor(Math.random()*(b-a+1)); }

// ============ 房间管理 ============
const rooms = new Map();
function createRoom() {
  let id;
  do { id = String(Math.floor(100000+Math.random()*900000)); } while (rooms.has(id));
  rooms.set(id, { id, players: [], game: null, isLocal: false });
  return id;
}

// ============ 游戏状态 ============
function makePlayer(idx) {
  return {
    idx, name: `玩家${idx+1}`, score: 15, pieces: [0,0], finished: [false,false],
    equipment: { top:true, pants:true, underwear:true, brief:true },
    items: {}, freeClothesStreak: 0, extraTurns: 0
  };
}

function createGame(isLocal) {
  return {
    isLocal,
    players: [makePlayer(0), makePlayer(1)],
    currentPlayer: 0,
    phase: 'rolling',
    diceValue: null,
    rerollCost: 2,
    eventDeck: shuffle(EVENTS.map((_,i)=>i)), eventDiscard: [],
    taskDeckLow: shuffle(DEFAULT_TASKS_LOW.map((_,i)=>i)), taskDiscardLow: [],
    taskDeckHigh: shuffle(DEFAULT_TASKS_HIGH.map((_,i)=>i)), taskDiscardHigh: [],
    currentTasks: null, currentEvent: null, currentShop: null,
    movingPiece: null, log: [], winner: null, finishedFirst: null,
    _eventCallback: null, _clothesContext: null, _heavenReward: false, _autoStack: null
  };
}

function getState(g) {
  return {
    players: g.players.map(p => ({
      idx:p.idx, name:p.name, score:p.score, pieces:p.pieces, finished:p.finished,
      equipment:{...p.equipment}, items:{...p.items},
      freeClothesStreak:p.freeClothesStreak, extraTurns:p.extraTurns
    })),
    currentPlayer:g.currentPlayer, phase:g.phase, diceValue:g.diceValue,
    rerollCost:g.rerollCost, log:g.log.slice(-10), winner:g.winner, finishedFirst:g.finishedFirst
  };
}

function sendTo(room, pIdx, msg) {
  const p = room.players[pIdx];
  if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}
function broadcast(g, room, msg) {
  if (room.isLocal) {
    if (room.players[0].ws.readyState === 1) room.players[0].ws.send(JSON.stringify({...msg, state: msg.state || getState(g)}));
    return;
  }
  room.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); });
}
function log(g, text) { g.log.push(text); if (g.log.length > 30) g.log.shift(); }

// ============ 装备辅助 ============
function equipCount(p) { return EQUIP_KEYS.filter(k=>p.equipment[k]).length; }
function equipMissing(p) { return 4-equipCount(p); }
function randomEquipOn(p) { const on=EQUIP_KEYS.filter(k=>p.equipment[k]); return on.length?on[randInt(on.length)]:null; }
function randomEquipOff(p) { const off=EQUIP_KEYS.filter(k=>!p.equipment[k]); return off.length?off[randInt(off.length)]:null; }
function addScore(p,n) { p.score=Math.max(0,p.score+n); }

function loseEquipment(g, p, count=1) {
  const lost=[];
  for(let i=0;i<count;i++){
    const e=randomEquipOn(p); if(!e) break;
    if(equipCount(p)===1 && p.items.emergencyIns){
      delete p.items.emergencyIns;
      p.equipment[e]=false;
      const ne=randomEquipOff(p); if(ne) p.equipment[ne]=true;
      log(g,`${p.name}的应急保险生效`); lost.push(e); continue;
    }
    p.equipment[e]=false; lost.push(e);
    if(p.items.financeIns){ delete p.items.financeIns; addScore(p,20); log(g,`${p.name}的金融保险生效，+20积分`); }
  }
  return lost;
}

// ============ 骰子 ============
function rollDice(g, p) {
  let val=randInt(6)+1;
  if(p.items.cheatDice>0){ val=6; p.items.cheatDice--; if(p.items.cheatDice<=0) delete p.items.cheatDice; }
  const other=g.players[1-p.idx];
  if(other.items.curseDice>0){ val=Math.max(1,val-randRange(1,2)); other.items.curseDice--; if(other.items.curseDice<=0) delete other.items.curseDice; }
  return val;
}

// ============ 棋子位置 ============
function piecesAtPos(g, pos, exclude) {
  const result=[];
  g.players.forEach(pl=>pl.pieces.forEach((pp,i)=>{
    if(pp===pos&&!pl.finished[i]){ if(!exclude||!(exclude.pl===pl&&exclude.i===i)) result.push({pl,i}); }
  }));
  return result;
}

function kickDown(g, room, pl, i, callback) {
  let pos=pl.pieces[i];
  if(pos===0){callback();return;}
  const newPos=sameColBelow(pos);
  pl.pieces[i]=newPos;
  g.movingPiece={player:pl.idx,piece:i,from:pos,to:newPos};
  if(newPos===0){callback();return;}
  const others=piecesAtPos(g,newPos,{pl,i});
  if(others.length>0){
    const t=others[0];
    if(t.pl.items.immovableArmor){ delete t.pl.items.immovableArmor; log(g,`${t.pl.name}的不动甲生效`); callback(); return; }
    kickDown(g,room,t.pl,t.i,callback); return;
  }
  callback();
}

function resolveCollision(g, room, pl, i, pos, callback) {
  if(pos===0||pos===39){callback();return;}
  const others=piecesAtPos(g,pos,{pl,i});
  if(others.length===0){callback();return;}
  const enemy=others.find(x=>x.pl!==pl);
  const ally=others.find(x=>x.pl===pl);
  if(enemy){
    if(pl.items.immovableArmor){
      delete pl.items.immovableArmor;
      log(g,`${pl.name}的不动甲生效，${enemy.pl.name}反落一层`);
      kickDown(g,room,enemy.pl,enemy.i,callback); return;
    }
    if(pl.items.thornArmor){
      delete pl.items.thornArmor;
      loseEquipment(g,enemy.pl,1);
      log(g,`${pl.name}的荆棘甲生效，${enemy.pl.name}失一件装备`);
    }
    log(g,`${pl.name}踢飞了${enemy.pl.name}的棋子！`);
    kickDown(g,room,enemy.pl,enemy.i,callback); return;
  }
  if(ally){
    if(pl.items.springArmor){
      delete pl.items.springArmor;
      const newPos=sameColAbove(pos);
      if(newPos===null){callback();return;}
      log(g,`${pl.name}的弹簧甲生效，上升一层！`);
      pl.pieces[i]=newPos;
      g.movingPiece={player:pl.idx,piece:i,from:pos,to:newPos};
      if(newPos>=39){pl.finished[i]=true;checkWin(g);callback();return;}
      resolveCollision(g,room,pl,i,newPos,()=>resolveCell(g,room,pl,i,newPos,callback));
      return;
    }
    log(g,`${pl.name}叠棋！再掷一次`);
    g.phase='rolling'; g.diceValue=null; g.rerollCost=2;
    g._autoPiece=i; // 自动选这枚棋子
    broadcast(g,room,{type:'state',state:getState(g)});
    return;
  }
  callback();
}

function eventMove(g, room, pl, i, newPos, callback) {
  newPos=Math.max(0,Math.min(39,newPos));
  pl.pieces[i]=newPos;
  g.movingPiece={player:pl.idx,piece:i,to:newPos};
  if(newPos===39){pl.finished[i]=true;checkWin(g);callback();return;}
  if(newPos===0){callback();return;}
  resolveCollision(g,room,pl,i,newPos,callback);
}

// ============ 格子效果 ============
function resolveCell(g, room, pl, i, pos, callback) {
  if(pos===39){pl.finished[i]=true;checkWin(g);callback();return;}
  switch(CELL_TYPES[pos]){
    case 'task':
      drawTasks(g,pl); g.phase='task';
      broadcast(g,room,{type:'taskDraw',tasks:g.currentTasks,playerIdx:pl.idx,state:getState(g)});
      break;
    case 'event':
      triggerEvent(g,room,pl,i,callback); break;
    case 'teleport':
      handleTeleport(g,room,pl,i,pos,callback); break;
    case 'shop':
      openShop(g,pl); g.phase='shop';
      broadcast(g,room,{type:'shopOpen',shop:g.currentShop,playerIdx:pl.idx,state:getState(g)});
      break;
    default: callback();
  }
}

function drawTasks(g, p) {
  if(g.taskDeckLow.length===0){g.taskDeckLow=shuffle(g.taskDiscardLow);g.taskDiscardLow=[];}
  if(g.taskDeckHigh.length===0){g.taskDeckHigh=shuffle(g.taskDiscardHigh);g.taskDiscardHigh=[];}
  const li=g.taskDeckLow.pop(), hi=g.taskDeckHigh.pop();
  const bonus=equipMissing(p)*2;
  const t1=DEFAULT_TASKS_LOW[li], t2=DEFAULT_TASKS_HIGH[hi];
  g.currentTasks=[
    {text:t1[0],base:t1[1],bonus,total:t1[1]+bonus,deck:'low',idx:li},
    {text:t2[0],base:t2[1],bonus,total:t2[1]+bonus,deck:'high',idx:hi}
  ];
}

function openShop(g, p) {
  const items=[];
  const eqKey=EQUIP_KEYS[randInt(4)];
  let eqPrice=randRange(10,15);
  if(p.items.memberCard) eqPrice=Math.floor(eqPrice/2);
  if(g.players[1-p.idx].items.capitalCard) eqPrice+=5;
  items.push({type:'equip',equip:eqKey,name:EQUIP_NAMES[eqKey],price:eqPrice,owned:p.equipment[eqKey]});
  const itemCount=p.items.restock?6:4;
  const pool=shuffle(SHOP_ITEMS.filter(it=>!p.items[it.id]));
  for(let i=0;i<itemCount&&i<pool.length;i++){
    let price=pool[i].price;
    if(p.items.memberCard) price=Math.floor(price/2);
    if(g.players[1-p.idx].items.capitalCard) price+=5;
    items.push({type:'item',id:pool[i].id,name:pool[i].name,price,desc:pool[i].desc});
  }
  if(p.items.memberCard) delete p.items.memberCard;
  if(g.players[1-p.idx].items.capitalCard) delete g.players[1-p.idx].items.capitalCard;
  if(p.items.restock) delete p.items.restock;
  g.currentShop=items;
}

function handleTeleport(g, room, pl, i, pos, callback) {
  let target;
  if(pl.items.tpTrap){ delete pl.items.tpTrap; target=sameColBelow(pos); log(g,`${pl.name}的传送陷阱生效，向下传送！`); }
  else target=sameColAbove(pos);
  if(target===null){callback();return;}
  pl.pieces[i]=target;
  g.movingPiece={player:pl.idx,piece:i,from:pos,to:target};
  log(g,`${pl.name}传送至第${getRow(target)+1}层`);
  if(target===39){pl.finished[i]=true;checkWin(g);callback();return;}
  resolveCollision(g,room,pl,i,target,()=>resolveCell(g,room,pl,i,target,callback));
}

// ============ 事件 ============
function drawEvent(g) {
  if(g.eventDeck.length===0){g.eventDeck=shuffle(g.eventDiscard);g.eventDiscard=[];}
  return g.eventDeck.pop();
}

function triggerEvent(g, room, pl, i, callback) {
  const other=g.players[1-pl.idx];
  if(other.items.financeTrap){
    delete other.items.financeTrap;
    if(pl.score>=18) addScore(pl,-18); else { addScore(pl,-pl.score); loseEquipment(g,pl,1); }
    log(g,`${pl.name}触发金融陷阱！`);
    g.currentEvent={name:'金融陷阱',desc:'失去18积分，不足则失一件装备'};
    g.phase='event'; g._eventCallback=callback;
    broadcast(g,room,{type:'eventDraw',event:g.currentEvent,playerIdx:pl.idx,state:getState(g)});
    return;
  }
  const evtIdx=drawEvent(g);
  g.eventDiscard.push(evtIdx);
  const [name,desc]=EVENTS[evtIdx];
  g.currentEvent={name,desc};
  log(g,`事件：${name}`);
  const handler=EVENT_HANDLERS[evtIdx];
  const done=()=>{
    g.phase='event'; g._eventCallback=callback;
    broadcast(g,room,{type:'eventDraw',event:g.currentEvent,playerIdx:pl.idx,state:getState(g)});
  };
  if(handler) handler(g,room,pl,i,done); else done();
}

const EVENT_HANDLERS = {
  0(g,room,p,i,cb){ addScore(g.players[0],8);addScore(g.players[1],8);log(g,'红包雨！双方+8积分');cb(); },
  1(g,room,p,i,cb){ g.players.forEach(pl=>{const t=Math.floor(pl.score/10);addScore(pl,-t);});log(g,'个人所得税！');cb(); },
  2(g,room,p,i,cb){ if(g.players[0].score!==g.players[1].score){const[r,po]=g.players[0].score>g.players[1].score?[g.players[0],g.players[1]]:[g.players[1],g.players[0]];addScore(r,-3);addScore(po,3);log(g,`劫富济贫！${r.name}给${po.name}3积分`);}cb(); },
  3(g,room,p,i,cb){ if(g.players[0].score===g.players[1].score){addScore(g.players[0],6);addScore(g.players[1],6);log(g,'平分，双方+6积分');}else{const po=g.players[0].score<g.players[1].score?g.players[0]:g.players[1];addScore(po,6);log(g,`扶贫款！${po.name}+6积分`);}cb(); },
  4(g,room,p,i,cb){ const c0=equipCount(g.players[0]),c1=equipCount(g.players[1]);if(c0===c1){addScore(g.players[0],6);addScore(g.players[1],6);log(g,'装备相同，双方+6积分');}else{const p2=c0<c1?g.players[0]:g.players[1];addScore(p2,6);log(g,`救灾款！${p2.name}+6积分`);}cb(); },
  5(g,room,p,i,cb){ let mx=-1;g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)>mx)mx=getRow(pp);}));if(mx<=0){log(g,'都在第一层，无事发生');cb();return;}const cands=[];g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)===mx)cands.push({pl,j});}));const ch=cands[randInt(cands.length)];log(g,`木秀于林！${ch.pl.name}的棋子落一层`);eventMove(g,room,ch.pl,ch.j,sameColBelow(ch.pl.pieces[ch.j]),cb); },
  6(g,room,p,i,cb){ let mn=5;g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)<mn)mn=getRow(pp);}));if(mn>=4){log(g,'都在第五层，无事发生');cb();return;}const cands=[];g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)===mn)cands.push({pl,j});}));const ch=cands[randInt(cands.length)];log(g,`扶摇直上！${ch.pl.name}的棋子上一层`);eventMove(g,room,ch.pl,ch.j,sameColAbove(ch.pl.pieces[ch.j]),cb); },
  7(g,room,p,i,cb){ const ts=[];g.players.forEach(pl=>{const o=[];pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)>0)o.push(j);});if(o.length)ts.push({pl,j:o[randInt(o.length)]});});let idx=0;function nx(){if(idx>=ts.length){cb();return;}const t=ts[idx++];log(g,`地震！${t.pl.name}的棋子落一层`);eventMove(g,room,t.pl,t.j,sameColBelow(t.pl.pieces[t.j]),nx);}nx(); },
  8(g,room,p,i,cb){ const ts=[];g.players.forEach(pl=>{const o=[];pl.pieces.forEach((pp,j)=>{if(!pl.finished[j])o.push(j);});if(o.length)ts.push({pl,j:o[randInt(o.length)]});});let idx=0;function nx(){if(idx>=ts.length){cb();return;}const t=ts[idx++];const row=getRow(t.pl.pieces[t.j]);const occ=new Set();g.players.forEach(pl=>pl.pieces.forEach(pp=>occ.add(pp)));const emp=[];for(let c=0;c<8;c++){const pp=rcToPos(row,c);if(!occ.has(pp))emp.push(pp);}if(emp.length){log(g,`大风吹！${t.pl.name}的棋子被吹走`);eventMove(g,room,t.pl,t.j,emp[randInt(emp.length)],nx);}else nx();}nx(); },
  9(g,room,p,i,cb){ const ms=[];g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&pp!==0)ms.push({pl,j,from:pp});}));ms.forEach(m=>{m.to=Math.max(0,m.from-1);m.pl.pieces[j]=m.to;});g.movingPiece={multi:true};let idx=0;function nx(){if(idx>=ms.length){cb();return;}const m=ms[idx++];if(m.to===0){nx();return;}resolveCollision(g,room,m.pl,m.j,m.to,nx);}log(g,'鬼打墙！所有棋子后退1格');nx(); },
  10(g,room,p,i,cb){ const ms=[];g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&pp!==0)ms.push({pl,j,from:pp});}));let cross=null;ms.forEach(m=>{m.to=Math.min(39,m.from+2);if(m.to<39&&getRow(m.to)>getRow(m.from)&&!cross)cross=m;});if(cross){g._clothesContext={type:'eventMove',movers:ms,cb};g.phase='clothes';broadcast(g,room,{type:'clothesChoice',equipment:cross.pl.equipment,freeCost:10+cross.pl.freeClothesStreak*5,playerIdx:cross.pl.idx,state:getState(g)});return;}ms.forEach(m=>{if(m.to<39)m.pl.pieces[m.j]=m.to;});g.movingPiece={multi:true};let idx=0;function nx(){if(idx>=ms.length){cb();return;}const m=ms[idx++];if(m.to>=39){if(m.to===39){m.pl.finished[m.j]=true;checkWin(g);}nx();return;}if(m.to===0){nx();return;}resolveCollision(g,room,m.pl,m.j,m.to,nx);}log(g,'顺风车！所有棋子前进2格');nx(); },
  11(g,room,p,i,cb){ const my=p.pieces[i];let best=null,bd=999;g.players.forEach(pl=>pl.pieces.forEach((pp,j)=>{if(pl===p&&j===i||pl.finished[j])return;const d=Math.abs(pp-my);if(d<bd||(d===bd&&pp>(best?best.pos:0))){best={pl,j,pos:pp};bd=d;}}));if(!best){cb();return;}const t=Math.max(0,best.pos-1);log(g,`你看看你后面！传送到${best.pl.name}身后`);eventMove(g,room,p,i,t,cb); },
  12(g,room,p,i,cb){ const from=p.pieces[i],to=Math.min(39,from+3);if(to<39&&getRow(to)>getRow(from)){g._clothesContext={type:'eventForward',pl:p,i,fromPos:from,toPos:to,cb};g.phase='clothes';broadcast(g,room,{type:'clothesChoice',equipment:p.equipment,freeCost:10+p.freeClothesStreak*5,playerIdx:p.idx,state:getState(g)});return;}log(g,'勇往直前！前进3格');eventMove(g,room,p,i,to,cb); },
  13(g,room,p,i,cb){ const row=getRow(p.pieces[i]);let sp=null;for(let c=0;c<8;c++){const pp=rcToPos(row,c);if(CELL_TYPES[pp]==='shop'){sp=pp;break;}}if(sp===null){log(g,'同层无商店');cb();return;}log(g,`购物狂热！传送到商店`);p.pieces[i]=sp;g.movingPiece={player:p.idx,piece:i,to:sp};resolveCollision(g,room,p,i,sp,()=>{openShop(g,p);g.phase='shop';broadcast(g,room,{type:'shopOpen',shop:g.currentShop,playerIdx:p.idx,state:getState(g)});}); },
  14(g,room,p,i,cb){ const row=getRow(p.pieces[i]);const tps=[];for(let c=0;c<8;c++){const pp=rcToPos(row,c);if(CELL_TYPES[pp]==='task')tps.push(pp);}if(!tps.length){cb();return;}const tp=tps[randInt(tps.length)];log(g,`任务狂热！传送到任务格`);p.pieces[i]=tp;g.movingPiece={player:p.idx,piece:i,to:tp};resolveCollision(g,room,p,i,tp,()=>{drawTasks(g,p);g.phase='task';broadcast(g,room,{type:'taskDraw',tasks:g.currentTasks,playerIdx:p.idx,state:getState(g)});}); },
  15(g,room,p,i,cb){ if(equipCount(p)<4){if(p.score>=15)addScore(p,-15);else addScore(p,-p.score);const e=randomEquipOff(p);p.equipment[e]=true;log(g,`强买强卖！获得${EQUIP_NAMES[e]}`);}else log(g,'装备已满');cb(); },
  16(g,room,p,i,cb){ const lost=loseEquipment(g,p,1);addScore(p,20);log(g,`砸锅卖铁！${lost.length?'失去'+EQUIP_NAMES[lost[0]]+'，':''}+20积分`);cb(); },
  17(g,room,p,i,cb){ loseEquipment(g,p,1);const to=Math.min(39,p.pieces[i]+8);log(g,`裸体狂奔！前进8格`);eventMove(g,room,p,i,to,cb); },
  18(g,room,p,i,cb){ const c0=equipCount(g.players[0]),c1=equipCount(g.players[1]);if(c0===c1){log(g,'装备相同，无事发生');cb();return;}const giver=c0>c1?g.players[0]:g.players[1],receiver=g.players[1-giver.idx];const can=EQUIP_KEYS.filter(k=>giver.equipment[k]&&!receiver.equipment[k]);if(!can.length){cb();return;}const eq=can[randInt(can.length)];giver.equipment[eq]=false;receiver.equipment[eq]=true;log(g,`慈善家！${giver.name}把${EQUIP_NAMES[eq]}给了${receiver.name}`);const o=[];giver.pieces.forEach((pp,j)=>{if(!giver.finished[j]&&getRow(pp)<4)o.push(j);});if(o.length){const j=o[randInt(o.length)];eventMove(g,room,giver,j,sameColAbove(giver.pieces[j]),cb);}else cb(); },
  19(g,room,p,i,cb){ const c0=equipCount(g.players[0]),c1=equipCount(g.players[1]);if(c0===c1){g.players.forEach(pl=>{const e=randomEquipOff(pl);if(e){pl.equipment[e]=true;log(g,`${pl.name}恢复${EQUIP_NAMES[e]}`);}});}else{const p2=c0<c1?g.players[0]:g.players[1];const e=randomEquipOff(p2);if(e){p2.equipment[e]=true;log(g,`天外来衣！${p2.name}恢复${EQUIP_NAMES[e]}`);}}cb(); },
  20(g,room,p,i,cb){ g.players.forEach(pl=>{if(equipCount(pl)>0){loseEquipment(g,pl,1);log(g,`${pl.name}失去一件装备`);}});cb(); },
  21(g,room,p,i,cb){ g.players.forEach(pl=>{const e=randomEquipOff(pl);if(e){pl.equipment[e]=true;log(g,`${pl.name}恢复${EQUIP_NAMES[e]}`);}});cb(); },
  22(g,room,p,i,cb){ g.players.forEach(pl=>{if(equipCount(pl)>0&&equipCount(pl)<4){const off=randomEquipOff(pl),on=randomEquipOn(pl);pl.equipment[on]=false;pl.equipment[off]=true;log(g,`${pl.name}的${EQUIP_NAMES[on]}换成${EQUIP_NAMES[off]}`);}});cb(); },
  23(g,room,p,i,cb){ if(equipCount(p)>0)loseEquipment(g,p,1);drawTasks(g,p);g.phase='task';g._heavenReward=true;log(g,`天道酬勤！完成任务恢复两件装备`);broadcast(g,room,{type:'taskDraw',tasks:g.currentTasks,playerIdx:p.idx,state:getState(g)}); },
  24(g,room,p,i,cb){ if(p.score>=3)addScore(p,-3);else addScore(p,-p.score);p.extraTurns++;log(g,`我的回合！${p.name}获得额外回合`);cb(); },
  25(g,room,p,i,cb){ const ts=[];g.players.forEach(pl=>{const o=[];pl.pieces.forEach((pp,j)=>{if(!pl.finished[j]&&getRow(pp)<4)o.push(j);});if(o.length)ts.push({pl,j:o[randInt(o.length)]});});let idx=0;function nx(){if(idx>=ts.length){cb();return;}const t=ts[idx++];log(g,`传送魔法！${t.pl.name}的棋子上一层`);eventMove(g,room,t.pl,t.j,sameColAbove(t.pl.pieces[t.j]),nx);}nx(); },
  26(g,room,p,i,cb){ const e=randomEquipOff(p);if(e){p.equipment[e]=true;log(g,`整装待发！恢复${EQUIP_NAMES[e]}`);}g.players[1-p.idx].extraTurns+=2;log(g,`${g.players[1-p.idx].name}获得两个额外回合`);cb(); },
  27(g,room,p,i,cb){ const s=equipMissing(p)*2;addScore(p,s);log(g,`空任务！+${s}积分`);cb(); },
  28(g,room,p,i,cb){ const n=randRange(-4,6);addScore(p,n);log(g,`炒股！${n>=0?'+':''}${n}积分`);cb(); },
  29(g,room,p,i,cb){ g.players[0].freeClothesStreak=0;g.players[1].freeClothesStreak=0;log(g,'瞬间失忆！免脱计数清零');cb(); }
};

// ============ 回合 ============
function nextTurn(g, room) {
  if(g.winner!==null)return;
  const cur=g.players[g.currentPlayer];
  if(cur.extraTurns>0){cur.extraTurns--;log(g,`${cur.name}的额外回合`);}
  else g.currentPlayer=1-g.currentPlayer;
  const p=g.players[g.currentPlayer];
  if(p.finished[0]&&p.finished[1]){
    if(g.finishedFirst===null){g.finishedFirst=p.idx;log(g,`${p.name}率先完赛！`);}
    if(g.players[1-p.idx].finished[0]&&g.players[1-p.idx].finished[1]){finishGame(g,room);return;}
    nextTurn(g,room);return;
  }
  if(g.finishedFirst!==null&&p.idx!==g.finishedFirst){
    addScore(p,-10);log(g,`${p.name}追赶中，-10积分`);
  }
  g.phase='rolling';g.diceValue=null;g.rerollCost=2;g._autoPiece=null;g.movingPiece=null;
  broadcast(g,room,{type:'state',state:getState(g)});
}

function checkWin(g){
  g.players.forEach(p=>{if(p.finished[0]&&p.finished[1]&&g.finishedFirst===null)g.finishedFirst=p.idx;});
  if(g.players[0].finished[0]&&g.players[0].finished[1]&&g.players[1].finished[0]&&g.players[1].finished[1])finishGame(g);
}
function finishGame(g,room){
  g.phase='gameover';
  g.winner=g.players[0].score>g.players[1].score?0:g.players[1].score>g.players[0].score?1:-1;
  log(g,g.winner>=0?`${g.players[g.winner].name}获胜！`:'平局！');
  broadcast(g,room,{type:'gameOver',winner:g.winner,scores:[g.players[0].score,g.players[1].score],state:getState(g)});
}

function afterAction(g, room) {
  if(g.winner!==null)return;
  if(g.phase==='rolling')return;
  const p=g.players[g.currentPlayer];
  if(p.finished[0]&&p.finished[1]&&g.finishedFirst===null){g.finishedFirst=p.idx;log(g,`${p.name}率先完赛！`);}
  if(g.players[0].finished[0]&&g.players[0].finished[1]&&g.players[1].finished[0]&&g.players[1].finished[1]){finishGame(g,room);return;}
  nextTurn(g,room);
}

// ============ 消息处理 ============
function handleAction(room, pIdx, msg) {
  const g=room.game; if(!g||g.winner!==null)return;
  const p=g.players[pIdx];
  if(g.currentPlayer!==pIdx) return;

  switch(msg.type){
    case 'roll': {
      if(g.phase!=='rolling'||g.diceValue!==null)return;
      const val=rollDice(g,p);
      g.diceValue=val;
      broadcast(g,room,{type:'diceResult',value:val,state:getState(g)});
      if(p.items.autoDice>0){
        p.items.autoDice--;if(p.items.autoDice<=0)delete p.items.autoDice;
        setTimeout(()=>{
          const opts=[0,1].filter(j=>!p.finished[j]);
          if(opts.length)doMove(g,room,p,opts[randInt(opts.length)],true);
        },1000);
      }
      break;
    }
    case 'reroll': {
      if(g.phase!=='rolling'||g.diceValue===null)return;
      if(p.score<g.rerollCost)return;
      addScore(p,-g.rerollCost);g.rerollCost+=2;
      const val=rollDice(g,p);g.diceValue=val;
      broadcast(g,room,{type:'diceResult',value:val,state:getState(g)});
      if(p.items.autoDice>0){
        p.items.autoDice--;if(p.items.autoDice<=0)delete p.items.autoDice;
        setTimeout(()=>{const opts=[0,1].filter(j=>!p.finished[j]);if(opts.length)doMove(g,room,p,opts[randInt(opts.length)],true);},1000);
      }
      break;
    }
    case 'selectPiece': {
      if(g.phase!=='rolling'||g.diceValue===null)return;
      if(p.finished[msg.pieceIndex])return;
      if(g._autoPiece!==null&&g._autoPiece!==undefined&&g._autoPiece!==msg.pieceIndex)return;
      doMove(g,room,p,msg.pieceIndex,false);
      break;
    }
    case 'taskChoice': {
      if(g.phase!=='task')return;
      const task=g.currentTasks[msg.taskIndex];if(!task)return;
      let score=task.total;
      if(p.items.doubleScore){score*=2;delete p.items.doubleScore;log(g,'双倍积分卡生效！');}
      if(p.items.freeTask){score=g.currentTasks[0].total+g.currentTasks[1].total;delete p.items.freeTask;log(g,'白嫖卡生效！');}
      const other=g.players[1-pIdx];
      if(other.items.swapTask){delete other.items.swapTask;addScore(other,score);log(g,`调包卡！${score}积分归${other.name}`);}
      else {addScore(p,score);log(g,`${p.name}完成任务+${score}积分`);}
      if(task.deck==='low')g.taskDiscardLow.push(task.idx);else g.taskDiscardHigh.push(task.idx);
      if(g._heavenReward){g._heavenReward=false;for(let r=0;r<2&&equipCount(p)<4;r++){const e=randomEquipOff(p);p.equipment[e]=true;log(g,`天道酬勤！恢复${EQUIP_NAMES[e]}`);}}
      g.currentTasks=null;
      afterAction(g,room);
      broadcast(g,room,{type:'state',state:getState(g)});
      break;
    }
    case 'buyItem': {
      if(g.phase!=='shop')return;
      const item=g.currentShop[msg.itemIndex];if(!item||item.owned||p.score<item.price)return;
      addScore(p,-item.price);
      if(item.type==='equip'){p.equipment[item.equip]=true;log(g,`${p.name}购买${item.name}`);}
      else {p.items[item.id]=(p.items[item.id]||0)+1;log(g,`${p.name}购买${item.name}`);}
      openShop(g,p);
      broadcast(g,room,{type:'shopOpen',shop:g.currentShop,playerIdx:pIdx,state:getState(g)});
      break;
    }
    case 'closeShop': {
      if(g.phase!=='shop')return;g.currentShop=null;afterAction(g,room);
      broadcast(g,room,{type:'state',state:getState(g)});break;
    }
    case 'clothesChoice': {
      if(g.phase!=='clothes')return;
      const ctx=g._clothesContext;if(!ctx)return;
      const actor=ctx.pl||p;
      if(msg.choice==='pay'){
        const cost=10+actor.freeClothesStreak*5;if(actor.score<cost)return;
        addScore(actor,-cost);actor.freeClothesStreak++;log(g,`${actor.name}花${cost}积分免脱`);
      }else if(msg.choice==='free'){
        if(!actor.items.freeClothes)return;delete actor.items.freeClothes;actor.freeClothesStreak=0;log(g,`${actor.name}使用免脱卡`);
      }else{
        if(!actor.equipment[msg.equip])return;
        const other=g.players[1-actor.idx];
        if(other.items.thiefGloves&&!other.equipment[msg.equip]){delete other.items.thiefGloves;other.equipment[msg.equip]=true;log(g,`${other.name}的窃贼手套偷走${EQUIP_NAMES[msg.equip]}`);}
        actor.equipment[msg.equip]=false;actor.freeClothesStreak=0;log(g,`${actor.name}脱掉${EQUIP_NAMES[msg.equip]}`);
      }
      g._clothesContext=null;
      if(ctx.type==='move'){
        actor.pieces[ctx.piece]=ctx.toPos;
        g.movingPiece={player:actor.idx,piece:ctx.piece,from:ctx.fromPos,to:ctx.toPos};
        if(ctx.toPos>=39){actor.finished[ctx.piece]=true;checkWin(g);afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});return;}
        resolveCollision(g,room,actor,ctx.piece,ctx.toPos,()=>resolveCell(g,room,actor,ctx.piece,ctx.toPos,()=>{afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});}));
      }else if(ctx.type==='eventForward'){
        eventMove(g,room,ctx.pl,ctx.i,ctx.toPos,()=>{afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});});
      }else if(ctx.type==='eventMove'){
        ctx.movers.forEach(m=>{if(m.to<39)m.pl.pieces[m.j]=m.to;});
        g.movingPiece={multi:true};let idx=0;
        function nx(){if(idx>=ctx.movers.length){afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});return;}const m=ctx.movers[idx++];if(m.to>=39){if(m.to===39){m.pl.finished[m.j]=true;checkWin(g);}nx();return;}if(m.to===0){nx();return;}resolveCollision(g,room,m.pl,m.j,m.to,nx);}
        nx();
      }
      break;
    }
    case 'eventConfirm': {
      if(g.phase!=='event')return;g.currentEvent=null;const cb=g._eventCallback;g._eventCallback=null;
      if(cb)cb(()=>{afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});});
      else {afterAction(g,room);broadcast(g,room,{type:'state',state:getState(g)});}
      break;
    }
    case 'restart': {
      room.game=createGame(room.isLocal);
      broadcast(room.game,room,{type:'start',playerIdx:0,state:getState(room.game),isLocal:room.isLocal});
      break;
    }
  }
}

// ============ WebSocket ============
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg; try{msg=JSON.parse(data);}catch{return;}

    if(msg.type==='create'){
      const roomId=createRoom();const room=rooms.get(roomId);
      room.players[0]={ws,idx:0};room.isLocal=false;
      ws._room=room;ws._playerIdx=0;
      ws.send(JSON.stringify({type:'created',roomId}));
    }else if(msg.type==='join'){
      const room=rooms.get(msg.roomId);
      if(!room){ws.send(JSON.stringify({type:'error',message:'房间不存在'}));return;}
      if(room.players.length>=2){ws.send(JSON.stringify({type:'error',message:'房间已满'}));return;}
      ws._room=room;ws._playerIdx=1;
      room.players[1]={ws,idx:1};
      room.game=createGame(false);room.isLocal=false;
      room.players.forEach((pp,i)=>{if(pp.ws.readyState===1)pp.ws.send(JSON.stringify({type:'start',playerIdx:i,state:getState(room.game),isLocal:false}));});
    }else if(msg.type==='localStart'){
      const roomId=createRoom();const room=rooms.get(roomId);
      room.players[0]={ws,idx:0};room.players[1]={ws,idx:1};room.isLocal=true;
      room.game=createGame(true);
      ws._room=room;ws._playerIdx=0;ws._isLocal=true;
      ws.send(JSON.stringify({type:'start',playerIdx:0,state:getState(room.game),isLocal:true}));
    }else if(ws._room){
      const pIdx = ws._isLocal ? ws._room.game.currentPlayer : (ws._playerIdx||0);
      handleAction(ws._room, pIdx, msg);
    }
  });

  ws.on('close', () => {
    if(ws._room){
      const room=ws._room;
      if(!room.isLocal){
        room.players.forEach(p=>{if(p.ws!==ws&&p.ws.readyState===1)p.ws.send(JSON.stringify({type:'opponentLeft'}));});
        rooms.delete(room.id);
      }
    }
  });
});

server.listen(PORT, () => console.log(`飞行棋服务器运行在端口 ${PORT}`));
