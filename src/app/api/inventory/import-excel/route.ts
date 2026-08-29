import { NextResponse } from "next/server";
import { ParsedExcelRecord } from "@/lib/excelParser";

// 💡 [CHÚ THÍCH DATABASE]: Import các instance kết nối DB của bạn ở đây.
// Ví dụ với Prisma: import prisma from '@/lib/prisma';
// Ví dụ với Firebase Admin: import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { records } = body as { records: ParsedExcelRecord[] };

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu để xử lý." }, { status: 400 });
    }

    // 1. Tối ưu: Thu thập danh sách Ngày và Tên Hàng cần kiểm tra (để chỉ query DB 1 lần)
    const uniqueDates = Array.from(new Set(records.map(r => r.date)));
    const uniqueNames = Array.from(new Set(records.map(r => r.name)));

    // 💡 [CHÚ THÍCH DATABASE - KIỂM TRA TRÙNG LẶP]
    // Tại đây, thực hiện 1 truy vấn (Read) vào bảng 'LichSuNhapKho' (hoặc bảng tương ứng của bạn)
    // để tìm tất cả các bản ghi có Ngày nằm trong `uniqueDates` và Tên Hàng nằm trong `uniqueNames`.
    
    // Giả lập kết quả trả về từ DB (Những mặt hàng đã tồn tại trong ngày đó)
    // ---------------------------------------------------------------------------------
    // VD Mongoose: 
    // const existingDocs = await InventoryModel.find({ date: { $in: uniqueDates }, name: { $in: uniqueNames } });
    //
    // VD Prisma:
    // const existingDocs = await prisma.inventory.findMany({
    //   where: { date: { in: uniqueDates }, name: { in: uniqueNames } }
    // });
    // ---------------------------------------------------------------------------------
    
    // MOCK DATA: Giả sử mặt hàng "Gạo ST25" vào ngày "2026-08-29" đã được nhập rồi
    const mockExistingDocsFromDB = [
      { date: "2026-08-29", name: "Gạo ST25" }
    ];

    // Tạo một Hash Map (hoặc Set) để lookup nhanh
    const existingSet = new Set(mockExistingDocsFromDB.map(doc => `${doc.date}_${doc.name}`));

    // 2. Lọc mảng dữ liệu gốc
    const validRecordsToInsert: ParsedExcelRecord[] = [];
    const duplicateRecords: ParsedExcelRecord[] = [];

    for (const rec of records) {
      const key = `${rec.date}_${rec.name}`;
      if (existingSet.has(key)) {
        duplicateRecords.push(rec); // Đã tồn tại -> Bỏ qua
      } else {
        validRecordsToInsert.push(rec); // Chưa tồn tại -> Hợp lệ
        
        // Thêm vào Set để tránh trùng lặp ngay bên trong mảng gửi lên (nếu có 2 dòng giống nhau trong file excel)
        existingSet.add(key); 
      }
    }

    // 3. Ghi hàng loạt (Bulk Insert)
    let insertedCount = 0;
    if (validRecordsToInsert.length > 0) {
      // 💡 [CHÚ THÍCH DATABASE - BULK INSERT]
      // Tại đây, sử dụng phương thức Insert Many của ORM/DB để lưu mảng `validRecordsToInsert` trong 1 lượt Write.
      
      // ---------------------------------------------------------------------------------
      // VD Mongoose:
      // await InventoryModel.insertMany(validRecordsToInsert);
      //
      // VD Prisma:
      // await prisma.inventory.createMany({ data: validRecordsToInsert });
      //
      // VD Supabase:
      // const { error } = await supabase.from('inventory').insert(validRecordsToInsert);
      // ---------------------------------------------------------------------------------
      
      // MOCK: Giả lập insert thành công
      insertedCount = validRecordsToInsert.length;
    }

    // 4. Trả về Response chi tiết
    return NextResponse.json({
      success: true,
      successCount: insertedCount,
      duplicateCount: duplicateRecords.length,
      duplicates: duplicateRecords,
      message: `Đã nhập thành công ${insertedCount} mặt hàng. Bỏ qua ${duplicateRecords.length} mặt hàng trùng lặp.`
    });

  } catch (error: any) {
    console.error("API Import Excel Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi Server Internal" },
      { status: 500 }
    );
  }
}
