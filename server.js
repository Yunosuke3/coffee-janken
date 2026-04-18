// ============================================================
// コーヒーじゃんけん サーバー (Node.js + Express + Socket.IO)
// ============================================================
// ルーム単位で複数人のじゃんけんを管理。
// 勝ち残り方式で最後の1人（=奢る人）を決定する。
// ============================================================

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ---- ルーム状態の管理 ----
// rooms[roomCode] = {
//   hostId: string,
//   phase: 'lobby' | 'playing' | 'finished',
//   round: number,
//   players: { [socketId]: { name, alive, choice } },
// }
const rooms = {};

const CHOICES = ['rock', 'paper', 'scissors'];

// ルームコード（大文字英数4桁）を生成
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// クライアント向けのルーム要約を作成（choice は開示タイミング以外マスク）
function roomSnapshot(roomCode, revealChoices = false) {
  const room = rooms[roomCode];
  if (!room) return null;
  const players = Object.entries(room.players).map(([id, p]) => ({
    id,
    name: p.name,
    alive: p.alive,
    hasChosen: p.choice !== null,
    choice: revealChoices ? p.choice : null,
    isHost: id === room.hostId,
  }));
  return {
    roomCode,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    players,
  };
}

function broadcastRoom(roomCode, revealChoices = false) {
  const snap = roomSnapshot(roomCode, revealChoices);
  if (snap) io.to(roomCode).emit('room:update', snap);
}

// 生き残っている全員が choice を出し終わったか判定
function allAliveChose(room) {
  const alive = Object.values(room.players).filter(p => p.alive);
  return alive.length > 0 && alive.every(p => p.choice !== null);
}

// じゃんけんのラウンド判定
// returns: { kind: 'tie' } | { kind: 'advance', winners: [id], losers: [id] }
function judgeRound(room) {
  const alive = Object.entries(room.players).filter(([, p]) => p.alive);
  const choices = alive.map(([, p]) => p.choice);
  const set = new Set(choices);

  // 全員同じ手 or 3種すべてある → あいこ
  if (set.size === 1 || set.size === 3) {
    return { kind: 'tie' };
  }

  // 2種類のみ → 勝ち手と負け手を決定
  const [a, b] = [...set];
  // rock > scissors, scissors > paper, paper > rock
  const beats = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  let winChoice, loseChoice;
  if (beats[a] === b) { winChoice = a; loseChoice = b; }
  else { winChoice = b; loseChoice = a; }

  const winners = alive.filter(([, p]) => p.choice === winChoice).map(([id]) => id);
  const losers = alive.filter(([, p]) => p.choice === loseChoice).map(([id]) => id);
  return { kind: 'advance', winners, losers, winChoice, loseChoice };
}

// 次のラウンドに進む準備（choice をクリア）
function resetChoicesForNextRound(room) {
  for (const p of Object.values(room.players)) {
    if (p.alive) p.choice = null;
  }
}

