import React, { useMemo, useState, useEffect } from "react";
import { fmtCurrency } from "@/lib/finance";

// export const PNL_MAPPING = {
//   "iGV income": ["7001-EX-RV-LC", "7002-EX-RV-LC", "7003-EX-RV-LC", "7004-EX-RV-LC", "7005-EX-RV-LC"],
//   "iGT income": ["7009-EX-RV-LC", "7010-EX-RV-LC", "7011-EX-RV-LC", "7012-EX-RV-LC", "7016-EX-RV-LC", "7017-EX-RV-LC", "7018-EX-RV-LC", "7019-EX-RV-LC"],
//   "oGV income": ["7006-EX-RV-LC", "7007-EX-RV-LC", "7008-EX-RV-LC"],
//   "oGT income": ["7013-EX-RV-LC", "7014-EX-RV-LC", "7015-EX-RV-LC", "7020-EX-RV-LC", "7021-EX-RV-LC", "7022-EX-RV-LC"],
//   "iGV expenses": ["7601-EX-CO-LC", "7602-EX-CO-LC", "7603-EX-CO-LC", "7604-EX-CO-LC"],
//   "iGT expenses": ["7608-EX-CO-LC", "7609-EX-CO-LC", "7610-EX-CO-LC", "7614-EX-CO-LC", "7615-EX-CO-LC", "7616-EX-CO-LC"],
//   "oGV expenses": ["7605-EX-CO-LC", "7606-EX-CO-LC", "7607-EX-CO-LC"],
//   "oGT expenses": ["7611-EX-CO-LC", "7612-EX-CO-LC", "7613-EX-CO-LC", "7617-EX-CO-LC", "7618-EX-CO-LC", "7619-EX-CO-LC"],
// };

export interface FnRow {
  entity_id: string;
  period_month: string;
  function_code: string;
  amount: number;
}

export interface PnLReportProps {
  revenue: FnRow[];
  costs: FnRow[];
  isSplit?: boolean;
}

type YearMap = Record<string, number>;

