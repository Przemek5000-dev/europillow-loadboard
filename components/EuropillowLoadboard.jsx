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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.pill}`}
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
  return new Intl.NumberFormat("es-ES", {}).format(n) + " kg";
}

function fmtMoney(value) {
  if (value == null || value === "") return "";
  const num =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (Number.isNaN(num)) return "";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num) + " €";
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

    // Excel enriched fields
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
    paymentType: raw.payment_type ?? "",
  };
}

/* ============================================
   SUMMARY
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
   MAIN COMPONENT — WRAPPER REMOVES WHITE AREA
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

  return (
    <div className="space-y-4 px-4 py-4">

      {/* SUMMARY CARDS */}
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
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-8 py-2 text-sm text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {normalized.length}
        </p>
      </section>

      {/* TABLE */}
      <section className="w-full rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/40 overflow-hidden">

        <table className="w-full table-fixed border-collapse text-[9px] md:text-[10px]">

          <thead className="bg-slate-900/90">
            <tr className="border-b border-slate-800 uppercase tracking-wide text-slate-400">
              <Th className="w-[70px]">ID</Th>
              <Th className="w-[80px]">Origin</Th>
              <Th className="w-[100px]">Destination</Th>
              <Th className="w-[150px]">Remitente</Th>
              <Th className="w-[150px]">Consignatario</Th>
              <Th className="w-[55px] text-right">Pcs</Th>
              <Th className="w-[70px] text-right">Kg</Th>
              <Th className="w-[65px] text-right">Portes</Th>
              <Th className="w-[60px] text-right">Reexp</Th>
              <Th className="w-[60px] text-right">Reemb</Th>
              <Th className="w-[60px] text-right">G.R.</Th>
              <Th className="w-[60px] text-right">Desemb</Th>
              <Th className="w-[60px] text-right">Seguro</Th>
              <Th className="w-[60px] text-right">IVA</Th>
              <Th className="w-[70px] text-right">Total</Th>
              <Th className="w-[35px] text-center">?</Th>
              <Th className="w-[70px]">Product</Th>
              <Th className="w-[80px]">Carrier</Th>
              <Th className="w-[90px]">Status</Th>
              <Th className="w-[110px]">ETA</Th>
              <Th className="w-[110px]">Last Seen</Th>
              <Th className="w-[120px]">Location</Th>
              <Th className="w-[130px]">Checkpoint</Th>
              <Th className="w-[100px]">Contact</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/60">

                <Td className="font-mono">{s.id}</Td>
                <Td>{s.originCity}</Td>
                <Td>{s.destCity}</Td>
                <Td className="truncate">{s.remitente}</Td>
                <Td className="truncate">{s.consignatario}</Td>

                <Td className="text-right">{s.pieces}</Td>
                <Td className="text-right">{fmtKg(s.weightKg)}</Td>

                <Td className="text-right">{fmtMoney(s.portes)}</Td>
                <Td className="text-right">{fmtMoney(s.reexp)}</Td>
                <Td className="text-right">{fmtMoney(s.reemb)}</Td>
                <Td className="text-right">{fmtMoney(s.gReem)}</Td>
                <Td className="text-right">{fmtMoney(s.desemb)}</Td>
                <Td className="text-right">{fmtMoney(s.seguro)}</Td>
                <Td className="text-right">{fmtMoney(s.iva)}</Td>

                <Td className="text-right font-semibold text-emerald-400">
                  {fmtMoney(s.total)}
                </Td>

                <Td className="text-center">{s.paymentType}</Td>

                <Td className="truncate">{s.productType}</Td>
                <Td className="truncate">{s.carrier}</Td>

                <Td><StatusPill status={s.status} /></Td>

                <Td>{formatDateTime(s.eta)}</Td>
                <Td>{formatDateTime(s.lastSeen)}</Td>
                <Td>{s.currentLoc}</Td>

                <Td>
                  <div className="flex flex-col">
                    <span className="truncate">{s.lastCheckpointLabel}</span>
                    <span className="text-[9px] text-slate-400 whitespace-nowrap">
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
   SMALL COMPONENTS
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

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-1.5 py-1 text-left align-middle text-[9px] md:text-[10px] ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`px-1.5 py-1 align-top text-slate-100 text-[9px] md:text-[10px]`}
    >
      {children}
    </td>
  );
}
