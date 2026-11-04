import sys, zipfile, re, html, xml.etree.ElementTree as ET
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def rows(path):
    z = zipfile.ZipFile(path)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
    import datetime
    fmts = {}; xfs = []
    if 'xl/styles.xml' in z.namelist():
        st = ET.fromstring(z.read('xl/styles.xml'))
        for f in st.iter('{%s}numFmt' % ns['m']): fmts[int(f.get('numFmtId'))] = f.get('formatCode')
        cx = st.find('m:cellXfs', ns)
        xfs = [int(x.get('numFmtId', 0)) for x in cx.findall('m:xf', ns)] if cx is not None else []
    def fmt(val, s):
        fid = xfs[int(s)] if s is not None and int(s) < len(xfs) else 0
        code = fmts.get(fid, '')
        try: num = float(val)
        except: return val
        if 14 <= fid <= 22 or re.search(r'[yd]', code.lower()):
            d = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=num)
            return d.strftime('%Y-%m-%d %H:%M' if ('h' in code.lower() or num % 1) else '%Y-%m-%d')
        if fid in (3, 4) or '#,##0' in code: return f'{num:,.0f}'
        return f'{num:.15g}'
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    out = []
    for r in sheet.find('m:sheetData', ns).findall('m:row', ns):
        row = {}
        for c in r.findall('m:c', ns):
            col = re.match(r'[A-Z]+', c.get('r')).group()
            idx = 0
            for ch in col: idx = idx * 26 + ord(ch) - 64
            v = c.find('m:v', ns); t = c.get('t')
            if t == 's' and v is not None: val = ss[int(v.text)]
            elif t == 'inlineStr': val = ''.join(x.text or '' for x in c.iter('{%s}t' % ns['m']))
            else: val = fmt(v.text, c.get('s')) if v is not None else ''
            row[idx] = val
        out.append([row.get(i, '') for i in range(1, max(row) + 1)] if row else [])
    return out
title, path = sys.argv[1], sys.argv[2]
rs = rows(path)
w = max(len(r) for r in rs)
cells = lambda r, tag: ''.join(f'<{tag}>{html.escape(str(x))}</{tag}>' for x in r + [''] * (w - len(r)))
body = f'<tr><th class=n></th>{"".join(f"<th class=n>{chr(65+i) if i<26 else chr(64+i//26)+chr(65+i%26)}</th>" for i in range(w))}</tr>'
for i, r in enumerate(rs, 1):
    body += f'<tr><th class=n>{i}</th>{cells(r, "th" if i == 1 else "td")}</tr>'
print(f'''<html><head><meta charset=utf-8><style>body{{font-family:-apple-system,"Apple SD Gothic Neo";font-size:12px;margin:16px}}h3{{margin:0 0 8px}}table{{border-collapse:collapse}}td,th{{border:1px solid #d0d0d0;padding:4px 8px;white-space:nowrap;text-align:left}}th{{background:#eef3ea}}th.n{{background:#f3f3f3;color:#666;text-align:center;font-weight:normal}}</style></head><body><h3>{html.escape(title)}</h3><table>{body}</table></body></html>''')
