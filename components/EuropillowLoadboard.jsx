"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Truck, PackageSearch, Search } from "lucide-react";

/* ============================================
   STATUS STYLES
=============================================== */
const STATUS_STYLES = {
  Created: {
    pill: "bg-slate-800 text-slate-100 border border-slate-600",
    dot: "bg-slate-300",
  },
  "At Pickup": {
    pill: "bg-indigo-900 text-indigo-100 border border-indigo-700",
    dot: "bg-indigo-300",
  },
  "In Transit": {
    pill: "bg-blue-900 text-blue-100 border border-blue-700",
    dot: "bg-blue-300",
  },
  "At Hub": {
    pill: "bg-amber-900 text-amber-50 border border-amber-700",
    dot: "bg-amber-300",
  },
  "Out-For-Delivery": {
    pill: "bg-teal-900 text-teal-50 border border-teal-700",
    dot: "bg-teal-300",
  },
  Delayed: {
    pill: "bg-red-900 text-red-50 border border-red-700",
    dot: "bg-red-300",
  },
  Delivered: {
    pill: "bg-emerald-900 text-emerald-50 border border-emerald-700",
    dot: "bg-emerald-300",
  },
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["In Transit"];
  const Icon =
    status === "Delayed" ? AlertTriangle : status === "Delivered" ? Truck : PackageSearch;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium ${s.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function fmtKg(n) {
  if (n == null) return "";
  return (
    new Intl.NumberFormat("es-ES", {
      maximumFractionDigits: 0,
    }).format(n) + " kg"
  );
}

function fmtMoney(value) {
  if (value == null || value === "") return "";
  const num =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (Number.isNaN(num)) return "";
  return (
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num) + " €"
  );
}

function fmtInt(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(num);
}

/* ============================================
   NORMALIZE
=============================================== */
function normalizeShipment(raw) {
  const lastCheckpoint =
    raw?.checkpoints && raw.checkpoints.length
      ? raw.checkpoints[raw.checkpoints.length - 1]
      : null;

  return {
    id: raw.id ?? "",
    originCity: raw.origin_city ?? "",
    originCountry: raw.origin_country ?? "",
    destCity: raw.dest_city ?? "",
    destCountry: raw.dest_country ?? "",
    productType: raw.product_type ?? "",
    carrier: raw.carrier ?? "",
    pieces: raw.pieces ?? null,
    weightKg: raw.weight_kg ?? null,
    status: raw.status ?? "In Transit",
    eta: raw.eta ?? null,
    lastSeen: raw.last_seen ?? null,
    currentLoc: raw.current_loc ?? "",
    lastCheckpointLabel: lastCheckpoint?.label ?? "",
    lastCheckpointTs: lastCheckpoint?.ts ?? null,
    contactName: raw.contact?.name ?? "",

    // Excel-enriched fields
    fecha: raw.fecha ?? null,
    expOri: raw.exp_ori ?? "",
    remitente: raw.remitente ?? "",
    consignatario: raw.consignatario ?? "",
    portes: raw.portes ?? null,
    reexp: raw.reexp ?? null,
    reemb: raw.reemb ?? null,
    gReem: raw.g_reem ?? null,
    desemb: raw.desemb ?? null,
    seguro: raw.seguro ?? null,
    iva: raw.iva ?? null,
    total: raw.total ?? null,
    paymentType: raw.payment_type ?? "", // np. "P"
  };
}

/* ============================================
   SUMMARY (ilościowe)
=============================================== */
function computeStats(shipments) {
  return {
    total: shipments.length,
    delivered: shipments.filter((s) => s.status === "Delivered").length,
    inTransit: shipments.filter(
      (s) => s.status === "In Transit" || s.status === "Out-For-Delivery"
    ).length,
    totalPieces: shipments.reduce((a, b) => a + (b.pieces || 0), 0),
    totalWeight: shipments.reduce((a, b) => a + (b.weightKg || 0), 0),
  };
}

/* ============================================
   SUMMARY (finansowe PAGADOS / DEBIDOS / TOTALES)
=============================================== */
function calculatePaymentSummary(shipments) {
  const initial = {
    paid: { pieces: 0, kg: 0, portes: 0, iva: 0, total: 0, count: 0 },
    due: { pieces: 0, kg: 0, portes: 0, iva: 0, total: 0, count: 0 },
  };

  const acc = shipments.reduce((acc, s) => {
    // mapowanie z naszego JSON-a:
    // P -> paid, D -> due (reszta ignorowana)
    const status =
      s.paymentType === "P"
        ? "paid"
        : s.paymentType === "D"
        ? "due"
        : null;

    if (!status) return acc;

    acc[status].pieces += s.pieces || 0;
    acc[status].kg += s.weightKg || 0;
    acc[status].portes += Number(s.portes || 0);
    acc[status].iva += Number(s.iva || 0);
    acc[status].total += Number(s.total || 0);
    acc[status].count += 1;
    return acc;
  }, initial);

  const totals = {
    pieces: acc.paid.pieces + acc.due.pieces,
    kg: acc.paid.kg + acc.due.kg,
    portes: acc.paid.portes + acc.due.portes,
    iva: acc.paid.iva + acc.due.iva,
    total: acc.paid.total + acc.due.total,
    count: acc.paid.count + acc.due.count,
  };

  return { paid: acc.paid, due: acc.due, totals };
}

/* ============================================
   MAIN WRAPPER
=============================================== */
export default function EuropillowLoadboard({ initialShipments = [] }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <LoadboardContent initialShipments={initialShipments} />
    </div>
  );
}

