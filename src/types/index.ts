export type PaymentMethod = "cash" | "transfer";
export type PaymentStatus = "paid" | "unpaid";
export type Seller = "Hằng" | "Gấm" | "Duyên" | string;
export type BagType = "25kg" | "50kg" | "Khác" | string;

export interface ProductItem {
  id: string;
  name: string;
  price: number; // Giá gốc bao 50kg
  allow25kg?: boolean; // Cho phép bán bao 25kg (mặc định true)
  allow50kg?: boolean; // Cho phép bán bao 50kg (mặc định true)
  stock25kg?: number; // Lượng tồn bao 25kg (số bao)
  stock50kg?: number; // Lượng tồn bao 50kg (số bao)
  minStockAlert?: number; // Ngưỡng cảnh báo tồn ít (mặc định 5 bao)
  updatedAt?: number; // Thời điểm cập nhật cuối
}

export interface StockInRecord {
  id: string;
  date: string;              // YYYY-MM-DD (Giờ VN)
  time: string;              // HH:mm:ss (Giờ VN)
  seller?: string;           // Người nhập (Hằng / Gấm / Người khác)
  productId?: string;        // ID mặt hàng
  itemName: string;          // Tên hàng hóa
  bagType: string;           // Loại bao (25kg / 50kg / Khác)
  quantity: number;          // Số lượng bao nhập
  unitCost?: number;         // Giá nhập mỗi bao (VNĐ)
  totalCost?: number;        // Tổng tiền nhập hàng (VNĐ)
  supplier?: string;         // Nhà cung cấp / Nguồn nhập
  note?: string;             // Ghi chú đợt nhập
  createdAt: number;         // Timestamp
  isDeleted?: boolean;       // Đã xóa/hủy phiếu
  deleteReason?: string;     // Lý do hủy
  deletedAt?: number;        // Timestamp thời điểm hủy
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: number;
}

export interface PickupEvent {
  id: string;
  date: string;       // YYYY-MM-DD (Giờ VN)
  time: string;       // HH:mm:ss (Giờ VN)
  quantity: number;   // Số bao lấy trong lần này
  note?: string;      // Ghi chú lần lấy
  createdAt: number;  // Timestamp
}

export interface SaleRecord {
  id?: string;
  date: string;              // YYYY-MM-DD (Giờ VN)
  time?: string;              // HH:mm:ss (Giờ VN)
  seller?: string;           // Tên người bán (Hằng / Gấm)
  customerName?: string;     // Tên khách hàng
  itemName: string;          // Tên hàng hóa
  bagType?: string;          // Loại bao (25kg / 50kg)
  quantity: number;          // Tổng số lượng bao đã mua
  unitPrice: number;         // Đơn giá (VNĐ)
  totalPrice: number;        // Thành tiền (VNĐ)
  paymentStatus?: PaymentStatus; // "paid" (Đã thu) | "unpaid" (Chưa thu)
  paymentMethod?: PaymentMethod; // Tiền mặt / Chuyển khoản
  note?: string;             // Ghi chú
  createdAt?: number;        // Timestamp
  isDeleted?: boolean;       // Trạng thái đã xóa
  deleteReason?: string;     // Lý do xóa
  deletedAt?: number;        // Timestamp thời điểm xóa

  // Tính năng Khách mua 1 đơn lấy hàng nhiều lần (Đơn gửi kho)
  isPartialPickup?: boolean; // true nếu là đơn lấy nhiều lần
  pickupStatus?: "pending" | "completed"; // "pending": Chưa lấy hết | "completed": Đã lấy đủ
  pickedQuantity?: number;   // Tổng số bao đã lấy cho đến hiện tại
  pickupHistory?: PickupEvent[]; // Danh sách các lần lấy hàng chi tiết
  completedAt?: number;      // Thời điểm hoàn tất lấy đủ số lượng
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  seller?: string;
  includeNotes?: boolean;
}