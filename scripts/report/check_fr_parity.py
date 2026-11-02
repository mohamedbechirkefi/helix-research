# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
# Parity check between paper/report.en.md and paper/report.fr.md (numbers, claim ids, journal ids, headings, table rows).
# Usage: python3 -I scripts/report/check_fr_parity.py paper/report.en.md paper/report.fr.md
import re, sys, collections
en = open(sys.argv[1], encoding='utf-8').read()
fr = open(sys.argv[2], encoding='utf-8').read()
def nums(t): return collections.Counter(re.findall(r'\d+(?:[.,:]\d+)*(?:-\d+(?:[.,]\d+)*)*', t))
def cids(t): return collections.Counter(re.findall(r'\bC\d{2}\b', t))
def hx(t): return collections.Counter(re.findall(r'HX-[A-Za-z0-9-]+', t))
for name, f in [('numbers', nums), ('claim ids', cids), ('HX ids', hx)]:
    a, b = f(en), f(fr)
    print(f'== {name}: EN total {sum(a.values())}, FR total {sum(b.values())}')
    print('  only/more in EN:', dict(a - b))
    print('  only/more in FR:', dict(b - a))
def heads(t):
    c = collections.Counter()
    for l in t.splitlines():
        m = re.match(r'^(#{1,3}) ', l)
        if m: c[m.group(1)] += 1
    return c
print('== headings EN', dict(heads(en)), 'FR', dict(heads(fr)))
tr = lambda t: sum(1 for l in t.splitlines() if l.startswith('|'))
print('== table rows EN', tr(en), 'FR', tr(fr))
print('== lines EN', len(en.splitlines()), 'FR', len(fr.splitlines()))
