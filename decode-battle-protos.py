"""
Decode battle protobuf JSONL dump.

Outputs per-method:
 - field histograms (which fields appear, value samples)
 - for WebcastLinkMicBattleItemCard: full nested decode (suspected source of gloves/mist/thunder/extra-time)
 - for WebcastLinkmicBattleTaskMessage: group by inner type, dump sample of each
 - for WebcastLinkMicArmies: dump user-level scores from team buffer to verify MVP score per team
"""
import json
import sys
import base64
from collections import Counter, defaultdict

# ── varint decode ──
def dv(b, o):
    v=0; s=0
    while o < len(b):
        x = b[o]; o += 1
        v |= (x & 0x7f) << s
        if not (x & 0x80): break
        s += 7
    return v, o

def decode(buf):
    """Returns list of (field_num, wire_type, value)."""
    fields = []
    o = 0
    while o < len(buf):
        t, o = dv(buf, o)
        fn = t >> 3; wt = t & 7
        if wt == 0:
            v, o = dv(buf, o); fields.append((fn, wt, v))
        elif wt == 2:
            ln, o = dv(buf, o); fields.append((fn, wt, buf[o:o+ln])); o += ln
        elif wt == 5:
            fields.append((fn, wt, int.from_bytes(buf[o:o+4], 'little'))); o += 4
        elif wt == 1:
            fields.append((fn, wt, int.from_bytes(buf[o:o+8], 'little'))); o += 8
        else: break
    return fields

def looks_str(b):
    if not b: return False
    try:
        s = b.decode('utf-8')
        return all(0x20 <= ord(c) < 0x7f or 0x80 <= ord(c) <= 0xFFFF for c in s) and len(s) >= 1
    except: return False

def looks_proto(b, depth=0):
    if depth > 3 or len(b) < 2: return False
    try:
        f = decode(b)
        return len(f) > 0 and all(1 <= fn < 200 for fn, _, _ in f)
    except: return False

def dump(buf, indent=0, max_depth=6):
    if indent > max_depth: return ' ' * (indent * 2) + '[max depth]\n'
    lines = []
    try:
        for fn, wt, v in decode(buf):
            pre = '  ' * indent + f'#{fn}'
            if wt == 0:
                lines.append(f'{pre} varint = {v}')
            elif wt == 2:
                if isinstance(v, bytes):
                    if looks_str(v) and not looks_proto(v, indent + 1):
                        try:
                            s = v.decode('utf-8')
                            if len(s) < 200:
                                lines.append(f'{pre} str("{s}")')
                            else:
                                lines.append(f'{pre} str(len={len(s)})')
                        except:
                            lines.append(f'{pre} bytes(len={len(v)})')
                    elif looks_proto(v):
                        lines.append(f'{pre} msg(len={len(v)}):')
                        lines.append(dump(v, indent + 1, max_depth))
                    else:
                        lines.append(f'{pre} bytes(len={len(v)}) hex={v.hex()[:80]}')
            else:
                lines.append(f'{pre} fixed{wt} = {v}')
    except Exception as e:
        lines.append('  ' * indent + f'[decode err: {e}]')
    return '\n'.join(lines)

# ── main ──
path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/battle.jsonl'

byMethod = defaultdict(list)
with open(path) as f:
    for line in f:
        r = json.loads(line)
        byMethod[r['method']].append(r)

print('=' * 70)
print('COUNTS')
print('=' * 70)
for m in sorted(byMethod, key=lambda k: -len(byMethod[k])):
    print(f'  {m}: {len(byMethod[m])}')

# ── 1. WebcastLinkMicBattleItemCard ── full dump of all 17 (suspected gloves/mist source)
print('\n' + '=' * 70)
print('WebcastLinkMicBattleItemCard - FULL DUMP (17 frames)')
print('=' * 70)
for i, r in enumerate(byMethod.get('WebcastLinkMicBattleItemCard', [])):
    buf = base64.b64decode(r['b64'])
    # strip TikTok envelope (method name etc.) - find inner payload
    print(f'\n--- #{i+1} uid=@{r["uid"]} room={r["room"]} len={r["len"]}B ---')
    print(dump(buf, max_depth=8))

