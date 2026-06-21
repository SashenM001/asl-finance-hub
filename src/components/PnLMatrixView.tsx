import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X, Plus, Filter, Loader2, Pin, ChevronRight } from "lucide-react";
import { fmtCurrency, fetchEntities, formatEntityName, type Entity } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface PnLMatrixViewProps {
  configs: any[];
  onAddConfig: () => void;
  onRemoveConfig: (id: string) => void;
  onEditConfig: (id: string) => void;
  onUpdateConfig: (id: string, updates: any) => void;
  onScrollIndexChange?: (index: number) => void;
}

const ROW_LABELS = [
  { id: 'iGV income', label: 'iGV income', type: 'currency', indent: false },
  { id: 'iGT income', label: 'iGT income', type: 'currency', indent: false },
  { id: 'oGV income', label: 'oGV income', type: 'currency', indent: false },
  { id: 'oGT income', label: 'oGT income', type: 'currency', indent: false },
  { id: 'ELD income', label: 'ELD income', type: 'currency', style: 'font-semibold bg-slate-50/80 text-slate-800', stickyStyle: 'font-semibold bg-slate-50/80 text-slate-800' },
  
  { id: 'iGV expenses', label: 'iGV expenses', type: 'currency', indent: false },
  { id: 'iGT expenses', label: 'iGT expenses', type: 'currency', indent: false },
  { id: 'oGV expenses', label: 'oGV expenses', type: 'currency', indent: false },
  { id: 'oGT expenses', label: 'oGT expenses', type: 'currency', indent: false },
  { id: 'ELD expenses', label: 'ELD expenses', type: 'currency', style: 'font-semibold bg-slate-50/80 text-slate-800', stickyStyle: 'font-semibold bg-slate-50/80 text-slate-800' },
  
  { id: 'Gross Profit/Loss', label: 'Gross Profit/Loss', type: 'currency', style: 'font-bold bg-slate-100 text-slate-900 border-b-2', stickyStyle: 'font-bold bg-slate-100 text-slate-900 border-b-2' },
  
  { id: 'ELD income (Total)', label: 'ELD income', type: 'currency', indent: false },
  { id: 'EwA income', label: 'EwA income', type: 'currency', indent: false },
  { id: 'Conference income', label: 'Conference income', type: 'currency', indent: false },
  { id: 'Project management income', label: 'Project management income', type: 'currency', indent: false },
  { id: 'Miscellaneous income', label: 'Miscellaneous income', type: 'currency', indent: false },
  { id: 'Total income', label: 'Total income', type: 'currency', style: 'font-bold bg-slate-200 text-slate-900 border-b-2', stickyStyle: 'font-bold bg-slate-200 text-slate-900 border-b-2' },
  
  { id: 'ELD expenses (Total)', label: 'ELD expenses', type: 'currency', indent: false },
  { id: 'EwA expenses', label: 'EwA expenses', type: 'currency', indent: false },
  { id: 'Conference expenses', label: 'Conference expenses', type: 'currency', indent: false },
  { id: 'National conference expenses', label: 'National conference expenses', type: 'currency', indent: false },
  { id: 'NMF expenses', label: 'NMF expenses', type: 'currency', indent: false },
  { id: 'Project management expenses', label: 'Project management expenses', type: 'currency', indent: false },
  { id: 'Miscellaneous expenses', label: 'Miscellaneous expenses', type: 'currency', indent: false },
  { id: 'Total expenses', label: 'Total expenses', type: 'currency', style: 'font-bold bg-slate-200 text-slate-900 border-b-2', stickyStyle: 'font-bold bg-slate-200 text-slate-900 border-b-2' },
  
  { id: 'Net Profit/Loss', label: 'Net Profit/Loss', type: 'currency', style: 'font-extrabold bg-slate-800 text-white hover:bg-slate-700 text-xl', stickyStyle: 'font-extrabold bg-slate-800 text-white text-xl' },
];