/* ============================================
   LOADBOARD CONTENT
=============================================== */
function LoadboardContent({ initialShipments = [] }) {
  const normalized = useMemo(
    () =>
      initialShipments
        .filter((s) => s.id && s.id !== "TOTALES")
        .map((s) => normalizeShipment(s)),
    [initialShipments]
  );

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return normalized;
    const q = search.toLowerCase();
    return normalized.filter((s) =>
      [
        s.id,
        s.originCity,
        s.destCity,
        s.remitente,
        s.consignatario,
        s.carrier,
      ]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [search, normalized]);

  const stats = computeStats(normalized);
  const paymentSummary = useMemo(
    () => calculatePaymentSummary(normalized),
    [normalized]
  );

  return (
    <div className="space-y-4 px-4 py-4">
      {/* ====== NOWY HEADER FINANSOWY (PAGADOS / DEBIDOS / TOTALES) ====== */}
      <FinanceSummaryHeader summary={paymentSummary} />

      {/* ====== ISTNIEJĄCE KARTY STATYSTYK ====== */}
      <section className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="Total shipments" value={stats.total} />
        <SummaryCard label="Delivered" value={stats.delivered} type="success" />
        <SummaryCard label="In transit / OFD" value={stats.inTransit} type="info" />
        <SummaryCard label="Total pieces" value={stats.totalPieces} />
        <SummaryCard label="Total weight" value={fmtKg(stats.totalWeight)} />
      </section>

      {/* SEARCH */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search shipments..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-8 py-2 text-xs text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-slate-500">
          Showing {filtered.length} of {normalized.length}
        </p>
      </section>

      {/* TABLE */}
      <section className="w-full rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/40 overflow-hidden">
        <table className="w-full table-fixed border-collapse text-[8px] md:text-[9px]">
          <thead className="bg-slate-900/90">
            <tr className="border-b border-slate-800 uppercase tracking-wide text-slate-400">
              <Th className="w-[65px]">ID</Th>
              <Th className="w-[75px]">Origin</Th>
              <Th className="w-[95px]">Destination</Th>
              <Th className="w-[135px]">Remitente</Th>
              <Th className="w-[135px]">Consignatario</Th>
              <Th className="w-[48px] text-right">Pcs</Th>
              <Th className="w-[60px] text-right">Kg</Th>
              <Th className="w-[60px] text-right">Portes</Th>
              <Th className="w-[55px] text-right">Reexp</Th>
              <Th className="w-[55px] text-right">Reemb</Th>
              <Th className="w-[55px] text-right">G.R.</Th>
              <Th className="w-[55px] text-right">Desemb</Th>
              <Th className="w-[55px] text-right">Seguro</Th>
              <Th className="w-[55px] text-right">IVA</Th>
              <Th className="w-[65px] text-right">Total</Th>
              <Th className="w-[30px] text-center">?</Th>
              <Th className="w-[65px]">Product</Th>
              <Th className="w-[75px]">Carrier</Th>
              <Th className="w-[80px]">Status</Th>
              <Th className="w-[100px]">ETA</Th>
              <Th className="w-[100px]">Last seen</Th>
              <Th className="w-[110px]">Location</Th>
              <Th className="w-[120px]">Checkpoint</Th>
              <Th className="w-[90px]">Contact</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-800/60 hover:bg-slate-800/60"
              >
                <Td className="font-mono whitespace-nowrap">{s.id}</Td>
                <Td>{s.originCity}</Td>
                <Td>{s.destCity}</Td>
                <Td className="truncate">{s.remitente}</Td>
                <Td className="truncate">{s.consignatario}</Td>

                <Td className="text-right tabular-nums">{s.pieces}</Td>
                <Td className="text-right tabular-nums">{fmtKg(s.weightKg)}</Td>

                <Td className="text-right tabular-nums">{fmtMoney(s.portes)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.reexp)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.reemb)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.gReem)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.desemb)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.seguro)}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(s.iva)}</Td>

                <Td className="text-right font-semibold text-emerald-400 tabular-nums">
                  {fmtMoney(s.total)}
                </Td>

                <Td className="text-center">{s.paymentType}</Td>

                <Td className="truncate">{s.productType}</Td>
                <Td className="truncate">{s.carrier}</Td>

                <Td>
                  <StatusPill status={s.status} />
                </Td>

                <Td className="whitespace-nowrap">
                  {formatDateTime(s.eta)}
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(s.lastSeen)}
                </Td>
                <Td className="truncate">{s.currentLoc}</Td>

                <Td>
                  <div className="flex flex-col">
                    <span className="truncate">{s.lastCheckpointLabel}</span>
                    <span className="text-[8px] text-slate-400 whitespace-nowrap">
                      {formatDateTime(s.lastCheckpointTs)}
                    </span>
                  </div>
                </Td>

                <Td className="truncate">{s.contactName}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ============================================
   SUMMARY CARDS (ILOŚCIOWE)