// ---- Socket.IO ハンドラ ----
io.on('connection', (socket) => {
  // 部屋を作る
  socket.on('room:create', ({ name }, cb) => {
    name = String(name || '').trim().slice(0, 20) || 'プレイヤー';
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      phase: 'lobby',
      round: 0,
      players: {
        [socket.id]: { name, alive: true, choice: null },
      },
    };
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    cb && cb({ ok: true, roomCode });
    broadcastRoom(roomCode);
  });

  // 部屋に入る
  socket.on('room:join', ({ name, roomCode }, cb) => {
    name = String(name || '').trim().slice(0, 20) || 'プレイヤー';
    roomCode = String(roomCode || '').trim().toUpperCase();
    const room = rooms[roomCode];
    if (!room) return cb && cb({ ok: false, error: 'ルームが見つかりません' });
    if (room.phase !== 'lobby') return cb && cb({ ok: false, error: 'すでにゲームが始まっています' });
    if (Object.keys(room.players).length >= 20) return cb && cb({ ok: false, error: 'ルームが満員です' });
    room.players[socket.id] = { name, alive: true, choice: null };
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    cb && cb({ ok: true, roomCode });
    broadcastRoom(roomCode);
  });

  // ゲーム開始（ホストのみ）
  socket.on('game:start', () => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (Object.keys(room.players).length < 2) return;
    room.phase = 'playing';
    room.round = 1;
    for (const p of Object.values(room.players)) {
      p.alive = true;
      p.choice = null;
    }
    broadcastRoom(roomCode);
  });

  // 手を出す
  socket.on('game:choose', ({ choice }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room || room.phase !== 'playing') return;
    const player = room.players[socket.id];
    if (!player || !player.alive) return;
    if (!CHOICES.includes(choice)) return;
    player.choice = choice;
    broadcastRoom(roomCode);

    // 全員揃ったら結果を出す
    if (allAliveChose(room)) {
      const result = judgeRound(room);
      // 少し待ってから公開（演出用）
      setTimeout(() => {
        if (result.kind === 'tie') {
          io.to(roomCode).emit('round:result', {
            kind: 'tie',
            round: room.round,
            revealed: Object.fromEntries(
              Object.entries(room.players)
                .filter(([, p]) => p.alive)
                .map(([id, p]) => [id, p.choice])
            ),
          });
          resetChoicesForNextRound(room);
          broadcastRoom(roomCode);
        } else {
          // 負けた人を脱落
          for (const id of result.losers) {
            if (room.players[id]) room.players[id].alive = false;
          }
          io.to(roomCode).emit('round:result', {
            kind: 'advance',
            round: room.round,
            winners: result.winners,
            losers: result.losers,
            winChoice: result.winChoice,
            loseChoice: result.loseChoice,
            revealed: Object.fromEntries(
              Object.entries(room.players).map(([id, p]) => [id, p.choice])
            ),
          });

          const aliveIds = Object.entries(room.players)
            .filter(([, p]) => p.alive).map(([id]) => id);

          if (aliveIds.length === 1) {
            // ゲーム終了：最後の1人が奢る人
            room.phase = 'finished';
            const loserId = aliveIds[0];
            const loserName = room.players[loserId].name;
            io.to(roomCode).emit('game:over', {
              loserId,
              loserName,
              everyone: Object.entries(room.players).map(([id, p]) => ({ id, name: p.name })),
            });
            broadcastRoom(roomCode);
          } else {
            // 次のラウンドへ
            room.round += 1;
            resetChoicesForNextRound(room);
            broadcastRoom(roomCode);
          }
        }
      }, 800);
    }
  });

  // 同じメンバーでもう一度
  socket.on('game:restart', () => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    room.phase = 'lobby';
    room.round = 0;
    for (const p of Object.values(room.players)) {
      p.alive = true;
      p.choice = null;
    }
    broadcastRoom(roomCode);
  });

  // 切断時
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;
    delete room.players[socket.id];

    // 部屋が空になったら削除
    if (Object.keys(room.players).length === 0) {
      delete rooms[roomCode];
      return;
    }

    // ホストが抜けたら次の人をホストに
    if (room.hostId === socket.id) {
      room.hostId = Object.keys(room.players)[0];
    }

    // プレイ中に抜けた人がいて、残りの生存者が全員手を出し終わっていたら判定を進める
    if (room.phase === 'playing' && allAliveChose(room)) {
      // 単純化のため一度ラウンドをやり直す（脱落者が減ったケースの不整合を防ぐ）
      resetChoicesForNextRound(room);
    }

    // 残り1人になったらロビーに戻す
    if (room.phase === 'playing' && Object.values(room.players).filter(p => p.alive).length <= 1) {
      room.phase = 'lobby';
      room.round = 0;
      for (const p of Object.values(room.players)) {
        p.alive = true;
        p.choice = null;
      }
    }

    broadcastRoom(roomCode);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`☕ Coffee Janken server listening on http://localhost:${PORT}`);
});
