import { useEffect, useRef, useState } from 'react';
function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open('satoru-b2-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
export async function putMedia(id: string, blob: Blob) {
  const d = await db();
  return new Promise<void>((ok, fail) => {
    const tx = d.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put(blob, id);
    tx.oncomplete = () => {
      d.close();
      ok();
    };
    tx.onerror = () => {
      d.close();
      fail(tx.error);
    };
    tx.onabort = () => {
      d.close();
      fail(tx.error);
    };
  });
}
export function MediaPlayer({
  id,
  kind
}: {
  id: string;
  kind: string;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      u = '';
    db().then(d => {
      const r = d.transaction('blobs').objectStore('blobs').get(id);
      r.onsuccess = () => {
        d.close();
        if (!active) return;
        if (r.result) {
          u = URL.createObjectURL(r.result);
          setUrl(u);
        } else setError('Медиа недоступно в этом браузере.');
      };
      r.onerror = () => setError('Не удалось загрузить запись.');
    }).catch(() => setError('Хранилище медиа недоступно.'));
    return () => {
      active = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return error ? <p role="alert">{error}</p> : !url ? <p>Загрузка записи…</p> : kind === 'video' ? <video src={url} controls playsInline preload="metadata" /> : <audio src={url} controls preload="metadata" />;
}
export function Capture({
  onCapture
}: {
  onCapture: (blob: Blob, kind: string) => void;
}) {
  const [recording, setRecording] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const rec = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (rec.current?.state === 'recording') rec.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, []);
  async function start(kind: string) {
    setError('');
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('Запись недоступна в этом браузере. Можно прикрепить файл.');
      const s = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? {
          facingMode: 'user'
        } : false
      });
      if (!active.current) {
        s.getTracks().forEach(t => t.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s);
      rec.current = r;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      r.ondataavailable = e => {
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > 20 * 1024 * 1024 && r.state === 'recording') r.stop();
      };
      r.onstop = () => {
        s.getTracks().forEach(t => t.stop());
        if (active.current) {
          setRecording('');
          onCapture(new Blob(chunks, {
            type: r.mimeType
          }), kind);
        }
      };
      r.onerror = () => {
        s.getTracks().forEach(t => t.stop());
        if (active.current) {
          setRecording('');
          setError('Запись прервалась. Можно повторить или прикрепить готовый файл.');
        }
      };
      r.start(1000);
      setRecording(kind);
    } catch (e) {
      stream.current?.getTracks().forEach(t => t.stop());
      setRecording('');
      setError((e as Error).name === 'NotAllowedError' ? 'Доступ не разрешён. Текст сохранится; можно прикрепить готовую запись.' : (e as Error).message || 'Не удалось начать запись.');
    } finally {
      setBusy(false);
    }
  }
  return <div className="wb-capture">{recording ? <button type="button" className="wb-recording" onClick={() => rec.current?.stop()}>Остановить {recording === 'video' ? 'видео' : 'аудио'} и прикрепить</button> : <div className="wb-actions"><button type="button" disabled={busy} onClick={() => start('voice')}>Записать аудио</button><button type="button" disabled={busy} onClick={() => start('video')}>Записать видео</button><label className="wb-upload">Прикрепить файл<input type="file" accept="audio/*,video/*" onChange={e => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 25 * 1024 * 1024) {
            setError('Выбери запись до 25 МБ.');
            return;
          }
          if (!/^(audio|video)\//.test(f.type)) {
            setError('Нужен аудио- или видеофайл.');
            return;
          }
          onCapture(f, f.type.startsWith('video') ? 'video' : 'voice');
        }} /></label></div>}{busy && <p role="status">Ожидаем доступ к микрофону{recording === 'video' ? ' и камере' : ''}…</p>}{error && <p className="wb-error" role="alert">{error}</p>}</div>;
}
