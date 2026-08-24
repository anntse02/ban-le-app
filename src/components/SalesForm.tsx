"use client";

import React, { useState, useEffect } from "react";
import { SaleRecord, BagType, ProductItem, PaymentStatus } from "@/types";
import { getVietnamDate, getVietnamTime, getVietnamTodayDisplay } from "@/lib/dateUtils";
import { formatCurrencyVND, formatNumberVN } from "@/lib/formatters";
import {
  PlusCircle,
  DollarSign,
  Package,
  User,
  CheckCircle2,
  Scale,
  UserCheck,
  Settings,
  Trash2,
  Plus,
  X,
  CreditCard,
} from "lucide-react";

interface SalesFormProps {
  onAddRecord: (record: Omit<SaleRecord, "id" | "createdAt">) => Promise<void>;
  loading?: boolean;
}

const INITIAL_PRODUCTS: ProductItem[] = [
  { id: "p1", name: "Cám lợn (heo)", price: 380000 },
  { id: "p2", name: "Cám gà / vịt", price: 350000 },
  { id: "p3", name: "Cám bò / dê", price: 290000 },
  { id: "p4", name: "Gạo ST25", price: 420000 },
  { id: "p5", name: "Gạo Đài Thơm", price: 360000 },
  { id: "p6", name: "Gạo Bắc Hương", price: 340000 },
  { id: "p7", name: "Phân bón NPK", price: 450000 },
  { id: "p8", name: "Đạm Ure", price: 390000 },
  { id: "p9", name: "Phân Lân / Kali", price: 310000 },
  { id: "p10", name: "Ngô hạt / Bột ngô", price: 280000 },
  { id: "p11", name: "Đường cát trắng", price: 520000 },
];

