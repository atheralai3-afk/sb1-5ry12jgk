import pathlib
d = pathlib.Path(__file__).parent / 'src'
src = (d/'index.src.html').read_text()
for k, f in (('/*CSS*/','style.css'),('/*BANK*/','bank.js'),('/*ENGINE*/','engine.js'),('/*GAME*/','game.js')):
    body = (d/f).read_text()
    if f == 'engine.js': body = body.replace("if (typeof module !== 'undefined')", "if (false)")
    assert '</script' not in body.lower(), f
    src = src.replace(k, body, 1)
(d.parent/'index.html').write_text(src)
print('index.html', round(len(src)/1024), 'KB')
