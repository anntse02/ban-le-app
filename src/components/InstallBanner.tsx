"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem("install_banner_dismissed");
    if (!dismissed) {
      setIsDismissed(false);
    }
    
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    } else {
      setIsStandalone(false);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (isStandalone || isDismissed) return null;
  // If not iOS and no prompt available, wait until prompt fires (Android/Desktop)
  if (!isIOS && !deferredPrompt) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("install_banner_dismissed", "true");
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-1.5 sm:px-4 mt-2">
        <div className="bg-indigo-600 text-white px-3 py-2 flex items-center justify-between shadow-md rounded-xl animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="flex items-center gap-2.5 z-10">
            <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
              <Smartphone className="w-5 h-5 text-indigo-50 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bold leading-tight">Cài đặt App ra Màn Hình</span>
              <span className="text-[10px] sm:text-xs text-indigo-100 line-clamp-1">Khởi động nhanh, mượt như app thật</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 z-10 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-white text-indigo-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cài Ngay</span>
            </button>
            <button onClick={handleDismiss} className="p-1 hover:bg-white/20 rounded-full transition text-indigo-200 hover:text-white" title="Đóng">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIOSPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-12 sm:items-center sm:pb-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm relative animate-slide-up sm:animate-fade-in shadow-2xl">
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Cài đặt lên iPhone/iPad</h3>
              <p className="text-sm text-slate-500 mt-1">Apple không hỗ trợ cài tự động. Hãy làm theo 2 bước sau:</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-700 leading-snug">
                  1. Nhấn nút <b className="text-blue-600">Chia sẻ</b> (Share) ở menu dưới cùng hoặc trên cùng của Safari.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="bg-slate-200 text-slate-600 p-2.5 rounded-xl shrink-0 flex items-center justify-center w-10 h-10">
                  <span className="font-black text-xl leading-none">+</span>
                </div>
                <p className="text-sm text-slate-700 leading-snug">
                  2. Cuộn xuống chọn <b className="text-slate-900">Thêm vào MH chính</b> (Add to Home Screen).
                </p>
              </div>
            </div>
            
            <div className="mt-6 text-center text-slate-400 text-xs font-medium">
              Bạn có thể vuốt xuống để đóng hướng dẫn này.
            </div>
          </div>
        </div>
      )}
    </>
  );
}