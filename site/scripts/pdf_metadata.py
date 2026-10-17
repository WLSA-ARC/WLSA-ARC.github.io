"""Read/write self-contained ARC classification in PDF Info and XMP metadata."""
import argparse
import json
import re
import sys
import uuid
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfReader, PdfWriter
from pypdf.xmp import XmpInformation

ARC_NS = 'https://wlsa-arc.github.io/ns/material/1.0/'
RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
CONFIG = Path(__file__).resolve().parents[1] / 'config/catalog.json'
TEXT_FIELDS = ('id', 'title', 'author', 'subject', 'course', 'type', 'description', 'grade', 'examBoard', 'updated')
ARRAY_FIELDS = ('keywords', 'languages', 'topics')


def registry(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def course_aliases(config):
    courses = {c['id'] for c in config['courses']}
    aliases = config.get('courseAliases', {})
    if not isinstance(aliases, dict):
        raise ValueError('courseAliases must be an object.')
    for alias, target in aliases.items():
        if not isinstance(alias, str) or not alias or alias in courses or not isinstance(target, str) or target not in courses:
            raise ValueError(f'Invalid course alias: {alias}')
    return aliases


def normalize(fields, config):
    if not isinstance(fields, dict):
        raise ValueError('ARC metadata must be a JSON object.')
    unknown = set(fields) - set(TEXT_FIELDS + ARRAY_FIELDS + ('schemaVersion',))
    if unknown:
        raise ValueError('Unknown metadata fields: ' + ', '.join(sorted(unknown)))
    if type(fields.get('schemaVersion', 1)) is not int or fields.get('schemaVersion', 1) != 1:
        raise ValueError('Unsupported ARC schemaVersion; expected 1.')
    value = {'schemaVersion': 1}
    for key in TEXT_FIELDS:
        if key in fields:
            if not isinstance(fields[key], str):
                raise ValueError(f'{key} must be a string.')
            value[key] = fields[key].strip()
    for key in ARRAY_FIELDS:
        if key in fields:
            if not isinstance(fields[key], list) or not all(isinstance(x, str) for x in fields[key]):
                raise ValueError(f'{key} must be an array of strings.')
            value[key] = list(dict.fromkeys(x.strip() for x in fields[key] if x.strip()))
    subjects = config['subjects']
    courses = {c['id']: c for c in config['courses']}
    aliases = course_aliases(config)
    course = value.get('course')
    canonical_course = aliases.get(course, course)
    if course and canonical_course not in courses:
        raise ValueError(f'Unknown course code: {course}')
    if course:
        # Resolve classification without rewriting the original embedded code.
        subject = courses[canonical_course]['subjectCode']
        if value.get('subject') and value['subject'] != subject:
            raise ValueError(f'{course} belongs to {subject}, not {value["subject"]}.')
        value['subject'] = subject
    if value.get('subject') and value['subject'] not in subjects:
        raise ValueError(f'Unknown subject code: {value["subject"]}')
    if value.get('type') and value['type'] not in config['types']:
        raise ValueError(f'Unknown material type: {value["type"]}')
    if value.get('id') and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,100}', value['id']):
        raise ValueError('id must be a short stable identifier using letters, digits, . _ : or -.')
    if value.get('updated'):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value['updated']):
            raise ValueError('updated must be YYYY-MM-DD.')
        date.fromisoformat(value['updated'])
    for language in value.get('languages', []):
        if not re.fullmatch(r'[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*', language):
            raise ValueError(f'Invalid language tag: {language}')
    return value


def xmp_record(reader):
    stream = reader.root_object.get('/Metadata')
    if not stream:
        return None
    raw = stream.get_object().get_data()
    if len(raw) > 2_000_000 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Unsupported XMP packet.')
    try:
        tree = ET.fromstring(raw)
    except ET.ParseError:
        return None
    node = tree.find('.//{' + ARC_NS + '}record')
    return json.loads(node.text) if node is not None and node.text else None


def read_fields(reader, config):
    info = reader.metadata or {}
    raw = info.get('/WLSAARC')
    encoded = json.loads(str(raw)) if raw else None
    xmp = xmp_record(reader)
    if encoded is not None and xmp is not None and normalize(encoded, config) != normalize(xmp, config):
        raise ValueError('ARC Info and XMP metadata disagree. Re-tag this PDF to synchronize them.')
    if encoded is not None or xmp is not None:
        return normalize(encoded if encoded is not None else xmp, config)
    # Existing editors can use ordinary Subject and explicit Keywords directives.
    keyword_text = str(info.get('/Keywords') or '')
    directives = dict(re.findall(r'(?:^|;)\s*arc\.(subject|course|type)\s*=\s*([^;]+)', keyword_text))
    subject = str(info.get('/ARCSubject') or directives.get('subject') or info.get('/Subject') or '').strip()
    lookup = {k.casefold(): k for k in config['subjects']}
    lookup.update({v.casefold(): k for k, v in config['subjects'].items()})
    fields = {
        'title': str(info.get('/Title') or ''), 'author': str(info.get('/Author') or ''),
        'subject': lookup.get(subject.casefold(), ''),
        'course': str(info.get('/ARCCourse') or directives.get('course') or '').strip(),
        'type': str(info.get('/ARCType') or directives.get('type') or '').strip(),
        'description': str(info.get('/ARCDescription') or ''),
        'keywords': [s.strip() for s in re.split('[,;，]', keyword_text) if s.strip() and not s.strip().startswith('arc.')],
    }
    return normalize(fields, config)


