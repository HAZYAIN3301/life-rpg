FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIPER_DATA_DIR=/opt/piper/voices

RUN python -m pip install --no-cache-dir "piper-tts[http]==1.6.0" \
    && mkdir -p "$PIPER_DATA_DIR" \
    && python -m piper.download_voices --download-dir "$PIPER_DATA_DIR" \
      ru_RU-dmitri-medium \
      uk_UA-mykyta-high \
      en_US-joe-medium \
      de_DE-thorsten-high \
      es_ES-davefx-medium

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '5000') + '/info', timeout=2)" || exit 1

CMD ["sh", "-c", "python -m piper.http_server -m ru_RU-dmitri-medium --data-dir /opt/piper/voices --host 0.0.0.0 --port ${PORT:-5000}"]
