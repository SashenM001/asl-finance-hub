/**
 * Data Mapper: MASTER_COMBINED_TALL → Database Schema
 * * This mapper uses an Exact Dictionary approach based on AIESEC GFB Codes.
 * Every valid 4-digit code is explicitly defined below to guarantee 100% accuracy.
 */

import type { FunctionCode } from "@/lib/finance";

// ─── LC code → entity name mapping ──────────────────────────────────────────
export const LC_CODE_TO_NAME: Record<string, string> = {
  CC: "Colombo Central",
  CN: "Colombo North",
  CS: "Colombo South",
  Kandy: "Kandy",
  USJ: "USJ",
  NSBM: "NSBM",
  Ruhuna: "Ruhuna",
  Rajarata: "Rajarata",
  SLIIT: "SLIIT",
  NIBM: "NIBM",
  Wayamba: "Wayamba",
};

// ─── Types ──────────────────────────────────────────────────────────────────
export type RowCategory = "revenue" | "cost" | "balance_sheet" | "cash_flow" | "unknown";
export type BalanceField =
  | "bank_balance"
  | "assets"
  | "receivables"
  | "petty_cash" // 8502-CA-AS-LC: isolated for MoCR numerator (not merged into assets)
  | "reserves" // 8602-LA-AS-LC: isolated for MoCR numerator (not merged into assets)
  | "equity"
  | "liabilities"
  | "cash_inflow"
  | "cash_outflow"
  | null;

interface MappingDefinition {
  category: RowCategory;
  functionCode: FunctionCode | null;
  balanceField: BalanceField;
}

