// app/page.jsx
import EuropillowLoadboard from "@/components/EuropillowLoadboard";
import shipments from "@/lib/shipments.json";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* szerzej: max do 1800px, prawie cały ekran */}
      <div className="mx-auto w-full max-w-[1800px] px-6 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Europillow Loadboard
          </h1>
          <p className="text-sm text-slate-400">
            Dane wczytywane z pliku <code>shipments.json</code> (ok. 300 przesyłek).
          </p>
        </header>

        <EuropillowLoadboard initialShipments={shipments} />
      </div>
    </main>
  );
}
