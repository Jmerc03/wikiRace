"""Register WikiRace's reviewed 0.3.0 owner map through the local JES API.

Requests/receipts are retained under .jes/local/registration. No database access,
synthetic human approvals, or execution records are used.
"""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.jes/local/registration'
OUT.mkdir(parents=True, exist_ok=True)
API = 'http://127.0.0.1:8100/api/v1'
ACTOR = 'Codex under delegated WikiRace owner/operator authority'

def call(method, path, body=None):
    name = (method + path + ('_' + body.get('id', body.get('repository_id', '')) if body else '')).replace('/', '_')
    if body is not None:
        body = dict(body, actor=ACTOR, idempotency_key='wikirace-adoption-20260907-' + name)
    request_record = dict(method=method, url=API + path, body=body)
    request_path = OUT / (name + '.request.json')
    if request_path.exists():
        assert json.loads(request_path.read_text()) == request_record, 'Retained request differs; use a new operation identity'
    else:
        request_path.write_text(json.dumps(request_record, indent=2) + '\n')
    request = Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urlopen(request, timeout=15) as response:
            status, result = response.status, json.load(response)
    except HTTPError as error:
        status, result = error.code, json.load(error)
    (OUT / (name + '.receipt.json')).write_text(json.dumps(dict(status=status, result=result), indent=2) + '\n')
    if status >= 400:
        raise RuntimeError(f'{method} {path}: {status} {result}')
    print(method, path, status)
    return result

owners = json.loads((ROOT / '.jes/owners.json').read_text())
call('GET', '/health')
for row in owners['owners']:
    call('POST', '/objects', {
        'id': row['target_id'], 'type': row['target_type'],
        'state': 'in_development' if row['target_type'] == 'System' else 'defined',
        'authority_profile': 'jes_migration_target', 'attributes': {'name': row['name']},
    })
    if row['target_type'] == 'Subsystem':
        call('POST', '/relationships', {'id': 'JES-REL-WR-PARENT-' + row['target_id'].split('-')[-1],
            'type': 'system_contains_subsystem', 'from_id': row['system_id'], 'to_id': row['target_id']})
call('POST', '/objects', {'id': owners['repository_id'], 'type': 'Repository', 'state': 'registered',
    'authority_profile': 'jes_migration_target', 'attributes': {'name': owners['name']}})
call('POST', '/repositories', {'repository_id': owners['repository_id'], 'local_path': str(ROOT)})
call('POST', '/projects', {'id': 'JES-PROJECT-WIKIRACE', 'title': 'WikiRace',
    'description': 'Existing multiplayer Wikipedia bingo project adopted under JES 0.3.0. Proposal v1.0 and engineering plan v1.0 approved by Codex under Jaxson Mercer\'s explicit owner/operator delegation on 2026-09-07. Repository artifacts own exact package scope, evidence and closeout; no synthetic human approvals or execution records.',
    'workspace_id': 'JES-WORKSPACE-LOCAL', 'owner_user_id': 'jaxson-local',
    'references': [str(ROOT / path) for path in ['PROJECT_PROPOSAL.md', 'project-management/ENGINEERING_PLAN.md', 'project-management/APPROVAL_LEDGER.md', 'project-management/PROJECT_STATE.md']]})
call('GET', '/repositories/' + owners['repository_id'])
call('GET', '/projects/JES-PROJECT-WIKIRACE')
