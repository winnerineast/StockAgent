import React, { useState } from "react";
import { Lock, Unlock, X, ShieldCheck } from "lucide-react";

interface TradeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (passwordMD5: string) => Promise<void>;
}

export const TradeUnlockModal: React.FC<TradeUnlockModalProps> = ({
  isOpen,
  onClose,
  onUnlock,
}) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      // 简单 MD5 处理逻辑或透传 MD5 字符串
      await onUnlock(password);
      setPassword("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-card w-full max-w-md border-slate-800 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">解锁 MooMoo 交易密码</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          解锁 MooMoo 交易密码后，系统可获得持仓、可用资金以及自动下单委托参数生成权限。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">6位交易密码或 MD5 哈希</label>
            <input
              type="password"
              placeholder="输入 MooMoo 6 位数字交易密码..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:from-amber-400 transition-all disabled:opacity-50"
          >
            {loading ? "正在验证解锁..." : "确认解锁 MooMoo 交易"}
          </button>
        </form>
      </div>
    </div>
  );
};
