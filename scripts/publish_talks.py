"""Publishes only Talks JSON, rejecting concurrent main updates."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--expected-head',required=True);args=p.parse_args()
repo='repos/SoulConcept/dashboard-spira'
def api(path,body=None,method='POST'):
    cmd=['gh','api',repo+path]
    if body is not None:cmd+=['--method',method,'--input','-']
    return json.loads(subprocess.run(cmd,input=None if body is None else json.dumps(body),text=True,capture_output=True,check=True).stdout)
head=api('/git/ref/heads/main')['object']['sha']
if head!=args.expected_head:raise SystemExit('Main cambió. Reejecutar el workflow desde main actual.')
file='assets/data/spira-talks.json';content=Path(file).read_text();data=json.loads(content)
if not isinstance(data.get('episodes'),list):raise SystemExit('JSON no válido')
commit=api('/git/commits/'+head);tree=api('/git/trees',{'base_tree':commit['tree']['sha'],'tree':[{'path':file,'mode':'100644','type':'blob','content':content}]})
if tree['sha']!=commit['tree']['sha']:
    new=api('/git/commits',{'message':'Actualiza SPIRA Talks desde YouTube','tree':tree['sha'],'parents':[head]})
    api('/git/refs/heads/main',{'sha':new['sha'],'force':False},'PATCH')
    print('https://github.com/SoulConcept/dashboard-spira/commit/'+new['sha'])
