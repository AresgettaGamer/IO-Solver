"""Genera los documentos de prueba (PDF con texto, escaneados, mixtos, imágenes, corruptos) con Chromium + PIL.
Uso: python3 tests/make_fixtures.py   (requiere playwright y pillow)"""
import io, os, random, html
from playwright.sync_api import sync_playwright
from PIL import Image, ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); FX=os.path.join(HERE,'fixtures'); os.makedirs(FX,exist_ok=True)
CSS="""body{font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;margin:36px;line-height:1.45}h1{font-size:20px}h2{font-size:17px;margin:22px 0 6px}
table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #333;padding:7px 16px;text-align:center;font-size:16px}th{background:#eee}p{margin:6px 0}.pg{color:#666;font-size:12px;margin-top:30px}"""
def table(sources,dests,costs,supply=None,demand=None,corner='Origen / Destino',supply_head='Oferta',demand_label='Demanda',total=False):
    h='<tr><th>%s</th>%s%s</tr>'%(corner,''.join('<th>%s</th>'%html.escape(d) for d in dests),('<th>%s</th>'%supply_head) if supply else '')
    rows=''
    for i,s in enumerate(sources):
        rows+='<tr><th>%s</th>%s%s</tr>'%(html.escape(s),''.join('<td>%s</td>'%c for c in costs[i]),('<td>%s</td>'%supply[i]) if supply else '')
    if demand: rows+='<tr><th>%s</th>%s%s</tr>'%(demand_label,''.join('<td>%s</td>'%d for d in demand),('<td>%d</td>'%sum(demand) if total else '<td></td>') if supply else '')
    return '<table>'+h+rows+'</table>'
SURPLUS=dict(src=['A','B','C'],dst=['C1','C2','C3','C4'],costs=[[8,3,4,5],[7,6,5,2],[2,4,3,3]],supply=[550,300,260],demand=[250,300,200,160])
BAL=dict(src=['A','B','C'],dst=['D','E','F','G','H'],costs=[[42,42,44,40,44],[34,42,40,46,48],[46,44,42,48,46]],supply=[19,28,25],demand=[11,13,7,17,24])
SHORT=dict(src=['Planta 1','Planta 2'],dst=['Cliente 1','Cliente 2','Cliente 3'],costs=[[5,7,6],[4,3,8]],supply=[100,120],demand=[90,80,70])
def page(body): return '<!doctype html><meta charset=utf-8><style>%s</style>%s'%(CSS,body)
SIMPLEX1='''<h2>Ejercicio 1</h2><p>Una empresa fabrica dos productos. Maximizar Z = 300 X1 + 150 X2</p><p>Sujeto a:</p><p>4 X1 + 2 X2 &lt;= 40</p><p>2 X1 + X2 &lt;= 18</p><p>X1, X2 &gt;= 0</p>'''
SIMPLEX2='''<h2>Ejercicio 2</h2><p>Minimizar Z = 2 X1 + 3 X2</p><p>Sujeto a:</p><p>X1 + X2 &gt;= 8</p><p>X1 + 3 X2 &gt;= 12</p><p>X1, X2 &gt;= 0</p>'''
def T(m,title,**kw): return '<h2>%s</h2><p>Problema de transporte.</p>%s<p class="pg">Página 1 · ref. 550</p>'%(title,table(m['src'],m['dst'],m['costs'],m['supply'],m['demand'],**kw))
def degrade(png,rot=0.8,noise=10,blur=0.6):
    im=Image.open(io.BytesIO(png)).convert('L'); im=im.rotate(rot,expand=True,fillcolor=250); im=im.filter(ImageFilter.GaussianBlur(blur))
    px=im.load(); rnd=random.Random(7)
    for y in range(0,im.height):
        for x in range(0,im.width,2):
            v=px[x,y]+rnd.randint(-noise,noise); px[x,y]=max(0,min(255,v))
    return im
