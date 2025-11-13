"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Truck, PackageSearch, Search } from "lucide-react";

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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.pill}`}
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
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(n) + " kg";
}

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
  };
}

function computeStats(shipments) {
  const total = shipments.length;
  let delivered = 0;
  let inTransit = 0;
  let totalPieces = 0;
  let totalWeight = 0;

  for (const s of shipments) {
    if (s.status === "Delivered") delivered++;
    if (s.status === "In Transit" || s.status === "Out-For-Delivery") inTransit++;
    totalPieces += s.pieces || 0;
    totalWeight += s.weightKg || 0;
  }

  return {
    total,
    delivered,
    inTransit,
    totalPieces,
    totalWeight,
  };
}

export default function EuropillowLoadboard({ initialShipments = [] }) {
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
    const q = search.trim().toLowerCase();
    return normalized.filter((s) => {
      return (
        s.id.toLowerCase().includes(q) ||
        s.originCity.toLowerCase().includes(q) ||
        s.destCity.toLowerCase().includes(q) ||
        s.carrier.toLowerCase().includes(q) ||
        s.productType.toLowerCase().includes(q) ||
        s.currentLoc.toLowerCase().includes(q)
      );
    });
  }, [normalized, search]);

  const stats = useMemo(() => computeStats(normalized), [normalized]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="Total shipments" value={stats.total} />
        <SummaryCard label="Delivered" value={stats.delivered} type="success" />
        <SummaryCard label="In transit / OFD" value={stats.inTransit} type="info" />
        <SummaryCard label="Total pieces" value={stats.totalPieces} />
        <SummaryCard label="Total weight" value={fmtKg(stats.totalWeight)} />
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ID, city, carrier..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-8 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-200">{filtered.length}</span>{" "}
          of <span className="font-semibold text-slate-200">{normalized.length}</span>{" "}
          shipments
        </p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/40">
        <table className="min-w-full border-collapse text-xs md:text-sm">
          <thead className="bg-slate-900/80">
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-400">
              <Th>ID</Th>
              <Th>Origin</Th>
              <Th>Destination</Th>
              <Th>Product</Th>
              <Th>Carrier</Th>
              <Th className="text-right">Pieces</Th>
              <Th className="text-right">Weight</Th>
              <Th>Status</Th>
              <Th>ETA</Th>
              <Th>Last seen</Th>
              <Th>Current location</Th>
              <Th>Last checkpoint</Th>
              <Th>Contact</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-6 text-center text-sm text-slate-500">
                  No shipments match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/60"
                >
                  <Td className="font-mono text-[11px] md:text-xs">{s.id}</Td>

                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">{s.originCity}</span>
                      <span className="text-[11px] text-slate-400">
                        {s.originCountry}
                      </span>
                    </div>
                  </Td>

                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">{s.destCity}</span>
                      <span className="text-[11px] text-slate-400">
                        {s.destCountry}
                      </span>
                    </div>
                  </Td>

                  <Td>{s.productType}</Td>
                  <Td>{s.carrier}</Td>
                  <Td className="text-right tabular-nums">{s.pieces ?? ""}</Td>
                  <Td className="text-right tabular-nums">{fmtKg(s.weightKg)}</Td>

                  <Td>
                    <StatusPill status={s.status} />
                  </Td>

                  <Td>{formatDateTime(s.eta)}</Td>
                  <Td>{formatDateTime(s.lastSeen)}</Td>
                  <Td>{s.currentLoc}</Td>

                  <Td>
                    <div className="flex flex-col">
                      <span>{s.lastCheckpointLabel}</span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(s.lastCheckpointTs)}
                      </span>
                    </div>
                  </Td>

                  <Td>{s.contactName}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

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
    <th className={`px-3 py-2 text-left align-middle ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td className={`px-3 py-2 align-top text-slate-100 ${className}`}>{children}</td>
  );
}
