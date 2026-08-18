// ============ 全局状态 ============
let ws = null;
let gameState = null;
let myIdx = 0;
let isLocal = false;
let diceAnimating = false;

const CELL_INFO = [
  {type:'start',icon:'🚀',label:'起点'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'event',icon:'⚡',label:'事件'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'teleport',icon:'🌀',label:'传送'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'shop',icon:'🏪',label:'商店'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'event',icon:'⚡',label:'事件'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'teleport',icon:'🌀',label:'传送'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'shop',icon:'🏪',label:'商店'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'event',icon:'⚡',label:'事件'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'teleport',icon:'🌀',label:'传送'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'shop',icon:'🏪',label:'商店'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'event',icon:'⚡',label:'事件'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'teleport',icon:'🌀',label:'传送'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'shop',icon:'🏪',label:'商店'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'event',icon:'⚡',label:'事件'},
  {type:'task',icon:'⭐',label:'任务'},
  {type:'end',icon:'🏁',label:'终点'}
];

const EQUIP_NAMES = {top:'上衣',pants:'裤子',underwear:'内衣(特殊)',brief:'内裤'};
const EQUIP_KEYS = ['top','pants','underwear','brief'];

// ============ WebSocket ============
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleMessage(msg);
  };
  ws.onclose = () => {
    if (!isLocal && document.getElementById('game').style.display !== 'none') {
      document.getElementById('disconnectModal').style.display = 'flex';
    }
  };
}

function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function handleMessage(msg) {
  switch(msg.type) {
    case 'created':
      document.getElementById('roomIdDisplay').textContent = msg.roomId;
      document.getElementById('waitBox').style.display = 'block';
      document.getElementById('joinBox').style.display = 'none';
      break;
    case 'error':
      document.getElementById('homeError').textContent = msg.message;
      break;
    case 'start':
      myIdx = msg.playerIdx || 0;
      isLocal = msg.isLocal;
      gameState = msg.state;
      document.getElementById('home').style.display = 'none';
      document.getElementById('game').style.display = 'flex';
      renderBoard();
      updateUI();
      break;
    case 'state':
      gameState = msg.state;
      updateUI();
      break;
    case 'diceResult':
      gameState = msg.state;
      showDiceResult(msg.value);
      break;
    case 'taskDraw':
      gameState = msg.state;
      showTaskModal(msg.tasks);
      break;
    case 'eventDraw':
      gameState = msg.state;
      showEventModal(msg.event);
      break;
    case 'shopOpen':
      gameState = msg.state;
      showShopModal(msg.shop);
      break;
    case 'clothesChoice':
      gameState = msg.state;
      showClothesModal(msg);
      break;
    case 'gameOver':
      gameState = msg.state;
      showGameOver(msg.winner, msg.scores);
      break;
    case 'opponentLeft':
      document.getElementById('disconnectModal').style.display = 'flex';
      break;
  }
}

// ============ 首页操作 ============
function startLocal() {
  connectWS();
  ws.onopen = () => send({type:'localStart'});
}
function showCreate() {
  document.getElementById('joinBox').style.display='none';
  if (!ws) connectWS();
  ws.onopen = () => {
    send({type:'create'});
    document.getElementById('waitBox').style.display='block';
  };
  if (ws.readyState === 1) { send({type:'create'}); document.getElementById('waitBox').style.display='block'; }
}
function showJoin() {
  document.getElementById('joinBox').style.display='block';
  document.getElementById('waitBox').style.display='none';
  if (!ws) connectWS();
}
function joinRoom() {
  const roomId = document.getElementById('roomInput').value.trim();
  if (roomId.length !== 6) { document.getElementById('homeError').textContent='请输入6位房间号'; return; }
  if (!ws) connectWS();
  ws.onopen = () => send({type:'join', roomId});
  if (ws.readyState === 1) send({type:'join', roomId});
}

