#!/usr/bin/env python3
"""Publish specified sync files in one non-force GitHub commit via gh.

Use the main SHA captured BEFORE downloading the source repository.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

REPO = 'repos/SoulConcept/dashboard-spira'
ALLOWED = {'assets/js/data.js', 'scripts/sync_notion.py', 'scripts/test_sync_notion.py',
           'scripts/notion_sources.json', 'scripts/publish_data.py', 'SYNC_NOTION.md'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--expected-head', required=True)
    p.add_argument('--message', required=True)
    p.add_argument('files', nargs='+', choices=sorted(ALLOWED))
    args = p.parse_args()
    gh = shutil.which('gh') or str(Path.home() / '.local/bin/gh')

    def api(endpoint, body=None):
        command = [gh, 'api', REPO + endpoint]
        if body is not None:
            command += ['--method', 'POST', '--input', '-']
        result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                                text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    head = api('/git/ref/heads/main')['object']['sha']
    if head != args.expected_head:
        raise SystemExit('Main changed: download latest files, regenerate and validate before retrying.')
    commit = api('/git/commits/' + head)
    tree = api('/git/trees', {'base_tree': commit['tree']['sha'], 'tree': [
        {'path': name, 'mode': '100644', 'type': 'blob', 'content': Path(name).read_text()}
        for name in args.files]})
    if tree['sha'] == commit['tree']['sha']:
        print('No changes to publish.')
        return
    new = api('/git/commits', {'message': args.message, 'tree': tree['sha'], 'parents': [head]})
    # Non-fast-forward concurrent updates are rejected by GitHub.
    subprocess.run([gh, 'api', REPO + '/git/refs/heads/main', '--method', 'PATCH', '--input', '-'],
                   input=json.dumps({'sha': new['sha'], 'force': False}), text=True,
                   capture_output=True, check=True)
    print('https://github.com/SoulConcept/dashboard-spira/commit/' + new['sha'])


if __name__ == '__main__':
    main()
