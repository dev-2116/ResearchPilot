import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Hash,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { FinalReport } from '../types';
import { EmptyState, SectionHeader, StatusBadge, fmtDate } from '../components/ui';

interface ReportViewerProps {
  report: FinalReport | null;
  isLoading: boolean;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  const [copiedBibtex, setCopiedBibtex] = useState(false);

  if (!report) {
    return (
      <div className="page-view">
        <div className="card">
          <EmptyState
            icon={<FileText size={22} />}
            title="No synthesis report available yet"
            description="When an investigation completes all pipeline stages, a structured report with executive summary, verified evidence, experiment findings, limitations and citations is generated here."
          />
        </div>
      </div>
    );
  }

  /* Print / PDF export — renders ONLY the research paper (isolated iframe) */
  const handlePrintResearchPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${report.title}</title>
        <style>
          @page { size: A4 portrait; margin: 18mm 16mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                 color: #111827; background: #ffffff; font-size: 10pt; line-height: 1.55; }
          .paper-header { border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
          .journal-tag { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em;
                         color: #B45309; font-weight: 700; margin-bottom: 6px; }
          h1.paper-title { font-size: 17pt; font-weight: 800; line-height: 1.25; color: #0f172a; margin-bottom: 10px; }
          .meta-strip { display: flex; flex-direction: column; gap: 3px; font-size: 8.5pt; color: #475569;
                        background: #f8fafc; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0; }
          .section { margin-bottom: 20px; page-break-inside: avoid; }
          h2.section-title { font-size: 11.5pt; font-weight: 700; color: #92400e; border-bottom: 1px solid #cbd5e1;
                             padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
          p.lead { color: #1e293b; margin-bottom: 10px; }
          .methodology-box { background: #f8fafc; border-left: 3px solid #B45309; padding: 10px 14px;
                             font-size: 9.5pt; color: #334155; white-space: pre-line; border-radius: 4px; }
          .claim-item { border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
          .claim-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5pt; margin-bottom: 4px; gap: 8px; }
          .status-tag { font-size: 8pt; font-weight: 700; padding: 2px 6px; border-radius: 3px;
                        background: #fffbeb; color: #92400e; border: 1px solid #fde68a; white-space: nowrap; }
          .passage-citation { background: #f8fafc; border-left: 3px solid #059669; padding: 6px 10px;
                              font-size: 8.5pt; color: #334155; font-style: italic; margin-top: 6px; }
          table.metrics-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 8px 0 12px; }
          table.metrics-table th, table.metrics-table td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
          table.metrics-table th { background: #f1f5f9; }
          .chart-container { text-align: center; margin: 12px 0; }
          .chart-container img { max-width: 480px; border: 1px solid #cbd5e1; border-radius: 4px; }
          .reference-item { font-size: 8.5pt; color: #334155; margin-bottom: 6px; line-height: 1.4; }
          .provenance-seal { border-top: 2px dashed #cbd5e1; padding-top: 10px; margin-top: 20px;
                             display: flex; justify-content: space-between; gap: 10px; font-size: 7.5pt; color: #64748b; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="paper-header">
          <div class="journal-tag">ResearchPilot Autonomous Research Report · Evidence-Verified Synthesis</div>
          <h1 class="paper-title">${report.title}</h1>
          <div class="meta-strip">
            <span><strong>Investigation question:</strong> ${report.task_question}</span>
            <span><strong>Generated:</strong> ${new Date(report.generated_at).toUTCString()} · <strong>Run:</strong> ${report.run_id}</span>
          </div>
        </div>

        <div class="section"><h2 class="section-title">1. Executive Summary</h2><p class="lead">${report.executive_summary}</p></div>

        <div class="section"><h2 class="section-title">2. Verification Methodology</h2><div class="methodology-box">${report.methodology}</div></div>

        <div class="section">
          <h2 class="section-title">3. Decomposed Claims & Literature Provenance</h2>
          ${report.evidence_synthesis.map((claim, idx) => `
            <div class="claim-item">
              <div class="claim-header">
                <span>Claim 3.${idx + 1}: "${claim.claim_text}"</span>
                <span class="status-tag">${claim.status} · heuristic ${(claim.confidence * 100).toFixed(1)}%</span>
              </div>
              <p style="font-size: 8.5pt; color: #475569; margin-bottom: 4px;">${claim.explanation}</p>
              ${claim.supporting_passages?.length > 0 ? `
                <div class="passage-citation">
                  <strong>Source:</strong> ${claim.supporting_passages[0].document_title} (${claim.supporting_passages[0].identifier})<br/>
                  "${claim.supporting_passages[0].passage}"
                </div>` : ''}
            </div>`).join('')}
        </div>

        ${report.experiment_results ? `
          <div class="section">
            <h2 class="section-title">4. Sandboxed Experiment Findings</h2>
            <p style="font-size: 9pt; margin-bottom: 6px;"><strong>Hypothesis:</strong> <em>"${report.experiment_results.hypothesis}"</em></p>
            <table class="metrics-table">
              <thead><tr><th>Metric</th><th>Observed</th><th>Baseline</th><th>Delta</th></tr></thead>
              <tbody>
                ${report.experiment_results.metrics.map(m => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.unit === 'ratio' ? (m.value * 100).toFixed(1) + '%' : m.value.toFixed(3)}</td>
                    <td>${m.baseline_value !== undefined && m.baseline_value !== null ? (m.unit === 'ratio' ? (m.baseline_value * 100).toFixed(1) + '%' : m.baseline_value.toFixed(3)) : 'N/A'}</td>
                    <td>${m.delta_percentage !== undefined && m.delta_percentage !== null ? (m.delta_percentage > 0 ? '+' : '') + m.delta_percentage + '%' : '—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
            ${report.experiment_results.chart_url ? `
              <div class="chart-container">
                <img src="${report.experiment_results.chart_url}" alt="Experiment chart"/>
                <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">Figure 1: Sandbox-generated experiment plot</div>
              </div>` : ''}
          </div>` : ''}

        <div class="section">
          <h2 class="section-title">5. Limitations & Scope</h2>
          <ul style="padding-left: 18px; font-size: 9pt; color: #334155;">
            ${report.limitations.map(l => `<li>${l}</li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <h2 class="section-title">6. References</h2>
          ${report.citations.map((c, idx) => `
            <div class="reference-item"><strong>[${idx + 1}]</strong> <strong>${c.title}</strong> — ${c.authors}. <em>${c.venue}</em>.</div>`).join('')}
        </div>

        <div class="provenance-seal">
          <div>SHA-256 PROVENANCE: ${report.provenance_hash}</div>
          <div>GENERATED: ${new Date(report.generated_at).toUTCString()}</div>
        </div>
      </body>
      </html>
    `;

    let printFrame = document.getElementById('research-print-iframe') as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'research-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }
    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printContent);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      }, 400);
    }
  };

  const handleExportMarkdown = () => {
    let md = `# ${report.title}\n\n`;
    md += `**Investigation Question:** ${report.task_question}\n`;
    md += `**Generated:** ${new Date(report.generated_at).toUTCString()}\n`;
    md += `**Provenance Hash:** \`${report.provenance_hash}\`\n\n`;
    md += `## 1. Executive Summary\n\n${report.executive_summary}\n\n`;
    md += `## 2. Verification Methodology\n\n${report.methodology}\n\n`;
    md += `## 3. Evidence-Verified Claims\n\n`;
    report.evidence_synthesis.forEach((c, idx) => {
      md += `### Claim 3.${idx + 1}: ${c.claim_text}\n`;
      md += `- **Status:** ${c.status} (heuristic confidence: ${(c.confidence * 100).toFixed(1)}%)\n`;
      md += `- **Explanation:** ${c.explanation}\n\n`;
    });
    if (report.experiment_results) {
      md += `## 4. Empirical Sandbox Results\n\n`;
      md += `- **Hypothesis:** ${report.experiment_results.hypothesis}\n`;
      md += `- **Baseline:** ${report.experiment_results.baseline_method} | **Proposed:** ${report.experiment_results.proposed_method}\n\n`;
    }
    md += `## 5. Limitations\n\n`;
    report.limitations.forEach((l) => (md += `- ${l}\n`));
    md += `\n## 6. References\n\n`;
    report.citations.forEach((cit, idx) => {
      md += `[${idx + 1}] **${cit.title}** — ${cit.authors}. *${cit.venue}*.\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `researchpilot_report_${report.run_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `researchpilot_report_${report.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBibtex = () => {
    const bibtex = `@techreport{researchpilot_${report.run_id},\n  title={${report.title}},\n  author={{ResearchPilot evidence-verified agent}},\n  year={${new Date(report.generated_at).getFullYear()}},\n  note={Provenance hash: ${report.provenance_hash}}\n}`;
    navigator.clipboard.writeText(bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  return (
    <div className="page-view">
      {/* Action bar */}
      <div className="card no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', minWidth: 0 }}>
            <span className="mono badge badge-slate">{report.run_id}</span>
            <span className="badge badge-emerald"><ShieldCheck size={12} /> Provenance sealed</span>
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
              sha256:{report.provenance_hash.slice(0, 20)}…
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleCopyBibtex} style={{ fontSize: '0.76rem' }}>
              {copiedBibtex ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
              <span>{copiedBibtex ? 'Copied' : 'BibTeX'}</span>
            </button>
            <button className="btn btn-secondary" onClick={handleExportMarkdown} style={{ fontSize: '0.76rem' }}>
              <Download size={13} /> Markdown
            </button>
            <button className="btn btn-secondary" onClick={handleExportJSON} style={{ fontSize: '0.76rem' }}>
              <Download size={13} /> JSON
            </button>
            <button className="btn btn-primary" onClick={handlePrintResearchPDF} style={{ fontSize: '0.76rem' }}>
              <Printer size={13} /> Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Paper body */}
      <div className="card paper-view-container" style={{ padding: '40px 48px' }}>
        <div style={{ borderBottom: '2px solid var(--accent-primary-border)', paddingBottom: 18, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="badge badge-amber-brand">ResearchPilot Synthesis Report</span>
            <span className="badge badge-slate">Generated {fmtDate(report.generated_at)}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', lineHeight: 1.3, marginBottom: 14, fontWeight: 800 }}>
            {report.title}
          </h1>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', background: 'var(--bg-inset)', padding: '10px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Investigation question:</strong> {report.task_question}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <h3 className="paper-section-title">1 · Executive Summary</h3>
          <p className="paper-prose">{report.executive_summary}</p>
        </div>

        <div style={{ marginBottom: 30 }}>
          <h3 className="paper-section-title">2 · Verification Methodology</h3>
          <div className="passage-quote" style={{ borderLeftColor: 'var(--accent-primary)', whiteSpace: 'pre-line' }}>
            {report.methodology}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <h3 className="paper-section-title">3 · Decomposed Claims & Provenance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {report.evidence_synthesis.map((claim, idx) => (
              <div key={claim.claim_id || idx} style={{ padding: '15px 18px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Claim 3.{idx + 1}: “{claim.claim_text}”</span>
                  <StatusBadge status={claim.status}>
                    {claim.status} · {(claim.confidence * 100).toFixed(1)}%
                  </StatusBadge>
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.55 }}>
                  {claim.explanation}
                </p>
                {claim.supporting_passages?.length > 0 && (
                  <div className="passage-quote">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                      <span>Source: {claim.supporting_passages[0].document_title}</span>
                      <span className="mono">{claim.supporting_passages[0].identifier}</span>
                    </div>
                    <em>“{claim.supporting_passages[0].passage}”</em>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {report.experiment_results && (
          <div style={{ marginBottom: 30 }}>
            <h3 className="paper-section-title">4 · Sandboxed Experiment Findings</h3>
            <p className="paper-prose" style={{ marginBottom: 14 }}>
              Hypothesis: <em>“{report.experiment_results.hypothesis}”</em>
            </p>
            <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(report.experiment_results.metrics.length, 4)}, 1fr)`, gap: 12, marginBottom: 16 }}>
              {report.experiment_results.metrics.map((m) => (
                <div key={m.id || m.name} style={{ background: 'var(--bg-inset)', padding: 13, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-muted-caps" style={{ display: 'block', marginBottom: 4 }}>{m.name}</span>
                  <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {m.unit === 'ratio' ? `${(m.value * 100).toFixed(1)}%` : Number(m.value).toFixed(3)}
                  </div>
                  {m.delta_percentage !== undefined && m.delta_percentage !== null && (
                    <span className={`badge ${m.delta_percentage > 0 ? 'badge-emerald' : 'badge-rose'}`} style={{ marginTop: 6 }}>
                      {m.delta_percentage > 0 ? '+' : ''}{m.delta_percentage}% vs baseline
                    </span>
                  )}
                </div>
              ))}
            </div>
            {report.experiment_results.chart_url && (
              <div style={{ textAlign: 'center', background: 'var(--bg-inset)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <img src={report.experiment_results.chart_url} alt="Experiment results figure" style={{ maxWidth: 560, width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 8 }}>
                  Figure 1: Sandbox-generated experiment plot
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 30 }}>
          <h3 className="paper-section-title">5 · Limitations & Scope</h3>
          <ul style={{ paddingLeft: 22, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            {report.limitations.map((lim, idx) => <li key={idx}>{lim}</li>)}
          </ul>
        </div>

        <div style={{ marginBottom: 8 }}>
          <h3 className="paper-section-title">6 · References</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.citations.map((cit, idx) => (
              <div key={cit.id || idx} style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--accent-primary)' }}>[{idx + 1}]</strong>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cit.title}</span> — {cit.authors}. <em>{cit.venue}</em>.
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '2px dashed var(--border-strong)', marginTop: 24, paddingTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-light)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Hash size={13} color="var(--accent-primary)" />
            <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>SHA-256 {report.provenance_hash}</span>
          </span>
          <span>Sealed {new Date(report.generated_at).toUTCString()}</span>
        </div>
      </div>
    </div>
  );
};
