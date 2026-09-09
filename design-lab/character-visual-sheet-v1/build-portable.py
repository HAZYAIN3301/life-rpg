"""Вшивает уменьшенные копии ассетов в HTML. Оригиналы не трогает."""
import base64, mimetypes, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'index.html')
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'visual-sheet-portable.html'))

# Предельная сторона по назначению кадра — примерно вдвое больше размера показа,
# чтобы на retina не мылилось, и во много раз меньше оригинала.
TARGETS = (
    ('den-day.jpg', 900), ('den-night-lantern.jpg', 900),
    ('attune-', 460), ('shadow-', 340),
    ('body-visible-approved', 480), ('traveller-face-', 240),
    ('reward-atlas', 420), ('-runtime', 260), ('portal-reach', 260),
    ('content-raster-v208', 200),   # иконки показываются в 96px
)
DEFAULT_MAX = 400

def target_for(name):
    for key, size in TARGETS:
        if key in name:
            return size
    return DEFAULT_MAX

def main():
    html = open(SRC, encoding='utf-8').read()
    srcs = sorted(set(re.findall(r'src="([^"]+)"', html)))
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for rel in srcs:
            path = os.path.normpath(os.path.join(HERE, rel))
            if not os.path.exists(path):
                sys.exit(f'нет файла: {path}')
            small = os.path.join(tmp, os.path.basename(path))
            subprocess.run(['sips', '-Z', str(target_for(rel)), path,
                            '--out', small], check=True, capture_output=True)
            data = open(small, 'rb').read()
            total += len(data)
            mime = mimetypes.guess_type(path)[0] or 'image/png'
            uri = f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')
            html = html.replace(f'src="{rel}"', f'src="{uri}"')

    html = html.replace('<p class="note">Не таблица файлов',
                        '<p class="note"><b>Переносимая копия.</b> Изображения уменьшены до размера '
                        'показа и вшиты в файл, поэтому он открывается где угодно, включая телефон. '
                        'Оригиналы — в <code>public/art</code>.<br>Не таблица файлов')
    open(OUT, 'w', encoding='utf-8').write(html)
    print(f'{len(srcs)} изображений · {total/1024/1024:.1f} MB после уменьшения '
          f'· файл {os.path.getsize(OUT)/1024/1024:.1f} MB')
    print(OUT)

if __name__ == '__main__':
    main()
