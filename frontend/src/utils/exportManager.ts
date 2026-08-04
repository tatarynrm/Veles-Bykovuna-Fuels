export interface ExportColumn {
  label: string;
  key: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency';
}

export interface ExportOptions {
  filename?: string;
  title?: string;
  subtitle?: string;
  columns?: ExportColumn[];
  sheetName?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Parses an HTML table element or selector into columns and rows.
 * Cleans formatting like currency symbols and units while preserving data types.
 */
export function parseHTMLTable(tableElementOrSelector: HTMLTableElement | string): { columns: ExportColumn[]; data: any[] } {
  let table: HTMLTableElement | null = null;
  if (typeof tableElementOrSelector === 'string') {
    table = document.querySelector(tableElementOrSelector);
  } else {
    table = tableElementOrSelector;
  }

  if (!table) {
    throw new Error(`Table element not found for selector: ${tableElementOrSelector}`);
  }

  const columns: ExportColumn[] = [];
  const data: any[] = [];

  // Helper to check if a column is empty or contains non-exportable action elements (e.g. basket icon buttons, buttons)
  const isActionColumn = (text: string) => {
    const t = text.trim().toLowerCase();
    return t === '' || t.includes('action') || t.includes('кошик') || t.includes('деталі') || t.includes('дію') || t.includes('дії') || t.includes('статус');
  };

  // Find headers
  const headers = table.querySelectorAll('thead th, thead td');
  const headerCells = headers.length > 0 ? Array.from(headers) : Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));

  headerCells.forEach((th, index) => {
    const text = th.textContent?.trim() || '';
    if (isActionColumn(text)) return; // Skip columns like actions/basket

    columns.push({
      label: text,
      key: `col_${index}`,
      type: 'string', // Default type, can be overridden during cell inspection
    });
  });

  // Find data rows in tbody
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) return;

    const rowData: Record<string, any> = {};

    headerCells.forEach((th, headerIdx) => {
      const text = th.textContent?.trim() || '';
      if (isActionColumn(text)) return;

      const cell = cells[headerIdx];
      if (cell) {
        // Strip nested button texts/actions, get raw text representation
        let val = cell.textContent?.trim() || '';

        // Clean value formatting to detect numeric values (e.g. "50.00 ₴" -> 50, "10 л" -> 10)
        let cleanVal = val.replace(/\s+/g, '')
                          .replace(/₴/g, '')
                          .replace(/л/g, '')
                          .replace(/%/g, '')
                          .replace(/,/g, '.');

        // Check if value is numeric, but keep long integer strings like cards PAN (16+ digits) or codes as strings
        const isNumeric = /^[+-]?\d+(\.\d+)?$/.test(cleanVal);
        const isLongNumber = /^\d{10,}$/.test(cleanVal);

        if (isNumeric && !isLongNumber && cleanVal !== '') {
          rowData[`col_${headerIdx}`] = Number(cleanVal);
        } else {
          // Keep string
          rowData[`col_${headerIdx}`] = val;
        }
      } else {
        rowData[`col_${headerIdx}`] = '';
      }
    });

    // Skip empty rows
    if (Object.values(rowData).some(v => v !== '')) {
      data.push(rowData);
    }
  });

  return { columns, data };
}

/**
 * Exports data to an Excel file (.xlsx) using ExcelJS.
 */
