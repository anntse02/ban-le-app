"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SaleRecord, StockInRecord } from "@/types";
import { getVietnamDate, formatVietnamDisplayDate } from "@/lib/dateUtils";
import { formatCurrencyVND } from "@/lib/formatters";
import { X, Download, FileSpreadsheet, Calendar, CheckCircle2 } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockInRecords?: StockInRecord[];
  onFetchRecords: (
    mode: "range" | "multiday",
    startDate: string,
    endDate: string,
    specificDays: string[]
  ) => Promise<SaleRecord[]>;
}

type ExportMode = "range" | "multiday";

export default function ExportModal({
  isOpen,
  onClose,
  stockInRecords = [],
  onFetchRecords,
}: ExportModalProps) {
  const today = getVietnamDate();
  const [mode, setMode] = useState<ExportMode>("range");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [multiDayInput, setMultiDayInput] = useState("");
  const [previewRecords, setPreviewRecords] = useState<SaleRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const parsedDays: string[] = useMemo(() => {
    if (mode !== "multiday") return [];
    const tokens = multiDayInput.trim().split(/\s+/).filter(Boolean);
    const valid: string[] = [];
    for (const token of tokens) {
      const dmyMatch = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        valid.push(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
        continue;
      }
      const ymdMatch = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymdMatch) {
        valid.push(token);
        continue;
      }
      const dmyDashMatch = token.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (dmyDashMatch) {
        const [, d, m, y] = dmyDashMatch;
        valid.push(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
        continue;
      }
    }
    return Array.from(new Set(valid)).sort();
  }, [multiDayInput, mode]);

  // Tải dữ liệu xem trước khi mở modal hoặc thay đổi khoảng ngày
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingData(true);

    onFetchRecords(mode, startDate, endDate, parsedDays)
      .then((records) => {
        if (isMounted) {
          setPreviewRecords(records);
        }
      })
      .catch((err) => {
        console.error("Lỗi lấy dữ liệu xuất:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, startDate, endDate, parsedDays, onFetchRecords]);

  const totalRevenue = previewRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const totalBags = previewRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const paidCount = previewRecords.filter((r) => r.paymentStatus !== "unpaid").length;
  const unpaidCount = previewRecords.filter((r) => r.paymentStatus === "unpaid").length;

  const getFileName = () => {
    if (mode === "range") return `BaoCao_BanLe_${startDate}_${endDate}.xlsx`;
    if (parsedDays.length === 1) return `BaoCao_BanLe_${parsedDays[0]}.xlsx`;
    return `BaoCao_BanLe_NhieuNgay_${parsedDays.length}ngay.xlsx`;
  };

  const handleDirectDownload = async () => {
    if (previewRecords.length === 0) {
      alert("Không có giao dịch nào trong ngày đã chọn!");
      return;
    }
    setDownloading(true);
    setSuccessMsg(null);
    const exportStart = mode === "range" ? startDate : (parsedDays[0] || today);
    const exportEnd = mode === "range" ? endDate : (parsedDays[parsedDays.length - 1] || today);

    // Lọc stockInRecords theo khoảng ngày hoặc các ngày đã chọn
    const filteredStockIns = (stockInRecords || []).filter((r) => {
      if (r.isDeleted) return false;
      if (mode === "range") {
        return r.date >= exportStart && r.date <= exportEnd;
      }
      return parsedDays.includes(r.date);
    });

    try {
      const res = await fetch("/api/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: previewRecords,
          startDate: exportStart,
          endDate: exportEnd,
          stockInRecords: filteredStockIns,
        }),
      });
      if (!res.ok) throw new Error("Không thể tạo file Excel!");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg("Đã tải file Excel về máy thành công!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Lỗi khi tải file!");
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Xuất File Báo Cáo Excel</h3>
              <p className="text-[10px] text-emerald-200">Tải dữ liệu bán hàng dạng file .xlsx</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Toggle chế độ */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                mode === "range"
                  ? "bg-white text-green-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📅 Khoảng ngày
            </button>
            <button
              type="button"
              onClick={() => setMode("multiday")}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                mode === "multiday"
                  ? "bg-white text-green-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🗓️ Nhiều ngày lẻ
            </button>
          </div>

          {/* === CHẾ ĐỘ KHOẢNG NGÀY === */}
          {mode === "range" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-green-600" />
                Nhập ngày muốn xuất Excel:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Từ ngày:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Đến ngày:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  Hôm Nay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const [y, m] = today.split("-");
                    setStartDate(`${y}-${m}-01`);
                    setEndDate(today);
                  }}
                  className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  Cả Tháng Này
                </button>
              </div>
            </div>
          )}

          {/* === CHẾ ĐỘ NHIỀU NGÀY LẺ === */}
          {mode === "multiday" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-green-600" />
                Nhập nhiều ngày (cách nhau bằng dấu cách):
              </label>

              <textarea
                rows={3}
                value={multiDayInput}
                onChange={(e) => setMultiDayInput(e.target.value)}
                placeholder={"VD: 24/08/2026 22/08/2026 20/08/2026\nMỗi ngày cách nhau 1 dấu cách (Space)"}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-green-500 resize-none leading-relaxed"
              />

              {multiDayInput.trim().length > 0 && (
                <div>
                  {parsedDays.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-green-700">
                        ✓ Nhận dạng được {parsedDays.length} ngày:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {parsedDays.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-800 text-[10px] font-bold rounded-lg border border-green-200"
                          >
                            {formatVietnamDisplayDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-red-600 font-semibold">
                      ✗ Không nhận dạng được ngày hợp lệ. Định dạng: DD/MM/YYYY
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const todayDisplay = today.split("-").reverse().join("/");
                    const existing = multiDayInput.trim();
                    if (!existing.includes(todayDisplay)) {
                      setMultiDayInput(existing ? existing + " " + todayDisplay : todayDisplay);
                    }
                  }}
                  className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  + Hôm Nay
                </button>
                <button
                  type="button"
                  onClick={() => setMultiDayInput("")}
                  className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg transition border border-red-200"
                >
                  Xóa hết
                </button>
              </div>
            </div>
          )}

          {/* Tóm tắt dữ liệu */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Số đơn tìm thấy:</span>
              <strong className="font-extrabold text-slate-800">
                {loadingData ? "Đang tải..." : `${previewRecords.length} đơn`}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tổng số bao:</span>
              <strong className="font-extrabold text-slate-800">
                {loadingData ? "..." : `${totalBags} bao`}
              </strong>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1">
              <span className="text-slate-500">Tổng doanh thu:</span>
              <span className="font-black text-green-700 text-sm">
                {loadingData ? "..." : formatCurrencyVND(totalRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-emerald-700 font-semibold">🟢 Đã thu: {paidCount} đơn</span>
              <span className="text-red-600 font-semibold">🔴 Chưa thu: {unpaidCount} đơn</span>
            </div>
          </div>

          {/* Thông báo tải thành công */}
          {successMsg && (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Nút Tải file Excel */}
          <button
            type="button"
            onClick={handleDirectDownload}
            disabled={downloading || loadingData || previewRecords.length === 0}
            className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition disabled:opacity-50"
          >
            {downloading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>TẢI FILE EXCEL (.XLSX)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
