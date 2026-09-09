import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * 여러 시트로 구성된 워크북을 만들어 .xlsx 파일로 저장합니다.
 * `/api/export/*` 응답(JSON 배열)을 그대로 넘기면 됩니다.
 *
 * @example
 *   exportWorkbook('safestep_강남점_2026-09', [
 *     { name: '학생목록', rows: students },
 *     { name: '출석기록', rows: attendance },
 *   ]);
 */
export interface SheetSpec {
  name: string;
  rows: readonly unknown[];
}

export function exportWorkbook(fileBaseName: string, sheets: SheetSpec[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows as object[]);
    // 시트명은 31자 제한 + 일부 특수문자 불가
    const safeName = sheet.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${fileBaseName}.xlsx`);
}