export async function exportToExcel(
  inputData: any[] | HTMLTableElement | string,
  options: ExportOptions = {}
) {
  const {
    filename = 'export',
    title = 'Звіт даних',
    subtitle = '',
    sheetName = 'Дані',
    columns: customColumns,
  } = options;

  let columns: ExportColumn[] = [];
  let data: any[] = [];

  if (Array.isArray(inputData)) {
    if (inputData.length === 0) {
      throw new Error('Дані для експорту порожні');
    }
    data = inputData;
    if (customColumns) {
      columns = customColumns;
    } else {
      // Auto-create columns from first object's keys
      const keys = Object.keys(data[0]);
      columns = keys.map((key) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        key,
        type: typeof data[0][key] === 'number' ? 'number' : 'string',
      }));
    }
  } else {
    const parsed = parseHTMLTable(inputData);
    columns = parsed.columns;
    data = parsed.data;
  }

  // Load exceljs dynamically
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Ensure grid lines are visible
  worksheet.views = [{ showGridLines: true }];

  let currentRow = 1;

  // Title Row
  if (title) {
    const titleRow = worksheet.addRow([title]);
    titleRow.height = 32;
    titleRow.getCell(1).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00C853' }, // OKKO Emerald Green
    };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
    currentRow++;
  }

  // Subtitle / Date Row
  const dateStr = `Згенеровано: ${new Date().toLocaleString('uk-UA')}`;
  const subText = subtitle ? `${subtitle} | ${dateStr}` : dateStr;
  const subRow = worksheet.addRow([subText]);
  subRow.height = 20;
  subRow.getCell(1).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF555555' } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
  currentRow++;

  // Empty spacing row
  worksheet.addRow([]);
  currentRow++;

  // Headers Row
  const headerValues = columns.map((col) => col.label);
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 26;

  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF24A600' }, // OKKO Green
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  // Populate data
  data.forEach((item) => {
    const rowValues = columns.map((col) => {
      const val = item[col.key];
      if (val === undefined || val === null) return '';
      return val;
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 20;

    columns.forEach((col, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };

      const val = cell.value;
      if (typeof val === 'number') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        // Мінус (злив/втрата) — червоним, решта чисел — зеленим
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: val < 0 ? NEGATIVE_ARGB : POSITIVE_ARGB },
        };

        // Formatting currency / volume / numeric
        const label = col.label.toLowerCase();
        const key = col.key.toLowerCase();
        if (col.type === 'currency' || label.includes('сума') || label.includes('ціна') || label.includes('баланс') || label.includes('ліміт') || label.includes('uah') || label.includes('₴')) {
          cell.numFmt = '#,##0.00 "₴"';
        } else if (label.includes('об\'єм') || label.includes('volume') || label.includes('літр') || key.includes('volume')) {
          cell.numFmt = '#,##0.00 "л"';
        } else {
          cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.00';
        }
      } else if (val instanceof Date) {
        cell.numFmt = 'YYYY-MM-DD HH:MM:SS';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (typeof val === 'string') {
        // Date strings format centering
        if (/^\d{4}-\d{2}-\d{2}/.test(val) || /^\d{2}\.\d{2}\.\d{4}/.test(val)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        // Identifiers centering
        if (col.label.toLowerCase().includes('картка') || col.label.toLowerCase().includes('pan') || col.label.toLowerCase().includes('номер')) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          // Відформатовані числа-рядки ("-1 234,56 ₴") теж фарбуємо за знаком
          const numeric = parseDisplayNumber(val);
          if (numeric !== null) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.font = {
              name: 'Segoe UI',
              size: 10,
              color: { argb: numeric < 0 ? NEGATIVE_ARGB : POSITIVE_ARGB },
            };
          }
        }
      }
    });
  });

  // Calculate and set auto column widths
  columns.forEach((col, colIndex) => {
    let maxLength = col.label.length;

    data.forEach((item) => {
      const val = item[col.key];
      if (val !== undefined && val !== null) {
        let text = val.toString();
        if (typeof val === 'number') {
          // Approximate formatted string length
          text = val.toFixed(2) + ' ₴';
        }
        maxLength = Math.max(maxLength, text.length);
      }
    });

    const worksheetColumn = worksheet.getColumn(colIndex + 1);
    worksheetColumn.width = Math.min(Math.max(maxLength + 4, 10), 45);
  });

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Memory caches for fonts base64
let cachedRegularFont: string | null = null;
let cachedBoldFont: string | null = null;

