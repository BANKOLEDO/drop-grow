import sqlite3, os, sys, json, datetime

db = os.path.join(os.environ['USERPROFILE'], '.local', 'share', 'opencode', 'opencode.db')
con = sqlite3.connect(db)
import json, datetime

def ts(ms):
    try:
        return datetime.datetime.fromtimestamp(ms/1000).strftime('%m-%d %H:%M')
    except Exception:
        return ms

TARGET = sys.argv[1] if len(sys.argv) > 1 else 'ses_fbbc544eaffeXPYLYT8C2xLxgO'

rows = list(con.execute(
    "select id, json_extract(data,'$.role'), time_created from message where session_id=? order by time_created",
    (TARGET,)))

def get_texts(mid):
    parts = list(con.execute("select data from part where message_id=? order by time_created", (mid,)))
    out = []
    for (d,) in parts:
        try:
            j = json.loads(d)
        except Exception:
            continue
        if j.get('type') == 'text' and j.get('text'):
            out.append(j['text'])
    return out

for mid, role, tm in rows:
    if role != 'user':
        continue
    texts = get_texts(mid)
    if texts:
        print(f"USER {ts(tm)}: {' | '.join(texts)[:600]}".replace('\n', ' '))

for mid, role, tm in reversed(rows):
    if role != 'assistant':
        continue
    try:
        texts = get_texts(mid)
    except Exception as e:
        print('ERR', e)
        texts = []
    if texts:
        print('\n--- LAST ASSISTANT MSG', ts(tm), '---')
        print(' '.join(texts)[-2500:])
        break

print('\n--- TODOS ---')
for tid, tdata in con.execute("select id, data from todo where session_id=?", (TARGET,)):
    print(tdata[:200])




