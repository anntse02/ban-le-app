import ExcelJS from "exceljs";
import { SaleRecord } from "@/types";
import { formatVietnamDisplayDate } from "@/lib/dateUtils";

export async function generateSalesReportExcel(
  records: SaleRecord[],
  startDate: string,
  endDate: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hệ Thống Bán Lẻ";
  workbook.lastModifiedBy = "Hệ Thống Bán Lẻ";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Báo Cáo Bán Lẻ", {
    views: [{ showGridLines: true }],
  });

  // 1. Tiêu đề Báo Cáo
  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "BÁO CÁO DOANH THU BÁN LẺ";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF15803D" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 30;

  // 2. Thông tin thời gian
  worksheet.mergeCells("A2:L2");
  const dateInfoCell = worksheet.getCell("A2");
  dateInfoCell.value = `Thời gian: Từ ngày ${formatVietnamDisplayDate(startDate)} đến ngày ${formatVietnamDisplayDate(endDate)}  |  Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`;
  dateInfoCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF555555" } };
  dateInfoCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(2).height = 20;

  // Hàng trống
  worksheet.addRow([]);

  // 3. Tiêu đề Cột (Header Table)
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
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF16A34A" },
    };
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "medium", color: { argb: "FF0F5132" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });

  // 4. Đổ dữ liệu các dòng
  let totalQuantity = 0;
  let totalRevenue = 0;
  let totalHang = 0;
  let totalGam = 0;
  let totalBao25 = 0;
  let totalBao50 = 0;

  records.forEach((record, index) => {
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
    }

    const isUnpaid = record.paymentStatus === "unpaid";
    const statusText = isUnpaid ? "Chưa thu" : "Đã thu";

    const row = worksheet.addRow([
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

    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      // Căn giữa STT, Ngày, Giờ, Người Bán, Loại Bao, Trạng Thái
      if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 7 || colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      // Căn phải & format số cho Số lượng, Đơn giá, Thành tiền
      else if (colNumber === 8) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0";
      } else if (colNumber === 9 || colNumber === 10) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '#,##0" đ"';
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });

  // 5. Dòng Tổng Cộng
  const summaryRow = worksheet.addRow([
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
  summaryRow.height = 24;

  worksheet.mergeCells(`A${summaryRow.number}:G${summaryRow.number}`);
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF111827" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF16A34A" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "double", color: { argb: "FF16A34A" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };

    if (colNumber === 1) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    } else if (colNumber === 8) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = "#,##0";
    } else if (colNumber === 10) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '#,##0" đ"';
    }
  });

  // Thêm bảng phân tích thống kê phụ
  worksheet.addRow([]);
  const statHeader = worksheet.addRow(["* THỐNG KÊ CHI TIẾT:", "", "", "", "", "", "", "", "", "", "", ""]);
  statHeader.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF166534" } };

  const hangRow = worksheet.addRow(["- Doanh số Hằng:", "", "", "", "", "", "", "", "", totalHang, "", ""]);
  hangRow.getCell(1).font = { name: "Arial", size: 10, italic: true };
  hangRow.getCell(10).numFmt = '#,##0" đ"';
  hangRow.getCell(10).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFDB2777" } };

  const gamRow = worksheet.addRow(["- Doanh số Gấm:", "", "", "", "", "", "", "", "", totalGam, "", ""]);
  gamRow.getCell(1).font = { name: "Arial", size: 10, italic: true };
  gamRow.getCell(10).numFmt = '#,##0" đ"';
  gamRow.getCell(10).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF7C3AED" } };

  const bao25Row = worksheet.addRow(["- Tổng số bao 25kg:", "", "", "", "", "", "", totalBao25, "", "", "", ""]);
  bao25Row.getCell(1).font = { name: "Arial", size: 10, italic: true };
  bao25Row.getCell(8).font = { name: "Arial", size: 10, bold: true };

  const bao50Row = worksheet.addRow(["- Tổng số bao 50kg:", "", "", "", "", "", "", totalBao50, "", "", "", ""]);
  bao50Row.getCell(1).font = { name: "Arial", size: 10, italic: true };
  bao50Row.getCell(8).font = { name: "Arial", size: 10, bold: true };

  // 6. Tự động điều chỉnh độ rộng cột
  worksheet.columns = [
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

  // Xuất file ra dạng Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}