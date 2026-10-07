import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface SheetSpec {
  name: string;
  rows: readonly unknown[];
}

/**
 * 여러 시트로 구성된 .xlsx 를 만들어 앱 캐시에 저장한 뒤 공유 시트(저장/메일/드라이브 등)를 엽니다.
 * (웹의 utils/excelExporter.ts 대응 — 브라우저 다운로드 대신 OS 공유 시트 사용)
 */
export async function exportWorkbook(fileBaseName: string, sheets: SheetSpec[]) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows as object[]);
    // 시트명은 31자 제한 + 일부 특수문자 불가
    const safeName = sheet.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }

  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const safeFile = fileBaseName.replace(/[\\/:*?"<>|\s]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${safeFile}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('이 기기에서는 파일 공유를 사용할 수 없습니다.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: '엑셀 파일 저장/공유',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}
