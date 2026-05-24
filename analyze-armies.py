"""Aggregate field histogram across all WebcastLinkMicArmies frames."""
import json, base64, sys
from collections import Counter, defaultdict

def dv(b, o):
    v=0; s=0
    while o < len(b):
        x = b[o]; o += 1
        v |= (x & 0x7f) << s
        if not (x & 0x80): break
        s += 7
    return v, o

def decode(buf):
    fields=[]; o=0
    while o < len(buf):
        try: t, o = dv(buf, o)
        except: break
        fn = t >> 3; wt = t & 7
        try:
            if wt == 0: v, o = dv(buf, o); fields.append((fn, wt, v))
            elif wt == 2:
                ln, o = dv(buf, o); fields.append((fn, wt, buf[o:o+ln])); o += ln
            elif wt == 5: fields.append((fn, wt, int.from_bytes(buf[o:o+4],'little'))); o+=4
            elif wt == 1: fields.append((fn, wt, int.from_bytes(buf[o:o+8],'little'))); o+=8
            else: break
        except: break
    return fields

# parse method-envelope to get inner payload
def inner_payload(buf, method):
    # WebcastResponse contains repeated Message at field 1
    # Each Message has field 1 (method name) + field 2 (payload)
    fields = decode(buf)
    for fn, wt, v in fields:
        if fn == 1 and wt == 2 and isinstance(v, bytes):
            mf = decode(v)
            mname = None
            mpayload = None
            for ffn, fwt, fv in mf:
                if ffn == 1 and fwt == 2 and isinstance(fv, bytes):
                    try:
                        s = fv.decode('utf-8')
                        if s == method: mname = s
                    except: pass
                if ffn == 2 and fwt == 2 and isinstance(fv, bytes):
                    mpayload = fv
            if mname == method and mpayload:
                return mpayload
    return None

# field signature
fieldsig = Counter()
field_14_samples = []
mvp_examples = []
team_field3_samples = []
team_field14_samples = []
total_armies = 0

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/battle.jsonl'
with open(path) as f:
    for line in f:
        r = json.loads(line)
        if r['method'] != 'WebcastLinkMicArmies': continue
        total_armies += 1
        buf = base64.b64decode(r['b64'])
        # The capture wraps the raw protocol frame. The frame has multiple
        # methods. Find ours.
        payload = inner_payload(buf, 'WebcastLinkMicArmies')
        if not payload: continue
        f2 = decode(payload)
        sig = tuple(sorted(set(fn for fn, wt, v in f2)))
        fieldsig[sig] += 1
        has_14 = any(fn == 14 for fn, _, _ in f2)
        has_3 = any(fn == 3 for fn, wt, _ in f2 if wt == 2)
        if has_14 and len(field_14_samples) < 5:
            field_14_samples.append((r['uid'], payload))
        if has_3 and not has_14 and len(team_field3_samples) < 3:
            team_field3_samples.append((r['uid'], payload))

print(f'Total Armies: {total_armies}')
print(f'\nField signatures (top 10):')
for sig, c in fieldsig.most_common(10):
    print(f'  {c}× fields={sig}')

# Decode one field_14 sample fully
if field_14_samples:
    uid, payload = field_14_samples[0]
    f = decode(payload)
    print(f'\n=== SAMPLE WITH field_14 (@{uid}) ===')
    for fn, wt, v in f:
        if fn == 14 and wt == 2 and isinstance(v, bytes):
            inner = decode(v)
            print(f'field_14 sub-message (len={len(v)}):')
            for ifn, iwt, iv in inner:
                if iwt == 0:
                    print(f'  #{ifn} = {iv}')
                elif iwt == 2 and isinstance(iv, bytes):
                    # decode again
                    sub = decode(iv)
                    print(f'  #{ifn} msg(len={len(iv)}):')
                    for jfn, jwt, jv in sub:
                        if jwt == 0:
                            print(f'    #{jfn} = {jv}')
                        elif jwt == 2 and isinstance(jv, bytes):
                            try:
                                s = jv.decode('utf-8')
                                if 1 <= len(s) <= 80 and all(0x20<=ord(c)<0x7f or ord(c)>=0x80 for c in s):
                                    print(f'    #{jfn} str = {s!r}')
                                    continue
                            except: pass
                            print(f'    #{jfn} bytes(len={len(jv)})')

# Decode one field_3 sample (legacy?)
if team_field3_samples:
    uid, payload = team_field3_samples[0]
    f = decode(payload)
    print(f'\n=== SAMPLE WITH field_3 only (@{uid}) ===')
    for fn, wt, v in f:
        if fn == 3 and wt == 2 and isinstance(v, bytes):
            inner = decode(v)
            print(f'field_3 sub-message (len={len(v)}):')
            host_id = next((u for ifn, _, u in inner if ifn == 1), None)
            print(f'  host_id={host_id}')
            for ifn, iwt, iv in inner:
                if ifn == 2 and iwt == 2 and isinstance(iv, bytes):
                    sub = decode(iv)
                    print(f'  #2 msg(len={len(iv)}):')
                    # Per-group scores
                    grp_users = [u for jfn, jwt, u in sub if jfn == 1 and jwt == 2 and isinstance(u, bytes)]
                    team_total = next((u for jfn, jwt, u in sub if jfn == 2 and jwt == 0), None)
                    print(f'    team_total={team_total}, users={len(grp_users)}')
                    break
            break
