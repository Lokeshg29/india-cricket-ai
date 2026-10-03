import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import DataBadge from "@/components/cricket/DataBadge";
import { allFormats, dataQuality, drift, metricOrPending, modelRegistry, pct, systemHealth, training } from "@/lib/cricket";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { PRODUCT_NAME } from "@/lib/site";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="glass-card rounded-lg p-4">
    <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.14em] text-foreground/45">{title}</div>
    {children}
  </div>
);

export default function AdminPage() {
  const formats = allFormats();
  return (
    <main className="relative">
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">Internal · read-only</div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">{PRODUCT_NAME} admin</h1>
          <p className="mt-2 max-w-xl text-sm text-foreground/55">
            Read-only status view. No write endpoints are exposed. Everything shown is generated from DEMO DATA unless a badge says otherwise.
          </p>
        </div>
        <Link href="/" className="font-mono text-xs text-accent hover:underline">&larr; back to the public site</Link>
      </div>

      <section className="py-8">
        <SectionHeading eyebrow="1 · System" title="Health & Data Quality" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="System health">
            <ul className="font-mono space-y-1 text-sm text-foreground/75">
              {Object.entries(systemHealth).filter(([k]) => k !== "generated_at" && k !== "data_label").map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>
              ))}
              <li className="flex justify-between"><span>generated_at</span><span>{systemHealth.generated_at.slice(0, 19)}Z</span></li>
            </ul>
          </Card>
          <Card title="Data quality">
            <ul className="font-mono space-y-1 text-sm text-foreground/75">
              {dataQuality.checks.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className={c.status === "pass" ? "text-accent" : "text-saffron"}>{c.status}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3"><DataBadge label={dataQuality.data_label} /></div>
          </Card>
        </div>
      </section>

      <section className="py-8">
        <SectionHeading eyebrow="2 · Models" title="Model & Prediction Status by Format" />
        <div className="grid gap-4 md:grid-cols-3">
          {formats.map((f) => {
            const reg = modelRegistry.find((m) => m.format === f.format.toUpperCase());
            const latest = f.ledger[f.ledger.length - 1];
            return (
              <Card key={f.slug} title={`Monitoring: ${f.format}`}>
                <dl className="font-mono space-y-1 text-sm text-foreground/75">
                  <div className="flex justify-between"><dt>model version</dt><dd>{f.model_version}</dd></div>
                  <div className="flex justify-between"><dt>stage</dt><dd>{reg?.stage}</dd></div>
                  <div className="flex justify-between"><dt>backend</dt><dd className="text-right text-xs">{reg?.backend}</dd></div>
                  <div className="flex justify-between"><dt>accuracy</dt><dd>{metricOrPending(f.validation?.accuracy, (n) => pct(n))}</dd></div>
                  <div className="flex justify-between"><dt>predictions</dt><dd>{f.summary.predictions_generated}</dd></div>
                  <div className="flex justify-between"><dt>latest prediction</dt><dd>{latest.prediction_timestamp.slice(0, 10)}</dd></div>
                </dl>
                <div className="mt-3"><DataBadge label={f.data_label} /></div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="py-8">
        <SectionHeading eyebrow="3 · Training & Drift" title="Training Status and Data Drift" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Training">
            <div className="font-mono text-sm text-foreground/75">
              status: {training.status}<br />last trained: {training.last_trained.slice(0, 19)}Z
            </div>
          </Card>
          <Card title="Data drift">
            <div className="font-mono text-sm text-foreground/75">{drift.status}</div>
            <p className="mt-2 text-xs text-foreground/45">
              Drift reporting (inherited from the base project) needs a live data feed; it is not active on demo data.
            </p>
          </Card>
        </div>
      </section>
      </div>
      <Footer />
    </main>
  );
}
