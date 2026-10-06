// Run with the original Lobby Door SOP and EOP paths. All checks are local;
// exports stay in memory and nothing is written to Firestore or the source files.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import JSZip from 'jszip';

const [sopPath, eopPath] = process.argv.slice(2);
assert.ok(sopPath && eopPath, 'Usage: node scripts/test-sop-eop-docx.mjs <Lobby Door SOP.docx> <Lobby Door EOP.docx>');
const bundlePath = path.resolve('tmp', `sop-eop-regression-${process.pid}.mjs`);
await fs.mkdir(path.dirname(bundlePath), { recursive: true });

try {
  await build({
    stdin: {
      contents: `export { importSopEopFromDocx } from './frontend/utils/sopEopDocxImport.ts';
        export { exportSOPToDocx, exportEOPToDocx } from './frontend/utils/sopEopDocxExport.ts';`,
      resolveDir: process.cwd(),
    },
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    alias: { '@': path.resolve('frontend') },
    loader: { '.jpeg': 'dataurl' },
    plugins: [{
      name: 'local-document-check',
      setup(builder) {
        builder.onResolve({ filter: /^file-saver$/ }, () => ({ path: 'save', namespace: 'local-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'local-test' }, () => ({
          contents: 'export const saveAs = (blob, name) => { globalThis.__documentExport = { blob, name }; };',
        }));
        // Keep the real deterministic translator; prevent auth/network initialization.
        builder.onLoad({ filter: /[\\/]api[\\/]firebase\.ts$/ }, () => ({ contents: 'export const auth = { currentUser: null };' }));
        builder.onLoad({ filter: /[\\/]utils[\\/]apiConfig\.ts$/ }, () => ({
          contents: 'export const getApiEndpoint = () => { throw new Error("Network access is forbidden in document regression checks"); };',
        }));
      },
    }],
  });
  const { importSopEopFromDocx, exportSOPToDocx, exportEOPToDocx } = await import(pathToFileURL(bundlePath).href);
  const file = (bytes, name) => new File([bytes], name);
  const selected = (data) => data.affectedSystems.filter((item) => item.checked).map((item) => item.key).sort();
  const expected = ['lockout_tagout', 'security_system'];
  const sourceBytes = await fs.readFile(sopPath);
  const imported = await importSopEopFromDocx(file(sourceBytes, path.basename(sopPath)));
  assert.equal(imported.type, 'SOP');
  assert.deepEqual(selected(imported.sopData), expected);
  assert.equal(imported.sopData.affectedSystems.length, 15);
  console.log('PASS original SOP: only Security System and Lockout / Tag Required checked');

  // Exercise alternative Word encodings using the same real source content.
  const sourceZip = await JSZip.loadAsync(sourceBytes);
  const sourceXml = await sourceZip.file('word/document.xml').async('text');
  const checkedParagraphs = sourceXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)
    .filter((paragraph) => /<w:numId w:val="9"/.test(paragraph) && /Security System|Lockout \/ Tag Required/.test(paragraph));
  assert.equal(checkedParagraphs.length, 2);

  const splitHeadingZip = await JSZip.loadAsync(sourceBytes);
  const splitHeadingXml = sourceXml.replace(/Section 4(?=[^<]*<\/w:t>)/, 'Section </w:t></w:r><w:r><w:t>4');
  assert.notEqual(splitHeadingXml, sourceXml);
  splitHeadingZip.file('word/document.xml', splitHeadingXml);
  const splitHeading = await importSopEopFromDocx(file(await splitHeadingZip.generateAsync({ type: 'uint8array' }), path.basename(sopPath)));
  assert.deepEqual(selected(splitHeading.sopData), expected);
  console.log('PASS section heading split across Word runs');

  const overrideZip = await JSZip.loadAsync(sourceBytes);
  const numberingXml = await overrideZip.file('word/numbering.xml').async('text');
  const overrideXml = numberingXml.replace(/(<w:num\b[^>]*w:numId="9"[^>]*>[\s\S]*?)(<\/w:num>)/,
    '$1<w:lvlOverride w:ilvl="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:lvlOverride>$2');
  assert.notEqual(overrideXml, numberingXml);
  overrideZip.file('word/numbering.xml', overrideXml);
  const overridden = await importSopEopFromDocx(file(await overrideZip.generateAsync({ type: 'uint8array' }), path.basename(sopPath)));
  assert.deepEqual(selected(overridden.sopData), []);
  console.log('PASS per-list level override replaces the abstract checkmark');

  for (const [name, marker] of [
    ['Unicode checkmark', '<w:r><w:t>✓ </w:t></w:r>'],
    ['checked box', '<w:r><w:t>☑ </w:t></w:r>'],
    ['crossed box', '<w:r><w:t>☒ </w:t></w:r>'],
    ['text checkbox', '<w:r><w:t>[x] </w:t></w:r>'],
    ['Word symbol', '<w:r><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>'],
    ['Wingdings text', '<w:r><w:rPr><w:rFonts w:ascii="Wingdings"/></w:rPr><w:t>\uf0fc</w:t></w:r>'],
  ]) {
    const zip = await JSZip.loadAsync(sourceBytes);
    let xml = sourceXml;
    for (const paragraph of checkedParagraphs) {
      const changed = paragraph.replace(/<w:numPr\b[^>]*>[\s\S]*?<\/w:numPr>/, '')
        .replace('</w:pPr>', `</w:pPr>${marker}`)
        .replace('Security System', 'Secu</w:t></w:r><w:r><w:t>rity System');
      xml = xml.replace(paragraph, changed);
    }
    zip.file('word/document.xml', xml);
    zip.remove('word/numbering.xml');
    const result = await importSopEopFromDocx(file(await zip.generateAsync({ type: 'uint8array' }), path.basename(sopPath)));
    assert.deepEqual(selected(result.sopData), expected, name);
    console.log(`PASS ${name}: separate marker/label runs, no numbering.xml`);
  }

  // Detail text must never turn an unchecked checklist item into a checked one.
  const uncheckedZip = await JSZip.loadAsync(sourceBytes);
  let uncheckedXml = sourceXml;
  for (const paragraph of checkedParagraphs) {
    uncheckedXml = uncheckedXml.replace(paragraph, paragraph.replace('<w:numId w:val="9"', '<w:numId w:val="1"'));
  }
  uncheckedXml = uncheckedXml.replace('Lockout/Tag Required – Be sure', '✓ Lockout/Tag Required – Be sure');
  uncheckedZip.file('word/document.xml', uncheckedXml);
  const unchecked = await importSopEopFromDocx(file(await uncheckedZip.generateAsync({ type: 'uint8array' }), path.basename(sopPath)));
  assert.deepEqual(selected(unchecked.sopData), []);
  console.log('PASS unchecked bullets and checked-looking detail text do not select any system');

  await exportSOPToDocx(imported.sopData);
  const exported = globalThis.__documentExport;
  const exportedZip = await JSZip.loadAsync(await exported.blob.arrayBuffer());
  const exportedXml = await exportedZip.file('word/document.xml').async('text');
  const checklistXml = exportedXml.match(/<w:tbl\b[^>]*>(?:(?!<\/w:tbl>)[\s\S])*Security System[\s\S]*?<\/w:tbl>/)?.[0];
  assert.ok(checklistXml, 'Export contains the Section 4 checklist table');
  const checklistText = checklistXml.replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '');
  assert.ok(checklistText.includes('☑ Security System'), 'Security System is a checked box');
  assert.ok(checklistText.includes('☑ Lockout / Tag Required'), 'Lockout / Tag Required is a checked box');
  assert.ok(checklistText.includes('☐ Electrical Distribution'), 'Unchecked items are empty boxes');
  const cellBorders = checklistXml.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0];
  assert.ok(cellBorders && /w:val="single"/.test(cellBorders), 'Checklist table cells have grid borders');
  const reimported = await importSopEopFromDocx(file(await exported.blob.arrayBuffer(), exported.name));
  assert.deepEqual(selected(reimported.sopData), expected);
  console.log('PASS SOP import/export/reimport: selected states preserved, checklist boxed grid');

  const eop = await importSopEopFromDocx(file(await fs.readFile(eopPath), path.basename(eopPath)));
  assert.equal(eop.type, 'EOP');
  assert.ok(eop.eopData.workSteps.length > 0);
  assert.ok(!('affectedSystems' in eop.eopData));
  await exportEOPToDocx(eop.eopData);
  const eopExport = globalThis.__documentExport;
  const eopReimport = await importSopEopFromDocx(file(await eopExport.blob.arrayBuffer(), eopExport.name));
  assert.equal(eopReimport.type, 'EOP');
  assert.deepEqual(eopReimport.eopData.workSteps, eop.eopData.workSteps);
  console.log('PASS original EOP: work steps preserved through import/export/reimport');
} finally {
  await fs.unlink(bundlePath).catch(() => {});
  delete globalThis.__documentExport;
}
