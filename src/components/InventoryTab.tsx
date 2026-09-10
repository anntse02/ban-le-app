"use client";

import React, { useState, useMemo } from "react";
import { ProductItem, StockInRecord, BagType } from "@/types";
import { getVietnamDate, getVietnamTime, formatVietnamDisplayDate } from "@/lib/dateUtils";
import {
  formatCurrencyVND,
  formatNumberVN,
  formatCurrencyInput,
  parseCurrencyInput,
  parseQuantityInput,
} from "@/lib/formatters";
import {
  Boxes,
  PlusCircle,
  History,
  Search,
  AlertTriangle,
  Package,
  Plus,
  CheckCircle2,
  Trash2,
  RefreshCcw,
  X,
  ArrowDownToLine,
  FileSpreadsheet,
} from "lucide-react";

import { ParsedExcelRecord } from "@/lib/excelParser";
import ExcelImportStock from "./ExcelImportStock";

interface InventoryTabProps {
  products: ProductItem[];
  stockInRecords: StockInRecord[];
  onResetAllStock?: () => Promise<void>;
  onUpdateProductStock: (
    productId: string,
    stock25kg?: number,
    stock50kg?: number,
    minStockAlert?: number
  ) => Promise<void>;
  onUpdateProductFull?: (
    productId: string,
    updatedData: Partial<ProductItem>
  ) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onAddStockInRecord: (record: Omit<StockInRecord, "id" | "createdAt">) => Promise<void>;
  onDeleteStockInRecord: (id: string, reason: string) => Promise<void>;
  onAddNewProduct?: (newProd: Omit<ProductItem, "id">) => Promise<ProductItem | void>;
  loading?: boolean;
}

