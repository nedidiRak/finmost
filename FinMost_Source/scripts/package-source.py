"""Архив исходников и снимок Git без зависимостей, токенов и данных браузера."""
from pathlib import Path
import html
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile

root=Path(__file__).resolve().parents[1]
dist=root/'dist'
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else dist/'downloads'
out.mkdir(parents=True,exist_ok=True)

def git(*args,cwd=None):
    return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()

files=[root/'README.md',root/'package.json',root/'.gitignore']
files += [dist/n for n in ['index.html','styles.css','engine.js','learning.js','app.js','icon.svg']]
for folder in ['docs','tests','scripts']:
    files += [p for p in sorted((root/folder).rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
bare=dist/'code.git'
with tempfile.TemporaryDirectory(prefix='finmost-source-') as temp:
    snapshot=Path(temp)/'snapshot'
    if bare.exists():
        git('clone','--quiet',str(bare),str(snapshot))
        for p in snapshot.iterdir():
            if p.name!='.git':
                if p.is_dir():shutil.rmtree(p)
                else:p.unlink()
    else:
        snapshot.mkdir();git('init','--quiet','-b','main',cwd=snapshot)
        git('init','--quiet','--bare',str(bare));git('remote','add','origin',str(bare),cwd=snapshot)
    for p in files:
        target=snapshot/p.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(p,target)
    git('config','user.name','FinMost contributors',cwd=snapshot)
    git('config','user.email','finmost@users.invalid',cwd=snapshot)
    git('add','-A',cwd=snapshot)
    changed=subprocess.run(['git','diff','--cached','--quiet'],cwd=snapshot).returncode
    if changed:
        git('commit','--quiet','-m','Publish contest materials and GitHub submission instructions',cwd=snapshot)
    git('push','--quiet','origin','HEAD:main',cwd=snapshot)
    git('--git-dir',str(bare),'update-server-info')
    sha=git('rev-parse','HEAD',cwd=snapshot)
    history=git('log','--format=%h | %cs | %s',cwd=snapshot).splitlines()
    source=dist/'source'
    if (source/'files').exists():shutil.rmtree(source/'files')
    for p in files:
        target=source/'files'/p.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(p,target)
    archive=out/'FinMost_Source.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in files:z.write(p,'FinMost_Source/'+str(p.relative_to(root)))
    download=dist/'downloads'/'FinMost_Source.zip'
    download.parent.mkdir(exist_ok=True)
    if archive.resolve()!=download.resolve():shutil.copyfile(archive,download)
    items=''.join('<li><a href="files/'+html.escape(str(p.relative_to(root)),quote=True)+'">'+html.escape(str(p.relative_to(root)))+'</a></li>' for p in files)
    log=''.join('<li><code>'+html.escape(line)+'</code></li>' for line in history)
    page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ФинМост 1.1 — исходники</title><style>body{font:16px/1.7 system-ui;max-width:950px;margin:45px auto;padding:0 24px;color:#23345a;background:#f8faff}a{color:#244bc7}code{overflow-wrap:anywhere}h1{line-height:1.2}li{margin:5px 0}.note{background:#eaf0ff;border-radius:12px;padding:17px}</style><h1>ФинМост 1.1 — исходный код</h1><p>Работающий браузерный MVP: 10 уроков, 30 вопросов, бюджет, безопасность и календарь ИП. Внешних зависимостей нет.</p><p class="note">Приложение, исходники и Git-история открыты для конкурсной демонстрации. Git HTTPS: <code>https://finmost-navigator.aquabay4.chatgpt.site/code.git</code>. Для зеркала на GitHub используйте <a href="files/docs/GITHUB_GUIDE.md">пошаговую инструкцию</a>. Архив не подменяет ссылку на Git-репозиторий.</p><p><a href="/">Открыть приложение</a> · <a href="/downloads/FinMost_Source.zip">Скачать исходники ZIP</a> · <a href="/downloads/FinMost.html">Скачать автономный HTML</a></p><p>Клонирование: <code>git clone https://finmost-navigator.aquabay4.chatgpt.site/code.git FinMost</code></p><p><a href="/submission/">Презентация и аналитика проекта →</a></p><h2>История Git</h2><p>Реальные снимки подготовки прототипа. Автор записан техническим именем, личные данные команды не придуманы.</p><ul>'''+log+'''</ul><p>Текущий коммит: <code>'''+sha+'''</code></p><h2>Файлы</h2><ul>'''+items+'''</ul><p>Проверки: <code>npm test</code> и <code>npm run check</code>. Автономный HTML собирается командой <code>python scripts/build-portable.py</code>.</p></html>'''
    source.mkdir(exist_ok=True);(source/'index.html').write_text(page,encoding='utf-8')
    version={'version':'1.1.0','source_commit':sha,'source_history':history,'access':'public','archive':'FinMost_Source.zip','lesson_count':10,'questions':30}
    (out/'source-version.json').write_text(json.dumps(version,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(version,ensure_ascii=False))
