'use strict';

/* v7.0.0 · servicios comunes de IO Solver
 * Infraestructura compartida para proyectos y reportes multipágina.
 */
(function initIOSolverServices() {
  const service = {
    version: '1.0.0',
    storage: {
      sanitizeFilename(name, fallback = 'io-solver-proyecto') {
        const clean = String(name || '')
          .normalize('NFKC')
          .replace(/[\\/:*?"<>|]+/g, '-')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 120);
        return clean || fallback;
      },
      downloadJson(data, name, fallback = 'io-solver-proyecto') {
        const safeName = service.storage.sanitizeFilename(name, fallback);
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.json`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        return true;
      },
      readJsonFile(file) {
        if (!file) return Promise.reject(new Error('No se seleccionó ningún archivo.'));
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              resolve(JSON.parse(String(reader.result || '')));
            } catch (_) {
              reject(new Error('El archivo no contiene un JSON válido.'));
            }
          };
          reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
          reader.readAsText(file);
        });
      },
      clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
      }
    },
    print: {
      baseStyles() {
        return `
          @page { size: Letter portrait; margin: 0; }
          *, *::before, *::after { box-sizing: border-box; }
          :root {
            color-scheme: light !important;
            --bg: #ffffff;
            --panel: #ffffff;
            --panel-soft: #f8fafc;
            --input-bg: #ffffff;
            --code-bg: #f8fafc;
            --text: #172033;
            --muted: #68758a;
            --border: #d9e1ec;
            --accent: #1989e8;
            --accent-soft: #eaf5ff;
            --accent-strong: #166bb4;
            --glass-control: #ffffff;
            --glass-line: #d9e1ec;
            --glass-shine: rgba(255,255,255,.78);
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 100%;
            background: #fff !important;
          }
          body {
            color: #172033 !important;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif !important;
            font-size: 10.5pt;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .io-print-main {
            display: block !important;
            width: 8.5in !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0.58in 0.62in 0.62in !important;
            background: #fff !important;
            color: #172033 !important;
            overflow: visible !important;
          }
          .io-report-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .io-report-page { break-before: page; page-break-before: always; }
          .io-report-page:first-child { break-before: auto; page-break-before: auto; }
          h1, h2, h3, h4, p, li, strong, span, small, td, th, summary {
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
            word-break: normal;
          }
          h1, h2, h3, h4 {
            break-after: avoid-page;
            page-break-after: avoid;
          }
          p, li { orphans: 3; widows: 3; }
          table {
            max-width: 100% !important;
          }
          img, svg, canvas {
            max-width: 100% !important;
          }
          .io-no-break,
          .io-print-card,
          .io-callout,
          .io-section-box {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .io-print-table-wrap {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          @media screen {
            body { background: #eef2f6; padding: 20px !important; }
            .io-print-main {
              max-width: 8.5in !important;
              box-shadow: 0 5px 30px rgba(20,40,70,.12);
            }
          }
          @media print {
            .no-print { display: none !important; }
            .io-print-main { overflow: visible !important; }
          }
        `;
      },
      open({ title = 'IO Solver', content = '', styles = '', bodyClass = 'io-print-document', messageTarget = null, message = '' } = {}) {
        const reportWindow = window.open('', '_blank', 'width=980,height=900');
        if (!reportWindow) {
          throw new Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para IO Solver e inténtalo de nuevo.');
        }
        try {
          const stylesheetHref = new URL('style.css', document.baseURI).href;
          const safeTitle = String(title).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
          reportWindow.document.open();
          reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle}</title><base href="${document.baseURI.replace(/"/g, '&quot;')}"><link rel="stylesheet" href="${stylesheetHref}"><style>${service.print.baseStyles()}\n${styles}</style></head><body class="${bodyClass}"><main class="io-print-main">${content}</main></body></html>`);
          reportWindow.document.close();

          let printed = false;
          const triggerPrint = () => {
            if (printed || reportWindow.closed) return;
            printed = true;
            reportWindow.document.querySelectorAll('details').forEach(detail => { detail.open = true; });
            reportWindow.focus();
            setTimeout(() => {
              try { reportWindow.print(); } catch (_) { /* El navegador controla el diálogo. */ }
            }, 150);
          };
          reportWindow.addEventListener('load', triggerPrint, { once: true });
          setTimeout(triggerPrint, 800);
          if (messageTarget && message) messageTarget(message, 'ok');
          return reportWindow;
        } catch (error) {
          try { reportWindow.close(); } catch (_) {}
          throw error;
        }
      }
    }
  };

  window.IOSolverServices = service;
})();
