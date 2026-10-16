# Dependencias incluidas (copias locales para uso con servidor estático)

| Componente | Versión | Licencia | Origen |
|---|---|---|---|
| PDF.js (`pdfjs-dist`) | 4.10.38 | Apache-2.0 | npm / jsDelivr |
| Tesseract.js (`tesseract.js`) | 5.1.1 | Apache-2.0 | npm / jsDelivr |
| Tesseract.js core (`tesseract.js-core`, variantes `simd-lstm` y `lstm`) | 5.1.1 | Apache-2.0 | npm / jsDelivr |
| Datos de idioma español (`@tesseract.js-data/spa`, `4.0.0_best_int`) | 1.0.0 | MIT (datos de tessdata_best, Apache-2.0) | npm / jsDelivr |
| Datos de idioma inglés (`@tesseract.js-data/eng`, `4.0.0_best_int`) | 1.0.0 | MIT (datos de tessdata_best, Apache-2.0) | npm / jsDelivr |

Los textos de licencia de PDF.js, Tesseract.js y Tesseract.js core están junto a cada componente.
Sin servidor estático (abriendo `index.html` con `file://`) la aplicación descarga estas mismas versiones desde jsDelivr.