export function PnLReport({ revenue, costs, isSplit = false }: PnLReportProps) {
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    [...revenue, ...costs].forEach(r => {
      if (r.period_month) years.add(r.period_month.substring(0, 4));
    });
    return Array.from(years).sort();
  }, [revenue, costs]);

  const [selectedYears, setSelectedYears] = useState<string[]>([]);

  useEffect(() => {
    // Initialize with all available years if empty, or keep existing selection valid
    setSelectedYears(prev => {
      if (prev.length === 0 && availableYears.length > 0) return [...availableYears];
      return prev;
    });
  }, [availableYears]);

  const data = useMemo(() => {
    const getRevByYear = (fnCode: string): YearMap => {
      const res: YearMap = {};
      selectedYears.forEach(y => (res[y] = 0));
      revenue.filter((r) => r.function_code === fnCode).forEach(r => {
        const y = r.period_month.substring(0, 4);
        if (selectedYears.includes(y)) res[y] += Number(r.amount);
      });
      return res;
    };

    const getCostByYear = (fnCode: string): YearMap => {
      const res: YearMap = {};
      selectedYears.forEach(y => (res[y] = 0));
      costs.filter((c) => c.function_code === fnCode).forEach(c => {
        const y = c.period_month.substring(0, 4);
        if (selectedYears.includes(y)) res[y] += Number(c.amount);
      });
      return res;
    };

    const sumMaps = (...maps: YearMap[]): YearMap => {
      const res: YearMap = {};
      selectedYears.forEach(y => {
        res[y] = maps.reduce((sum, m) => sum + (m[y] || 0), 0);
      });
      return res;
    };

    const diffMaps = (map1: YearMap, map2: YearMap): YearMap => {
      const res: YearMap = {};
      selectedYears.forEach(y => {
        res[y] = (map1[y] || 0) - (map2[y] || 0);
      });
      return res;
    };

    const zeroMap: YearMap = {};
    selectedYears.forEach(y => (zeroMap[y] = 0));

    // Direct Profit / Loss
    const iGvIncome = getRevByYear("iGV");
    const iGtIncome = getRevByYear("iGT");
    const oGvIncome = getRevByYear("oGV");
    const oGtIncome = getRevByYear("oGT");
    const eldIncome = sumMaps(iGvIncome, iGtIncome, oGvIncome, oGtIncome);

    const iGvExpenses = getCostByYear("iGV");
    const iGtExpenses = getCostByYear("iGT");
    const oGvExpenses = getCostByYear("oGV");
    const oGtExpenses = getCostByYear("oGT");
    const eldExpenses = sumMaps(iGvExpenses, iGtExpenses, oGvExpenses, oGtExpenses);

    const grossProfitLoss = diffMaps(eldIncome, eldExpenses);

    // Total Income & Expenses
    const ewaIncome = getRevByYear("EwA");
    const confIncome = getRevByYear("Conference");
    const pmIncome = zeroMap;
    const miscIncome = getRevByYear("Miscellaneous");
    
    const totalIncome = sumMaps(eldIncome, ewaIncome, confIncome, pmIncome, miscIncome);

    const ewaExpenses = getCostByYear("EwA");
    const confExpenses = getCostByYear("Conference");
    const natConfExpenses = getCostByYear("National Conference Delegation");
    const nmfExpenses = getCostByYear("NMF");
    const pmExpenses = zeroMap;
    const miscExpenses = getCostByYear("Miscellaneous");

    const totalExpenses = sumMaps(eldExpenses, ewaExpenses, confExpenses, natConfExpenses, nmfExpenses, pmExpenses, miscExpenses);

    const netProfitLoss = diffMaps(totalIncome, totalExpenses);

    return {
      "iGV income": iGvIncome,
      "iGT income": iGtIncome,
      "oGV income": oGvIncome,
      "oGT income": oGtIncome,
      "ELD income": eldIncome,
      "iGV expenses": iGvExpenses,
      "iGT expenses": iGtExpenses,
      "oGV expenses": oGvExpenses,
      "oGT expenses": oGtExpenses,
      "ELD expenses": eldExpenses,
      "Gross Profit/Loss": grossProfitLoss,
      "EwA income": ewaIncome,
      "Conference income": confIncome,
      "Project management income": pmIncome,
      "Miscellaneous income": miscIncome,
      "Total income": totalIncome,
      "EwA expenses": ewaExpenses,
      "Conference expenses": confExpenses,
      "National conference expenses": natConfExpenses,
      "NMF expenses": nmfExpenses,
      "Project management expenses": pmExpenses,
      "Miscellaneous expenses": miscExpenses,
      "Total expenses": totalExpenses,
      "Net Profit/Loss": netProfitLoss
    };
  }, [revenue, costs, selectedYears]);

  const toggleYear = (year: string) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) return prev.filter(y => y !== year);
      return [...prev, year].sort();
    });
  };

  const renderRow = (label: string, styleClass: string = "hover:bg-muted/30", valClass: string = "") => {
    const map = data[label as keyof typeof data] as YearMap;
    
    const getCellColor = (val: number) => {
      if (label === "Gross Profit/Loss" || label === "Net Profit/Loss") {
        return val >= 0 ? "text-green-600" : "text-red-600";
      }
      return valClass;
    };

    const cellPadding = isSplit ? "px-2 py-1.5" : "px-4 py-2";
    const textSize = isSplit ? "text-xs md:text-sm" : "text-sm";

    return (
      <tr className={`${styleClass} ${textSize}`}>
        <td className={`${cellPadding} ${styleClass.includes("bg-") ? "pl-2 md:pl-4" : "pl-4 md:pl-8"}`}>{label}</td>
        {selectedYears.map(y => (
          <td key={y} className={`${cellPadding} text-right ${getCellColor(map[y] || 0)}`}>{fmtCurrency(map[y])}</td>
        ))}
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Year Filter UI */}
      {availableYears.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-md border">
          <span className="text-sm font-medium text-muted-foreground">Compare Years:</span>
          {availableYears.map(year => (
            <label key={year} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input 
                type="checkbox" 
                className="rounded border-input text-primary focus:ring-primary"
                checked={selectedYears.includes(year)}
                onChange={() => toggleYear(year)}
              />
              {year}
            </label>
          ))}
        </div>
      )}

      {/* PnL Table */}
      <div className="rounded-md border bg-card overflow-x-auto w-full shadow-sm">
        <table className="min-w-full text-left text-muted-foreground">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className={`px-4 py-3 font-semibold text-foreground whitespace-nowrap min-w-[200px]`}>Profit & Loss Statement</th>
              {selectedYears.map(y => (
                <th key={y} className={`px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap ${isSplit ? 'w-24' : 'w-32'}`}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Direct Income */}
            {renderRow("iGV income")}
            {renderRow("iGT income")}
            {renderRow("oGV income")}
            {renderRow("oGT income")}
            {renderRow("ELD income", "bg-muted/10 font-medium text-foreground", "text-green-600")}

            {/* Direct Expenses */}
            {renderRow("iGV expenses")}
            {renderRow("iGT expenses")}
            {renderRow("oGV expenses")}
            {renderRow("oGT expenses")}
            {renderRow("ELD expenses", "bg-muted/10 font-medium text-foreground border-b-2", "text-red-600")}
            
            {/* Gross Profit/Loss */}
            {renderRow("Gross Profit/Loss", "bg-muted/30 font-semibold text-foreground border-b-2 text-base", "")}

            {/* Total Income Section */}
            {renderRow("ELD income")}
            {renderRow("EwA income")}
            {renderRow("Conference income")}
            {renderRow("Project management income")}
            {renderRow("Miscellaneous income")}
            {renderRow("Total income", "bg-muted/10 font-medium text-foreground border-b-2", "text-green-600")}

            {/* Total Expenses Section */}
            {renderRow("ELD expenses")}
            {renderRow("EwA expenses")}
            {renderRow("Conference expenses")}
            {renderRow("National conference expenses")}
            {renderRow("NMF expenses")}
            {renderRow("Project management expenses")}
            {renderRow("Miscellaneous expenses")}
            {renderRow("Total expenses", "bg-muted/10 font-medium text-foreground border-b-2", "text-red-600")}

            {/* Net Profit/Loss */}
            {renderRow("Net Profit/Loss", "bg-primary/10 font-bold text-foreground text-base", "")}
          </tbody>
        </table>
      </div>
    </div>
  );
}