// ─── The Exact GFB Dictionary ───────────────────────────────────────────────
const GFB_DICTIONARY: Record<string, MappingDefinition> = {
  // === CASH FLOW: INFLOWS ===
  "1301-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: iGV
  "1302-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: oGV
  "1303-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: iGTa
  "1304-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: oGTa
  "1305-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: iGTe
  "1306-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Product: oGTe
  "1307-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from EwA: Youth Speak
  "1308-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from EwA: Heading the Future
  "1309-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Entity EwA initiatives
  "1310-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from EwA: Local Volunteer
  "1311-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Project Mgt: Conference and Meetings (National+Local)
  "1312-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Project Mgt: Conference and Meetings (International)
  "1313-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Project Mgt: Digital Engagements
  "1314-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipt from Project Mgt: Other Portfolio & Initiatives
  "1315-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Proj Mgt.: Grants, Donations, Subsidies
  "1316-OA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts from Miscellaneous Sales
  "1317-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Generated from Long Term Assets Sold
  "1318-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Collected for Receivables: Internal (Between LC & LC of Entity)
  "1319-IA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Collected for Receivables: External (Partners, AIESEC Entities, Others)
  "1320-FA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts for Liabilities: Internal (Between LC & LC/s of Entity)
  "1321-FA-CI-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_inflow" }, // LC | Cash Receipts for Liabilities: External (Partners, AIESEC Entities, Others)

  // === CASH FLOW: OUTFLOWS ===
  "1401-OA-CO-LC": { category: "cash_flow", functionCode: "iGV", balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGV Expenses
  "1402-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGV Quality Cases
  "1403-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGV Refunds
  "1404-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGV Expenses
  "1405-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGV Quality Cases
  "1406-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGV Refunds
  "1409-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTa Expenses
  "1410-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTa Quality Cases
  "1411-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTa Refunds
  "1412-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTa Expenses
  "1413-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTa Quality Cases
  "1414-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTa Refunds
  "1415-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTe Expenses
  "1416-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTe Quality Cases
  "1417-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: iGTe Refunds
  "1418-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTe Expenses
  "1419-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTe Quality Cases
  "1420-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Product: oGTe Refunds
  "1421-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EwA: Youth Speak
  "1422-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EwA: Heading the Future
  "1423-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Entity EwA initiatives
  "1424-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EwA: Local Volunteer
  "1425-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Project Mgt: Conference and Meetings (National+Local)
  "1426-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Project Mgt: Conference and Meetings (International)
  "1427-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Project Mgt: Parntership Logistics
  "1428-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Project Mgt: Other Portfolio & Initiatives
  "1429-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Bank Fee
  "1430-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Taxes
  "1431-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: Office Costs
  "1432-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: HR Costs
  "1433-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: Legality Costs
  "1434-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: Planning & LnD Costs
  "1435-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead Costs: Other Marketing
  "1436-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead Costs: PR & Branding
  "1437-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: Entity Coaching & Visits Costs
  "1438-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: National Conf. Travelling Costs
  "1439-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead: International Conf. Travelling + Visa Costs
  "1440-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Overhead Costs: (Platforms)
  "1441-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EAF: Products Royalty
  "1442-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EAF: Fixed Fee Payment
  "1443-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for EAF: Variable Fee Payment
  "1444-OA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Miscellaneous Sales
  "1445-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Spent for Long Term Assets Purchased
  "1446-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Given for Receivables: Internal (Between LC & LC of Entity)
  "1447-IA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Given for Receivables: External (Partners, AIESEC Entities, Others)
  "1448-FA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Liabilities: Internal (Between LC & LC/s of Entity)
  "1449-FA-CO-LC": { category: "cash_flow", functionCode: null, balanceField: "cash_outflow" }, // LC | Cash Payments for Liabilities: External (Partners, AIESEC Entities, Others)

  // === BALANCE SHEET: OPENING BALANCE ===
  // "1501-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "bank_balance" }, // LC | Opening Balance (Petty Cash + Bank Account)

  // === PNL: REVENUE ===
  "7001-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null }, // LC | Direct Revenue: iGV Partner Fee
  "7002-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null }, // LC | Direct Revenue: iGV Accommodation Fee
  "7003-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null }, // LC | Direct Revenue: iGV Refunds & Returns (contra account)
  "7004-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null }, // LC | Direct Revenue: iGV Discounts (contra account)
  "7005-EX-RV-LC": { category: "revenue", functionCode: "iGV", balanceField: null }, // LC | Direct Revenue: iGV Other
  "7006-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null }, // LC | Direct Revenue: oGV Program Fee
  "7007-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null }, // LC | Direct Revenue: oGV Refunds & Returns (contra account)
  "7008-EX-RV-LC": { category: "revenue", functionCode: "oGV", balanceField: null }, // LC | Direct Revenue: oGV Discounts (contra account)
  "7009-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTa Partner Fee
  "7010-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTa Refunds & Returns (contra account)
  "7011-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTa Discounts (contra account)
  "7012-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTa Other
  "7013-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTa Program Fee
  "7014-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTa Refunds & Returns (contra account)
  "7015-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTa Discounts (contra account)
  "7016-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTe Partner Fee
  "7017-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTe Refunds & Returns (contra account)
  "7018-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTe Discounts (contra account)
  "7019-EX-RV-LC": { category: "revenue", functionCode: "iGT", balanceField: null }, // LC | Direct Revenue: iGTe Other
  "7020-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTe Program Fee
  "7021-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTe Refunds & Returns (contra account)
  "7022-EX-RV-LC": { category: "revenue", functionCode: "oGT", balanceField: null }, // LC | Direct Revenue: oGTe Discounts (contra account)
  "7101-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: YouthSpeak Partner Fee
  "7102-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: YouthSpeak Participant Fee
  "7103-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: YouthSpeak Others
  "7104-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: Heading the Future Participant Fee
  "7105-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: Heading the Future Partner Fee
  "7106-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: Heading the Future Refunds & Returns (contra account)
  "7107-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: Heading the Future Discounts (contra account)
  "7108-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenue: Heading the Future Others
  "7109-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenues: Entity EwA Initiatives Participant Fee
  "7110-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenues: Entity EwA Initiatives Partner Fee
  "7111-EA-RV-LC": { category: "revenue", functionCode: "EwA", balanceField: null }, // LC | EwA Revenues: Local Volunteer
  "7301-MG-RV-LC": { category: "revenue", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Revenue: Conference and Meetings (National+Local) Participant Fee
  "7302-MG-RV-LC": { category: "revenue", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Revenue: Conference and Meetings (National+Local) Partner Fee
  "7303-MG-RV-LC": { category: "revenue", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Revenue: Conference and Meetings (International) Participant Fee
  "7304-MG-RV-LC": { category: "revenue", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Revenue: Conference and Meetings (International) Partner Fee
  "7305-MG-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Revenue: Digital Engagement Participant Fee
  "7306-MG-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Revenue: Digital Engagement Partner Fee
  "7307-MG-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Revenue: Other Portfolio & Initiatives Partner Fee
  "7308-MG-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Revenue: Other Portfolio & Initiatives Participant Fee
  "7309-MG-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Revenue: Grants, Donations, Subsidies
  "7501-NE-RV-LC": { category: "revenue", functionCode: "Miscellaneous", balanceField: null }, // LC | Miscellaneous Revenue

  // === PNL: COSTS ===
  "7601-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null }, // LC | Direct Costs: iGV Marketing
  "7602-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null }, // LC | Direct Costs: iGV Accommodation
  "7603-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null }, // LC | Direct Costs: iGV Quality Cases
  "7604-EX-CO-LC": { category: "cost", functionCode: "iGV", balanceField: null }, // LC | Direct Costs: iGV Other
  "7605-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null }, // LC | Direct Costs: oGV Marketing
  "7606-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null }, // LC | Direct Costs: oGV Quality Cases
  "7607-EX-CO-LC": { category: "cost", functionCode: "oGV", balanceField: null }, // LC | Direct Costs: oGV Other
  "7608-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTa Marketing
  "7609-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTa Quality Cases
  "7610-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTa Other
  "7611-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTa Marketing
  "7612-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTa Quality Cases
  "7613-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTa Other
  "7614-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTe Marketing
  "7615-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTe Quality Cases
  "7616-EX-CO-LC": { category: "cost", functionCode: "iGT", balanceField: null }, // LC | Direct Costs: iGTe Other
  "7617-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTe Marketing
  "7618-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTe Quality Cases
  "7619-EX-CO-LC": { category: "cost", functionCode: "oGT", balanceField: null }, // LC | Direct Costs: oGTe Other
  "7701-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Costs: YouthSpeak
  "7702-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Costs: YouthSpeak Marketing
  "7703-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Cost: Heading for the Future
  "7704-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Cost: Heading for the Future Marketing
  "7705-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Cost: Entity EwA Initiatives
  "7706-EA-CO-LC": { category: "cost", functionCode: "EwA", balanceField: null }, // LC | EwA Costs: Local Volunteer
  "7901-MG-CO-LC": { category: "cost", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Costs: Conference and Meetings (National+Local)
  "7902-MG-CO-LC": { category: "cost", functionCode: "Conference", balanceField: null }, // LC | Project Mgt Costs: Conference and Meetings (International)
  "7903-MG-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Costs: Digital Engagement
  "7904-MG-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Costs: Other Portfolio & Initiatives
  "7905-MG-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Project Mgt Costs: Partnership Logistics
  "8001-FN-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Bank Fees
  "8002-FN-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Taxes
  "8101-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: (Office)
  "8102-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: (HR)
  "8103-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: (Legality)
  "8104-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: (Planning & LnD)
  "8105-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: Other Marketing
  "8106-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: PR & Branding Costs
  "8108-OH-CO-LC": {
    category: "cost",
    functionCode: "National Conference Delegation",
    balanceField: null,
  }, // LC | Overhead Costs: (National Conf. Travelling)
  "8109-OH-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Overhead Costs: (International Conf. Travelling + Visa)
  "8201-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: iGV Royalty
  "8202-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: oGV Royalty
  "8203-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: iGTa Royalty
  "8204-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: oGTa Royalty
  "8205-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: iGTe Royalty
  "8206-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: oGTe Royalty
  "8207-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Costs: Fixed Payment
  "8208-IN-CO-LC": { category: "cost", functionCode: "NMF", balanceField: null }, // LC | Entity Affiliation Fee Revenue: Other Variable Payment. // Keeping as "cost" pending confirmation from finance team, despite "Revenue" in description
  "8401-NE-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Uncollectible Accounts Costs
  "8402-NE-CO-LC": { category: "cost", functionCode: "Miscellaneous", balanceField: null }, // LC | Miscellaneous Costs

  // === BALANCE SHEET: ASSETS, LIABILITIES, EQUITY ===
  "8501-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "bank_balance" }, // LC | Bank Account
  "8502-CA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "petty_cash" }, // LC | Petty Cash — isolated field for MoCR numerator; included in Total Assets on frontend
  "8601-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" }, // LC | Long Term Assets (Property)
  "8602-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "reserves" }, // LC | Long Term Assets (Reserves) — isolated field for MoCR numerator; included in Total Assets on frontend
  "8603-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" }, // LC | Long Term Assets (Financial Property)
  "8604-LA-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" }, // LC | Long Term Assets (Other)
  "8605-IN-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Long Term Receivables: Internal (AIESEC Entities)
  "8606-LR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Long Term Receivables: External (Partners)
  "8607-LR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Long Term Receivables: External (AIESEC Entities)
  "8609-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "assets" }, // LC | Prepaid Expenses
  "8611-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: Internal (AIESEC Entities)
  "8612-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: External (Members)
  "8613-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: External (Youth)
  "8614-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: External (Partners)
  "8615-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: External (AIESEC Entities)
  "8616-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: iGTa Partners (Salaries/Accommodation Transfer)
  "8617-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Short Term Receivables: iGTe Partners (Salaries Transfer)
  "8618-SR-AS-LC": { category: "balance_sheet", functionCode: null, balanceField: "receivables" }, // LC | Allowance for Uncollectible Accounts (contra account)
  "8701-EQ-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "equity" }, // LC | Equity
  "8801-IN-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Long Term Liabilities: Internal (AIESEC Entities)
  "8802-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Long Term Liabilities: External (Partners)
  "8803-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Long Term Liabilities: External (AIESEC Entities)
  "8805-LL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Long Term Liabilities: External (Other Externals)
  "8806-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Prepaid Incomes
  "8807-IN-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: Internal (AIESEC Entities)
  "8808-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: External (Members)
  "8809-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: External (AIESEC Entities)
  "8811-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: External (Other Externals)
  "8812-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: iGTa Exchange Participants (Salaries/Accommodation Transfer)
  "8813-SL-LE-LC": { category: "balance_sheet", functionCode: null, balanceField: "liabilities" }, // LC | Short Term Liabilities: iGTe Exchange Participants (Salaries Transfer)
};

export function getGfbMapping(gfbCode: string): MappingDefinition {
  // Use the exact full code (trimmed and uppercase to be safe)
  const cleanCode = gfbCode.trim().toUpperCase();

  // Return the mapped definition, or fallback if they invent a new code
  return (
    GFB_DICTIONARY[cleanCode] || { category: "unknown", functionCode: null, balanceField: null }
  );
}

// ─── Parsed row type ────────────────────────────────────────────────────────
export interface ParsedRow {
  lcCode: string;
  entityName: string;
  term: string;
  periodMonth: string; // YYYY-MM-DD
  reportType: string;
  gfbCode: string;
  description: string;
  amount: number;
  category: RowCategory;
  functionCode: FunctionCode | null;
  balanceField: BalanceField;
}

/**
 * Parse a single raw sheet row into a structured ParsedRow.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRow(row: any[]): ParsedRow | null {
  if (!row || row.length < 9) return null;

  const lcCode = String(row[0] || "").trim();
  const term = String(row[1] || "").trim();
  const date = String(row[4] || "").trim();
  const reportType = String(row[5] || "").trim();
  const gfbCode = String(row[6] || "").trim();
  const description = String(row[7] || "").trim();

  const amountStr = String(row[8] || "0").replace(/[^0-9.-]/g, "");
  const amount = parseFloat(amountStr) || 0;

  if (!lcCode || !date || !gfbCode) return null;

  const entityName = LC_CODE_TO_NAME[lcCode];
  if (!entityName) return null;

  // Normalize date to first-of-month
  const periodMonth = date.length >= 10 ? date.substring(0, 10) : null;
  if (!periodMonth) return null;

  // Perform lookup using our hardcoded dictionary
  const mapping = getGfbMapping(gfbCode);

  return {
    lcCode,
    entityName,
    term,
    periodMonth,
    reportType,
    gfbCode,
    description,
    amount,
    category: mapping.category,
    functionCode: mapping.functionCode,
    balanceField: mapping.balanceField,
  };
}