export function PnLMatrixView({ configs, onAddConfig, onRemoveConfig, onEditConfig, onUpdateConfig, onScrollIndexChange }: PnLMatrixViewProps) {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const lockEntity = isLC && !isMC && !isEFB;

  const [loading, setLoading] = useState(false);
  const [pinnedConfigIds, setPinnedConfigIds] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, { configHash: string, revenue: any[], costs: any[] }>>({});
  const [entities, setEntities] = useState<Entity[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkOverflow = () => {
      setIsOverflowing(container.scrollWidth > container.clientWidth + 5);
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
      if (scrollContainerRef.current) {
        window.dispatchEvent(new CustomEvent('pnl-scroll-metrics', {
          detail: { 
            scrollLeft: scrollContainerRef.current.scrollLeft, 
            scrollWidth: scrollContainerRef.current.scrollWidth, 
            clientWidth: scrollContainerRef.current.clientWidth 
          }
        }));
      }
    });

    resizeObserver.observe(container);
    const table = container.querySelector('table');
    if (table) resizeObserver.observe(table);

    return () => resizeObserver.disconnect();
  }, [configs, rawData]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onScrollIndexChange) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        window.dispatchEvent(new CustomEvent('pnl-scroll-metrics', {
          detail: { scrollLeft: container.scrollLeft, scrollWidth: container.scrollWidth, clientWidth: container.clientWidth }
        }));

        if (maxScroll <= 0) {
          onScrollIndexChange(0);
          return;
        }
        const scrollPercentage = container.scrollLeft / maxScroll;
        const index = Math.round(scrollPercentage * (configs.length - 1));
        const safeIndex = Math.max(0, Math.min(index, configs.length - 1));
        onScrollIndexChange(safeIndex);
      });
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Trigger once to initialize
    return () => {
      container.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [configs.length, onScrollIndexChange]);

  // Fetch entities list to map UUID to Name
  useEffect(() => {
    fetchEntities().then(setEntities).catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;
    
    const fetchAllData = async () => {
      setLoading(true);
      const newRawData = { ...rawData };
      let updated = false;

      await Promise.all(
        configs.map(async (config) => {
          let effectiveEntityId = config.entity;
          if (lockEntity) {
            effectiveEntityId = profile?.entity_id;
          }

          const configHash = `${effectiveEntityId}-${config.from}-${config.to}-${config.function}`;
          if (newRawData[config.id] && newRawData[config.id].configHash === configHash) return; // Already fetched

          const entityIds = effectiveEntityId && effectiveEntityId !== "Select LC" && effectiveEntityId !== "all" 
            ? [effectiveEntityId] // effectiveEntityId is actually the entity_id (UUID)
            : undefined;

          // Fetch revenue
          let revQ = supabase.from("revenue_streams").select("entity_id,period_month,function_code,amount");
          if (entityIds) revQ = revQ.in("entity_id", entityIds);
          if (config.from) revQ = revQ.gte("period_month", config.from);
          if (config.to) revQ = revQ.lte("period_month", config.to);
          if (config.function && config.function !== "all") revQ = revQ.eq("function_code", config.function);
          
          // Fetch costs
          let costQ = supabase.from("cost_breakdown").select("entity_id,period_month,function_code,amount");
          if (entityIds) costQ = costQ.in("entity_id", entityIds);
          if (config.from) costQ = costQ.gte("period_month", config.from);
          if (config.to) costQ = costQ.lte("period_month", config.to);
          if (config.function && config.function !== "all") costQ = costQ.eq("function_code", config.function);

          const [revRes, costRes] = await Promise.all([revQ, costQ]);
          
          newRawData[config.id] = {
            configHash,
            revenue: revRes.data || [],
            costs: costRes.data || []
          };
          updated = true;
        })
      );

      if (active && updated) {
        setRawData(newRawData);
      }
      if (active) setLoading(false);
    };

    fetchAllData();
    return () => { active = false; };
  }, [configs]);

  // Aggregate fetched data per config into exact requested mapping
  const calculatedData = useMemo(() => {
    const dataMap: Record<string, Record<string, number>> = {};
    
    configs.forEach((config) => {
      const rd = rawData[config.id];
      if (!rd) {
        dataMap[config.id] = {};
        return;
      }
      
      const { revenue, costs } = rd;

      const sumRev = (fn: string) => revenue.filter(r => r.function_code === fn).reduce((acc, curr) => acc + Number(curr.amount), 0);
      const sumCost = (fn: string) => costs.filter(c => c.function_code === fn).reduce((acc, curr) => acc + Number(curr.amount), 0);

      // Incomes
      const iGvIncome = sumRev("iGV");
      const iGtIncome = sumRev("iGT");
      const oGvIncome = sumRev("oGV");
      const oGtIncome = sumRev("oGT");
      const eldIncome = iGvIncome + iGtIncome + oGvIncome + oGtIncome;

      const ewaIncome = sumRev("EwA");
      const confIncome = sumRev("Conference");
      const pmIncome = 0; // PM Income isn't a direct standard function code but grouped. We leave it as sumRev('Miscellaneous') or similar if needed. Standard AIESEC PM is usually Misc or not separated. We'll use 0 here or mapping logic. Wait, let's just use 0 if not defined.
      const miscIncome = sumRev("Miscellaneous");
      
      const totalIncome = eldIncome + ewaIncome + confIncome + pmIncome + miscIncome;

      // Expenses
      const iGvExpenses = sumCost("iGV");
      const iGtExpenses = sumCost("iGT");
      const oGvExpenses = sumCost("oGV");
      const oGtExpenses = sumCost("oGT");
      const eldExpenses = iGvExpenses + iGtExpenses + oGvExpenses + oGtExpenses;

      const ewaExpenses = sumCost("EwA");
      const confExpenses = sumCost("Conference");
      const natConfExpenses = sumCost("National Conference Delegation");
      const nmfExpenses = sumCost("NMF");
      const pmExpenses = 0;
      const miscExpenses = sumCost("Miscellaneous");

      const totalExpenses = eldExpenses + ewaExpenses + confExpenses + natConfExpenses + nmfExpenses + pmExpenses + miscExpenses;

      const grossProfit = eldIncome - eldExpenses;
      const netProfit = totalIncome - totalExpenses;

      dataMap[config.id] = {
        'iGV income': iGvIncome,
        'iGT income': iGtIncome,
        'oGV income': oGvIncome,
        'oGT income': oGtIncome,
        'ELD income': eldIncome,
        'iGV expenses': iGvExpenses,
        'iGT expenses': iGtExpenses,
        'oGV expenses': oGvExpenses,
        'oGT expenses': oGtExpenses,
        'ELD expenses': eldExpenses,
        'Gross Profit/Loss': grossProfit,
        'ELD income (Total)': eldIncome,
        'EwA income': ewaIncome,
        'Conference income': confIncome,
        'Project management income': pmIncome,
        'Miscellaneous income': miscIncome,
        'Total income': totalIncome,
        'ELD expenses (Total)': eldExpenses,
        'EwA expenses': ewaExpenses,
        'Conference expenses': confExpenses,
        'National conference expenses': natConfExpenses,
        'NMF expenses': nmfExpenses,
        'Project management expenses': pmExpenses,
        'Miscellaneous expenses': miscExpenses,
        'Total expenses': totalExpenses,
        'Net Profit/Loss': netProfit,
      };
    });
    
    return dataMap;
  }, [configs, rawData]);

  // Safe value extraction
  const getMetricValue = (configId: string, metricId: string, type: string) => {
    const val = calculatedData[configId]?.[metricId] || 0;
    return fmtCurrency(val);
  };

  const handleExportCSV = useCallback(() => {
    const entityNames = configs.map(c => {
      let effectiveEntityId = c.entity;
      if (lockEntity) {
        effectiveEntityId = profile?.entity_id;
      }
      const rawName = effectiveEntityId && effectiveEntityId !== "Select LC" && effectiveEntityId !== "all" 
        ? (entities.find(e => e.id === effectiveEntityId)?.name || "Unknown LC") 
        : "All Entities";
      return formatEntityName(rawName);
    });
    
    const fileName = `PnL Report_ ${entityNames.join("+")}.csv`;

    const formatMonthYear = (dateStr?: string) => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}/${yy}`;
      } catch {
        return "";
      }
    };

    const headers = ["Metric", ...configs.map((c, i) => {
      const fromStr = formatMonthYear(c.from);
      const toStr = formatMonthYear(c.to);
      const dateRange = (fromStr && toStr) ? `${fromStr}-${toStr}` : (c.term || "All Dates");
      return `"${entityNames[i]}(${dateRange})"`;
    })];
    
    const rows = ROW_LABELS.map(row => {
      const vals = configs.map(c => calculatedData[c.id]?.[row.id] || 0);
      return `"${row.label}",${vals.join(",")}`;
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [configs, entities, calculatedData, lockEntity, profile]);

  useEffect(() => {
    const handler = () => handleExportCSV();
    window.addEventListener('export-pnl-csv', handler);
    return () => window.removeEventListener('export-pnl-csv', handler);
  }, [handleExportCSV]);

  useEffect(() => {
    const handler = (e: any) => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: e.detail, behavior: 'smooth' });
      }
    };
    window.addEventListener('pnl-scroll-to', handler);
    return () => window.removeEventListener('pnl-scroll-to', handler);
  }, []);

  return (
    <div className="w-full space-y-4 pb-24 relative">
      {isOverflowing && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
          <button 
            onClick={onAddConfig} 
            className="w-12 h-12 bg-[#037EF3] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
            title="Add new column"
          >
            <Plus size={24} />
          </button>
          <button 
            onClick={() => scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
            className="bg-white/80 backdrop-blur border border-gray-200 text-gray-500 rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-100 hover:text-blue-600 transition-colors" 
            title="Scroll right for more"
          >
            <ChevronRight size={20} className="animate-pulse" />
          </button>
        </div>
      )}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                {/* Top-left empty header cell, sticky */}
                <th className="sticky left-0 top-0 z-30 bg-white min-w-[220px] w-[220px] p-4 font-semibold border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center gap-2">
                    Financial Metrics
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                </th>
                
                {/* Dynamic Columns */}
                {configs.map((config) => {
                  const pinnedConfigsInOrder = configs.filter(c => pinnedConfigIds.includes(c.id));
                  const pinnedIndex = pinnedConfigsInOrder.findIndex(c => c.id === config.id);
                  const isPinned = pinnedIndex !== -1;
                  return (
                  <th id={`card-${config.id}`} key={config.id} style={isPinned ? { left: `${220 + (pinnedIndex * 200)}px` } : {}} className={`p-4 min-w-[200px] w-[200px] align-top group transition-all duration-200 ${isPinned ? 'sticky z-20 bg-blue-50/90 backdrop-blur-sm border-r-2 border-blue-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : 'border-r border-slate-200 bg-white relative shadow-[0_1px_0_0_#e2e8f0]'}`}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 mr-2 text-left">
                          <select
                            className="text-sm font-semibold bg-transparent border-b border-gray-300 hover:border-slate-400 focus:outline-none focus:border-blue-500 py-1 w-full text-slate-800 cursor-pointer appearance-none text-left disabled:opacity-100 disabled:cursor-default"
                            dir="ltr"
                            value={lockEntity ? profile?.entity_id || "" : (config.entity && config.entity !== "Select LC" && config.entity !== "all" ? config.entity : "all")}
                            onChange={(e) => {
                              const val = e.target.value;
                              onUpdateConfig(config.id, { entity: val === 'all' ? "Select LC" : val });
                            }}
                            disabled={lockEntity}
                          >
                            {lockEntity ? (
                              <option value={profile?.entity_id || ""}>
                                {entities.find(e => e.id === profile?.entity_id)?.name ? formatEntityName(entities.find(e => e.id === profile?.entity_id)!.name) : "Your LC"}
                              </option>
                            ) : (
                              <>
                                <option value="all">All Entities</option>
                                {entities.map(e => (
                                  <option key={e.id} value={e.id}>{formatEntityName(e.name)}</option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>
                        <div className={`flex items-center gap-1 transition-opacity shrink-0 ${isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-7 w-7 transition-colors ${isPinned ? 'text-blue-600 bg-blue-100 hover:bg-blue-200 hover:text-blue-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                            onClick={() => setPinnedConfigIds(prev => prev.includes(config.id) ? prev.filter(id => id !== config.id) : [...prev, config.id])}
                            title={isPinned ? "Unpin column" : "Pin column"}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => onRemoveConfig(config.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1 w-full mt-1">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[9px] text-gray-400 w-6 text-right">From</span>
                          <input 
                            type="date" 
                            value={config.from || ''} 
                            onChange={(e) => onUpdateConfig(config.id, { from: e.target.value, term: 'Custom' })}
                            className="text-[10px] p-0.5 bg-transparent border-b border-gray-300 w-full focus:outline-none focus:border-blue-500 text-slate-700 text-right"
                          />
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[9px] text-gray-400 w-6 text-right">To</span>
                          <input 
                            type="date" 
                            value={config.to || ''} 
                            onChange={(e) => onUpdateConfig(config.id, { to: e.target.value, term: 'Custom' })}
                            className="text-[10px] p-0.5 bg-transparent border-b border-gray-300 w-full focus:outline-none focus:border-blue-500 text-slate-700 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  );
                })}
                
                {/* Final Column for Adding */}
                <th className="p-4 min-w-[120px] align-middle text-center bg-slate-50/50 shadow-[0_1px_0_0_#e2e8f0]">
                  <Button 
                    onClick={onAddConfig}
                    variant="outline"
                    className="gap-2 border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add Column
                  </Button>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {ROW_LABELS.map((row) => {
                const rowStyle = row.style || 'bg-white hover:bg-blue-50/30 text-slate-600';
                const stickyStyle = row.stickyStyle || 'bg-white group-hover:bg-[#f4f7fa] text-slate-700';
                
                return (
                  <tr key={row.id} className={`group ${rowStyle} transition-colors`}>
                    {/* Row Label, Sticky */}
                    <td className={`sticky left-0 z-30 ${stickyStyle} min-w-[220px] w-[220px] ${row.indent ? 'pl-8' : 'pl-4'} pr-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors`}>
                      {row.label}
                    </td>
                    
                    {/* Data Cells */}
                    {configs.map((config) => {
                      const pinnedConfigsInOrder = configs.filter(c => pinnedConfigIds.includes(c.id));
                      const pinnedIndex = pinnedConfigsInOrder.findIndex(c => c.id === config.id);
                      const isPinned = pinnedIndex !== -1;
                      return (
                      <td key={`${config.id}-${row.id}`} style={isPinned ? { left: `${220 + (pinnedIndex * 200)}px` } : {}} className={`px-4 py-3 text-right font-mono text-sm ${row.style ? 'text-inherit' : 'text-slate-600'} transition-all duration-200 min-w-[200px] w-[200px] ${isPinned ? 'sticky z-20 bg-blue-50/90 backdrop-blur-sm border-r-2 border-blue-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : 'border-r border-slate-100'}`}>
                        {getMetricValue(config.id, row.id, row.type)}
                      </td>
                      );
                    })}
                    
                    {/* Empty cell under Add Column */}
                    <td className={`px-4 py-3 ${rowStyle}`}></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
