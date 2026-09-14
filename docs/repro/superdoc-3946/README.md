# superdoc/docx-editor#3946 — repro files for the residual gap

After the SD-4772 fix shipped in SuperDoc 2.13.0 the spurious empty line is gone, but a line
that ends at a `<w:br/>` still stops short of the measure when the text before the break ends
with a space.

Measured shortfall, on every affected line:

```
gap = word-spacing + one space advance
```

The trailing space is counted by the justifier — it is in the line's natural width and in its
space count, so `word-spacing` is computed as if it will be drawn — and then it is not drawn.

## Files

| File | What it is |
| --- | --- |
| `grid-space.docx` | 24 paragraphs, identical except the pre-break text grows one character at a time. 13 of 24 show the gap (37.98px down to 5.02px); 11 are correct. |
| `grid-nospace.docx` | The control: same file minus one space per paragraph. All 24 at -0.02px. |
| `min-space.docx` | One paragraph, the exact shape of the repro in the issue body. Gap 7.34px. |
| `min-nospace.docx` | Its control. -0.02px. |
| `mx-en-ltr.docx` | Isolation matrix: English text, LTR section. |
| `mx-en-rtl.docx` | English text, `w:bidi` section. |
| `mx-he-ltr.docx` | Hebrew text, LTR section. |
| `mx-he-rtl.docx` | Hebrew text, `w:bidi` section. |
| `case.docx` | The original Hebrew two-column document the report came from. |
| `make-docx.mjs` | Generator for every synthetic file above — five OOXML parts, Arial only, no embedded fonts. |

The four `mx-*` files are the same content in four combinations of script and section
direction. All four show the same gap, which is what rules out an RTL-specific or a
Hebrew-specific cause.

## Measuring

Render the file, then for each `.superdoc-line` compare the line box's end edge against the
last glyph's edge — not against the span's bounding rect, which includes a trailing space's
advance when one is drawn. Pick the edge by the line's `text-align`, not by its inherited
`direction`; a host container that forces `direction: rtl` will otherwise send the measurement
to the wrong side of an LTR line.