def scan(folder, config):
    rows = []
    for path in sorted(Path(folder).rglob('*')):
        if not path.is_file() or path.suffix.lower() != '.pdf':
            continue
        try:
            reader = PdfReader(path)
            if reader.is_encrypted and not reader.decrypt(''):
                rows.append({'relative': path.relative_to(folder).as_posix(), 'metadata': {}, 'readable': False, 'warning': 'Encrypted PDF: download only.'})
                continue
            fields = read_fields(reader, config)
            rows.append({'relative': path.relative_to(folder).as_posix(), 'metadata': fields, 'pages': len(reader.pages), 'readable': True})
        except ValueError as error:
            raise ValueError(f'{path.name}: {error}') from error
        except Exception as error:
            raise ValueError(f'Could not index PDF {path.name}: {error}') from error
    return rows


def write_metadata(source, output, fields, config):
    source, output = Path(source).resolve(), Path(output).resolve()
    if source == output:
        raise ValueError('Choose a separate output PDF; the source stays intact.')
    if output.exists():
        raise ValueError('Output file already exists; choose another filename.')
    reader = PdfReader(source)
    if reader.is_encrypted:
        raise ValueError('Use an unlocked PDF to write metadata.')
    if any(f.get('/FT') == '/Sig' for f in (reader.get_fields() or {}).values()):
        raise ValueError('Use the unsigned original PDF to write metadata.')
    existing = read_fields(reader, config)
    merged = {**existing, **fields}
    if not merged.get('id'):
        merged['id'] = 'arc-' + uuid.uuid4().hex
    if not merged.get('title'):
        merged['title'] = source.stem
    if not merged.get('type'):
        merged['type'] = 'review-guide'
    merged = normalize(merged, config)
    if not merged.get('subject'):
        raise ValueError('Specify --subject or --course before uploading.')
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    payload = json.dumps(merged, ensure_ascii=False, separators=(',', ':'))
    writer.add_metadata({
        '/Title': merged['title'], '/Author': merged.get('author', ''),
        '/Subject': config['subjects'][merged['subject']],
        '/Keywords': '; '.join([*merged.get('keywords', []), f'arc.subject={merged["subject"]}', f'arc.course={merged.get("course", "")}', f'arc.type={merged["type"]}']),
        '/WLSAARC': payload, '/ARCSubject': merged['subject'], '/ARCCourse': merged.get('course', ''),
        '/ARCType': merged['type'], '/ARCDescription': merged.get('description', ''),
    })
    xmp = writer.xmp_metadata or XmpInformation.create()
    xmp.dc_title = {'x-default': merged['title']}
    if 'author' in merged:
        xmp.dc_creator = [merged['author']] if merged['author'] else []
    if 'description' in merged:
        xmp.dc_description = {'x-default': merged['description']}
    xmp.dc_subject = merged.get('keywords', [])
    if 'languages' in merged:
        xmp.dc_language = merged['languages']
    xmp.dc_identifier = merged['id']
    xmp.pdf_keywords = '; '.join(merged.get('keywords', []))
    doc = xmp.rdf_root.ownerDocument
    for old in list(doc.getElementsByTagNameNS(ARC_NS, 'record')):
        old.parentNode.removeChild(old)
    description = doc.createElementNS(RDF_NS, 'rdf:Description')
    description.setAttribute('rdf:about', '')
    description.setAttribute('xmlns:arc', ARC_NS)
    record = doc.createElementNS(ARC_NS, 'arc:record')
    record.appendChild(doc.createTextNode(payload))
    description.appendChild(record)
    xmp.rdf_root.appendChild(description)
    xmp.stream.set_data(doc.toxml().encode('utf-8'))
    writer.xmp_metadata = xmp
    output.parent.mkdir(parents=True, exist_ok=True)
    writer.write(output)
    # Verify both encodings and the full page content after reopening.
    check = PdfReader(output)
    if read_fields(check, config) != merged or len(check.pages) != len(reader.pages):
        raise ValueError('PDF metadata round-trip failed.')
    for before, after in zip(reader.pages, check.pages):
        left, right = before.get_contents(), after.get_contents()
        if (left.get_data() if left else b'') != (right.get_data() if right else b'') or before.mediabox != after.mediabox:
            raise ValueError('PDF page content changed unexpectedly.')
    return merged


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=str(CONFIG))
    commands = parser.add_subparsers(dest='command', required=True)
    read = commands.add_parser('read'); read.add_argument('file')
    scan_parser = commands.add_parser('scan'); scan_parser.add_argument('folder')
    write = commands.add_parser('write'); write.add_argument('file'); write.add_argument('--output', required=True)
    write.add_argument('--metadata', help='Optional JSON record to embed.')
    for key in TEXT_FIELDS:
        write.add_argument('--' + re.sub(r'([A-Z])', lambda m: '-' + m[1].lower(), key), dest=key)
    for key in ARRAY_FIELDS:
        write.add_argument('--' + key, nargs='+')
    args = parser.parse_args()
    config = registry(args.config)
    if args.command == 'scan':
        result = scan(Path(args.folder), config)
    elif args.command == 'read':
        result = read_fields(PdfReader(args.file), config)
    else:
        fields = json.loads(Path(args.metadata).read_text(encoding='utf-8')) if args.metadata else {}
        fields.update({key: getattr(args, key) for key in TEXT_FIELDS + ARRAY_FIELDS if getattr(args, key) is not None})
        result = write_metadata(args.file, args.output, fields, config)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        main()
    except Exception as error:
        print(f'PDF metadata: {error}', file=sys.stderr)
        sys.exit(1)
