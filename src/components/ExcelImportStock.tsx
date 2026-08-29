"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, Play, Database } from "lucide-react";
import { parseInventoryExcel, ParsedExcelRecord } from "@/lib/excelParser";

interface ExcelImportStockProps {
  onImportSuccess?: (records: ParsedExcelRecord[]) => void;
}

export default function ExcelImportStock({ onImportSuccess }: ExcelImportStockProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [previewData, setPreviewData] = useState<ParsedExcelRecord[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Lưu buffer thay vì workbook object của XLSX để tránh memory leak
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewData([]); // Reset
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      setFileBuffer(buffer);
      
      // Khởi chạy tạm parse 1 lần để lấy danh sách sheet
      const { sheetNames } = parseInventoryExcel(buffer, "");
      setSheetNames(sheetNames);
      
      // Auto select sheet chứa "Kho Lẻ" của tháng hiện tại
      const currentMonth = new Date().getMonth() + 1;
      const targetName = `Kho Lẻ ${currentMonth}`;
      
      const foundSheet = sheetNames.find((n) => n.includes(targetName)) || sheetNames.find((n) => n.includes("Kho Lẻ")) || sheetNames[0];
      setSelectedSheet(foundSheet);
    } catch (err) {
      alert("Lỗi khi đọc file Excel!");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = () => {
    if (!fileBuffer || !selectedSheet) return;
    
    setIsProcessing(true);
    try {
      const { records } = parseInventoryExcel(fileBuffer, selectedSheet);
      
      if (records.length === 0) {
        alert("Không tìm thấy dữ liệu hợp lệ trong sheet này!");
      }
      
      setPreviewData(records);
    } catch (err) {
      alert("Lỗi phân tích dữ liệu: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (previewData.length === 0) return;
    setIsSaving(true);
    
    try {
      if (onImportSuccess) {
        onImportSuccess(previewData);
      }

      // Xóa form sau khi lưu thành công
      setFile(null);
      setFileBuffer(null);
      setSheetNames([]);
      setSelectedSheet("");
      setPreviewData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      alert("Lỗi khi lưu vào CSDL: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase">Nhập hàng từ Excel</h3>
          <p className="text-[10px] text-slate-400">Trích xuất tự động khu vực "Nhập" trong file</p>
        </div>
      </div>

      {/* 1. Chọn File */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase">1. Chọn file Excel (.xlsx)</label>
        <div 
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
            file ? "border-blue-300 bg-blue-50/50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div className="flex items-center gap-2 text-blue-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold">{file.name}</span>
            </div>
          ) : (
            <>
              <UploadCloud className="w-6 h-6 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Bấm để chọn file Excel TỔNG NHẬP XUẤT TỒN</span>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
          />
        </div>
      </div>

      {/* 2. Chọn Sheet & Phân Tích */}
      {sheetNames.length > 0 && (
        <div className="space-y-2 animate-fadeIn">
          <label className="text-[10px] font-bold text-slate-500 uppercase">2. Chọn Sheet Cần Đọc</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sheetNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isProcessing}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Phân tích dữ liệu</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Bảng Preview Dữ Liệu */}
      {previewData.length > 0 && (
        <div className="space-y-3 animate-fadeIn pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              3. Xem trước dữ liệu Nhập Kho (Trích xuất)
            </label>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold">
              {previewData.length} dòng
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 font-bold w-24 border-r border-slate-100">Ngày</th>
                  <th className="px-3 py-2 font-bold border-r border-slate-100">Tên Hàng</th>
                  <th className="px-3 py-2 font-bold text-right">Số Lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-100">{row.date}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-900 border-r border-slate-100">{row.name}</td>
                    <td className="px-3 py-1.5 font-black text-emerald-700 text-right">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-sm font-black shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Database className="w-5 h-5" />
            <span>{isSaving ? "Đang xử lý Backend..." : "LƯU VÀO DATABASE SỔ TỒN KHO"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
