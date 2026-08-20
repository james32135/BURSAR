from pathlib import Path
import sys

pdf_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("pypdfium2 missing")

pdf = pdfium.PdfDocument(str(pdf_path))
page = pdf[0]
bitmap = page.render(scale=2.5)
pil = bitmap.to_pil()
out_path.parent.mkdir(parents=True, exist_ok=True)
pil.save(out_path, format="PNG")
print(f"wrote {out_path} {pil.size[0]}x{pil.size[1]}")
