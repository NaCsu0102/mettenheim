#!/usr/bin/env bash
# Установка бота «Хроники Меттенхейма» на чистый Ubuntu 22.04/24.04.
# Запуск:  bash <(curl -fsSL https://raw.githubusercontent.com/NaCsu0102/mettenheim/main/bot/install.sh)
set -e
DIR=/opt/mettenheim-bot
RAW=https://raw.githubusercontent.com/NaCsu0102/mettenheim/main/bot
echo "== Ставлю Node.js 20 =="
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  apt-get update -y && apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
mkdir -p "$DIR" && cd "$DIR"
echo "== Скачиваю бота =="
curl -fsSL "$RAW/package.json" -o package.json
curl -fsSL "$RAW/index.js" -o index.js
npm install --omit=dev --no-audit --no-fund
if [ ! -s .env ]; then
  echo
  echo "Вставь токен бота (Discord Developer Portal → Bot → Reset Token) и нажми Enter."
  echo "Символы не будут видны — так и задумано."
  read -rs TOKEN
  [ -z "$TOKEN" ] && { echo "Токен пустой — запусти установку ещё раз."; exit 1; }
  printf 'DISCORD_BOT_TOKEN=%s\n' "$TOKEN" > .env
  chmod 600 .env
fi
cat > /etc/systemd/system/mettenheim-bot.service <<UNIT
[Unit]
Description=Mettenheim Discord bot
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
ExecStart=/usr/bin/node $DIR/index.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now mettenheim-bot
sleep 4
systemctl --no-pager --lines=5 status mettenheim-bot || true
echo
echo "Готово. Бот работает и сам перезапустится после перезагрузки сервера."
echo "Обновить бота: запусти эту же команду ещё раз. Журнал: journalctl -u mettenheim-bot -f"