export default function SalesForm({ onAddRecord, loading = false }: SalesFormProps) {
  const [seller, setSeller] = useState<string>("Hằng");
  const [isRetail, setIsRetail] = useState<boolean>(true);
  const [customCustomerInput, setCustomCustomerInput] = useState<string>("");

  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState<boolean>(false);
  const [selectedItemName, setSelectedItemName] = useState<string>(INITIAL_PRODUCTS[0].name);

  const [bagType, setBagType] = useState<BagType>("25kg");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unitPrice, setUnitPrice] = useState<number | "">(INITIAL_PRODUCTS[0].price);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [note, setNote] = useState<string>("");
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ban_le_products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setSelectedItemName(parsed[0].name);
          setUnitPrice(parsed[0].price);
        }
      }
    } catch (e) {
      console.error("Lỗi đọc danh sách hàng:", e);
    }
  }, []);

  const saveProducts = (newProducts: ProductItem[]) => {
    setProducts(newProducts);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(newProducts));
    } catch (e) {
      console.error("Lỗi lưu danh sách hàng:", e);
    }
  };

  const handleUpdateProduct = (id: string, field: "name" | "price", value: string | number) => {
    const updated = products.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          [field]: field === "price" ? Math.max(0, Number(value) || 0) : value,
        };
      }
      return p;
    });
    saveProducts(updated);

    const current = updated.find((p) => p.name === selectedItemName);
    if (current) {
      setUnitPrice(current.price);
    }
  };

  const handleAddNewProduct = () => {
    const newItem: ProductItem = {
      id: "p_" + Date.now(),
      name: "Hàng mới " + (products.length + 1),
      price: 100000,
    };
    const updated = [...products, newItem];
    saveProducts(updated);
    setSelectedItemName(newItem.name);
    setUnitPrice(newItem.price);
  };

  const handleDeleteProduct = (id: string) => {
    if (products.length <= 1) {
      alert("Cần giữ ít nhất 1 mặt hàng trong danh sách!");
      return;
    }
    const updated = products.filter((p) => p.id !== id);
    saveProducts(updated);
    if (updated.length > 0) {
      setSelectedItemName(updated[0].name);
      setUnitPrice(updated[0].price);
    }
  };

  const handleSelectProduct = (name: string) => {
    setSelectedItemName(name);
    const found = products.find((p) => p.name === name);
    if (found) {
      setUnitPrice(found.price);
    }
  };

  const numQty = typeof quantity === "number" ? quantity : 0;
  const numPrice = typeof unitPrice === "number" ? unitPrice : 0;
  const totalPrice = numQty * numPrice;
  const finalCustomerName = isRetail ? "Khách lẻ" : (customCustomerInput.trim() || "Khách lẻ");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName.trim()) {
      alert("Vui lòng chọn tên hàng hóa!");
      return;
    }
    if (numQty <= 0) {
      alert("Số lượng bao phải lớn hơn 0!");
      return;
    }
    if (numPrice <= 0) {
      alert("Vui lòng nhập đơn giá hợp lệ!");
      return;
    }

    const autoDate = getVietnamDate();
    const autoTime = getVietnamTime();

    await onAddRecord({
      date: autoDate,
      time: autoTime,
      seller,
      customerName: finalCustomerName,
      itemName: selectedItemName.trim(),
      bagType,
      quantity: numQty,
      unitPrice: numPrice,
      totalPrice,
      paymentStatus,
      paymentMethod: "cash",
      note: note.trim(),
    });

    setQuantity(1);
    setCustomCustomerInput("");
    setIsRetail(true);
    setPaymentStatus("paid");
    setNote("");

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-2.5 sm:p-3.5 relative overflow-hidden text-slate-800">
      {/* Toast thông báo lưu thành công */}
      {showSuccessToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 z-20 animate-bounce pointer-events-none">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã lưu đơn thành công vào sổ!</span>
        </div>
      )}

      {/* Header Form Gọn Nhẹ */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <PlusCircle className="w-3.5 h-3.5 text-green-600" />
          <h2 className="text-xs font-black text-slate-800">Tạo Đơn Bán Mới</h2>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">
          Ngày: <strong className="text-green-700 font-bold">{getVietnamTodayDisplay()}</strong>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* 1. NGƯỜI BÁN (HẰNG / GẤM) */}
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Nút Hằng */}
            <button
              type="button"
              onClick={() => setSeller("Hằng")}
              className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                seller === "Hằng"
                  ? "bg-pink-50 border-pink-500 ring-1 ring-pink-400/30 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 opacity-75"
              }`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  seller === "Hằng"
                    ? "bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-2xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                👩
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${seller === "Hằng" ? "text-pink-900" : "text-slate-700"}`}>
                    Hằng
                  </span>
                  {seller === "Hằng" && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600 shrink-0" />}
                </div>
                <span className="text-[9px] text-slate-400">Bán hàng</span>
              </div>
            </button>

            {/* Nút Gấm */}
            <button
              type="button"
              onClick={() => setSeller("Gấm")}
              className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                seller === "Gấm"
                  ? "bg-purple-50 border-purple-500 ring-1 ring-purple-400/30 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 opacity-75"
              }`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  seller === "Gấm"
                    ? "bg-gradient-to-tr from-purple-500 to-indigo-400 text-white shadow-2xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                👱‍♀️
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${seller === "Gấm" ? "text-purple-900" : "text-slate-700"}`}>
                    Gấm
                  </span>
                  {seller === "Gấm" && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                </div>
                <span className="text-[9px] text-slate-400">Bán hàng</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. TÊN KHÁCH HÀNG */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setIsRetail(true);
              setCustomCustomerInput("");
            }}
            className={`h-9 px-2.5 rounded-xl text-[11px] font-bold shrink-0 border transition-all flex items-center gap-1 active:scale-95 ${
              isRetail
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
          >
            <span>Khách lẻ</span>
            {isRetail && <CheckCircle2 className="w-3 h-3 text-white" />}
          </button>

          <input
            type="text"
            placeholder="Hoặc nhập: Anh Ba, Chị Lan..."
            value={customCustomerInput}
            onChange={(e) => {
              const val = e.target.value;
              setCustomCustomerInput(val);
              if (val.trim().length > 0) {
                setIsRetail(false);
              } else {
                setIsRetail(true);
              }
            }}
            className={`flex-1 min-w-0 h-9 px-2.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition ${
              !isRetail && customCustomerInput.trim()
                ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500"
                : "border-slate-300"
            }`}
          />
        </div>

        {/* 3. TÊN HÀNG HÓA & NÚT SỬA GIÁ (1 HÀNG) */}
        <div>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedItemName}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="flex-1 min-w-0 h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition"
            >
              {products.map((prod) => (
                <option key={prod.id} value={prod.name}>
                  {prod.name} — {formatNumberVN(prod.price)} đ
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsProductManagerOpen(!isProductManagerOpen)}
              className="h-9 px-2 rounded-xl text-[10px] font-bold text-green-700 hover:text-green-800 flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 transition shrink-0"
              title="Chỉnh sửa danh mục mặt hàng & giá"
            >
              <Settings className="w-3 h-3" />
              <span>{isProductManagerOpen ? "Đóng" : "Sửa giá"}</span>
            </button>
          </div>

          {/* Bảng Quản lý Danh mục Hàng hóa */}
          {isProductManagerOpen && (
            <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-green-500/40 shadow-xs space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-[11px] font-bold text-slate-800">
                  ✏️ Sửa Tên & Giá ({products.length} hàng):
                </span>
                <button
                  type="button"
                  onClick={() => setIsProductManagerOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                {products.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200 text-xs"
                  >
                    <span className="text-[10px] font-bold text-slate-400 w-4 text-center shrink-0">
                      {index + 1}
                    </span>

                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleUpdateProduct(p.id, "name", e.target.value)}
                      placeholder="Tên hàng..."
                      className="flex-1 min-w-0 px-1.5 py-1 text-[11px] font-semibold text-slate-800 border border-slate-200 rounded outline-none focus:border-green-500"
                    />

                    <div className="relative w-22 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={p.price}
                        onChange={(e) => handleUpdateProduct(p.id, "price", e.target.value)}
                        placeholder="Giá..."
                        className="w-full px-1.5 py-1 pr-3 text-[11px] font-bold text-right text-slate-900 border border-slate-200 rounded outline-none focus:border-green-500"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                        đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleAddNewProduct}
                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Thêm Hàng Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsProductManagerOpen(false)}
                  className="py-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold transition active:scale-95"
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. LOẠI BAO TRỌNG LƯỢNG */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setBagType("25kg")}
            className={`py-2 px-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              bagType === "25kg"
                ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-400/30 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>📦</span>
            <span>Bao 25 kg</span>
            {bagType === "25kg" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => setBagType("50kg")}
            className={`py-2 px-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              bagType === "50kg"
                ? "bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-400/30 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>📦</span>
            <span>Bao 50 kg</span>
            {bagType === "50kg" && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
          </button>
        </div>

        {/* 5. SỐ LƯỢNG (BẤM TO RÕ RÀNG) & ĐƠN GIÁ (GRID 2 CỘT) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Cụm nút Số Lượng */}
          <div>
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Số lượng (Bao):</span>
            <div className="flex items-stretch h-10 rounded-xl overflow-hidden border border-slate-300">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                className="w-10 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl flex items-center justify-center select-none transition active:scale-95 border-r border-slate-300 shrink-0"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-50 text-sm font-black text-center text-slate-900 focus:bg-white focus:outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => (Number(prev) || 0) + 1)}
                className="w-10 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl flex items-center justify-center select-none transition active:scale-95 border-l border-slate-300 shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Ô Đơn Giá */}
          <div>
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Đơn giá / Bao (VNĐ):</span>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="380000"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition"
              required
            />
          </div>
        </div>

        {/* 6. TRẠNG THÁI THU TIỀN: 2 NÚT NẰM TRÊN CÙNG 1 HÀNG */}
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Nút ĐÃ THU */}
            <button
              type="button"
              onClick={() => setPaymentStatus("paid")}
              className={`h-9 sm:h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all active:scale-[0.98] ${
                paymentStatus === "paid"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span>✓</span>
              <span>Đã thu</span>
              {paymentStatus === "paid" && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </button>

            {/* Nút CHƯA THU */}
            <button
              type="button"
              onClick={() => setPaymentStatus("unpaid")}
              className={`h-9 sm:h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all active:scale-[0.98] ${
                paymentStatus === "unpaid"
                  ? "bg-red-600 border-red-600 text-white shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span>✗</span>
              <span>Chưa thu</span>
              {paymentStatus === "unpaid" && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </button>
          </div>
        </div>

        {/* 7. KHUNG THÀNH TIỀN TẠM TÍNH (NẰM XUỐNG DƯỚI) */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 py-1.5 px-3 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold text-green-800">Tạm tính:</span>
            <span className="text-base sm:text-lg font-black text-green-700">{formatCurrencyVND(totalPrice)}</span>
          </div>

          {numQty > 0 && numPrice > 0 && (
            <span className="text-[10px] font-bold text-green-800/80 bg-white/80 px-2 py-0.5 rounded-lg border border-green-200">
              {numQty} bao × {formatNumberVN(numPrice)} đ
            </span>
          )}
        </div>

        {/* 8. GHI CHÚ TÙY CHỌN */}
        <div>
          <input
            type="text"
            placeholder="Ghi chú (địa chỉ giao, nợ, SĐT... nếu có)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition"
          />
        </div>

        {/* 9. NÚT BÁN HÀNG TO RÕ */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 sm:h-12 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm sm:text-base font-black rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>BÁN HÀNG</span>
          )}
        </button>
      </form>
    </div>
  );
}