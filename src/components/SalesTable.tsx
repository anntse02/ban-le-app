"use client";

import React, { useState, useMemo } from "react";
import { SaleRecord, StockInRecord } from "@/types";
import { formatVietnamDisplayDate, getVietnamDate } from "@/lib/dateUtils";
import { formatCurrencyVND, formatNumberVN } from "@/lib/formatters";
import {
  Trash2,
  Search,
  Package,
  Clock,
  Scale,
  UserCheck,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Layers,
  AlertTriangle,
  ArrowDownToLine,
} from "lucide-react";

interface SalesTableProps {
  records: SaleRecord[];
  stockInRecords?: StockInRecord[];
  onDeleteRecord: (id: string, reason: string) => Promise<void>;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

interface ItemSummary {
  itemName: string;
  bag25: number;
  bag50: number;
  otherBag: number;
  totalQuantity: number;
  totalRevenue: number;
}

type FilterTab = "all" | "Hằng" | "Gấm" | "Duyên" | "paid" | "unpaid" | "partial";

export default function SalesTable({
  records,
  stockInRecords = [],
  onDeleteRecord,
  selectedDate,
  onDateChange,
}: SalesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(true);

  const [deletingRecord, setDeletingRecord] = useState<SaleRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [yearStr, monthStr] = (selectedDate || getVietnamDate()).split("-");
  const [calendarYear, setCalendarYear] = useState<number>(Number(yearStr) || new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(Number(monthStr) || new Date().getMonth() + 1);

  const todayStr = getVietnamDate();

  // Đếm theo người bán, trạng thái thu tiền và đơn lấy nhiều lần
  const countHang = records.filter((r) => r.seller === "Hằng" && !r.isDeleted).length;
  const countGam = records.filter((r) => r.seller === "Gấm" && !r.isDeleted).length;
  const countDuyen = records.filter((r) => r.seller === "Duyên" && !r.isDeleted).length;
  const countPaid = records.filter((r) => r.paymentStatus !== "unpaid" && !r.isDeleted).length;
  const countUnpaid = records.filter((r) => r.paymentStatus === "unpaid" && !r.isDeleted).length;
  const countPartial = records.filter((r) => r.isPartialPickup && !r.isDeleted).length;

  // Lọc theo bộ lọc và từ khóa tìm kiếm
  const filteredRecords = records.filter((rec) => {
    let matchesFilter = true;
    if (activeFilter === "Hằng") matchesFilter = rec.seller === "Hằng";
    else if (activeFilter === "Gấm") matchesFilter = rec.seller === "Gấm";
    else if (activeFilter === "Duyên") matchesFilter = rec.seller === "Duyên";
    else if (activeFilter === "paid") matchesFilter = rec.paymentStatus !== "unpaid";
    else if (activeFilter === "unpaid") matchesFilter = rec.paymentStatus === "unpaid";
    else if (activeFilter === "partial") matchesFilter = !!rec.isPartialPickup;

    const matchesSearch =
      rec.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.customerName && rec.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.seller && rec.seller.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.bagType && rec.bagType.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.note && rec.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.deleteReason && rec.deleteReason.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  // Tính tổng số liệu hợp lệ của ngày đang xem
  const activeRecords = records.filter((r) => !r.isDeleted);
  const totalRevenueDay = activeRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const totalBagsDay = activeRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Lọc danh sách đợt nhập kho trong ngày đang xem
  const dayStockInRecords = useMemo(() => {
    return stockInRecords.filter((r) => r.date === selectedDate && !r.isDeleted);
  }, [stockInRecords, selectedDate]);

  const totalDayImportBags = useMemo(() => {
    return dayStockInRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [dayStockInRecords]);

  // Bảng tổng hợp theo từng loại hàng
  const itemSummaryMap = new Map<string, ItemSummary>();
  activeRecords.forEach((rec) => {
    const name = rec.itemName.trim() || "Chưa đặt tên";
    const qty = Number(rec.quantity) || 0;
    const total = Number(rec.totalPrice) || 0;
    const bag = rec.bagType || "25kg";

    if (!itemSummaryMap.has(name)) {
      itemSummaryMap.set(name, {
        itemName: name,
        bag25: 0,
        bag50: 0,
        otherBag: 0,
        totalQuantity: 0,
        totalRevenue: 0,
      });
    }

    const existing = itemSummaryMap.get(name)!;
    existing.totalQuantity += qty;
    existing.totalRevenue += total;
    if (bag === "25kg") {
      existing.bag25 += qty;
    } else if (bag === "50kg") {
      existing.bag50 += qty;
    } else {
      existing.otherBag += qty;
    }
  });

  const itemSummaries = Array.from(itemSummaryMap.values()).sort(
    (a, b) => b.totalQuantity - a.totalQuantity
  );

  const handleOpenDeleteModal = (record: SaleRecord) => {
    setDeletingRecord(record);
    setDeleteReason("");
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord || !deletingRecord.id) return;
    if (!deleteReason.trim()) {
      alert("Vui lòng nhập lý do xóa đơn hàng!");
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteRecord(deletingRecord.id, deleteReason.trim());
      setDeletingRecord(null);
      setDeleteReason("");
    } catch (e: any) {
      alert("Lỗi khi xóa: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. THANH CHỌN NGÀY TRONG THÁNG & BỘ LỌC */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        {/* Nút mở Lịch chọn ngày */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="flex-1 py-2.5 px-3.5 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border border-green-300 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center shadow-xs">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                  Đang xem sổ ngày:
                </span>
                <span className="text-sm sm:text-base font-black text-green-900">
                  {formatVietnamDisplayDate(selectedDate)}
                  {selectedDate === todayStr && (
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-green-200 text-green-800">
                      Hôm nay
                    </span>
                  )}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-green-700 underline">Đổi ngày ▾</span>
          </button>

          {selectedDate !== todayStr && (
            <button
              type="button"
              onClick={() => onDateChange(todayStr)}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
              title="Quay về ngày hôm nay"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hôm nay</span>
            </button>
          )}
        </div>

        {/* Tóm tắt nhanh số liệu của ngày đang xem */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Doanh thu ngày: </span>
            <span className="font-bold text-green-700">{formatCurrencyVND(totalRevenueDay)}</span>
          </div>
          <div>
            <span className="text-slate-500">Tổng xuất: </span>
            <span className="font-bold text-slate-800">{totalBagsDay} bao</span>
          </div>
        </div>

        {/* Ô Tìm kiếm */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tên hàng, khách hàng, người bán, lý do xóa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition"
          />
        </div>

        {/* BỘ LỌC: BỎ CHỮ 'NGƯỜI BÁN:', DỜI CÁC NÚT QUA TRÁI & THÊM Ô 'ĐÃ THU', 'CHƯA THU' */}
        <div className="pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Nút Tất cả */}
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                activeFilter === "all"
                  ? "bg-slate-800 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tất cả ({records.length})
            </button>

            {/* Nút Hằng */}
            <button
              type="button"
              onClick={() => setActiveFilter("Hằng")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                activeFilter === "Hằng"
                  ? "bg-pink-600 text-white shadow-2xs"
                  : "bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200"
              }`}
            >
              Hằng ({countHang})
            </button>

            {/* Nút Gấm */}
            <button
              type="button"
              onClick={() => setActiveFilter("Gấm")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                activeFilter === "Gấm"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
              }`}
            >
              Gấm ({countGam})
            </button>

            {/* Nút Duyên */}
            <button
              type="button"
              onClick={() => setActiveFilter("Duyên")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                activeFilter === "Duyên"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              Duyên ({countDuyen})
            </button>

            {/* Nút ĐÃ THU */}
            <button
              type="button"
              onClick={() => setActiveFilter("paid")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                activeFilter === "paid"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <span>✓ Đã thu</span>
              <span className="font-bold">({countPaid})</span>
            </button>

            {/* Nút CHƯA THU */}
            <button
              type="button"
              onClick={() => setActiveFilter("unpaid")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                activeFilter === "unpaid"
                  ? "bg-red-600 text-white shadow-2xs"
                  : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              }`}
            >
              <span>✗ Chưa thu</span>
              <span className="font-bold">({countUnpaid})</span>
            </button>

            {/* Nút LẤY NHIỀU LẦN */}
            <button
              type="button"
              onClick={() => setActiveFilter("partial")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 shrink-0 ${
                activeFilter === "partial"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <span>📦 Lấy nhiều lần</span>
              <span className="font-bold">({countPartial})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BẢNG CỘNG LƯỢNG TỪNG LOẠI HÀNG TRONG NGÀY */}
      {itemSummaries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="p-3 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-200" />
              <h3 className="text-xs sm:text-sm font-black tracking-tight">
                Tổng Lượng Từng Loại Hàng ({itemSummaries.length} loại)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-200 bg-white/10 px-2 py-0.5 rounded-md">
              {isSummaryExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
            </span>
          </div>

          {isSummaryExpanded && (
            <div className="p-3 space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-bold">
                      <th className="pb-2">Tên Hàng Hóa</th>
                      <th className="pb-2 text-center">Bao 25kg</th>
                      <th className="pb-2 text-center">Bao 50kg</th>
                      <th className="pb-2 text-center">Tổng Bao</th>
                      <th className="pb-2 text-right">Thành Tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemSummaries.map((item, idx) => {
                      const bagParts: React.ReactNode[] = [];
                      if (item.bag25 > 0) {
                        bagParts.push(
                          <span key="25" className="inline-flex items-baseline">
                            <span className="font-extrabold text-slate-900">{item.bag25}</span>
                            <span className="text-[10px] text-slate-500 font-semibold lowercase ml-0.5">x25</span>
                          </span>
                        );
                      }
                      if (item.bag50 > 0) {
                        bagParts.push(
                          <span key="50" className="inline-flex items-baseline">
                            <span className="font-extrabold text-slate-900">{item.bag50}</span>
                            <span className="text-[10px] text-slate-500 font-semibold lowercase ml-0.5">x50</span>
                          </span>
                        );
                      }

                      return (
                        <tr key={item.itemName + idx} className="hover:bg-slate-50 transition">
                          <td className="py-2 pr-2 font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-green-100 text-green-800 text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate max-w-[120px] sm:max-w-none">{item.itemName}</span>
                          </td>
                          <td className="py-2 text-center">
                            {item.bag25 > 0 ? (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {item.bag25}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            {item.bag50 > 0 ? (
                              <span className="font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                {item.bag50}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                              {bagParts.length > 0 ? (
                                bagParts.map((part, pIdx) => (
                                  <React.Fragment key={pIdx}>
                                    {pIdx > 0 && <span className="text-slate-400 font-medium text-[11px]">và</span>}
                                    {part}
                                  </React.Fragment>
                                ))
                              ) : (
                                <span className="font-bold text-slate-700">
                                  {item.totalQuantity} <span className="text-[10px] text-slate-400">bao</span>
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2 text-right font-black text-green-700">
                            {formatCurrencyVND(item.totalRevenue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const total25 = itemSummaries.reduce((sum, i) => sum + i.bag25, 0);
                      const total50 = itemSummaries.reduce((sum, i) => sum + i.bag50, 0);
                      const totalParts: React.ReactNode[] = [];
                      if (total25 > 0) {
                        totalParts.push(
                          <span key="t25" className="inline-flex items-baseline">
                            <span className="font-extrabold text-slate-900">{total25}</span>
                            <span className="text-[10px] text-slate-500 font-semibold lowercase ml-0.5">x25</span>
                          </span>
                        );
                      }
                      if (total50 > 0) {
                        totalParts.push(
                          <span key="t50" className="inline-flex items-baseline">
                            <span className="font-extrabold text-slate-900">{total50}</span>
                            <span className="text-[10px] text-slate-500 font-semibold lowercase ml-0.5">x50</span>
                          </span>
                        );
                      }

                      return (
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-900">
                          <td className="py-2.5 pl-2 font-black text-xs text-green-800">
                            TỔNG CỘNG
                          </td>
                          <td className="py-2.5 text-center text-emerald-800">
                            {total25}
                          </td>
                          <td className="py-2.5 text-center text-teal-800">
                            {total50}
                          </td>
                          <td className="py-2.5 text-center text-slate-900 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-lg border border-slate-300 shadow-2xs">
                              {totalParts.length > 0 ? (
                                totalParts.map((part, pIdx) => (
                                  <React.Fragment key={pIdx}>
                                    {pIdx > 0 && <span className="text-slate-400 font-medium text-[11px]">và</span>}
                                    {part}
                                  </React.Fragment>
                                ))
                              ) : (
                                <span>{totalBagsDay} bao</span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-right text-green-700 text-xs sm:text-sm">
                            {formatCurrencyVND(totalRevenueDay)}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DANH SÁCH CHI TIẾT CÁC THẺ ĐƠN HÀNG */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-green-600" />
            Chi Tiết Từng Đơn Bán ({filteredRecords.length} đơn):
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Ngày {formatVietnamDisplayDate(selectedDate)} chưa có đơn bán nào.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRecords.map((rec, idx) => {
              const isDel = !!rec.isDeleted;
              const isUnpaid = rec.paymentStatus === "unpaid";

              return (
                <div
                  key={rec.id || idx}
                  className={`rounded-xl border p-3 shadow-xs transition-all flex items-start gap-2.5 ${
                    isDel
                      ? "bg-red-50/50 border-red-200 text-slate-500"
                      : "bg-white border-slate-200 hover:shadow-sm"
                  }`}
                >
                  {/* SỐ THỨ TỰ BÊN TRÁI & CHẤM TRÒN ĐỎ NẾU LÀ ĐƠN LẤY NHIỀU LẦN */}
                  <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                    <div
                      className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center border ${
                        isDel
                          ? "bg-red-100 border-red-200 text-red-700"
                          : "bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    {rec.isPartialPickup && (
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-200 shadow-xs"
                        title="Đơn khách lấy nhiều lần (Gửi kho)"
                      />
                    )}
                  </div>

                  {/* NỘI DUNG THẺ ĐƠN HÀNG */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">
                          {formatVietnamDisplayDate(rec.date)}
                        </span>
                        {rec.time && <span className="text-[11px] text-slate-400">{rec.time}</span>}

                        {isDel && (
                          <span className="ml-1 px-1.5 py-0.2 rounded font-black text-[10px] bg-red-600 text-white shadow-2xs">
                            ĐÃ XÓA
                          </span>
                        )}

                        {!isDel && (
                          isUnpaid ? (
                            <span className="ml-1 px-1.5 py-0.2 rounded font-black text-[10px] bg-red-100 text-red-700 border border-red-200">
                              Chưa thu
                            </span>
                          ) : (
                            <span className="ml-1 px-1.5 py-0.2 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Đã thu
                            </span>
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {rec.seller === "Hằng" ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-100 text-pink-700 border border-pink-200">
                            Hằng
                          </span>
                        ) : rec.seller === "Gấm" ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                            Gấm
                          </span>
                        ) : rec.seller === "Duyên" ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Duyên
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {rec.seller || "—"}
                          </span>
                        )}

                        {!isDel && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(rec)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Xóa đơn hàng này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-bold text-sm ${
                              isDel ? "line-through text-slate-500" : "text-slate-900"
                            }`}
                          >
                            {rec.itemName}
                          </span>
                          {rec.bagType && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Scale className="w-3 h-3" />
                              {rec.bagType}
                            </span>
                          )}
                        </div>

                        {rec.customerName && (
                          <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>Khách: <strong className="font-bold">{rec.customerName}</strong></span>
                          </p>
                        )}

                        <p className="text-xs text-slate-500">
                          Số lượng: <span className="font-bold text-slate-800">{rec.quantity} bao</span> ×{" "}
                          {formatNumberVN(rec.unitPrice)} đ/bao
                        </p>

                        {rec.isPartialPickup && (
                          <div className="pt-0.5">
                            {rec.pickupStatus === "completed" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                📦 Đã lấy đủ ({rec.pickedQuantity || rec.quantity}/{rec.quantity} bao)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                ⏳ Đang gửi kho (Đã lấy: {rec.pickedQuantity || 0}/{rec.quantity} bao)
                              </span>
                            )}
                          </div>
                        )}

                        {/* TEXT CHI TIẾT NGÀY GIỜ & SỐ LƯỢNG LẤY CỦA MỖI LẦN */}
                        {rec.isPartialPickup && rec.pickupHistory && rec.pickupHistory.length > 0 && (
                          <div className="mt-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              🚚 Chi tiết các lần lấy ({rec.pickupHistory.length} lần):
                            </span>
                            <div className="space-y-0.5">
                              {rec.pickupHistory.map((event, eIdx) => (
                                <div
                                  key={event.id || eIdx}
                                  className="flex items-center justify-between text-[11px] text-slate-600"
                                >
                                  <span>
                                    • Lần {eIdx + 1}: {formatVietnamDisplayDate(event.date)} {event.time || ""}
                                  </span>
                                  <strong className="text-emerald-700 font-bold">+{event.quantity} bao</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rec.note && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 inline-block">
                            📝 {rec.note}
                          </p>
                        )}

                        {isDel && rec.deleteReason && (
                          <div className="mt-1 p-1.5 bg-red-100/70 border border-red-200 rounded-lg text-[11px] text-red-800 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>Lý do xóa: <strong>{rec.deleteReason}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm sm:text-base font-black ${
                            isDel ? "line-through text-slate-400" : "text-green-600"
                          }`}
                        >
                          {formatCurrencyVND(rec.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. CHI TIẾT NHẬP KHO TRONG NGÀY ĐANG XEM */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-2xs">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800">
                Chi Tiết Nhập Kho Ngày {formatVietnamDisplayDate(selectedDate)}
              </h3>
              <p className="text-[10px] text-slate-400">
                Lịch sử nhập kho lưu theo ngày và làm mới mỗi ngày
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
            {dayStockInRecords.length} đợt nhập ({totalDayImportBags} bao)
          </span>
        </div>

        {dayStockInRecords.length === 0 ? (
          <div className="py-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-medium">Không có đợt nhập kho nào trong ngày này</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {dayStockInRecords.map((rec) => (
              <div
                key={rec.id}
                className="bg-slate-50/80 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-start justify-between gap-2 transition"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-slate-800 truncate">{rec.itemName}</span>
                    <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                      +{rec.quantity} bao ({rec.bagType})
                    </span>
                    {rec.time && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {rec.time}
                      </span>
                    )}
                  </div>
                  {(rec.unitCost || rec.note) && (
                    <p className="text-[10px] text-slate-500">
                      {rec.unitCost && (
                        <span>
                          Giá nhập: <strong className="text-slate-700">{formatCurrencyVND(rec.unitCost)}</strong>
                          {rec.totalCost && (
                            <span> (Tổng: <strong className="text-teal-700">{formatCurrencyVND(rec.totalCost)}</strong>)</span>
                          )}
                        </span>
                      )}
                      {rec.note && <span className="italic ml-1.5">— {rec.note}</span>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. MODAL LỊCH CHỌN NGÀY TRONG THÁNG */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-800">
                  Chọn Ngày Trong Tháng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-slate-800">
                Tháng {calendarMonth} / {calendarYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
              <span className="text-red-500">CN</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={"empty_" + i} className="h-10" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                const formattedMonth = calendarMonth < 10 ? `0${calendarMonth}` : `${calendarMonth}`;
                const thisDateStr = `${calendarYear}-${formattedMonth}-${formattedDay}`;

                const isSelected = selectedDate === thisDateStr;
                const isToday = todayStr === thisDateStr;

                return (
                  <button
                    key={thisDateStr}
                    type="button"
                    onClick={() => {
                      onDateChange(thisDateStr);
                      setIsCalendarOpen(false);
                    }}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center text-xs font-bold relative transition-all active:scale-95 ${
                      isSelected
                        ? "bg-green-600 text-white shadow-md shadow-green-600/30 scale-105"
                        : isToday
                        ? "bg-green-100 text-green-800 border-2 border-green-500"
                        : "bg-slate-50 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span>{dayNum}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  onDateChange(todayStr);
                  setIsCalendarOpen(false);
                }}
                className="py-2 px-3 bg-green-100 hover:bg-green-200 text-green-800 font-bold rounded-xl"
              >
                Chọn Hôm Nay
              </button>

              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL NHẬP LÝ DO XÓA ĐƠN HÀNG */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-red-600 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-800">Xác Nhận Xóa Đơn Hàng</h3>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Mặt hàng:</strong> {deletingRecord.itemName} ({deletingRecord.bagType})</p>
              <p><strong>Số lượng:</strong> {deletingRecord.quantity} bao • <strong>Tổng tiền:</strong> {formatCurrencyVND(deletingRecord.totalPrice)}</p>
              {deletingRecord.customerName && <p><strong>Khách hàng:</strong> {deletingRecord.customerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vui lòng nhập lý do xóa: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Khách đổi ý, nhập nhầm giá, huỷ đơn..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-red-400 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDeletingRecord(null);
                  setDeleteReason("");
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}