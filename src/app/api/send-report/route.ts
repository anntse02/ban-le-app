import { NextRequest, NextResponse } from "next/server";
import { generateSalesReportExcel } from "@/lib/excelGenerator";
import { sendEmailWithAttachment } from "@/lib/emailService";
import { SaleRecord } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { records, startDate, endDate, recipientEmail } = body as {
      records: SaleRecord[];
      startDate: string;
      endDate: string;
      recipientEmail: string;
    };

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Địa chỉ email người nhận không hợp lệ!" },
        { status: 400 }
      );
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, message: "Không có dữ liệu giao dịch để xuất báo cáo!" },
        { status: 400 }
      );
    }

    // Tạo file Excel
    const excelBuffer = await generateSalesReportExcel(records, startDate, endDate);
    const fileName = `BaoCao_BanLe_${startDate}_${endDate}.xlsx`;

    let totalRevenue = 0;
    let totalQty = 0;
    records.forEach((r) => {
      totalRevenue += Number(r.totalPrice) || 0;
      totalQty += Number(r.quantity) || 0;
    });

    const formattedRevenue = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(totalRevenue);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #16a34a; margin-top: 0;">Báo Cáo Bán Lẻ Định Kỳ</h2>
        <p>Xin chào,</p>
        <p>Hệ thống gửi đến bạn file báo cáo bán lẻ tổng hợp trong khoảng thời gian:</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 5px 0;">📅 <strong>Thời gian:</strong> ${startDate} đến ${endDate}</p>
          <p style="margin: 5px 0;">📦 <strong>Tổng số lượng hàng bán:</strong> ${totalQty}</p>
          <p style="margin: 5px 0;">💰 <strong>Tổng doanh thu:</strong> <span style="color: #15803d; font-size: 18px; font-weight: bold;">${formattedRevenue}</span></p>
          <p style="margin: 5px 0;">📝 <strong>Tổng số đơn/giao dịch:</strong> ${records.length}</p>
        </div>
        <p>Chi tiết các mặt hàng đã bán và phương thức thanh toán được đính kèm trong file Excel: <strong>${fileName}</strong> bên dưới.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">Email này được gửi tự động từ Ứng dụng Quản Lý Bán Lẻ.</p>
      </div>
    `;

    await sendEmailWithAttachment({
      to: recipientEmail,
      subject: `[Báo Cáo Bán Lẻ] Doanh thu từ ${startDate} đến ${endDate}`,
      htmlContent: emailHtml,
      excelBuffer: excelBuffer,
      fileName: fileName,
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi báo cáo thành công tới ${recipientEmail}!`,
    });
  } catch (error: any) {
    console.error("Lỗi khi tạo Excel hoặc gửi mail:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Đã xảy ra lỗi trong quá trình gửi mail!",
      },
      { status: 500 }
    );
  }
}