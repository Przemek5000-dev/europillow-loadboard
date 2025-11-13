"use client";
"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Truck, RefreshCcw, Maximize2, Minimize2, AlertTriangle, PackageSearch, Clock, ChevronUp, ChevronDown } from "lucide-react";


const STATUS_STYLES = {
  "Created": { pill: "bg-slate-100 text-slate-700", border: "border-l-slate-400" },
  "At Pickup": { pill: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-500" },
  "In Transit": { pill: "bg-blue-100 text-blue-700", border: "border-l-blue-500" },
  "At Hub": { pill: "bg-amber-100 text-amber-700", border: "border-l-amber-500" },
  "Out For Delivery": { pill: "bg-teal-100 text-teal-700", border: "border-l-teal-500" },
  "Delayed": { pill: "bg-red-100 text-red-700", border: "border-l-red-600" },
  "Delivered": { pill: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-600" }
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["In Transit"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.pill}`}>
      {status === 'Delayed'
        ? <AlertTriangle className="h-3.5 w-3.5" />
        : status === 'Delivered'
        ? <Truck className="h-3.5 w-3.5" />
        : <PackageSearch className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

function formatETA(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

function fmtKg(n) {
  if (n == null) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n) + " kg";
}

function fmtPcs(n) {
  if (n == null) return "-";
  return `${n} pcs`;
}

function fmtEUR(n) {
  if (n == null) return "-";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(n);
}
export default function EuropillowLoadboard() {
  const [data, setData] = useState([]);
  const [loadMsg, setLoadMsg] = useState("Loading…");
  const [persisted, setPersisted] = useState(false);
  const [compact, setCompact] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");

  const [sortBy, setSortBy] = useState("eta_ts");
  const [sortDir, setSortDir] = useState("asc");

  // Pricing fallback
  const [preferEmbeddedCost, setPreferEmbeddedCost] = useState(true);
  const [pricingMode, setPricingMode] = useState("per_piece");
  const [ratePerPiece, setRatePerPiece] = useState(10.61);
  const [ratePerKg, setRatePerKg] = useState(0.5);

  React.useEffect(() => {
    (async () => {
      // 0. Try localStorage
      try {
        const cached = localStorage.getItem("europillow_seed");
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr) && arr.length > 0) {
            setData(arr);
            setPersisted(true);
            setLoadMsg(`Loaded ${arr.length} shipments from local storage.`);
            setPasteOpen(false);
            return;
          }
        }
      } catch {}

      // 1. JSON file load attempt
      try {
        const resJson = await fetch("/mnt/data/europillow_shipments_today.json");
        if (resJson.ok) {
          const arr = await resJson.json();
          if (Array.isArray(arr) && arr.length > 0) {
            setData(arr);
            setLoadMsg(`Loaded ${arr.length} shipments from JSON.`);
            setPasteOpen(false);
            return;
          }
        }
      } catch {}

      // 2. XLSX attempt
      try {
        const res = await fetch("/mnt/data/11.11.2025-entregas-de-un-dia.xlsx");
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        const mapped = mapXlsxToShipments(raw);
        if (mapped.length > 0) {
          setData(mapped);
          setLoadMsg(`Loaded ${mapped.length} shipments from XLSX.`);
          setPasteOpen(false);
          return;
        }
      } catch {}

      setLoadMsg("No file access. Paste JSON below.");
      setPasteOpen(true);
    })();
  }, []);

  const carriers = useMemo(
    () => Array.from(new Set(data.map((d) => d.carrier))).sort(),
    [data]
  );

  const statuses = [
    "Created",
    "At Pickup",
    "In Transit",
    "At Hub",
    "Out For Delivery",
    "Delayed",
    "Delivered",
  ];

  // compute fallback cost
  const enriched = useMemo(() => {
    const computeFallbackCost = (s) => {
      if (typeof s.total === "number") return s.total;
      if (preferEmbeddedCost && typeof s.cost_eur === "number")
        return s.cost_eur;
      if (pricingMode === "per_piece")
        return (s.pieces ?? 0) * (ratePerPiece || 0);
      return (s.weight_kg ?? 0) * (ratePerKg || 0);
    };

    return data.map((d) => ({
      ...d,
      eta_ts: new Date(d.eta).getTime() || 0,
      _cost: computeFallbackCost(d),
    }));
  }, [data, preferEmbeddedCost, pricingMode, ratePerPiece, ratePerKg]);

  // Filters + sorting
  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return enriched
      .filter((d) => (statusFilter === "all" ? true : d.status === statusFilter))
      .filter((d) =>
        carrierFilter === "all" ? true : d.carrier === carrierFilter
      )
      .filter((d) => {
        if (!q) return true;
        return (
          (d.id || "").toLowerCase().includes(q) ||
          (d.origin_city || "").toLowerCase().includes(q) ||
          (d.dest_city || "").toLowerCase().includes(q) ||
          (d.carrier || "").toLowerCase().includes(q) ||
          (d.remitente || "").toLowerCase().includes(q) ||
          (d.consignatario || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const A = a[sortBy];
        const B = b[sortBy];

        if (A == null && B != null) return -1 * dir;
        if (A != null && B == null) return 1 * dir;
        if (A == null && B == null) return 0;

        if (A < B) return -1 * dir;
        if (A > B) return 1 * dir;
        return 0;
      });
  }, [enriched, query, statusFilter, carrierFilter, sortBy, sortDir]);

  const total = data.length;
  const delayed = data.filter((d) => d.status === "Delayed").length;
  const inTransit = data.filter((d) =>
    ["In Transit", "Out For Delivery"].includes(d.status)
  ).length;

  const todayEtas = data.filter(
    (d) =>
      new Date(d.eta).toDateString() === new Date().toDateString()
  ).length;

  const visibleTotal = useMemo(
    () =>
      rows.reduce((acc, r) => acc + (r.total ?? r._cost ?? 0), 0),
    [rows]
  );

  const headCell = compact
    ? "py-1 px-2 text-[10px]"
    : "py-3 px-4 text-xs";

  const bodyCell = compact
    ? "py-1.5 px-2 text-[11px]"
    : "py-2.5 px-4 text-sm";

  const setSort = (key) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) =>
    sortBy === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="h-3.5 w-3.5" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5" />
      )
    ) : null;
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            EUROPILLOW Shipments
          </h1>
          <p className="text-[11px] text-muted-foreground">{loadMsg}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={() => {
              try {
                localStorage.setItem(
                  "europillow_seed",
                  JSON.stringify(data)
                );
                setPersisted(true);
                setLoadMsg(
                  `Embedded (local) copy saved · ${data.length} shipments.`
                );
              } catch (e) {
                alert(
                  "Could not save embedded copy: " +
                    (e?.message || String(e))
                );
              }
            }}
          >
            Save as embedded
          </Button>

          {persisted && (
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("europillow_seed");
                setPersisted(false);
                setLoadMsg("Embedded copy removed.");
              }}
            >
              Clear embedded
            </Button>
          )}

          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4" />
            Reload
          </Button>

          <Button variant="outline" onClick={() => setCompact((v) => !v)}>
            {compact ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
            {compact ? "Comfort" : "Compact"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            title="Total"
            value={String(total)}
            icon={<Truck className="h-5 w-5" />}
          />
          <KpiCard
            title="In Transit"
            value={String(inTransit)}
            tone="text-blue-600"
          />
          <KpiCard
            title="Delivered Today"
            value={String(todayEtas)}
            tone="text-emerald-600"
          />
          <KpiCard
            title="Delayed"
            value={String(delayed)}
            tone="text-red-600"
          />
          <KpiCard title="Total (visible rows)" value={fmtEUR(visibleTotal)} />
        </div>
      )}

      {/* Controls */}
      <Card className="rounded-2xl">
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-xs"
                placeholder="Search ID, city, carrier, remitente, consignatario…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery("");
                }}
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-16">
                Status
              </label>
              <select
                className="h-8 text-xs border rounded-md px-2 flex-1"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-16">
                Carrier
              </label>
              <select
                className="h-8 text-xs border rounded-md px-2 flex-1"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
              >
                <option value="all">All</option>
                {carriers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-28">
                Prefer embedded
              </label>
              <input
                type="checkbox"
                checked={preferEmbeddedCost}
                onChange={(e) =>
                  setPreferEmbeddedCost(e.target.checked)
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-20">
                Mode
              </label>
              <select
                className="h-8 text-xs border rounded-md px-2 flex-1"
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value)}
              >
                <option value="per_piece">Per piece</option>
                <option value="per_kg">Per kg</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-24">
                €/piece
              </label>
              <input
                className="h-8 text-xs border rounded-md px-2 flex-1"
                type="number"
                step="0.01"
                value={ratePerPiece}
                onChange={(e) =>
                  setRatePerPiece(parseFloat(e.target.value))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-24">
                €/kg
              </label>
              <input
                className="h-8 text-xs border rounded-md px-2 flex-1"
                type="number"
                step="0.01"
                value={ratePerKg}
                onChange={(e) =>
                  setRatePerKg(parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl">
        {rows.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">
            No rows to display. Paste JSON below.
          </div>
        )}
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none`}
                    onClick={() => setSort("id")}
                  >
                    Nº Exp. <SortIcon col={"id"} />
                  </TableHead>
                  <TableHead className={headCell}>
                    Route (Exp.Ori. → Destino)
                  </TableHead>
                  <TableHead className={headCell}>Remitente</TableHead>
                  <TableHead className={headCell}>Consignatario</TableHead>
                  <TableHead className={headCell}>Bultos · Kg</TableHead>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none`}
                    onClick={() => setSort("status")}
                  >
                    Status <SortIcon col={"status"} />
                  </TableHead>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none`}
                    onClick={() => setSort("eta_ts")}
                  >
                    Fecha/ETA <SortIcon col={"eta_ts"} />
                  </TableHead>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none text-right`}
                    onClick={() => setSort("portes")}
                  >
                    Portes <SortIcon col={"portes"} />
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    Reexp.
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    Reemb.
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    G.Reem.
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    Desemb.
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    Seguro
                  </TableHead>
                  <TableHead className={`${headCell} text-right`}>
                    I.V.A
                  </TableHead>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none text-right`}
                    onClick={() => setSort("total")}
                  >
                    Total <SortIcon col={"total"} />
                  </TableHead>
                  <TableHead
                    className={`${headCell} cursor-pointer select-none text-right`}
                    onClick={() => setSort("_cost")}
                  >
                    Cost (fallback) <SortIcon col={"_cost"} />
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((s, i) => {
                  const st =
                    STATUS_STYLES[s.status] || STATUS_STYLES["In Transit"];
                  return (
                    <TableRow
                      key={i}
                      className={`odd:bg-muted/30 hover:bg-muted/60 border-l-4 ${st.border}`}
                    >
                      <TableCell
                        className={`${bodyCell} font-medium`}
                      >
                        {s.id}
                      </TableCell>

                      <TableCell className={bodyCell}>
                        <div className="text-[11px]">
                          <span className="font-medium">
                            {s.origin_city}
                          </span>{" "}
                          → {s.dest_city}
                        </div>
                        {s.current_loc && (
                          <div className="text-[10px] text-muted-foreground">
                            Loc: {s.current_loc}
                          </div>
                        )}
                      </TableCell>

                      <TableCell
                        className={`${bodyCell} truncate max-w-[160px]`}
                        title={s.remitente || ""}
                      >
                        {s.remitente || "-"}
                      </TableCell>

                      <TableCell
                        className={`${bodyCell} truncate max-w-[160px]`}
                        title={s.consignatario || ""}
                      >
                        {s.consignatario || "-"}
                      </TableCell>

                      <TableCell className={bodyCell}>
                        <div className="text-[10px]">
                          {fmtPcs(s.pieces)} · {fmtKg(s.weight_kg)}
                        </div>
                      </TableCell>

                      <TableCell className={bodyCell}>
                        <StatusPill status={s.status} />
                      </TableCell>

                      <TableCell
                        className={`${bodyCell} whitespace-nowrap`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatETA(s.eta)}
                        </div>
                      </TableCell>

                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.portes)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.reexp)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.reemb)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.g_reem)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.desemb)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.seguro)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s.iva)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right font-medium`}
                      >
                        {fmtEUR(s.total)}
                      </TableCell>
                      <TableCell
                        className={`${bodyCell} text-right`}
                      >
                        {fmtEUR(s._cost)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manual JSON paste loader */}
      <Card className="rounded-2xl">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Data loader (paste JSON)
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPasteOpen((v) => !v)}
            >
              {pasteOpen ? "Hide" : "Show"}
            </Button>
          </div>

          {pasteOpen && (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground">
                Paste the full JSON array (e.g. contents of{" "}
                <code>europillow_shipments_today.json</code>) and click{" "}
                <strong>Load JSON</strong>.
              </div>

              <Textarea
                className="min-h-[200px] text-xs"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder='[ {"id":"...","origin_city":"...", ...}, ... ]'
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      const txt = pasteText.trim();
                      if (!txt) {
                        alert("Paste JSON first");
                        return;
                      }
                      let parsed = null;
                      if (txt.startsWith("{")) {
                        const obj = JSON.parse(txt);
                        parsed = Array.isArray(obj)
                          ? obj
                          : obj.data || [];
                      } else {
                        parsed = JSON.parse(txt);
                      }
                      if (!Array.isArray(parsed))
                        throw new Error(
                          "JSON must be an array of shipments"
                        );
                      setData(parsed);
                      setLoadMsg(
                        `Loaded ${parsed.length} shipments from pasted JSON.`
                      );
                    } catch (e) {
                      alert("Invalid JSON: " + (e?.message || String(e)));
                    }
                  }}
                >
                  Load JSON
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPasteText("")}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-[10px] text-muted-foreground">
        © {new Date().getFullYear()} EUROPILLOW · Professional Loadboard UI
      </div>
    </div>
  );
}

/* ===== helper functions (mapping from XLSX etc.) ===== */

function mapXlsxToShipments(rows) {
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx === -1) return [];

  const header = rows[headerIdx].map((h) =>
    String(h || "").trim().toLowerCase()
  );

  const dataRows = rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => String(c || "").trim() !== ""));

  const getIndex = (keys) => {
    for (const k of keys) {
      const idx = header.findIndex((h) => h.includes(k.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxId = getIndex(["nº exp.", "expedición", "expedicion", "referencia", "id"]);
  const idxOri = getIndex(["exp.ori.", "origen", "origen ciudad", "from", "loading city"]);
  const idxDst = getIndex(["destino", "destino ciudad", "población destino", "to", "unloading city"]);
  const idxBlt = getIndex(["bult", "bultos", "piezas", "pieces", "palet", "pallet"]);
  const idxKg  = getIndex(["kg", "peso", "weight"]);
  const idxFec = getIndex(["fecha", "fecha entrega", "eta", "fecha entrega prevista", "fecha/hora entrega"]);
  const idxRem = getIndex(["remitente"]);
  const idxCon = getIndex(["consignatario"]);
  const idxPor = getIndex(["portes"]);
  const idxRex = getIndex(["reexp"]);
  const idxReb = getIndex(["reemb"]);
  const idxGre = getIndex(["g.reem", "g reem", "g.reemb", "g reemb"]);
  const idxDes = getIndex(["desemb"]);
  const idxSeg = getIndex(["seguro"]);
  const idxIva = getIndex(["i.v.a", "iva"]);
  const idxTot = getIndex(["total"]);

  const out = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rid = safeStr(r[idxId], `EP-${String(i + 1).padStart(4, "0")}`);

    out.push({
      id: rid,
      origin_city: safeStr(r[idxOri], "Salamanca"),
      origin_country: "Spain",
      dest_city: safeStr(r[idxDst], "-"),
      dest_country: "Spain",
      product_type: "Pallet",
      carrier: "Europillow",
      pieces: toInt(r[idxBlt]) ?? 1,
      weight_kg: toFloat(r[idxKg]) ?? 0,
      status: "Delivered",
      eta: toISO(r[idxFec]),
      last_seen: toISO(new Date()),
      current_loc: r[idxDst] ? safeStr(r[idxDst]) : undefined,

      remitente: safeStr(r[idxRem]),
      consignatario: safeStr(r[idxCon]),
      portes: toFloat(r[idxPor]),
      reexp: toFloat(r[idxRex]),
      reemb: toFloat(r[idxReb]),
      g_reem: toFloat(r[idxGre]),
      desemb: toFloat(r[idxDes]),
      seguro: toFloat(r[idxSeg]),
      iva: toFloat(r[idxIva]),
      total: toFloat(r[idxTot])
    });
  }

  return out;
}

function detectHeaderRow(rows) {
  const wants = [
    "nº exp.",
    "exp.ori.",
    "destino",
    "fecha",
    "bultos",
    "kg",
    "remitente",
    "consignatario",
    "portes",
    "total"
  ];

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = (rows[i] || []).map((x) => String(x || "").toLowerCase());
    const score = wants.reduce(
      (acc, w) => acc + (row.some((h) => h.includes(w)) ? 1 : 0),
      0
    );
    if (score >= 5) return i;
  }
  return -1;
}

function safeStr(val, dflt = "") {
  const s = String(val ?? "").trim();
  return s || dflt;
}

function toInt(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toFloat(x) {
  if (x == null) return null;
  const s = String(x)
    .replace(/[^0-9,.-]/g, "")
    .replace(/,(?=\d{2}\b)/, ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function toISO(d) {
  try {
    const t = new Date(d);
    return isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function KpiCard({ title, value, icon, tone }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground">{title}</div>
            <div className={`text-xl font-semibold ${tone || ""}`}>
              {value}
            </div>
          </div>
          {icon && <div className="opacity-70">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
