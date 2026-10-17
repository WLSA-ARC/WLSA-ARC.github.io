import json
import sys
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.xmp import XmpInformation

SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE / 'scripts'))
from pdf_metadata import ARC_NS, normalize, read_fields, registry, scan, write_metadata


class PdfMetadataTests(unittest.TestCase):
    def setUp(self):
        artifacts=SITE/'artifacts'
        artifacts.mkdir(exist_ok=True)
        self.scratch=tempfile.TemporaryDirectory(prefix='pdf-metadata-',dir=artifacts)
        self.folder=Path(self.scratch.name).resolve()
        self.assertEqual(self.folder.parent,artifacts.resolve())
        self.config=registry()
        self.source=SITE/'tests/fixtures/reader.pdf'
        self.fields={'title':'静电学复习 "Electric field" & <Gauss>', 'author':'联合复习公社', 'course':'physics-em', 'type':'practice-set', 'description':'练习与答案', 'keywords':['电磁学','Gauss; Coulomb'], 'languages':['zh-CN','en'], 'grade':'G12', 'examBoard':'AP', 'updated':'2026-10-13'}

    def tearDown(self):
        self.scratch.cleanup()

    def test_roundtrip_preserves_body_and_metadata_identity(self):
        output=self.folder/'tagged.pdf'
        original=self.source.read_bytes()
        fields=write_metadata(self.source,output,self.fields,self.config)
        reader=PdfReader(output)
        self.assertEqual(read_fields(reader,self.config),fields)
        self.assertEqual(json.loads(reader.metadata['/WLSAARC']),fields)
        self.assertIn(ARC_NS,reader.xmp_metadata.stream.get_data().decode('utf-8'))
        self.assertEqual(reader.metadata.title,self.fields['title'])
        self.assertEqual(reader.metadata.subject,'Physics')
        self.assertEqual(fields['subject'],'physics')
        before=PdfReader(self.source)
        self.assertEqual(len(reader.pages),len(before.pages))
        for old,new in zip(before.pages,reader.pages):
            self.assertEqual(old.extract_text(),new.extract_text())
            self.assertEqual(old.get_contents().get_data(),new.get_contents().get_data())
            self.assertEqual(old.mediabox,new.mediabox)
        renamed=self.folder/'renamed.pdf'
        output.rename(renamed)
        self.assertEqual(read_fields(PdfReader(renamed),self.config)['id'],fields['id'])
        updated=write_metadata(renamed,self.folder/'updated.pdf',{'title':'第二版'},self.config)
        self.assertEqual(updated['id'],fields['id'])
        self.assertEqual(self.source.read_bytes(),original)

    def test_xmp_only_and_info_xmp_conflicts(self):
        output=self.folder/'tagged.pdf'
        fields=write_metadata(self.source,output,self.fields,self.config)
        writer=PdfWriter(clone_from=output)
        writer.metadata={}
        only=self.folder/'xmp-only.pdf';writer.write(only)
        self.assertEqual(read_fields(PdfReader(only),self.config),fields)
        writer=PdfWriter(clone_from=output)
        changed={**fields,'title':'Inconsistent title'}
        writer.add_metadata({'/WLSAARC':json.dumps(changed)})
        conflict=self.folder/'conflict.pdf';writer.write(conflict)
        with self.assertRaisesRegex(ValueError,'disagree'):
            read_fields(PdfReader(conflict),self.config)

    def test_standard_metadata_and_unclassified_fallback(self):
        writer=PdfWriter(clone_from=self.source)
        writer.add_metadata({'/Title':'标准属性标题','/Subject':'Physics','/Keywords':'电场; arc.course=physics-em; arc.type=course-notes'})
        standard=self.folder/'standard.pdf';writer.write(standard)
        fields=read_fields(PdfReader(standard),self.config)
        self.assertEqual(fields['title'],'标准属性标题')
        self.assertEqual(fields['subject'],'physics')
        self.assertEqual(fields['course'],'physics-em')
        self.assertEqual(fields['type'],'course-notes')
        self.assertEqual(fields['keywords'],['电场'])
        writer.add_metadata({'/Subject':'A free-text topic','/Keywords':'Some keywords'})
        unknown=self.folder/'unknown.pdf';writer.write(unknown)
        self.assertEqual(read_fields(PdfReader(unknown),self.config)['subject'],'')

    def test_validation_and_source_output_protection(self):
        for bad in [{'subject':'made-up'}, {'course':'unknown'}, {'type':'unknown'}, {'subject':'economics','course':'physics-em'}, {'updated':'2026-02-30'}, {'schemaVersion':2}, {'schemaVersion':True}, {'keywords':'not-an-array'}, {'languages':['not_a_tag']}, {'typo':'value'}]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                normalize(bad,self.config)
        with self.assertRaisesRegex(ValueError,'separate output'):
            write_metadata(self.source,self.source,self.fields,self.config)
        output=self.folder/'existing.pdf';output.write_bytes(b'keep')
        with self.assertRaisesRegex(ValueError,'already exists'):
            write_metadata(self.source,output,self.fields,self.config)
        self.assertEqual(output.read_bytes(),b'keep')

    def test_preserves_other_xmp_properties(self):
        writer=PdfWriter(clone_from=self.source)
        xmp=XmpInformation.create();xmp.dc_rights={'x-default':'Original author retains rights'}
        writer.xmp_metadata=xmp
        source=self.folder/'original-xmp.pdf';writer.write(source)
        output=self.folder/'tagged-xmp.pdf';write_metadata(source,output,self.fields,self.config)
        self.assertEqual(PdfReader(output).xmp_metadata.dc_rights,{'x-default':'Original author retains rights'})

    def test_legacy_course_metadata_keeps_its_original_code(self):
        fields={**self.fields,'course':'g10-calculus-bc','subject':'mathematics','grade':'G10'}
        output=self.folder/'legacy-course.pdf'
        embedded=write_metadata(self.source,output,fields,self.config)
        original=output.read_bytes()
        decoded=read_fields(PdfReader(output),self.config)
        self.assertEqual(decoded,embedded)
        self.assertEqual(decoded['course'],'g10-calculus-bc')
        self.assertEqual(decoded['grade'],'G10')
        self.assertEqual(decoded['subject'],'mathematics')
        self.assertEqual(output.read_bytes(),original)
        with self.assertRaisesRegex(ValueError,'belongs to mathematics'):
            normalize({**fields,'subject':'physics'},self.config)
        for aliases in [{'ap-calculus-bc':'physics-em'},{'legacy':'missing'},{'legacy':'other','other':'ap-calculus-bc'}]:
            with self.subTest(aliases=aliases), self.assertRaisesRegex(ValueError,'Invalid course alias'):
                normalize(fields,{**self.config,'courseAliases':aliases})

    def test_scanner_handles_encrypted_pdf_as_download_only(self):
        writer=PdfWriter(clone_from=self.source);writer.encrypt('password')
        writer.write(self.folder/'locked.pdf')
        rows=scan(self.folder,self.config)
        self.assertEqual(len(rows),1)
        self.assertFalse(rows[0]['readable'])
        self.assertEqual(rows[0]['metadata'],{})


if __name__=='__main__':
    unittest.main()
