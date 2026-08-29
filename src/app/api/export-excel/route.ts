import { NextRequest, NextResponse } from "next/server";
import { generateSalesReportExcel } from "@/lib/excelGenerator";
import { SaleRecord, StockInRecord } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { records, startDate, endDate, stockInRecords = [] } = body as {
      records: SaleRecord[];
      startDate: string;
      endDate: string;
      stockInRecords?: StockInRecord[];
    };

    if ((!records || records.length === 0) && (!stockInRecords || stockInRecords.length === 0)) {
      return NextResponse.json(
        { success: false, message: "Không có dữ liệu để xuất file!" },
        { status: 400 }
      );
    }

    const excelBuffer = await generateSalesReportExcel(
      records || [],
      startDate,
      endDate,
      stockInRecords || []
    );
    const fileName = `BaoCao_BanLe_${startDate}_${endDate}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi tải file Excel:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi tạo file Excel" },
      { status: 500 }
    );
  }
}