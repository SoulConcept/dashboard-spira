#!/usr/bin/env python3
"""Transform a complete Notion view export into the existing dashboard data.

No network access and no credentials. Run from the repository root:
python3 scripts/sync_notion.py /path/to/snapshot.json --date YYYY-MM-DD
"""
import argparse
import datetime as dt
import html
import json
import math
from pathlib import Path
import re

MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
          'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
COUNTRIES = ['Colombia', 'México', 'Perú', 'CAM']
COUNTRY_MAP = {c: c for c in COUNTRIES}
COUNTRY_MAP.update({'Mexico': 'México', 'Peru': 'Perú', 'Ecuador': 'Colombia',
                    'Estados Unidos': 'Colombia', 'Panamá': 'CAM', 'Honduras': 'CAM',
                    'Guatemala': 'CAM', 'Costa Rica': 'CAM', 'El Salvador': 'CAM',
                    'Nicaragua': 'CAM', 'Belice': 'CAM'})


def clean(value):
    if value is None:
        return None
    text = html.unescape(re.sub(r'<[^>]*>', ' ', str(value)))
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'^\s*[•]\s*', '', text)
    return re.sub(r'\s+', ' ', text).strip() or None


def number(value, default=None):
    if value is None or value == '':
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'Expected finite number, got {value!r}')
    return value


def date_es(value):
    return f'{value.day} de {MONTHS[value.month-1].lower()} de {value.year}'


def complete(page):
    if page.get('has_more') is not False:
        raise ValueError('Incomplete export: paginate every view until has_more=false')
    rows = page['results']
    if not rows:
        raise ValueError('Empty source; refusing to replace dashboard')
    urls = [r['url'] for r in rows]
    if len(urls) != len(set(urls)):
        raise ValueError('Duplicate source rows; check pagination')
    return rows


def lead(row):
    raw = clean(row.get('País'))
    if raw and raw not in COUNTRY_MAP:
        raise ValueError(f'Country needs a business mapping: {raw}')
    sent = row.get('date:Fecha de envío a comercial :start')
    date = dt.date.fromisoformat(sent[:10]) if sent else None
    statuses = row.get('Estado', '[]')
    statuses = json.loads(statuses) if isinstance(statuses, str) else statuses
    if not isinstance(statuses, list) or not all(isinstance(s, str) for s in statuses):
        raise ValueError('Unexpected status format')
    return dict(id=number(row.get('Número ')), year=date.year if date else None,
                monthIndex=date.month if date else None, country=COUNTRY_MAP.get(raw),
                rawCountry=raw, commercial=clean(row.get('Comercial')),
                status=', '.join(statuses), proposalValue=number(row.get('VALOR USD PROPUESTA'), 0),
                closeValue=number(row.get('VALOR USD CIERRE'), 0), origin=clean(row.get('Origen del Lead')),
                company=clean(row.get('Empresa')), sentDate=date_es(date) if date else None)


def investment(rows, stamp, country=None):
    parsed = []
    for row in rows:
        month = clean(row.get('Mes'))
        idx = next((i+1 for i,m in enumerate(MONTHS) if m.casefold() == (month or '').casefold()), None)
        year = number(row.get('Año'))
        if idx is None or year is None or int(year) != year:
            raise ValueError(f'Invalid investment period: {year} {month}')
        item = dict(year=int(year), month=MONTHS[idx-1], monthIndex=idx,
                    budget=number(row.get('Presupuesto Aprobado')),
                    linkedin=number(row.get('Linkedin'), 0), google=number(row.get('Google'), 0),
                    leads=number(row.get('Leads #')), source=f'Notion · sincronizado el {stamp}')
        if country:
            item['country'] = country
        parsed.append(item)
    parsed.sort(key=lambda r: (r['year'], r['monthIndex']))
    seen, budget = set(), None
    for item in parsed:
        key = item['year'], item['monthIndex']
        if key in seen:
            raise ValueError(f'Duplicate investment period: {country} {key}')
        seen.add(key)
        if item['budget'] is None:
            if budget is None:
                raise ValueError(f'No earlier approved budget for {country or "General"} {key}')
            item['budget'] = budget
        else:
            budget = item['budget']
    return parsed


def sync(data, snapshot, today):
    source_leads = complete(snapshot['leads'])
    opportunities = [lead(r) for r in source_leads]
    # Keep the historical year assignment only for existing undated records.
    old = {r['id']: r for r in data['commercial']['opportunities'] if r['id'] is not None}
    blank_years = {r['year'] for r in data['commercial']['opportunities'] if r['id'] is None}
    for row in opportunities:
        if row['year'] is None:
            if row['id'] in old:
                row['year'] = old[row['id']]['year']
            elif row['id'] is None and len(blank_years) == 1:
                row['year'] = next(iter(blank_years))
    stamp = date_es(today)
    tables = snapshot['investment']
    history = investment(complete(tables['General']), stamp)
    country_history = [r for c in sorted(COUNTRIES) for r in investment(complete(tables[c]), stamp, c)]
    # Never silently discard existing investment periods on a partial source export.
    for key, fresh, old_rows in [
        ('General', history, data['investment']['history']),
        ('Countries', country_history, data['investment']['countryHistory'])]:
        periods = lambda rows: {(r.get('country'), r['year'], r['monthIndex']) for r in rows}
        if not periods(old_rows).issubset(periods(fresh)):
            raise ValueError(f'Missing historical investment periods: {key}')
    data['commercial']['opportunities'] = opportunities
    data['investment'].update(history=history, countryHistory=country_history, snapshot=stamp)
    data['meta'].update(cutoff=f'{stamp} · actualización automática desde Notion',
                        source=f'Listado de Leads entregados + USD Total Inversión de Publicidad 2025–2026 · sincronizado el {stamp}')
    validation = data['commercial']['validation']
    validation.update(sourceRows=len(source_leads), usableLeadRows=sum(r['id'] is not None for r in opportunities),
                      blankRows=sum(r['id'] is None for r in opportunities), commercialRowsSnapshot=stamp,
                      investmentExportSnapshot=stamp)
    # Legacy aggregates and manual control references are preserved. The frontend
    # recalculates the displayed metrics from opportunities/history/countryHistory.
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--date', required=True, type=dt.date.fromisoformat)
    parser.add_argument('--data', type=Path, default=Path('assets/js/data.js'))
    args = parser.parse_args()
    text = args.data.read_text()
    data = json.loads(text.split('=', 1)[1].strip().removesuffix(';'))
    snapshot = json.loads(args.snapshot.read_text())
    result = sync(data, snapshot, args.date)
    output = 'window.SPIRA_DATA = ' + json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + ';\n'
    # Escape line separators and HTML-sensitive characters in source data.
    output = output.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    temporary = args.data.with_suffix('.js.tmp')
    temporary.write_text(output)
    temporary.replace(args.data)
    print(json.dumps({'leads': len(result['commercial']['opportunities']),
                      'generalPeriods': len(result['investment']['history']),
                      'countryPeriods': len(result['investment']['countryHistory']),
                      'snapshot': args.date.isoformat()}))


if __name__ == '__main__':
    main()
