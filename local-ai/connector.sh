#!/bin/sh
# Satoru — локальная модель. Этот компьютер отвечает Satoru своей моделью Ollama.
# Наружу ничего не открывается: скрипт сам ходит к Satoru (исходящее соединение) и к Ollama
# на 127.0.0.1. Задание — готовое тело запроса /api/chat; другие адреса Ollama не трогаются.
# Отключить на этом компьютере: sh "$HOME/.satoru-local-ai/connector.sh" --uninstall
SATORU_URL="${SATORU_URL:-__SATORU_URL__}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
DIR="${SATORU_LOCAL_AI_DIR:-$HOME/.satoru-local-ai}"
LABEL="com.satoruapp.local-ai"
umask 077

uninstall() {
  rm -rf "$DIR"
  if [ "$(uname)" = Darwin ]; then
    rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  elif command -v systemctl >/dev/null 2>&1; then
    rm -f "$HOME/.config/systemd/user/satoru-local-ai.service"
    systemctl --user disable --now satoru-local-ai.service 2>/dev/null
  fi
  echo "Satoru: локальная модель на этом компьютере отключена."
}
if [ "${1:-}" = "--uninstall" ]; then uninstall; exit 0; fi

TOKEN=$(cat "$DIR/token" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "Satoru: нет ключа подключения — запусти установку из Настроек заново."; exit 1; fi

i=0
while :; do
  # Раз в ~10 опросов: какие модели стоят. Ollama не отвечает — ждём и Satoru не дёргаем.
  if [ $((i % 10)) -eq 0 ]; then
    if [ -f "$DIR/connector.log" ] && [ "$(wc -c < "$DIR/connector.log")" -gt 1048576 ]; then : > "$DIR/connector.log"; fi
    if ! curl -fsS --max-time 5 -o "$DIR/tags.json" "$OLLAMA_URL/api/tags"; then sleep 15; continue; fi
    code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' --data-binary @"$DIR/tags.json" "$SATORU_URL/api/local-ai/hello")
    if [ "$code" = 410 ]; then uninstall; exit 0; fi
  fi
  i=$((i + 1))
  code=$(curl -sS --max-time 40 -o "$DIR/job.json" -D "$DIR/job.head" -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" "$SATORU_URL/api/local-ai/next")
  case "$code" in
    200)
      job=$(sed -n 's/^[Xx]-[Ss]atoru-[Jj]ob: *\([A-Za-z0-9_-]*\).*/\1/p' "$DIR/job.head" | head -n 1)
      # Сразу подтвердить: задание, полученное после сна компьютера, Satoru уже отдал другому.
      ack=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" \
        -H "X-Satoru-Job: $job" "$SATORU_URL/api/local-ai/ack")
      if [ "$ack" = 204 ]; then
        : > "$DIR/answer.json"
        st=$(curl -sS -o "$DIR/answer.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
          --data-binary @"$DIR/job.json" "$OLLAMA_URL/api/chat")
        curl -sS --max-time 30 -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" -H "X-Satoru-Job: $job" \
          -H "X-Ollama-Status: ${st:-0}" -H 'Content-Type: application/json' --data-binary @"$DIR/answer.json" \
          "$SATORU_URL/api/local-ai/result"
      fi
      rm -f "$DIR/job.json" "$DIR/answer.json"
      ;;
    204) ;;
    410) uninstall; exit 0 ;;
    *) sleep 10 ;;
  esac
done