// ============ 棋盘渲染 ============
function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  // 第5层在最上面（row4），第1层在最下面（row0）
  for (let row = 4; row >= 0; row--) {
    for (let col = 0; col < 8; col++) {
      const pos = row % 2 === 0 ? row*8+col : row*8+(7-col);
      const info = CELL_INFO[pos];
      const cell = document.createElement('div');
      cell.className = `cell ${info.type}`;
      cell.id = `cell-${pos}`;
      cell.innerHTML = `
        <span class="cell-num">${pos}</span>
        <span class="cell-icon">${info.icon}</span>
        <span class="cell-label">${info.label}</span>
        <div class="pieces-container" id="pieces-${pos}"></div>
      `;
      board.appendChild(cell);
    }
  }
}

// ============ UI更新 ============
function updateUI() {
  if (!gameState) return;
  const cp = gameState.currentPlayer;

  // 玩家信息
  gameState.players.forEach((p, i) => {
    document.getElementById(`p${i}Score`).textContent = p.score;
    const info = document.getElementById(`p${i}Info`);
    info.classList.toggle('active', cp === i && gameState.phase !== 'gameover');
    info.classList.toggle('finished', p.finished[0] && p.finished[1]);

    // 装备
    const equips = document.getElementById(`p${i}Equips`);
    equips.innerHTML = EQUIP_KEYS.map(k =>
      `<span class="equip-chip ${p.equipment[k]?'':'off'}">${EQUIP_NAMES[k]}</span>`
    ).join('');

    // 道具
    const items = document.getElementById(`p${i}Items`);
    items.innerHTML = Object.entries(p.items).filter(([,v])=>v>0).map(([k,v]) =>
      `<span class="item-chip">${itemName(k)}${v>1?'x'+v:''}</span>`
    ).join('');

    // 完赛状态
    const fin = document.getElementById(`p${i}Finished`);
    if (p.finished[0] && p.finished[1]) fin.textContent = '完赛';
    else fin.textContent = `棋子${p.finished[0]?'✓':'○'} ${p.finished[1]?'✓':'○'}`;
  });

  // 棋子
  renderPieces();

  // 提示
  const hint = document.getElementById('hint');
  if (gameState.phase === 'gameover') {
    hint.textContent = '游戏结束';
  } else if (cp === myIdx || isLocal) {
    const name = `玩家${cp+1}`;
    if (gameState.phase === 'rolling') {
      hint.textContent = gameState.diceValue ? `${name}掷出${gameState.diceValue}点，选择棋子移动` : `轮到${name}掷骰子`;
    } else if (gameState.phase === 'clothes') {
      hint.textContent = `${name}跨层，请选择脱装备`;
    } else {
      hint.textContent = `轮到${name}`;
    }
  } else {
    hint.textContent = `等待玩家${cp+1}操作...`;
  }

  // 骰子
  const dice = document.getElementById('dice');
  const rerollBtn = document.getElementById('rerollBtn');
  const canRoll = (cp === myIdx || isLocal) && gameState.phase === 'rolling';
  dice.classList.toggle('rollable', canRoll && !diceAnimating);
  dice.classList.toggle('disabled', !canRoll && !diceAnimating);
  if (gameState.diceValue && gameState.phase === 'rolling' && canRoll) {
    rerollBtn.style.display = gameState.diceValue ? 'inline-block' : 'none';
    document.getElementById('rerollCost').textContent = gameState.rerollCost;
  } else {
    rerollBtn.style.display = 'none';
  }

  // 日志
  const log = document.getElementById('log');
  log.innerHTML = gameState.log.map(l => `<div>${l}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function itemName(id) {
  const names = {cheatDice:'作弊骰',luckyDice:'幸运骰',curseDice:'诅咒骰',autoDice:'自动骰',
    doubleScore:'双倍卡',freeTask:'白嫖卡',swapTask:'调包卡',restock:'补货卡',memberCard:'会员卡',
    capitalCard:'资本卡',freeClothes:'免脱卡',emergencyIns:'应急险',financeIns:'金融险',
    thornArmor:'荆棘甲',immovableArmor:'不动甲',springArmor:'弹簧甲',tpTrap:'传送陷阱',
    financeTrap:'金融陷阱',gripGloves:'防滑套',thiefGloves:'窃贼套'};
  return names[id]||id;
}

// ============ 棋子渲染 ============
function renderPieces() {
  // 清空所有棋子容器
  for (let i = 0; i < 40; i++) {
    const c = document.getElementById(`pieces-${i}`);
    if (c) c.innerHTML = '';
  }
  // 放置棋子
  gameState.players.forEach((p, pi) => {
    p.pieces.forEach((pos, ii) => {
      if (p.finished[ii]) return; // 完赛棋子不显示在棋盘上（或显示在终点）
      const container = document.getElementById(`pieces-${pos}`);
      if (!container) return;
      const piece = document.createElement('div');
      piece.className = `piece p${pi}`;
      piece.textContent = ii+1;
      piece.dataset.player = pi;
      piece.dataset.piece = ii;

      // 判断是否可选
      const canSelect = (gameState.currentPlayer === myIdx || isLocal) &&
        gameState.phase === 'rolling' && gameState.diceValue !== null &&
        pi === gameState.currentPlayer;
      if (canSelect) {
        piece.classList.add('selectable');
        piece.onclick = () => selectPiece(ii);
      }

      // 多棋子排列
      const existing = container.children.length;
      if (existing === 0) {
        piece.style.top = '50%'; piece.style.left = '50%';
        piece.style.transform = 'translate(-50%,-50%)';
      } else if (existing === 1) {
        // 重新排列为2x2
        container.innerHTML = '';
        // 重新添加所有在这个位置的棋子
        const allHere = [];
        gameState.players.forEach((pp, ppi) => {
          pp.pieces.forEach((ppos, iii) => {
            if (ppos === pos && !pp.finished[iii]) allHere.push({ppi,iii});
          });
        });
        allHere.forEach((a, idx) => {
          const np = document.createElement('div');
          np.className = `piece p${a.ppi}`;
          np.textContent = a.iii+1;
          const r = Math.floor(idx/2), c = idx%2;
          np.style.top = r===0 ? '28%' : '72%';
          np.style.left = c===0 ? '28%' : '72%';
          np.style.transform = 'translate(-50%,-50%)';
          const canS = (gameState.currentPlayer === myIdx || isLocal) &&
            gameState.phase === 'rolling' && gameState.diceValue !== null &&
            a.ppi === gameState.currentPlayer;
          if (canS) { np.classList.add('selectable'); np.onclick = () => selectPiece(a.iii); }
          container.appendChild(np);
        });
        return;
      }
      container.appendChild(piece);
    });
  });
}

// ============ 骰子 ============
const DICE_DOTS = {
  1: [5],
  2: [1,9],
  3: [1,5,9],
  4: [1,3,7,9],
  5: [1,3,5,7,9],
  6: [1,3,4,6,7,9]
};

function renderDiceFace(value) {
  const face = document.getElementById('diceFace');
  face.innerHTML = '';
  face.style.gridTemplateColumns = 'repeat(3,1fr)';
  face.style.gridTemplateRows = 'repeat(3,1fr)';
  for (let i = 1; i <= 9; i++) {
    const slot = document.createElement('div');
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    if (DICE_DOTS[value].includes(i)) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      slot.appendChild(dot);
    }
    face.appendChild(slot);
  }
}

function showDiceResult(value) {
  diceAnimating = true;
  const dice = document.getElementById('dice');
  dice.classList.add('rolling');
  // 动画期间快速切换面
  let count = 0;
  const interval = setInterval(() => {
    renderDiceFace(Math.floor(Math.random()*6)+1);
    count++;
  }, 80);
  setTimeout(() => {
    clearInterval(interval);
    dice.classList.remove('rolling');
    renderDiceFace(value);
    diceAnimating = false;
    updateUI();
  }, 1300);
}

function onDiceClick() {
  if (diceAnimating) return;
  if (gameState.phase !== 'rolling' || gameState.diceValue !== null) return;
  if (!isLocal && gameState.currentPlayer !== myIdx) return;
  send({type:'roll'});
}

function doReroll() {
  if (diceAnimating) return;
  send({type:'reroll'});
}

function selectPiece(idx) {
  send({type:'selectPiece', pieceIndex: idx});
}

// ============ 弹窗 ============
function showTaskModal(tasks) {
  document.getElementById('t0Text').textContent = tasks[0].text;
  document.getElementById('t0Score').textContent = tasks[0].total;
  document.getElementById('t0Bonus').textContent = tasks[0].bonus;
  document.getElementById('t1Text').textContent = tasks[1].text;
  document.getElementById('t1Score').textContent = tasks[1].total;
  document.getElementById('t1Bonus').textContent = tasks[1].bonus;
  document.getElementById('taskModal').style.display = 'flex';
}
function chooseTask(idx) {
  document.getElementById('taskModal').style.display = 'none';
  send({type:'taskChoice', taskIndex: idx});
}

function showEventModal(event) {
  document.getElementById('eventName').textContent = event.name;
  document.getElementById('eventDesc').textContent = event.desc;
  document.getElementById('eventModal').style.display = 'flex';
}
function confirmEvent() {
  document.getElementById('eventModal').style.display = 'none';
  send({type:'eventConfirm'});
}

function showShopModal(shop) {
  const container = document.getElementById('shopItems');
  container.innerHTML = shop.map((item, idx) => {
    if (item.type === 'equip') {
      return `<div class="shop-item equip ${item.owned?'disabled':''}" onclick="${item.owned?'':'buyItem('+idx+')'}">
        <div class="si-name">${item.name}<span class="si-tag">装备</span></div>
        <div class="si-desc">${item.owned?'已拥有':'购买后装备'}</div>
        <div class="si-price">${item.price} 积分</div>
      </div>`;
    }
    return `<div class="shop-item" onclick="buyItem(${idx})">
      <div class="si-name">${item.name}</div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-price">${item.price} 积分</div>
    </div>`;
  }).join('');
  document.getElementById('shopModal').style.display = 'flex';
}
function buyItem(idx) { send({type:'buyItem', itemIndex:idx}); }
function closeShop() {
  document.getElementById('shopModal').style.display = 'none';
  send({type:'closeShop'});
}

function showClothesModal(data) {
  const opts = document.getElementById('clothesOptions');
  opts.innerHTML = EQUIP_KEYS.map(k => {
    const has = data.equipment[k];
    return `<div class="clothes-opt ${has?'':'off'}" ${has?`onclick="removeClothes('${k}')"`:''}>
      ${EQUIP_NAMES[k]}
    </div>`;
  }).join('');
  document.getElementById('freeCost').textContent = data.freeCost;
  const payBtn = document.getElementById('payFreeBtn');
  const canAct = isLocal || data.playerIdx === myIdx;
  payBtn.style.display = canAct ? 'block' : 'none';
  payBtn.textContent = `花${data.freeCost}积分免脱`;
  // 免脱卡
  const p = gameState.players[data.playerIdx];
  const freeBtn = document.getElementById('freeCardBtn');
  if (p && p.items.freeClothes) { freeBtn.style.display='block'; } else { freeBtn.style.display='none'; }
  document.getElementById('clothesModal').style.display = 'flex';
}
function removeClothes(k) {
  document.getElementById('clothesModal').style.display = 'none';
  send({type:'clothesChoice', choice:'remove', equip:k});
}
function payFree() {
  document.getElementById('clothesModal').style.display = 'none';
  send({type:'clothesChoice', choice:'pay'});
}
function useFreeCard() {
  document.getElementById('clothesModal').style.display = 'none';
  send({type:'clothesChoice', choice:'free'});
}

function showGameOver(winner, scores) {
  document.getElementById('overTitle').textContent = winner>=0 ? `玩家${winner+1}获胜！` : '平局！';
  document.getElementById('overScores').textContent = `玩家1：${scores[0]}积分  vs  玩家2：${scores[1]}积分`;
  document.getElementById('overModal').style.display = 'flex';
}

function restartGame() {
  document.getElementById('overModal').style.display = 'none';
  document.getElementById('taskModal').style.display = 'none';
  document.getElementById('eventModal').style.display = 'none';
  document.getElementById('shopModal').style.display = 'none';
  document.getElementById('clothesModal').style.display = 'none';
  send({type:'restart'});
}

// 初始化渲染空骰子
renderDiceFace(1);
