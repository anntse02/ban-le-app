export type PaymentMethod = "cash" | "transfer";
export type PaymentStatus = "paid" | "unpaid";
export type Seller = "Hằng" | "Gấm" | string;
export type BagType = "25kg" | "50kg" | "Khác" | string;

export interface ProductItem {
  id: string;
  name: string;
  price: number;
}

export interface SaleRecord {
  id?: string;
  date: string;              // YYYY-MM-DD (Giờ VN)
  time?: string;              // HH:mm:ss (Giờ VN)
  seller?: string;           // Tên người bán (Hằng / Gấm)
  customerName?: string;     // Tên khách hàng
  itemName: string;          // Tên hàng hóa
  bagType?: string;          // Loại bao (25kg / 50kg)
  quantity: number;          // Số lượng bao
  unitPrice: number;         // Đơn giá (VNĐ)
  totalPrice: number;        // Thành tiền (VNĐ)
  paymentStatus?: PaymentStatus; // "paid" (Đã thu) | "unpaid" (Chưa thu)
  paymentMethod?: PaymentMethod; // Tiền mặt / Chuyển khoản
  note?: string;             // Ghi chú
  createdAt?: number;        // Timestamp
  isDeleted?: boolean;       // Trạng thái đã xóa
  deleteReason?: string;     // Lý do xóa
  deletedAt?: number;        // Timestamp thời điểm xóa
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  seller?: string;
  includeNotes?: boolean;
}