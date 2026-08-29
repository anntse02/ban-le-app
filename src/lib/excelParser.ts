import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ParsedExcelRecord {
  date: string;
  name: string;
  quantity: number;
}

/**
 * Helper function to parse the specific "TỔNG NHẬP XUẤT TỒN" Excel file structure.
 * 
 * @param arrayBuffer - The file content as an ArrayBuffer
 * @param selectedSheetName - The name of the sheet to parse
 * @returns Array of ParsedExcelRecord
 */
export function parseInventoryExcel(
  arrayBuffer: ArrayBuffer,
  selectedSheetName: string
): { records: ParsedExcelRecord[]; sheetNames: string[] } {
  // Read workbook with cellDates: true to parse dates correctly
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;

  if (!selectedSheetName) {
    return { records: [], sheetNames };
  }

  const worksheet = workbook.Sheets[selectedSheetName];
  if (!worksheet) {
    throw new Error(`Không tìm thấy sheet: ${selectedSheetName}`);
  }

  // Convert to 2D array
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const parsedList: ParsedExcelRecord[] = [];
  let lastDate = "";

  // The specific format starts data at row 4 (index 3)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const dateCell = row[0]; // Column A (Ngày)
    const nameCell = row[1]; // Column B (Tên hàng)
    const qtyCell = row[2];  // Column C (Số lượng)

    // Fill-down logic for Date column
    if (dateCell !== undefined && dateCell !== null && dateCell !== "") {
      if (dateCell instanceof Date) {
        lastDate = format(dateCell, "yyyy-MM-dd");
      } else {
        lastDate = String(dateCell).trim();
      }
    }

    // Skip rows without a product name
    if (nameCell && String(nameCell).trim() !== "") {
      const qty = Number(qtyCell) || 0;
      if (qty > 0) {
        parsedList.push({
          date: lastDate,
          name: String(nameCell).trim(),
          quantity: qty,
        });
      }
    }
  }

  // --- BƯỚC MỚI: TÌM NGÀY MỚI NHẤT ---
  let latestDate = "";
  let latestTime = 0;

  for (const rec of parsedList) {
    if (!rec.date) continue;
    let time = 0;
    
    // Nếu date theo chuẩn yyyy-MM-dd (do date-fns format ở trên)
    if (rec.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      time = new Date(rec.date).getTime();
    } 
    // Nếu date dạng dd/MM/yyyy
    else if (rec.date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [d, m, y] = rec.date.split("/");
      time = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).getTime();
    }
    else {
      // Fallback: thử parse bằng Date
      time = new Date(rec.date).getTime();
    }

    if (!isNaN(time)) {
      if (time > latestTime) {
        latestTime = time;
        latestDate = rec.date;
      }
    } else {
      // Fallback string so sánh
      if (rec.date > latestDate) {
        latestDate = rec.date;
      }
    }
  }

  // Lấy ngày của dòng cuối cùng làm dự phòng nếu thuật toán trên không tìm được
  if (!latestDate && parsedList.length > 0) {
    latestDate = parsedList[parsedList.length - 1].date;
  }

  // --- BƯỚC MỚI: LỌC THEO NGÀY MỚI NHẤT ---
  const filteredList = latestDate 
    ? parsedList.filter(rec => rec.date === latestDate)
    : parsedList;

  return { records: filteredList, sheetNames };
}
