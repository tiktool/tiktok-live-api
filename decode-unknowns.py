"""Scan battle:proto:capture stream for WebcastLinkMicBattleItemCard frames,
isolate ones that parse to empty effectKey, dump their full nested structure."""
import base64, sys, re
from collections import Counter

def dv(b, o):
    v=0; s=0
    while o < len(b):
        x=b[o]; o+=1; v |= (x & 0x7f) << s
        if not (x & 0x80): break
        s += 7
    return v, o
def decode(buf):
    f=[]; o=0
    while o < len(buf):
        try: t,o = dv(buf,o)
        except: break
        fn = t>>3; wt = t&7
        try:
            if wt==0: v,o=dv(buf,o); f.append((fn,wt,v))
            elif wt==2:
                ln,o=dv(buf,o); f.append((fn,wt,buf[o:o+ln])); o+=ln
            elif wt==5: f.append((fn,wt,int.from_bytes(buf[o:o+4],'little'))); o+=4
            elif wt==1: f.append((fn,wt,int.from_bytes(buf[o:o+8],'little'))); o+=8
            else: break
        except: break
    return f

def looks_str(b):
    if not b: return False
    try: s = b.decode('utf-8'); return all(0x20<=ord(c)<0x7f or 0x80<=ord(c) for c in s)
    except: return False

def dump(buf, ind=0, maxd=8):
    if ind > maxd: return ''
    out=[]
    for fn,wt,v in decode(buf):
        p='  '*ind + f'#{fn}'
        if wt==0: out.append(f'{p} = {v}')
        elif wt==2 and isinstance(v, bytes):
            if looks_str(v) and len(v) < 120:
                try:
                    s = v.decode('utf-8')
                    if 1 <= len(s) <= 120 and not any(c < ' ' for c in s):
                        out.append(f'{p} str = {s!r}'); continue
                except: pass
            if v:
                # try nested
                try:
                    nf = decode(v)
                    if nf and all(1 <= fn2 < 200 for fn2,_,_ in nf):
                        out.append(f'{p} msg(len={len(v)}):')
                        out.append(dump(v, ind+1, maxd)); continue
                except: pass
                out.append(f'{p} bytes(len={len(v)})')
        else: out.append(f'{p} fixed{wt} = {v}')
    return '\n'.join(out)

import json
known_keys = {'pm_mt_boost_crit_name','pm_mt_boost_mist_name','pm_mt_match_guide_gotPowerUps'}
known_substrings = ['userSentBooster_no2','userSentBooster_no3','thunder','extra_time','extra_round']

unknown_samples = []
all_keys = Counter()

# Read JSONL from stdin OR /tmp file
path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/cards.jsonl'
with open(path) as f:
    for line in f:
        r = json.loads(line)
        if r.get('method') != 'WebcastLinkMicBattleItemCard': continue
        buf = base64.b64decode(r['b64'])
        # WebcastResponse → Messages[]. Find ItemCard payload.
        outer = decode(buf)
        for fn,wt,v in outer:
            if fn==1 and wt==2 and isinstance(v,bytes):
                mf = decode(v)
                name_b = next((u for ifn,_,u in mf if ifn==1), None)
                payload = next((u for ifn,iwt,u in mf if ifn==2 and iwt==2 and isinstance(u,bytes)), None)
                if name_b == b'WebcastLinkMicBattleItemCard' and payload:
                    pf = decode(payload)
                    card_type = next((u for ifn,iwt,u in pf if ifn==3 and iwt==0), None)
                    # try each inner field
                    found_key = None
                    found_field = None
                    for inner_fn in [5,6,7,8,9,10]:
                        ib = next((u for ifn,iwt,u in pf if ifn==inner_fn and iwt==2 and isinstance(u,bytes)), None)
                        if not ib: continue
                        try:
                            inf = decode(ib)
                            name_buf = next((u for ifn,iwt,u in inf if ifn==1 and iwt==2 and isinstance(u,bytes)), None)
                            if name_buf:
                                nbf = decode(name_buf)
                                kb = next((u for ifn,iwt,u in nbf if ifn==1 and iwt==2 and isinstance(u,bytes)), None)
                                if kb:
                                    try:
                                        k = kb.decode('utf-8')
                                        if k:
                                            found_key = k
                                            found_field = inner_fn
                                            break
                                    except: pass
                        except: pass
                    all_keys[(card_type, found_field, found_key)] += 1
                    is_unknown = (not found_key) or (found_key not in known_keys and not any(s in found_key for s in known_substrings))
                    if is_unknown and len(unknown_samples) < 15:
                        unknown_samples.append({
                            'uname': r['uid'], 'cardType': card_type,
                            'foundField': found_field, 'foundKey': found_key,
                            'payload': payload,
                        })

print('=== EFFECT KEY TALLY ===')
for k, c in all_keys.most_common():
    print(f'  cardType={k[0]} innerField={k[1]} key={k[2]!r}  × {c}')

print('\n=== UNKNOWN SAMPLES (full dump) ===')
for s in unknown_samples[:8]:
    print(f'\n--- @{s["uname"]} cardType={s["cardType"]} foundField={s["foundField"]} foundKey={s["foundKey"]!r} ---')
    print(dump(s['payload']))