export default function InventoryTab({
  products,
  stockInRecords,
  onResetAllStock,
  onUpdateProductStock,
  onUpdateProductFull,
  onDeleteProduct,
  onAddStockInRecord,
  onDeleteStockInRecord,
  onAddNewProduct,
  loading = false,
}: InventoryTabProps) {
  const [subTab, setSubTab] = useState<"stock" | "stock_in" | "history" | "excel_import">("stock");

  // Tìm kiếm & bộ lọc cho Sổ Tồn Kho
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "in_stock" | "out_of_stock">("all");

  // Modal Nhập Thêm Số Lượng Cho 1 Mặt Hàng Đang Có (Ảnh 3)
  const [quickStockInProduct, setQuickStockInProduct] = useState<ProductItem | null>(null);
  const [quickBagType, setQuickBagType] = useState<BagType>("50kg");
  const [quickQty, setQuickQty] = useState<number | string>(10);
  const [quickCost, setQuickCost] = useState<number | string>("");
  const [quickNote, setQuickNote] = useState<string>("");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState<boolean>(false);

  // Form Nhập Mặt Hàng Mới Vào Kho (Ảnh 2)
  const [newProdName, setNewProdName] = useState<string>("");
  const [newProdPrice, setNewProdPrice] = useState<number | string>(350000);
  const [newProdAllow25, setNewProdAllow25] = useState<boolean>(true);
  const [newProdAllow50, setNewProdAllow50] = useState<boolean>(true);
  const [newProdStock25, setNewProdStock25] = useState<number | string>(10);
  const [newProdStock50, setNewProdStock50] = useState<number | string>(10);
  const [newProdUnitCost, setNewProdUnitCost] = useState<number | string>("");
  const [newProdNote, setNewProdNote] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [showStockInSuccess, setShowStockInSuccess] = useState<boolean>(false);

  // Modal Xóa Phiếu Nhập Hàng
  const [deletingRecord, setDeletingRecord] = useState<StockInRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Tìm kiếm cho Lịch Sử Nhập Hàng
  const [historySearch, setHistorySearch] = useState<string>("");

  // 1. TÍNH TOÁN CÁC CHỈ SỐ LỌC
  const activeStockInRecords = useMemo(
    () => stockInRecords.filter((r) => !r.isDeleted),
    [stockInRecords]
  );

  const stats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const s25 = Number(p.stock25kg) || 0;
      const s50 = Number(p.stock50kg) || 0;
      const minAlert = p.minStockAlert !== undefined ? p.minStockAlert : 5;
      const totalBags = s25 + s50;

      if (totalBags === 0) {
        outOfStockCount++;
      } else if (totalBags <= minAlert) {
        lowStockCount++;
      }
    });

    return {
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  // 2. LỌC DANH SÁCH MẶT HÀNG TRONG SỔ TỒN
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const s25 = Number(p.stock25kg) || 0;
      const s50 = Number(p.stock50kg) || 0;
      const totalBags = s25 + s50;
      const minAlert = p.minStockAlert !== undefined ? p.minStockAlert : 5;

      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (stockFilter === "low") {
        return totalBags > 0 && totalBags <= minAlert;
      }
      if (stockFilter === "out_of_stock") {
        return totalBags === 0;
      }
      if (stockFilter === "in_stock") {
        return totalBags > 0;
      }
      return true;
    });
  }, [products, searchTerm, stockFilter]);

  // 3. MỞ MODAL NHẬP THÊM HÀNG CHO 1 MẶT HÀNG (Ảnh 3)
  const handleOpenQuickStockIn = (product?: ProductItem | null, preferredBag?: BagType) => {
    const targetProduct = product || products[0];
    if (!targetProduct) return;
    
    setQuickStockInProduct(targetProduct);
    if (preferredBag) {
      setQuickBagType(preferredBag);
    } else if (targetProduct.allow50kg !== false) {
      setQuickBagType("50kg");
    } else if (targetProduct.allow25kg !== false) {
      setQuickBagType("25kg");
    }
    setQuickQty(10);
    setQuickCost("");
    setQuickNote("");
  };

  // 4. XÁC NHẬN NHẬP THÊM HÀNG (Lưu vào lịch sử + Tăng tồn kho)
  const handleConfirmQuickStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStockInProduct) return;

    const qty = typeof quickQty === "number" ? quickQty : 0;
    if (qty <= 0) {
      alert("Số lượng nhập thêm phải lớn hơn 0!");
      return;
    }

    setIsSubmittingQuick(true);
    try {
      const autoDate = getVietnamDate();
      const autoTime = getVietnamTime();
      const cost = typeof quickCost === "number" ? quickCost : 0;
      const total = cost > 0 ? cost * qty : 0;

      // 1. Tạo bản ghi lịch sử nhập hàng
      await onAddStockInRecord({
        date: autoDate,
        time: autoTime,
        productId: quickStockInProduct.id,
        itemName: quickStockInProduct.name,
        bagType: quickBagType,
        quantity: qty,
        unitCost: cost > 0 ? cost : undefined,
        totalCost: total > 0 ? total : undefined,
        note: quickNote.trim() || undefined,
      });

      // 2. Tăng số lượng tồn kho của mặt hàng
      const cur25 = Number(quickStockInProduct.stock25kg) || 0;
      const cur50 = Number(quickStockInProduct.stock50kg) || 0;
      const new25 = quickBagType === "25kg" ? cur25 + qty : cur25;
      const new50 = quickBagType === "50kg" ? cur50 + qty : cur50;

      await onUpdateProductStock(
        quickStockInProduct.id,
        new25,
        new50,
        quickStockInProduct.minStockAlert
      );

      setQuickStockInProduct(null);
      setShowStockInSuccess(true);
      setTimeout(() => setShowStockInSuccess(false), 3000);
    } catch (err: any) {
      alert("Lỗi khi nhập hàng: " + err.message);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // 5. XÁC NHẬN TẠO MẶT HÀNG MỚI & NHẬP VÀO SỔ TỒN KHO (Ảnh 2)
  const handleCreateNewProductStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert("Vui lòng nhập tên hàng mới!");
      return;
    }
    if (!newProdAllow25 && !newProdAllow50) {
      alert("Vui lòng chọn ít nhất một loại bao (Bao 25kg hoặc Bao 50kg)!");
      return;
    }

    setIsCreatingNew(true);
    try {
      const price = typeof newProdPrice === "number" ? Math.max(0, newProdPrice) : 350000;
      const s25 = newProdAllow25 ? (typeof newProdStock25 === "number" ? Math.max(0, newProdStock25) : 0) : 0;
      const s50 = newProdAllow50 ? (typeof newProdStock50 === "number" ? Math.max(0, newProdStock50) : 0) : 0;
      const cost = typeof newProdUnitCost === "number" ? newProdUnitCost : 0;
      const autoDate = getVietnamDate();
      const autoTime = getVietnamTime();

      // 1. Thêm mặt hàng mới vào danh mục sản phẩm kèm lượng tồn ban đầu
      let createdProduct: ProductItem | void = undefined;
      if (onAddNewProduct) {
        createdProduct = await onAddNewProduct({
          name: newProdName.trim(),
          price,
          allow25kg: newProdAllow25,
          allow50kg: newProdAllow50,
          stock25kg: s25,
          stock50kg: s50,
          minStockAlert: 5,
        });
      }

      // 2. Tự động ghi vào lịch sử nhập hàng cho đợt nhập ban đầu
      const prodId = createdProduct?.id || "p_" + Date.now();

      if (newProdAllow50 && s50 > 0) {
        await onAddStockInRecord({
          date: autoDate,
          time: autoTime,
          productId: prodId,
          itemName: newProdName.trim(),
          bagType: "50kg",
          quantity: s50,
          unitCost: cost > 0 ? cost : undefined,
          totalCost: cost > 0 ? cost * s50 : undefined,
          note: newProdNote.trim() || "Nhập ban đầu khi tạo hàng",
        });
      }

      if (newProdAllow25 && s25 > 0) {
        await onAddStockInRecord({
          date: autoDate,
          time: autoTime,
          productId: prodId,
          itemName: newProdName.trim(),
          bagType: "25kg",
          quantity: s25,
          unitCost: cost > 0 ? cost : undefined,
          totalCost: cost > 0 ? cost * s25 : undefined,
          note: newProdNote.trim() || "Nhập ban đầu khi tạo hàng",
        });
      }

      // Reset form
      setNewProdName("");
      setNewProdPrice(350000);
      setNewProdAllow25(true);
      setNewProdAllow50(true);
      setNewProdStock25(10);
      setNewProdStock50(10);
      setNewProdUnitCost("");
      setNewProdNote("");

      setSubTab("stock");
      setShowStockInSuccess(true);
      setTimeout(() => setShowStockInSuccess(false), 3000);
    } catch (err: any) {
      alert("Lỗi khi thêm hàng mới: " + err.message);
    } finally {
      setIsCreatingNew(false);
    }
  };

  // 6. XÓA PHIẾU NHẬP HÀNG (Kèm hoàn trả tồn kho)
  const handleConfirmDeleteStockIn = async () => {
    if (!deletingRecord) return;
    if (!deleteReason.trim()) {
      alert("Vui lòng nhập lý do hủy phiếu!");
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteStockInRecord(deletingRecord.id, deleteReason.trim());
      setDeletingRecord(null);
      setDeleteReason("");
    } catch (err: any) {
      alert("Lỗi khi xóa phiếu: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // 7. LỌC LỊCH SỬ NHẬP HÀNG
  const filteredHistory = useMemo(() => {
    return activeStockInRecords.filter((r) => {
      const q = historySearch.toLowerCase();
      return (
        r.itemName.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.date.includes(q)
      );
    });
  }, [activeStockInRecords, historySearch]);

  const handleExcelImportSuccess = async (records: ParsedExcelRecord[]) => {
    let successCount = 0;
    const notFoundNames = new Set<string>();

    for (const rec of records) {
      const targetProd = products.find((p) => p.name.trim().toLowerCase() === rec.name.trim().toLowerCase());
      if (targetProd) {
        // Tồn kho nhận số lượng từ Excel (bao gồm cả số lẻ như 0.5)
        const bagType = targetProd.allow50kg !== false ? "50kg" : "25kg";
        const importDate = rec.date.includes("-") || rec.date.includes("/") ? rec.date : getVietnamDate();
        
        await onAddStockInRecord({
          date: importDate,
          time: getVietnamTime(),
          productId: targetProd.id,
          itemName: targetProd.name,
          bagType: bagType,
          quantity: rec.quantity,
          note: "Nhập từ file Excel",
        });

        // Cập nhật số lượng tồn kho cộng dồn
        const cur25 = Number(targetProd.stock25kg) || 0;
        const cur50 = Number(targetProd.stock50kg) || 0;
        const qty = Number(rec.quantity) || 0;
        
        const new25 = bagType === "25kg" ? cur25 + qty : cur25;
        const new50 = bagType === "50kg" ? cur50 + qty : cur50;

        await onUpdateProductStock(
          targetProd.id,
          new25,
          new50,
          targetProd.minStockAlert
        );

        successCount++;
      } else {
        notFoundNames.add(rec.name);
      }
    }

    if (notFoundNames.size > 0) {
      alert(`Đã nhập thành công ${successCount} mặt hàng.\nBỏ qua các hàng hóa không có tên trong hệ thống: ${Array.from(notFoundNames).join(", ")}`);
    } else {
      alert(`Nhập thành công ${successCount} mặt hàng từ Excel!`);
    }

    setSubTab("stock");
  };

  return (
    <div className="space-y-2.5">
      {/* NÚT CHUYỂN PHÂN HỆ TRONG TỒN KHO */}
      <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setSubTab("stock")}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            subTab === "stock"
              ? "bg-emerald-700 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Sổ Tồn Kho</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("stock_in")}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            subTab === "stock_in"
              ? "bg-emerald-700 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Nhập Hàng Mới</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("history")}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            subTab === "history"
              ? "bg-emerald-700 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lịch Sử ({activeStockInRecords.length})</span>
          <span className="sm:hidden">Lịch Sử</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("excel_import")}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            subTab === "excel_import"
              ? "bg-emerald-700 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Từ Excel</span>
          <span className="sm:hidden">Excel</span>
        </button>
      </div>

      {/* Thông Báo Thành Công */}
      {showStockInSuccess && (
        <div className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Đã cập nhật lượng tồn kho thành công!</span>
          </div>
          <button
            type="button"
            onClick={() => setSubTab("stock")}
            className="underline text-[11px] text-emerald-100 hover:text-white"
          >
            Xem sổ tồn →
          </button>
        </div>
      )}

      {/* ===================== PHÂN HỆ 1: SỔ TỒN KHO (Ảnh 1 & 3) ===================== */}
      {subTab === "stock" && (
        <div className="space-y-2.5">
          {/* Thanh Tìm Kiếm & Bộ Lọc */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm nhanh mặt hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-700"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                  stockFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất Cả ({products.length})
              </button>

              <button
                type="button"
                onClick={() => setStockFilter("low")}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
                  stockFilter === "low"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Sắp Hết ({stats.lowStockCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStockFilter("out_of_stock")}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                  stockFilter === "out_of_stock"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 border border-red-200/60 hover:bg-red-100"
                }`}
              >
                Hết Hàng ({stats.outOfStockCount})
              </button>

              <button
                type="button"
                onClick={() => setStockFilter("in_stock")}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                  stockFilter === "in_stock"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100"
                }`}
              >
                Còn Hàng ({products.length - stats.outOfStockCount})
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN RESET TOÀN BỘ TỒN KHO VỀ 0?\n\nHành động này sẽ đặt số lượng tồn kho của tất cả mặt hàng về 0 và không thể hoàn tác!")) {
                    if (onResetAllStock) {
                      await onResetAllStock();
                      alert("✅ Đã reset toàn bộ tồn kho về 0 thành công!");
                    }
                  }
                }}
                className="px-2 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 ml-auto"
              >
                <RefreshCcw className="w-3 h-3" />
                <span>Reset Về 0</span>
              </button>
            </div>
          </div>

          {/* Nút nhập thêm hàng chung */}
          <button
            type="button"
            onClick={() => handleOpenQuickStockIn(null)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <ArrowDownToLine className="w-4.5 h-4.5" />
            <span>NHẬP THÊM HÀNG VÀO KHO</span>
          </button>

          {/* DANH SÁCH MẶT HÀNG: ĐÃ BỎ NÚT NHẬP THÊM Ở TỪNG HÀNG */}
          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Không tìm thấy mặt hàng nào phù hợp</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const s25 = Number(p.stock25kg) || 0;
                const s50 = Number(p.stock50kg) || 0;
                const totalBags = s25 + s50;
                const minAlert = p.minStockAlert !== undefined ? p.minStockAlert : 5;
                const isLow = totalBags > 0 && totalBags <= minAlert;
                const isOut = totalBags === 0;

                const allow25 = p.allow25kg !== false;
                const allow50 = p.allow50kg !== false;
                const bothAllowed = allow25 && allow50;

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl p-3 border transition shadow-2xs ${
                      isOut
                        ? "border-red-200 bg-red-50/20"
                        : isLow
                        ? "border-amber-200 bg-amber-50/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Header card: Tên hàng + Giá & Nút Nhập Thêm (Đã bỏ nút Sửa) */}
                    <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">{p.name}</h4>
                          {isOut ? (
                            <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.2 rounded">
                              Hết hàng
                            </span>
                          ) : isLow ? (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Tồn thấp (≤{minAlert})
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                              Còn hàng
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Giá niêm yết: <span className="font-semibold text-slate-600">{formatCurrencyVND(p.price)}</span>/50kg
                        </p>
                      </div>
                    </div>

                    {/* Chi tiết lượng tồn: Dạng gọn gàng 'Bao 50kg: X bao' dễ nhìn */}
                    <div className={`grid ${bothAllowed ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                      {/* Bao 25kg */}
                      {allow25 && (
                        <div className="bg-slate-50 hover:bg-slate-100/80 transition rounded-xl px-3 py-2 border border-slate-200/80 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-600">Bao 25kg:</span>
                          <span className={`text-sm sm:text-base font-black ${s25 <= 0 ? "text-red-500" : "text-emerald-700"}`}>
                            {s25} bao
                          </span>
                        </div>
                      )}

                      {/* Bao 50kg */}
                      {allow50 && (
                        <div className="bg-slate-50 hover:bg-slate-100/80 transition rounded-xl px-3 py-2 border border-slate-200/80 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-600">Bao 50kg:</span>
                          <span className={`text-sm sm:text-base font-black ${s50 <= 0 ? "text-red-500" : "text-teal-800"}`}>
                            {s50} bao
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================== PHÂN HỆ 2: NHẬP MẶT HÀNG MỚI (Ảnh 2) ===================== */}
      {subTab === "stock_in" && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3.5">
          {/* Header Form */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800">
                  NHẬP MẶT HÀNG MỚI VÀO KHO
                </h3>
                <p className="text-[10px] text-slate-400">
                  Tạo sản phẩm mới và tự động cộng lượng tồn ban đầu vào sổ kho
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateNewProductStockIn} className="space-y-3">
            {/* 1. Tên Hàng Nhập (Ô để trống để người dùng nhập) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Tên Hàng Nhập <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Nhập tên mặt hàng mới (VD: Cám heo nái, Gạo Lài Miên...)"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* 2. Giá Niêm Yết 50kg */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Giá Niêm Yết Bao 50kg (VNĐ) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newProdPrice === "" ? "" : formatCurrencyInput(newProdPrice)}
                  onChange={(e) => setNewProdPrice(parseCurrencyInput(e.target.value))}
                  placeholder="VD: 350.000"
                  className="w-full py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  đ
                </span>
              </div>
            </div>

            {/* 3. Tích Chọn Loại Bao Đang Có */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Loại Bao Đang Có <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProdAllow25}
                    onChange={(e) => setNewProdAllow25(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Bao 25kg</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProdAllow50}
                    onChange={(e) => setNewProdAllow50(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Bao 50kg</span>
                </label>
              </div>
            </div>

            {/* 4. Số Bao Nhập Ban Đầu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {newProdAllow25 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Số Bao 25kg Nhập Ban Đầu
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newProdStock25 === "" ? "" : newProdStock25}
                      onChange={(e) => setNewProdStock25(parseQuantityInput(e.target.value))}
                      placeholder="Nhập số bao 25kg..."
                      className="w-full py-2 px-3 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-black text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                      bao
                    </span>
                  </div>
                </div>
              )}

              {newProdAllow50 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Số Bao 50kg Nhập Ban Đầu
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newProdStock50 === "" ? "" : newProdStock50}
                      onChange={(e) => setNewProdStock50(parseQuantityInput(e.target.value))}
                      placeholder="Nhập số bao 50kg..."
                      className="w-full py-2 px-3 bg-teal-50/40 border border-teal-300 rounded-xl text-xs font-black text-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-700">
                      bao
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Đơn Giá Nhập (Tùy chọn) & Ghi Chú */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Đơn Giá Nhập / Bao (Tùy chọn)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newProdUnitCost === "" ? "" : formatCurrencyInput(newProdUnitCost)}
                    onChange={(e) => setNewProdUnitCost(parseCurrencyInput(e.target.value))}
                    placeholder="VD: 320.000"
                    className="w-full py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                    đ
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Ghi Chú Đợt Nhập (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newProdNote}
                  onChange={(e) => setNewProdNote(e.target.value)}
                  placeholder="VD: Nhập thêm hàng đợt 1..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Nút Xác Nhận Nhập Kho */}
            <button
              type="submit"
              disabled={isCreatingNew}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{isCreatingNew ? "ĐANG XỬ LÝ..." : "XÁC NHẬN NHẬP KHO"}</span>
            </button>
          </form>
        </div>
      )}

      {/* ===================== PHÂN HỆ 3: LỊCH SỬ NHẬP HÀNG ===================== */}
      {subTab === "history" && (
        <div className="space-y-2.5">
          {/* Thanh tìm kiếm lịch sử */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên hàng, ngày nhập..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium"
              />
            </div>
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch("")}
                className="px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Xóa lọc
              </button>
            )}
          </div>

          {/* Danh sách phiếu nhập */}
          <div className="space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <History className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Chưa có lịch sử nhập hàng nào</p>
              </div>
            ) : (
              filteredHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-slate-800">
                          {rec.itemName}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.2 rounded">
                          +{rec.quantity} bao ({rec.bagType})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {formatVietnamDisplayDate(rec.date)} {rec.time ? `• ${rec.time}` : ""}
                      </p>
                    </div>

                    {/* Nút Xóa Phiếu Nhập */}
                    <button
                      type="button"
                      onClick={() => setDeletingRecord(rec)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition"
                      title="Hủy phiếu nhập này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chi tiết phụ */}
                  {(rec.unitCost || rec.note) && (
                    <div className="bg-slate-50 rounded-xl p-2 text-[10px] text-slate-600 space-y-0.5 border border-slate-100">
                      {rec.unitCost && (
                        <div>
                          Giá nhập: <span className="font-bold">{formatCurrencyVND(rec.unitCost)}</span>
                          {rec.totalCost && (
                            <span>
                              {" "}
                              (Tổng tiền:{" "}
                              <span className="font-bold text-emerald-700">
                                {formatCurrencyVND(rec.totalCost)}
                              </span>
                              )
                            </span>
                          )}
                        </div>
                      )}
                      {rec.note && (
                        <div>
                          Ghi chú: <span className="italic text-slate-700">{rec.note}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== PHÂN HỆ 4: NHẬP TỪ EXCEL ===================== */}
      {subTab === "excel_import" && (
        <ExcelImportStock onImportSuccess={handleExcelImportSuccess} />
      )}

      {/* ===================== MODAL NHẬP THÊM HÀNG CHO 1 MẶT HÀNG (Ảnh 3) ===================== */}
      {quickStockInProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-scale-up">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 relative">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shadow-xs">
                  <ArrowDownToLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Nhập Thêm Hàng Vào Kho</h3>
                  <p className="text-[10px] text-emerald-200">Chọn mặt hàng và số lượng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickStockInProduct(null)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickStockIn} className="p-3.5 space-y-3">
              {/* Chọn Mặt Hàng */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Loại Hàng <span className="text-red-500">*</span></label>
                <select
                  value={quickStockInProduct.id}
                  onChange={(e) => {
                    const found = products.find(p => p.id === e.target.value);
                    if (found) {
                      setQuickStockInProduct(found);
                      if (quickBagType === "50kg" && found.allow50kg === false) setQuickBagType("25kg");
                      if (quickBagType === "25kg" && found.allow25kg === false) setQuickBagType("50kg");
                    }
                  }}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Chọn Loại Bao */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Loại Bao</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={quickStockInProduct.allow25kg === false}
                    onClick={() => setQuickBagType("25kg")}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      quickBagType === "25kg"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                        : quickStockInProduct.allow25kg === false
                        ? "opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Bao 25kg
                  </button>

                  <button
                    type="button"
                    disabled={quickStockInProduct.allow50kg === false}
                    onClick={() => setQuickBagType("50kg")}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      quickBagType === "50kg"
                        ? "bg-teal-700 border-teal-700 text-white shadow-2xs"
                        : quickStockInProduct.allow50kg === false
                        ? "opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Bao 50kg
                  </button>
                </div>
              </div>

              {/* Số Bao Nhập Thêm */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Số Bao Nhập Thêm <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Tồn hiện tại:{" "}
                    {quickBagType === "25kg"
                      ? (quickStockInProduct.stock25kg || 0)
                      : (quickStockInProduct.stock50kg || 0)}{" "}
                    bao
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quickQty === "" ? "" : quickQty}
                    onChange={(e) => setQuickQty(parseQuantityInput(e.target.value))}
                    placeholder="Nhập số bao..."
                    className="w-full py-2 px-3 bg-emerald-50/50 border border-emerald-300 rounded-xl text-sm font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                    bao
                  </span>
                </div>
              </div>

              {/* Các nút chọn nhanh số bao */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {[5, 10, 20, 30, 50, 100].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuickQty(num)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition ${
                      quickQty === num
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    +{num}
                  </button>
                ))}
              </div>

              {/* Đơn Giá Nhập (Tùy chọn) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Đơn Giá Nhập / Bao (Tùy chọn)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quickCost === "" ? "" : formatCurrencyInput(quickCost)}
                    onChange={(e) => setQuickCost(parseCurrencyInput(e.target.value))}
                    placeholder="VD: 320.000"
                    className="w-full py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                    đ
                  </span>
                </div>
              </div>

              {/* Ghi chú */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Ghi Chú Đợt Nhập (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="VD: Nhập thêm hàng chiều nay..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickStockInProduct(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuick}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs transition"
                >
                  {isSubmittingQuick ? "Đang lưu..." : `Xác Nhận (+${quickQty || 0} Bao)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL XÁC NHẬN XÓA PHIẾU NHẬP ===================== */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 animate-scale-up">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-xs sm:text-sm font-black">Xác Nhận Hủy Phiếu Nhập</h3>
            </div>

            <p className="text-xs text-slate-600">
              Hủy phiếu nhập <span className="font-bold">{deletingRecord.itemName}</span> (+
              {deletingRecord.quantity} bao {deletingRecord.bagType}). Số lượng tồn kho sẽ tự động trừ
              ngược lại.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Lý Do Hủy Phiếu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="VD: Nhập nhầm số lượng, sai loại bao..."
                className="w-full py-2 px-3 bg-red-50/50 border border-red-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isDeleting || !deleteReason.trim()}
                onClick={handleConfirmDeleteStockIn}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-2xs transition"
              >
                {isDeleting ? "Đang xử lý..." : "Xác Nhận Hủy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




