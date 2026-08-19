import React from "react";
import { getSourceMetadata, DataFreshnessStatus, DataValidityStatus } from "../utils/sourceColorMap";

interface DataSourceBadgeProps {
  source?: string;
  customLabel?: string;
  freshness?: DataFreshnessStatus;
  validity?: DataValidityStatus;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source = "MOOMOO_OPEND",
  customLabel,
  freshness = "FRESH",
  validity = "VALID",
  size = "sm",
  showDot = true,
  className = "",
}) => {
  const meta = getSourceMetadata(source);

  const freshnessDotClass =
    freshness === "FRESH"
      ? "bg-emerald-400 animate-pulse"
      : freshness === "DELAYED"
      ? "bg-amber-400"
      : "bg-rose-400";

  const isSmall = size === "sm";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-200 cursor-default select-none ${
        meta.badgeClass
      } ${isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs font-semibold"} ${className}`}
      title={`${meta.label} (${meta.description}) · 时效: ${freshness} · 校验: ${validity} · 置信度: ${(meta.defaultReliability * 100).toFixed(0)}%`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${freshnessDotClass}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${freshnessDotClass}`} />
        </span>
      )}
      <span className="font-mono">{customLabel || meta.shortLabel}</span>
      {validity === "CROSS_FLAGGED" && (
        <span className="text-[9px] text-amber-300 font-bold" title="多源比对微幅偏离已校验">
          ⚠️
        </span>
      )}
    </div>
  );
};
