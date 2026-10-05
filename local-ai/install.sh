#!/bin/sh
# Satoru — подключение локальной модели (Ollama) этого компьютера к аккаунту Satoru.
# Запуск: sh satoru-local-ai.sh <код из Настроек Satoru>
# Что делает: проверяет Ollama на 127.0.0.1, привязывает компьютер по коду, кладёт ключ и
# коннектор в ~/.satoru-local-ai и ставит автозапуск (macOS — LaunchAgent, Linux — systemd --user).
SATORU_URL="${SATORU_URL:-__SATORU_URL__}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
DIR="${SATORU_LOCAL_AI_DIR:-$HOME/.satoru-local-ai}"
LABEL="com.satoruapp.local-ai"
CODE="${1:-}"
say() { printf '%s\n' "$*"; }

if [ -z "$CODE" ]; then say "Нужен код: Satoru → Настройки → ИИ → Локальная модель → Подключить компьютер."; exit 1; fi
command -v curl >/dev/null 2>&1 || { say "Нужен curl."; exit 1; }
if ! curl -fsS --max-time 5 -o /dev/null "$OLLAMA_URL/api/tags"; then
  say "Ollama не отвечает на $OLLAMA_URL."
  say "Установи и запусти Ollama: https://ollama.com/download — и скачай модель, например: ollama pull qwen3.5:9b"
  exit 1
fi
case "$(uname)" in
  Darwin) PLATFORM=macos; NAME=$(scutil --get ComputerName 2>/dev/null || hostname) ;;
  Linux) PLATFORM=linux; NAME=$(hostname) ;;
  *) PLATFORM=other; NAME=$(hostname) ;;
esac

umask 077
mkdir -p "$DIR"
TOKEN=$(curl -fsS --max-time 20 -X POST --data-urlencode "code=$CODE" --data-urlencode "name=$NAME" \
  --data-urlencode "platform=$PLATFORM" "$SATORU_URL/api/local-ai/pair") || { say "Код не подошёл или устарел — возьми новый в Настройках."; exit 1; }
case "$TOKEN" in sd1.*) ;; *) say "Satoru ответил неожиданно — попробуй ещё раз."; exit 1 ;; esac
printf '%s' "$TOKEN" > "$DIR/token"
curl -fsS --max-time 20 -o "$DIR/connector.sh" "$SATORU_URL/local-ai/connector.sh" || { say "Не удалось скачать коннектор."; exit 1; }
chmod 700 "$DIR/connector.sh"

if [ "${SATORU_LOCAL_AI_NO_SERVICE:-}" = 1 ]; then say "Готово. Запуск: sh \"$DIR/connector.sh\""; exit 0; fi
if [ "$PLATFORM" = macos ]; then
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$DIR/connector.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$DIR/connector.log</string>
  <key>StandardErrorPath</key><string>$DIR/connector.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  launchctl bootstrap "gui/$(id -u)" "$PLIST" || { say "Не удалось включить автозапуск. Запуск вручную: sh \"$DIR/connector.sh\""; exit 1; }
elif command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/satoru-local-ai.service" <<EOF
[Unit]
Description=Satoru local AI connector
After=network-online.target
[Service]
ExecStart=/bin/sh $DIR/connector.sh
Restart=on-failure
RestartSec=10
[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload && systemctl --user enable --now satoru-local-ai.service || { say "Не удалось включить автозапуск. Запуск вручную: sh \"$DIR/connector.sh\""; exit 1; }
else
  say "Готово. Запусти коннектор и оставь окно открытым: sh \"$DIR/connector.sh\""
  exit 0
fi
say "Готово: «$NAME» подключён. Satoru отвечает моделью этого компьютера, пока он не спит."
say "Модель выбирается в Настройках Satoru. Отключить: sh \"$DIR/connector.sh\" --uninstall"