=============================================== */
function SummaryCard({ label, value, type }) {
  const base =
    "rounded-xl border px-3 py-2 text-xs md:text-sm flex flex-col gap-1 shadow-sm";
  const palette =
    type === "success"
      ? "border-emerald-700/70 bg-emerald-900/40 text-emerald-50"
      : type === "info"
      ? "border-sky-700/70 bg-sky-900/30 text-sky-50"
      : "border-slate-700/70 bg-slate-900/40 text-slate-50";

  return (
    <div className={`${base} ${palette}`}>
      <span className="text-[11px] uppercase tracking-wide text-slate-300/80">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/* ============================================
   NOWE KOMPONENTY FINANSOWE (HEADER)
=============================================== */
function FinanceSummaryHeader({ summary }) {
  const { paid, due, totals } = summary;

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl backdrop-blur flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinanceSummaryCard title="PAGADOS" currency="EUR" color="emerald" data={paid} />
        <FinanceSummaryCard title="DEBIDOS" currency="EUR" color="amber" data={due} />
        <FinanceSummaryCard title="TOTALES" currency="EUR" color="sky" data={totals} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
        <span>
          Resumen del periodo filtrado (ej. hoy / esta semana / rango de fechas).
        </span>
        <span className="italic">
          Los datos se calculan automáticamente a partir de las filas del loadboard.
        </span>
      </div>
    </div>
  );
}

function FinanceSummaryCard({ title, currency, color, data }) {
  const borderColor =
    color === "emerald"
      ? "border-emerald-700/50"
      : color === "amber"
      ? "border-amber-700/40"
      : "border-sky-700/60";

  const bgColor =
    color === "emerald"
      ? "bg-emerald-900/20"
      : color === "amber"
      ? "bg-amber-900/15"
      : "bg-sky-900/20";

  const titleColor =
    color === "emerald"
      ? "text-emerald-300"
      : color === "amber"
      ? "text-amber-300"
      : "text-sky-300";

  const chipBg =
    color === "emerald"
      ? "bg-emerald-800/60 text-emerald-100/90"
      : color === "amber"
      ? "bg-amber-800/60 text-amber-100/90"
      : "bg-sky-800/60 text-sky-100/90";

  return (
    <div
      className={`rounded-2xl border ${borderColor} ${bgColor} px-4 py-3 flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>
          {title}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${chipBg}`}>
          {currency}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
        <FinanceStat label="BULTOS" value={fmtInt(data.pieces)} />
        <FinanceStat label="KG" value={fmtInt(data.kg)} />
        <FinanceStat label="PORTES" value={fmtMoney(data.portes)} />
        <FinanceStat label="IVA" value={fmtMoney(data.iva)} />
        <FinanceStat label="TOTAL" value={fmtMoney(data.total)} emphasis />
        <FinanceStat label="Nº ALB." value={fmtInt(data.count)} />
      </div>
    </div>
  );
}

function FinanceStat({ label, value, emphasis }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <span
        className={
          "text-xs tabular-nums" +
          (emphasis ? " font-semibold text-slate-50" : " text-slate-100")
        }
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================
   TABLE HELPERS
=============================================== */
function Th({ children, className = "" }) {
  return (
    <th
      className={`px-1 py-0.5 text-left align-middle text-[8px] md:text-[9px] ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`px-1 py-0.5 align-top text-slate-100 text-[8px] md:text-[9px] ${className}`}
    >
      {children}
    </td>
  );
}