async function fetchFontAsBase64(urls: string[]): Promise<string> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font ${url}: ${response.statusText}`);
      }
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64 = base64String.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Loads Cyrillic Unicode fonts into jsPDF to support Ukrainian characters.
 * Fonts live in /public/fonts (same-origin, works offline); the CDN is only a
 * fallback. Note: pdfmake's CDN has no Roboto-Bold.ttf — Medium plays bold.
 */
async function loadCyrillicFonts(doc: any): Promise<boolean> {
  try {
    if (!cachedRegularFont) {
      cachedRegularFont = await fetchFontAsBase64([
        '/fonts/Roboto-Regular.ttf',
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
      ]);
    }
    if (!cachedBoldFont) {
      cachedBoldFont = await fetchFontAsBase64([
        '/fonts/Roboto-Medium.ttf',
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
      ]);
    }

    doc.addFileToVFS('Roboto-Regular.ttf', cachedRegularFont);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Medium.ttf', cachedBoldFont);
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto', 'normal');
    return true;
  } catch (error) {
    console.warn('Could not load Cyrillic Roboto font, falling back to Helvetica:', error);
    return false;
  }
}

/**
 * Intl formatters emit no-break / narrow no-break spaces (U+00A0, U+202F) as
 * thousands separators — glyphs the embedded font may not have, which render
 * as unknown-symbol boxes in the PDF. Swap them for plain spaces.
 */
function sanitizePdfText(text: string): string {
  return text.replace(/[\u00A0\u202F\u2009]/g, ' ');
}

/** Parses a display string like "-1 234,56 ₴" / "10 л" back to a number, or null. */
function parseDisplayNumber(text: string): number | null {
  const clean = text
    .replace(/[\s\u00A0\u202F\u2009]/g, '')
    .replace(/[₴%]/g, '')
    .replace(/л$/i, '')
    .replace(/грн$/i, '')
    .replace(',', '.')
    .replace('−', '-');
  if (clean === '' || !/^[+-]?\d+(\.\d+)?$/.test(clean)) return null;
  // Довгі цілі рядки — це PAN карток або коди, не суми
  if (/^\d{10,}$/.test(clean)) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

// Червоний для мінусів (злив/втрата/повернення), зелений для решти чисел.
const NEGATIVE_RGB: [number, number, number] = [220, 38, 38]; // red-600
const POSITIVE_RGB: [number, number, number] = [21, 128, 61]; // green-700
const NEGATIVE_ARGB = 'FFDC2626';
const POSITIVE_ARGB = 'FF15803D';

/**
 * Exports data to a PDF document (.pdf) using jsPDF and jspdf-autotable.
 */
export async function exportToPDF(
  inputData: any[] | HTMLTableElement | string,
  options: ExportOptions = {}
) {
  const {
    filename = 'export',
    title = 'Звіт даних',
    subtitle = '',
    columns: customColumns,
    orientation: customOrientation,
  } = options;

  let columns: ExportColumn[] = [];
  let data: any[] = [];

  if (Array.isArray(inputData)) {
    if (inputData.length === 0) {
      throw new Error('Дані для експорту порожні');
    }
    data = inputData;
    if (customColumns) {
      columns = customColumns;
    } else {
      const keys = Object.keys(data[0]);
      columns = keys.map((key) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        key,
      }));
    }
  } else {
    const parsed = parseHTMLTable(inputData);
    columns = parsed.columns;
    data = parsed.data;
  }

  // Auto-detect page orientation: landscape if > 6 columns
  const orientation = customOrientation || (columns.length > 6 ? 'landscape' : 'portrait');

  // Load jsPDF dynamically
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Load Unicode Cyrillic Font (essential for Ukrainian characters)
  const isUnicodeFontLoaded = await loadCyrillicFonts(doc);
  const activeFontFamily = isUnicodeFontLoaded ? 'Roboto' : 'helvetica';

  const tableHeaders = columns.map((col) => sanitizePdfText(col.label));
  const tableRows = data.map((item) => {
    return columns.map((col) => {
      const val = item[col.key];
      if (val === undefined || val === null) return '';

      if (typeof val === 'number') {
        const label = col.label.toLowerCase();
        if (col.type === 'currency' || label.includes('сума') || label.includes('ціна') || label.includes('баланс') || label.includes('ліміт') || label.includes('₴')) {
          return sanitizePdfText(new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(val));
        } else if (label.includes('об\'єм') || label.includes('volume') || label.includes('літр')) {
          return sanitizePdfText(`${val.toLocaleString('uk-UA')} л`);
        }
        return sanitizePdfText(val.toLocaleString('uk-UA'));
      }
      return sanitizePdfText(val.toString());
    });
  });

  const totalPagesPlaceholder = '{total_pages_count_string}';

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: 28,
    theme: 'grid',
    styles: {
      font: activeFontFamily,
      fontSize: columns.length > 8 ? 8 : 9,
      cellPadding: 2.5,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [36, 166, 0], // OKKO Green (#24a600)
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        const val = cellData.cell.raw;
        if (typeof val !== 'string') return;
        // Числові клітинки: вирівнювання праворуч + колір за знаком —
        // мінус (злив/втрата/повернення) червоний, решта зелені
        const numeric = parseDisplayNumber(val);
        if (numeric !== null) {
          cellData.cell.styles.halign = 'right';
          cellData.cell.styles.textColor = numeric < 0 ? NEGATIVE_RGB : POSITIVE_RGB;
        }
      }
    },
    didDrawPage: (pageData) => {
      // Header Section
      doc.setFont(activeFontFamily, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(36, 166, 0); // OKKO Green
      doc.text(sanitizePdfText(title), pageData.settings.margin.left, 12);

      // Subtitle
      doc.setFont(activeFontFamily, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate-500
      const dateStr = `Згенеровано: ${new Date().toLocaleString('uk-UA')}`;
      const subText = sanitizePdfText(subtitle ? `${subtitle} | ${dateStr}` : dateStr);
      doc.text(subText, pageData.settings.margin.left, 18);

      // Dividing Line
      doc.setDrawColor(226, 232, 240); // border line
      doc.setLineWidth(0.25);
      doc.line(pageData.settings.margin.left, 22, doc.internal.pageSize.width - pageData.settings.margin.right, 22);

      // Footer Section
      const currentPage = (doc.internal as any).getNumberOfPages();
      let footerStr = `Сторінка ${currentPage}`;
      if (typeof doc.putTotalPages === 'function') {
        footerStr += ` з ${totalPagesPlaceholder}`;
      }

      doc.setFont(activeFontFamily, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400

      const pageWidth = doc.internal.pageSize.width;
      const textWidth = doc.getStringUnitWidth(footerStr) * (doc.internal as any).getFontSize() / doc.internal.scaleFactor;
      const footerX = (pageWidth - textWidth) / 2;
      doc.text(footerStr, footerX, doc.internal.pageSize.height - 10);
    },
    margin: { top: 28, bottom: 16, left: 10, right: 10 },
  });

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesPlaceholder);
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Universal manager exporting API
 */
export const ExportManager = {
  toExcel: exportToExcel,
  toPDF: exportToPDF,
  parseTable: parseHTMLTable,
};