def to_png(im,path): im.save(path,'PNG')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':900,'height':700},device_scale_factor=2)
    def pdf(name,body):
        pg.set_content(page(body)); pg.pdf(path=os.path.join(FX,name),format='A4',print_background=True)
    def shot(body,sel='body'):
        pg.set_content(page(body)); return pg.locator(sel).screenshot()
    pdf('simplex_text.pdf',SIMPLEX1+SIMPLEX2)
    pdf('transport_table.pdf',T(SURPLUS,'Ejercicio 3: Transporte',supply_head='Oferta'))
    pdf('transport_balanced.pdf',T(BAL,'Ejercicio 4: Distribución de producto'))
    pdf('transport_shortage.pdf',T(SHORT,'Ejercicio 5: Demanda superior a la oferta'))
    # enunciado con ofertas en el texto + X en la tabla
    stm='<h2>Ejercicio 6: Rutas imposibles</h2><p>Una compañía tiene tres fábricas A, B y C que producen 550, 300 y 260 unidades, respectivamente. Los cuatro clientes C1, C2, C3 y C4 demandan lo indicado en la tabla. No es posible transportar desde la fábrica B hasta el cliente C1.</p>'+table(SURPLUS['src'],SURPLUS['dst'],[[8,3,4,5],['X',6,5,2],[2,4,3,3]],None,SURPLUS['demand'])+'<p class="pg">Página 2</p>'
    pdf('transport_statement_x.pdf',stm)
    # multi ejercicio (3 ejercicios en 2 páginas)
    pdf('multi_exercises.pdf',SIMPLEX1+SIMPLEX2+'<div style="page-break-before:always"></div>'+T(SURPLUS,'Ejercicio 3: Transporte'))
    # escaneados
    sc_t=degrade(shot(T(SURPLUS,'Ejercicio 3: Transporte'),'body'))
    to_png(sc_t,os.path.join(FX,'transport_scan.png')); sc_t.convert('RGB').save(os.path.join(FX,'transport_scan.jpg'),'JPEG',quality=72)
    sc_s=degrade(shot(SIMPLEX1,'body'),rot=0.5,noise=8); to_png(sc_s,os.path.join(FX,'simplex_scan.png'))
    def img_pdf(name,pngpath):
        import base64
        b64=base64.b64encode(open(pngpath,'rb').read()).decode()
        pg.set_content('<!doctype html><style>@page{margin:0}body{margin:0}img{width:100%%;display:block}</style><img src="data:image/png;base64,%s">'%b64); pg.pdf(path=os.path.join(FX,name),format='A4',print_background=True)
    img_pdf('transport_scanned.pdf',os.path.join(FX,'transport_scan.png')); img_pdf('simplex_scanned.pdf',os.path.join(FX,'simplex_scan.png'))
    # mixto: enunciado seleccionable + tabla como imagen
    tab_png=pg.set_content(page(table(SURPLUS['src'],SURPLUS['dst'],SURPLUS['costs'],SURPLUS['supply'],SURPLUS['demand']))) or pg.locator('table').screenshot()
    tab_im=degrade(tab_png,rot=0.3,noise=6,blur=0.4); to_png(tab_im,os.path.join(FX,'_tabla.png'))
    import base64
    b64=base64.b64encode(open(os.path.join(FX,'_tabla.png'),'rb').read()).decode()
    pdf('transport_mixed.pdf','<h2>Ejercicio 7: Transporte (documento mixto)</h2><p>Tres fábricas A, B y C abastecen a cuatro clientes C1 a C4. La siguiente tabla muestra los costos unitarios de envío, la oferta de cada fábrica y la demanda de cada cliente.</p><img src="data:image/png;base64,%s" style="width:560px">'%b64+'<p class="pg">Página 1</p>')
    os.remove(os.path.join(FX,'_tabla.png'))
    pg.set_content('<!doctype html><p>&nbsp;</p>'); pg.pdf(path=os.path.join(FX,'blank.pdf'))
    pdf('multi_transport.pdf',T(BAL,'Ejercicio 1: Distribución D–H')+'<div style="page-break-before:always"></div>'+T(SHORT,'Ejercicio 2: Demanda superior a la oferta'))
    # --- casos de error / incompletos ---
    inc=table(['A','B','C'],['C1','C2','C3','C4'],[[8,3,4,5],[7,'',5,2],[2,4,3,3]],[550,300,260],[250,300,200,160])
    pdf('transport_incomplete.pdf','<h2>Ejercicio 8: Tabla incompleta</h2><p>Falta un costo en la tabla.</p>'+inc)
    sym=table(['A','B','C'],['C1','C2','C3','C4'],[[8,3,4,5],[7,6,5,2],[2,4,3,3]],['5O0',300,260],[250,300,200,'l60'])
    pdf('transport_symbols.pdf','<h2>Ejercicio 9: Símbolos dudosos</h2><p>Dos cifras contienen letras en lugar de dígitos.</p>'+sym)
    pg.set_content(page('<p>&nbsp;</p><div style="page-break-after:always"></div>'+T(SURPLUS,'Ejercicio 3: Transporte (tras una página en blanco)'))); pg.pdf(path=os.path.join(FX,'transport_blank_first.pdf'),format='A4',print_background=True)

    b.close()
open(os.path.join(FX,'corrupt.pdf'),'wb').write(b'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n'+bytes(random.Random(3).randrange(256) for _ in range(300)))
open(os.path.join(FX,'not_a_pdf.pdf'),'wb').write(b'esto no es un pdf')
print(sorted(os.listdir(FX)))
