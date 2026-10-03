const zlib = require("node:zlib");
// Read PDFKit's standard-font text from real, compressed page streams. Used only
// by tests to assert content, in addition to checking the PDF header/structure.
function receiptPdfText(pdf) {
  const data = pdf.toString("latin1"); let text = "";
  for (const match of data.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gs)) {
    let stream = Buffer.from(match[2], "latin1");
    if (match[1].includes("FlateDecode")) stream = zlib.inflateSync(stream);
    for (const encoded of stream.toString("latin1").matchAll(/<([0-9a-f]+)>/gi)) text += Buffer.from(encoded[1], "hex").toString("latin1");
  }
  return text;
}
module.exports = { receiptPdfText };
