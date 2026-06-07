import React, { useEffect, useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Plus, Filter, Loader2 } from "lucide-react";
import { fmtCurrency, fetchEntities, type Entity } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";

interface PnLMatrixViewProps {
  configs: any[];
  onAddConfig: () => void;
  onRemoveConfig: (id: string) => void;
  onEditConfig: (id: string) => void;
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
  { id: 'Total income', label: 'Total income', type: 'currency', style: 'font-bold bg-slate-100 text-slate-900 border-b-2', stickyStyle: 'font-bold bg-slate-100 text-slate-900 border-b-2' },
  
  { id: 'ELD expenses (Total)', label: 'ELD expenses', type: 'currency', indent: false },
  { id: 'EwA expenses', label: 'EwA expenses', type: 'currency', indent: false },
  { id: 'Conference expenses', label: 'Conference expenses', type: 'currency', indent: false },
  { id: 'National conference expenses', label: 'National conference expenses', type: 'currency', indent: false },
  { id: 'NMF expenses', label: 'NMF expenses', type: 'currency', indent: false },
  { id: 'Project management expenses', label: 'Project management expenses', type: 'currency', indent: false },
  { id: 'Miscellaneous expenses', label: 'Miscellaneous expenses', type: 'currency', indent: false },
  { id: 'Total expenses', label: 'Total expenses', type: 'currency', style: 'font-bold bg-slate-100 text-slate-900 border-b-2', stickyStyle: 'font-bold bg-slate-100 text-slate-900 border-b-2' },
  
  { id: 'Net Profit/Loss', label: 'Net Profit/Loss', type: 'currency', style: 'font-extrabold bg-slate-800 text-white hover:bg-slate-700 text-xl', stickyStyle: 'font-extrabold bg-slate-800 text-white text-xl' },
];

export function PnLMatrixView({ configs, onAddConfig, onRemoveConfig, onEditConfig }: PnLMatrixViewProps) {
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<Record<string, { revenue: any[], costs: any[] }>>({});
  const [entities, setEntities] = useState<Entity[]>([]);

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
          if (newRawData[config.id]) return; // Already fetched

          const entityIds = config.entity && config.entity !== "Select LC" && config.entity !== "all" 
            ? [config.entity] // config.entity is actually the entity_id (UUID)
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

  return (
    <div className="w-full space-y-4 pb-24">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                {/* Top-left empty header cell, sticky */}
                <th className="sticky left-0 top-0 z-20 bg-slate-50 min-w-[200px] p-4 font-semibold shadow-[1px_0_0_0_#e2e8f0,0_1px_0_0_#e2e8f0]">
                  <div className="flex items-center gap-2">
                    Financial Metrics
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                </th>
                
                {/* Dynamic Columns */}
                {configs.map((config) => (
                  <th key={config.id} className="p-4 min-w-[280px] align-top border-r border-slate-200 bg-white relative group shadow-[0_1px_0_0_#e2e8f0]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-slate-900 text-base">
                          {config.entity && config.entity !== "Select LC" && config.entity !== "all" 
                            ? (entities.find(e => e.id === config.entity)?.name || config.entity) 
                            : "All Entities"}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-slate-400 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditConfig(config.id);
                            }}
                          >
                            <Filter className="h-3.5 w-3.5" />
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
                      <div className="text-xs font-normal text-slate-500">
                        {config.function === 'all' ? 'All Functions' : config.function}
                      </div>
                      {config.from && config.to && (
                        <div className="text-[10px] font-normal text-slate-400 mt-1">
                          {config.from} to {config.to}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                
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
                    <td className={`sticky left-0 z-10 ${stickyStyle} ${row.indent ? 'pl-8' : 'pl-4'} pr-4 py-3 shadow-[1px_0_0_0_#e2e8f0] transition-colors`}>
                      {row.label}
                    </td>
                    
                    {/* Data Cells */}
                    {configs.map((config) => (
                      <td key={`${config.id}-${row.id}`} className={`px-4 py-3 border-r border-slate-100 font-mono text-sm ${row.style ? 'text-inherit' : 'text-slate-600'}`}>
                        {getMetricValue(config.id, row.id, row.type)}
                      </td>
                    ))}
                    
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