# ── 2. WebcastLinkmicBattleTaskMessage ── group by field2 (task type)
print('\n' + '=' * 70)
print('WebcastLinkmicBattleTaskMessage - sample per inner task type')
print('=' * 70)
seen_types = {}
for r in byMethod.get('WebcastLinkmicBattleTaskMessage', []):
    buf = base64.b64decode(r['b64'])
    f = decode(buf)
    # field 2 = task type
    type_val = None
    for fn, wt, v in f:
        if fn == 2 and wt == 0: type_val = v; break
    if type_val not in seen_types:
        seen_types[type_val] = r
print(f'Distinct task types: {sorted(seen_types.keys())}\n')
for tv, r in seen_types.items():
    buf = base64.b64decode(r['b64'])
    print(f'--- task type={tv} uid=@{r["uid"]} len={r["len"]}B ---')
    print(dump(buf, max_depth=8))
    print()

# ── 3. WebcastLinkMicBattle ── one sample, full
print('\n' + '=' * 70)
print('WebcastLinkMicBattle - sample')
print('=' * 70)
if byMethod.get('WebcastLinkMicBattle'):
    r = byMethod['WebcastLinkMicBattle'][0]
    buf = base64.b64decode(r['b64'])
    print(f'--- uid=@{r["uid"]} len={r["len"]}B ---')
    print(dump(buf, max_depth=8))

# ── 4. WebcastLinkMicArmies ── decode team user-level scores
print('\n' + '=' * 70)
print('WebcastLinkMicArmies - team user scores (MVP check)')
print('=' * 70)
if byMethod.get('WebcastLinkMicArmies'):
    r = byMethod['WebcastLinkMicArmies'][0]
    buf = base64.b64decode(r['b64'])
    f = decode(buf)
    print(f'sample uid=@{r["uid"]}')
    # Top-level fields summary
    for fn, wt, v in f:
        if wt == 0:
            print(f'  #{fn} varint = {v}')
        elif wt == 2 and isinstance(v, bytes):
            if looks_str(v):
                try: print(f'  #{fn} str = {v.decode()!r}')
                except: pass
            elif looks_proto(v):
                print(f'  #{fn} msg len={len(v)}')

    # field 3 = team (repeated). Decode each team.
    print('\n  TEAMS:')
    teams = [v for fn, wt, v in f if fn == 3 and wt == 2 and isinstance(v, bytes)]
    for ti, team_buf in enumerate(teams):
        tf = decode(team_buf)
        host_id = next((v for fn, wt, v in tf if fn == 1 and wt == 0), None)
        print(f'  team #{ti+1} hostId={host_id}')
        # field 2 = sub-message with group containers
        for fn, wt, v in tf:
            if fn == 2 and wt == 2 and isinstance(v, bytes):
                inner = decode(v)
                # field 1 (repeated) = user-score entries
                user_entries = [u for fnn, wtn, u in inner if fnn == 1 and wtn == 2 and isinstance(u, bytes)]
                # field 2 = total team score
                total_score = next((u for fnn, wtn, u in inner if fnn == 2 and wtn == 0), None)
                print(f'    team_total={total_score}, entries={len(user_entries)}')
                for ei, eb in enumerate(user_entries[:3]):
                    ef = decode(eb)
                    print(f'      entry #{ei+1}:')
                    for efn, efw, efv in ef:
                        if efw == 0: print(f'        #{efn} = {efv}')
                        elif efw == 2 and isinstance(efv, bytes):
                            if looks_str(efv):
                                try:
                                    s = efv.decode('utf-8')
                                    if 1 < len(s) < 80: print(f'        #{efn} str = {s!r}')
                                except: pass
                            elif looks_proto(efv):
                                ifs = decode(efv)
                                # Look for: nickname, score, userId
                                user_id = next((u for ifn, _, u in ifs if ifn == 1), None)
                                nickname = next((u.decode('utf-8', 'ignore') for ifn, ifw, u in ifs if ifn == 3 and ifw == 2 and isinstance(u, bytes) and looks_str(u)), None)
                                print(f'        #{efn} msg user_id={user_id} nick={nickname!r}')
