"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Lock, Unlock, Delete, ShieldCheck, AlertCircle } from "lucide-react";

interface PinLockScreenProps {
  onUnlock: () => void;
}

const CORRECT_PIN = "1977";

export default function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      setError("");
      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === CORRECT_PIN) {
          setIsSuccess(true);
          try {
            localStorage.setItem("ban_le_auth_unlocked", "true");
          } catch (e) {}
          setTimeout(() => {
            onUnlock();
          }, 350);
        } else {
          setIsShaking(true);
          setError("Mã PIN không đúng, vui lòng thử lại!");
          setTimeout(() => {
            setPin("");
            setIsShaking(false);
          }, 600);
        }
      }
    },
    [pin, onUnlock]
  );

  const handleDelete = useCallback(() => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setError("");
    setPin("");
  }, []);

  // Lắng nghe bàn phím máy tính
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleDelete, handleClear]);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 flex flex-col items-center justify-center p-4 select-none">
      {/* Vòng sáng hiệu ứng nền */}
      <div className="absolute w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`w-full max-w-xs sm:max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/15 shadow-2xl text-center space-y-6 relative transition-transform ${
          isShaking ? "animate-shake" : ""
        }`}
      >
        {/* Icon khóa */}
        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isSuccess
                ? "bg-emerald-500 text-white shadow-lg scale-105"
                : error
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
            }`}
          >
            {isSuccess ? (
              <Unlock className="w-7 h-7" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
              BÁN LẺ & QUẢN LÝ KHO
            </h1>
            <p className="text-xs text-emerald-200/80 font-medium mt-0.5">
              Nhập mã PIN để mở khóa ứng dụng
            </p>
          </div>
        </div>

        {/* 4 Chấm chỉ thị PIN */}
        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  isSuccess
                    ? "bg-emerald-400 border-emerald-300 scale-110 shadow-sm shadow-emerald-400"
                    : isFilled
                    ? "bg-white border-white scale-110 shadow-xs"
                    : "border-white/30 bg-white/5"
                }`}
              />
            );
          })}
        </div>

        {/* Thông báo lỗi nếu có */}
        <div className="h-5 flex items-center justify-center">
          {error ? (
            <p className="text-xs font-bold text-red-400 flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </p>
          ) : (
            <p className="text-[11px] text-white/40">Bấm số trên màn hình hoặc gõ phím</p>
          )}
        </div>

        {/* Bàn phím số từ 0 đến 9 */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-14 sm:h-15 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-emerald-500/40 text-white font-black text-xl border border-white/10 shadow-xs transition-all active:scale-95 flex items-center justify-center"
            >
              {num}
            </button>
          ))}

          {/* Nút Xóa Hết (C) */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 sm:h-15 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-white/70 font-bold text-sm border border-white/5 transition-all active:scale-95 flex items-center justify-center"
          >
            C
          </button>

          {/* Nút 0 */}
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-14 sm:h-15 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-emerald-500/40 text-white font-black text-xl border border-white/10 shadow-xs transition-all active:scale-95 flex items-center justify-center"
          >
            0
          </button>

          {/* Nút Xóa Lùi (⌫) */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 sm:h-15 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-white/70 font-bold text-sm border border-white/5 transition-all active:scale-95 flex items-center justify-center"
            title="Xóa lùi"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
