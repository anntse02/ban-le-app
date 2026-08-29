import ExcelJS from "exceljs";
import { SaleRecord, StockInRecord } from "@/types";
import { formatVietnamDisplayDate } from "@/lib/dateUtils";

export async function generateSalesReportExcel(
  records: SaleRecord[],
  startDate: string,
  endDate: string,
  stockInRecords: StockInRecord[] = []
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hệ Thống Bán Lẻ & Quản Lý Kho";
  workbook.lastModifiedBy = "Hệ Thống Bán Lẻ & Quản Lý Kho";
  workbook.created = new Date();
  workbook.modified = new Date();

  // ==========================================
  // SHEET 1: BÁO CÁO BÁN LẺ
  // ==========================================
  const salesSheet = workbook.addWorksheet("Báo Cáo Bán Lẻ", {
    views: [{ showGridLines: true }],
  });

  // 1. Tiêu đề Báo Cáo
  salesSheet.mergeCells("A1:L1");
  const titleCell = salesSheet.getCell("A1");
  titleCell.value = "BÁO CÁO DOANH THU BÁN LẺ";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF15803D" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  salesSheet.getRow(1).height = 30;

  // 2. Thông tin thời gian
  salesSheet.mergeCells("A2:L2");
  const dateInfoCell = salesSheet.getCell("A2");
  dateInfoCell.value = `Thời gian: Từ ngày ${formatVietnamDisplayDate(startDate)} đến ngày ${formatVietnamDisplayDate(endDate)}  |  Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`;
  dateInfoCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF555555" } };
  dateInfoCell.alignment = { vertical: "middle", horizontal: "center" };
  salesSheet.getRow(2).height = 20;

  salesSheet.addRow([]);

  // 3. Tiêu đề Cột
  const headers = [
    "STT",
    "Ngày Bán",
    "Giờ",
    "Người Bán",
    "Khách Hàng",
    "Tên Hàng Hóa",
    "Loại Bao",
    "Số Lượng (Bao)",
    "Đơn Giá (VNĐ)",
    "Thành Tiền (VNĐ)",
    "Trạng Thái",
    "Ghi Chú",
  ];
  const headerRow = salesSheet.addRow(headers);
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF15803D" },
    };
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F5132" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // 4. Dữ liệu các dòng
  const activeRecords = records.filter((r) => !r.isDeleted);
  let totalQuantity = 0;
  let totalRevenue = 0;
  let totalHang = 0;
  let totalGam = 0;
  let totalDuyen = 0;
  let totalBao25 = 0;
  let totalBao50 = 0;

  activeRecords.forEach((record, index) => {
    const qty = Number(record.quantity) || 0;
    const price = Number(record.totalPrice) || 0;

    totalQuantity += qty;
    totalRevenue += price;

    if (record.bagType === "25kg") {
      totalBao25 += qty;
    } else if (record.bagType === "50kg") {
      totalBao50 += qty;
    }

    if (record.seller === "Hằng") {
      totalHang += price;
    } else if (record.seller === "Gấm") {
      totalGam += price;
    } else if (record.seller === "Duyên") {
      totalDuyen += price;
    }

    const isUnpaid = record.paymentStatus === "unpaid";
    const statusText = isUnpaid ? "Chưa thu" : "Đã thu";

    const row = salesSheet.addRow([
      index + 1,
      formatVietnamDisplayDate(record.date),
      record.time || "—",
      record.seller || "—",
      record.customerName || "—",
      record.itemName,
      record.bagType || "—",
      qty,
      Number(record.unitPrice) || 0,
      price,
      statusText,
      record.note || "",
    ]);

    row.height = 20;

    const isEven = index % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (!isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }

      if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 7 || colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      if (colNumber === 8) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0";
      }
      if (colNumber === 9 || colNumber === 10) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '#,##0" đ"';
      }

      if (colNumber === 11) {
        if (isUnpaid) {
          cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFDC2626" } };
        } else {
          cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF16A34A" } };
        }
      }
    });
  });

  // 5. Dòng Tổng Cộng
  const totalRow = salesSheet.addRow([
    "TỔNG CỘNG",
    "",
    "",
    "",
    "",
    "",
    "",
    totalQuantity,
    "",
    totalRevenue,
    "",
    "",
  ]);
  totalRow.height = 24;

  salesSheet.mergeCells(`A${totalRow.number}:G${totalRow.number}`);
  totalRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  totalRow.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF15803D" } };

  totalRow.getCell(8).numFmt = "#,##0";
  totalRow.getCell(8).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF15803D" } };

  totalRow.getCell(10).numFmt = '#,##0" đ"';
  totalRow.getCell(10).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF15803D" } };

  totalRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF15803D" } },
      bottom: { style: "medium", color: { argb: "FF15803D" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Thống kê phân tích phụ
  salesSheet.addRow([]);
  const statHeader = salesSheet.addRow(["* THỐNG KÊ CHI TIẾT:", "", "", "", "", "", "", "", "", "", "", ""]);
  statHeader.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF166534" } };

  const hangRow = salesSheet.addRow(["- Doanh số Hằng:", "", "", "", "", "", "", "", "", totalHang, "", ""]);
  hangRow.getCell(1).font = { name: "Arial", size: 10, italic: true };
  hangRow.getCell(10).numFmt = '#,##0" đ"';
  hangRow.getCell(10).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFDB2777" } };

  const gamRow = salesSheet.addRow(["- Doanh số Gấm:", "", "", "", "", "", "", "", "", totalGam, "", ""]);
  gamRow.getCell(1).font = { name: "Arial", size: 10, italic: true };
  gamRow.getCell(10).numFmt = '#,##0" đ"';
  gamRow.getCell(10).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF7C3AED" } };

  const duyenRow = salesSheet.addRow(["- Doanh số Duyên:", "", "", "", "", "", "", "", "", totalDuyen, "", ""]);
  duyenRow.getCell(1).font = { name: "Arial", size: 10, italic: true };
  duyenRow.getCell(10).numFmt = '#,##0" đ"';
  duyenRow.getCell(10).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFD97706" } };

  const bao25Row = salesSheet.addRow(["- Tổng số bao 25kg:", "", "", "", "", "", "", totalBao25, "", "", "", ""]);
  bao25Row.getCell(1).font = { name: "Arial", size: 10, italic: true };
  bao25Row.getCell(8).font = { name: "Arial", size: 10, bold: true };

  const bao50Row = salesSheet.addRow(["- Tổng số bao 50kg:", "", "", "", "", "", "", totalBao50, "", "", "", ""]);
  bao50Row.getCell(1).font = { name: "Arial", size: 10, italic: true };
  bao50Row.getCell(8).font = { name: "Arial", size: 10, bold: true };

  salesSheet.columns = [
    { width: 8 },  // STT
    { width: 14 }, // Ngày bán
    { width: 12 }, // Giờ
    { width: 14 }, // Người bán
    { width: 20 }, // Khách hàng
    { width: 30 }, // Tên hàng
    { width: 14 }, // Loại bao
    { width: 16 }, // Số lượng bao
    { width: 18 }, // Đơn giá
    { width: 20 }, // Thành tiền
    { width: 15 }, // Trạng thái
    { width: 25 }, // Ghi chú
  ];

  // ==========================================
  // SHEET 2: CHI TIẾT NHẬP KHO
  // ==========================================
  const activeStockIns = stockInRecords.filter((r) => !r.isDeleted);
  const stockSheet = workbook.addWorksheet("Chi Tiết Nhập Kho", {
    views: [{ showGridLines: true }],
  });

  stockSheet.mergeCells("A1:I1");
  const stockTitle = stockSheet.getCell("A1");
  stockTitle.value = "BẢNG KÊ CHI TIẾT NHẬP KHO HÀNG HÓA";
  stockTitle.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF0D9488" } };
  stockTitle.alignment = { vertical: "middle", horizontal: "center" };
  stockSheet.getRow(1).height = 30;

  stockSheet.mergeCells("A2:I2");
  const stockDateInfo = stockSheet.getCell("A2");
  stockDateInfo.value = `Thời gian: Từ ngày ${formatVietnamDisplayDate(startDate)} đến ngày ${formatVietnamDisplayDate(endDate)}  |  Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`;
  stockDateInfo.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF555555" } };
  stockDateInfo.alignment = { vertical: "middle", horizontal: "center" };
  stockSheet.getRow(2).height = 20;

  stockSheet.addRow([]);

  const stockHeaders = [
    "STT",
    "Ngày Nhập",
    "Giờ",
    "Tên Mặt Hàng",
    "Loại Bao",
    "Số Lượng Nhập (Bao)",
    "Đơn Giá Nhập (VNĐ)",
    "Tổng Tiền Nhập (VNĐ)",
    "Ghi Chú",
  ];
  const stockHeaderRow = stockSheet.addRow(stockHeaders);
  stockHeaderRow.height = 25;

  stockHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0D9488" },
    };
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF115E59" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  let totalImportBags = 0;
  let totalImportCost = 0;

  activeStockIns.forEach((rec, idx) => {
    const qty = Number(rec.quantity) || 0;
    const cost = Number(rec.unitCost) || 0;
    const total = Number(rec.totalCost) || (cost > 0 ? cost * qty : 0);

    totalImportBags += qty;
    totalImportCost += total;

    const row = stockSheet.addRow([
      idx + 1,
      formatVietnamDisplayDate(rec.date),
      rec.time || "—",
      rec.itemName,
      rec.bagType || "—",
      qty,
      cost > 0 ? cost : "—",
      total > 0 ? total : "—",
      rec.note || "",
    ]);

    row.height = 20;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (!isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0FDFA" },
        };
      }

      if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0";
      }
      if (colNumber === 7 || colNumber === 8) {
        if (typeof cell.value === "number") {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '#,##0" đ"';
        } else {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      }
    });
  });

  // Dòng Tổng Cộng Nhập Kho
  const stockTotalRow = stockSheet.addRow([
    "TỔNG CỘNG NHẬP KHO",
    "",
    "",
    "",
    "",
    totalImportBags,
    "",
    totalImportCost > 0 ? totalImportCost : "—",
    "",
  ]);
  stockTotalRow.height = 24;

  stockSheet.mergeCells(`A${stockTotalRow.number}:E${stockTotalRow.number}`);
  stockTotalRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  stockTotalRow.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F766E" } };

  stockTotalRow.getCell(6).numFmt = "#,##0";
  stockTotalRow.getCell(6).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F766E" } };

  if (totalImportCost > 0) {
    stockTotalRow.getCell(8).numFmt = '#,##0" đ"';
    stockTotalRow.getCell(8).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F766E" } };
  }

  stockTotalRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCFBF1" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0D9488" } },
      bottom: { style: "medium", color: { argb: "FF0D9488" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  stockSheet.columns = [
    { width: 8 },  // STT
    { width: 14 }, // Ngày nhập
    { width: 12 }, // Giờ
    { width: 30 }, // Tên hàng
    { width: 14 }, // Loại bao
    { width: 22 }, // Số lượng nhập
    { width: 20 }, // Đơn giá nhập
    { width: 22 }, // Tổng tiền nhập
    { width: 30 }, // Ghi chú
  ];

  // Xuất file ra dạng Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}