# ỨNG DỤNG QUẢN LÝ BÁN LẺ & GỬI BÁO CÁO EXCEL TỰ ĐỘNG

Dự án Web App đơn giản, ít lỗi, hiện đại phục vụ việc **nhập liệu doanh số bán lẻ hàng ngày**, **thống kê doanh thu**, **xuất file Excel định dạng đẹp** và **tự động gửi về Email**.

---

## 🛠 Công Nghệ Sử Dụng

- **Frontend & Backend API**: [Next.js 14](https://nextjs.org/) (App Router) + [Tailwind CSS](https://tailwindcss.com/)
- **Cơ sở dữ liệu**: [Firebase Firestore](https://firebase.google.com/) (Real-time Cloud Database)
- **Tạo file Excel**: [ExcelJS](https://github.com/exceljs/exceljs) (Kẻ bảng, màu sắc, format tiền VND, dòng tổng cộng)
- **Gửi Email**: [Nodemailer](https://nodemailer.com/) (SMTP Gmail)
- **Triển khai (Hosting)**: [Vercel](https://vercel.com/)

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Thử Trên Máy Tính (Local)

### Bước 1: Mở thư mục dự án trong Terminal
```bash
cd "D:\All Project\Bán Lẻ"
```

### Bước 2: Cài đặt các gói phụ thuộc
```bash
npm install
```

### Bước 3: Tạo file cấu hình `.env.local`
Sao chép nội dung từ file `.env.example` sang file mới tên là `.env.local`:
```bash
cp .env.example .env.local
```

### Bước 4: Chạy ứng dụng
```bash
npm run dev
```
👉 Mở trình duyệt và truy cập: **`http://localhost:3000`**

---

## 📧 Hướng Dẫn Cấu Hình Gửi Mail Bằng Gmail (3 Phút)

Để hệ thống có thể tự gửi email đính kèm Excel qua tài khoản Gmail của bạn:

1. Truy cập vào trang quản lý tài khoản Google: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Bật tính năng **Xác minh 2 bước (2-Step Verification)** (nếu chưa bật).
3. Tìm mục **Mật khẩu ứng dụng (App Passwords)**.
4. Đặt tên ứng dụng (ví dụ: `Ban Le App`), bấm **Tạo (Create)**. Google sẽ cung cấp 1 mật khẩu gồm 16 chữ cái (ví dụ: `abcd efgh ijkl mnop`).
5. Dán mật khẩu này vào dòng `SMTP_PASSWORD` trong file `.env.local`.

---

## 🔥 Hướng Dẫn Cấu Hình Firebase Firestore Miễn Phí (3 Phút)

1. Truy cập [Firebase Console](https://console.firebase.google.com/) và bấm **Add project (Thêm dự án)**.
2. Vào mục **Build -> Firestore Database** -> Bấm **Create database** (chọn chế độ *Test mode* hoặc *Production mode*).
3. Vào **Project Settings (Cài đặt dự án)** -> Thêm ứng dụng dạng **Web (`</>`)** -> Sao chép các thông số cấu hình (`apiKey`, `projectId`, v.v.) vào file `.env.local`.

> 💡 **Lưu ý**: Nếu chưa kịp điền Firebase, ứng dụng vẫn tự động hoạt động ở chế độ **Local Mode (LocalStorage)** để bạn trải nghiệm ngay lập tức mà không bị báo lỗi!

---

## 🌐 Hướng Dẫn Deploy Lên Vercel (1-Click)

1. Đẩy mã nguồn dự án lên tài khoản [GitHub](https://github.com).
2. Đăng nhập [Vercel.com](https://vercel.com) -> Bấm **Add New... -> Project**.
3. Chọn Repository dự án của bạn trên GitHub -> Bấm **Import**.
4. Trong phần **Environment Variables (Biến môi trường)** trên Vercel: Thêm các biến từ file `.env.local` vào.
5. Bấm **Deploy**! Chỉ sau khoảng 1 phút, bạn sẽ có một đường link website chạy online trên toàn cầu (ví dụ: `https://ban-le.vercel.app`).
