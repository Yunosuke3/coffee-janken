# ☕ コーヒーじゃんけん

複数人がそれぞれの端末からアクセスして、リアルタイムでじゃんけんができる Web アプリです。
**勝ち残り方式**で最後の1人になった人が、全員分のコーヒーを奢ります。

- 2〜10人程度（最大20人）で遊べます
- 各プレイヤーは自分のスマホ / PC から参加できます
- ルームコード（4桁）または URL で部屋を共有
- カジュアル＆ポップなデザイン

---

## 🚀 まずはローカルで試す

```bash
# Node.js 18 以上が必要
npm install
npm start
```

ブラウザで http://localhost:3000 を開いて、同じマシンの別タブや同じ Wi-Fi 上のスマホ
（`http://<あなたのPCのIP>:3000`）からアクセスすれば動作確認できます。

---

## 🌐 Web に公開する方法

「サーバーが必要なアプリ」なので、GitHub Pages のような静的ホスティングではなく、
**Node.js が動く無料サービス**にデプロイします。どれも数分で完了します。

### 方法1: Render.com（おすすめ・無料）

1. このフォルダを GitHub に push する
   ```bash
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/<あなた>/coffee-janken.git
   git push -u origin main
   ```
2. https://render.com にサインアップ
3. 「New +」→「Web Service」→ GitHub 連携で上記リポジトリを選択
4. 設定は自動で読み取られます（念のため）:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. Deploy を押すと数分で `https://coffee-janken-xxxx.onrender.com` のような URL が発行され、
   世界中どこからでもアクセスできるようになります。

> 無料プランはアクセスが無いと一時停止されますが、最初のアクセス時に自動起動します（数十秒待つ）。

### 方法2: Railway

1. https://railway.app にサインアップ
2. 「New Project」→「Deploy from GitHub repo」で本リポジトリを選択
3. 自動で `npm start` が実行され、公開 URL が発行されます

### 方法3: Glitch（一番手軽・GitHub 不要）

1. https://glitch.com にアクセス
2. 「New project」→「Import from GitHub」（もしくはファイルを直接アップロード）
3. そのまま公開されます

### 方法4: Fly.io / Vercel（Node サーバー）/ VPS

Node.js + WebSocket (Socket.IO) が動けばどこでも OK です。

---

## 🎮 遊び方

1. 誰か1人が「新しい部屋を作る」を押してホストになる
2. 表示された **4桁のコード** または **共有URL** を他のメンバーに送る
3. 全員集まったら、ホストが「ゲームを始める」を押す
4. 各ラウンドで ✊ グー / ✋ パー / ✌️ チョキ を選ぶ
5. 負けた人は脱落、勝った人は次のラウンドへ（あいこなら全員もう一度）
6. **最後に1人だけ残った人**が、全員分のコーヒー奢り決定 ☕

---

## 📁 ファイル構成

```
coffee-janken/
├── package.json        # 依存パッケージ
├── server.js           # Node.js + Socket.IO サーバー
├── public/
│   └── index.html      # フロントエンド（単一HTMLにCSS/JS同梱）
└── README.md           # このファイル
```

## 🛠 技術スタック

- バックエンド: **Node.js + Express + Socket.IO**（WebSocket でリアルタイム同期）
- フロントエンド: プレーンな HTML / CSS / JavaScript（フレームワーク不要）
- 外部データベース不要（ルーム情報はサーバーのメモリ上で管理）

## 💡 カスタマイズ例

- `server.js` 内の `if (Object.keys(room.players).length >= 20)` を変更すれば最大人数を変えられます
- ルール変更（例: 1人脱落 → 1人勝ち方式）は `judgeRound` 関数を編集
- デザインは `public/index.html` の `<style>` ブロック内の CSS 変数（`--accent` など）で色味を調整できます

---

Enjoy your coffee! ☕️
