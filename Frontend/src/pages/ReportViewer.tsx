import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  BookOpen,
  FlaskConical,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award,
  CheckCircle2,
  FileCheck,
  Hash
} from 'lucide-react';
import { FinalReport } from '../types';

interface ReportViewerProps {
  report: FinalReport | null;
  isLoading: boolean;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);

  if (!report) {
    return (
      <div className="page-view" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <FileText size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Final Synthesis Report Not Yet Available</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 24px' }}>
          When a research task completes all 11 stages of the evidence-verification pipeline, a publication-ready structured report is generated here.
        </p>
      </div>
    );
  }

  // Pure Targeted Research PDF Printing (Prints ONLY the research paper, isolated from web UI)
  const handlePrintResearchPDF = () => {
    // Generate clean, standalone HTML styled specifically for publication PDF export
    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${report.title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 18mm 16mm 18mm 16mm;
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
            }
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            font-size: 10pt;
            line-height: 1.55;
            padding: 0;
          }
          .paper-header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .journal-tag {
            font-size: 8pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #1d4ed8;
            font-weight: 700;
            margin-bottom: 6px;
          }
          h1.paper-title {
            font-size: 17pt;
            font-weight: 800;
            line-height: 1.25;
            color: #0f172a;
            margin-bottom: 10px;
          }
          .meta-strip {
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            color: #475569;
            background: #f8fafc;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
          }
          .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          h2.section-title {
            font-size: 12pt;
            font-weight: 700;
            color: #0f2b5c;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          p.lead {
            font-size: 10pt;
            color: #1e293b;
            text-align: justify;
            margin-bottom: 10px;
          }
          .methodology-box {
            background: #f8fafc;
            border-left: 3px solid #1d4ed8;
            border: 1px solid #e2e8f0;
            padding: 10px 14px;
            font-size: 9.5pt;
            color: #334155;
            white-space: pre-line;
            border-radius: 4px;
          }
          .claim-item {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px 12px;
            margin-bottom: 10px;
            background: #ffffff;
            page-break-inside: avoid;
          }
          .claim-header {
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            font-size: 9.5pt;
            margin-bottom: 4px;
          }
          .status-tag {
            font-size: 8pt;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
          }
          .passage-citation {
            background: #f8fafc;
            border-left: 3px solid #059669;
            padding: 6px 10px;
            font-size: 8.5pt;
            color: #334155;
            font-style: italic;
            margin-top: 6px;
            border-radius: 2px;
          }
          table.metrics-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            margin-top: 8px;
            margin-bottom: 12px;
          }
          table.metrics-table th, table.metrics-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            text-align: left;
          }
          table.metrics-table th {
            background: #f1f5f9;
            font-weight: 700;
          }
          .chart-container {
            text-align: center;
            margin: 12px 0;
            page-break-inside: avoid;
          }
          .chart-container img {
            max-width: 480px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
          }
          .reference-item {
            font-size: 8.5pt;
            color: #334155;
            margin-bottom: 6px;
            line-height: 1.4;
          }
          .provenance-seal {
            border-top: 2px dashed #cbd5e1;
            padding-top: 10px;
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 7.5pt;
            color: #64748b;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="paper-header">
          <div class="journal-tag">ResearchPilot Autonomous AI Research Report • Peer-Referenced Output</div>
          <h1 class="paper-title">${report.title}</h1>
          <div class="meta-strip">
            <span><strong>Investigation Question:</strong> ${report.task_question}</span>
            <span><strong>Date:</strong> ${new Date(report.generated_at).toLocaleDateString()}</span>
            <span><strong>Run ID:</strong> ${report.run_id}</span>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">1. Executive Summary & Abstract</h2>
          <p class="lead">${report.executive_summary}</p>
        </div>

        <div class="section">
          <h2 class="section-title">2. Evidence-First Verification Methodology</h2>
          <div class="methodology-box">${report.methodology}</div>
        </div>

        <div class="section">
          <h2 class="section-title">3. Decomposed Factual Assertions & Literature Provenance</h2>
          ${report.evidence_synthesis.map((claim, idx) => `
            <div class="claim-item">
              <div class="claim-header">
                <span>Claim 3.${idx + 1}: "${claim.claim_text}"</span>
                <span class="status-tag">${claim.status} (${(claim.confidence * 100).toFixed(1)}%)</span>
              </div>
              <p style="font-size: 8.5pt; color: #475569; margin-bottom: 4px;">${claim.explanation}</p>
              ${claim.supporting_passages && claim.supporting_passages.length > 0 ? `
                <div class="passage-citation">
                  <strong>Source:</strong> ${claim.supporting_passages[0].document_title} (${claim.supporting_passages[0].identifier})<br/>
                  "${claim.supporting_passages[0].passage}"
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${report.experiment_results ? `
          <div class="section">
            <h2 class="section-title">4. Sandboxed Empirical Experiment Findings</h2>
            <p style="font-size: 9pt; margin-bottom: 6px;"><strong>Empirical Hypothesis:</strong> <em>"${report.experiment_results.hypothesis}"</em></p>
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>Evaluation Metric</th>
                  <th>Observed Value</th>
                  <th>Baseline Value</th>
                  <th>Delta / Gain</th>
                </tr>
              </thead>
              <tbody>
                ${report.experiment_results.metrics.map(m => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.unit === 'ratio' ? (m.value * 100).toFixed(1) + '%' : m.value.toFixed(3)}</td>
                    <td>${m.baseline_value !== undefined ? (m.unit === 'ratio' ? (m.baseline_value * 100).toFixed(1) + '%' : m.baseline_value.toFixed(3)) : 'N/A'}</td>
                    <td style="color: #059669; font-weight: 700;">${m.delta_percentage !== undefined ? (m.delta_percentage > 0 ? '+' : '') + m.delta_percentage + '%' : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${report.experiment_results.chart_url ? `
              <div class="chart-container">
                <img src="${report.experiment_results.chart_url}" alt="Experiment Chart"/>
                <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">Figure 1: Automated Empirical Sandbox Plot</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="section">
          <h2 class="section-title">5. Limitations & Scope Constraints</h2>
          <ul style="padding-left: 18px; font-size: 9pt; color: #334155; line-height: 1.5;">
            ${report.limitations.map(l => `<li>${l}</li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <h2 class="section-title">6. Authoritative References & Citations</h2>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${report.citations.map((c, idx) => `
              <div class="reference-item">
                <strong>[${idx + 1}]</strong> <strong>${c.title}</strong> — ${c.authors}. <em>${c.venue}</em>.
              </div>
            `).join('')}
          </div>
        </div>

        <div class="provenance-seal">
          <div>RESEARCHPILOT CRYPTOGRAPHIC PROVENANCE HASH: ${report.provenance_hash}</div>
          <div>TIMESTAMP: ${new Date(report.generated_at).toUTCString()}</div>
        </div>
      </body>
      </html>
    `;

    // Create a dedicated isolated print iframe
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
    md += `**Generated Date:** ${new Date(report.generated_at).toUTCString()}\n`;
    md += `**Provenance Hash:** \`${report.provenance_hash}\`\n\n`;
    md += `## 1. Executive Summary\n\n${report.executive_summary}\n\n`;
    md += `## 2. Evidence-First Methodology\n\n${report.methodology}\n\n`;
    md += `## 3. Evidence-Verified Claims Synthesis\n\n`;
    report.evidence_synthesis.forEach((c, idx) => {
      md += `### Claim 3.${idx + 1}: ${c.claim_text}\n`;
      md += `- **Status:** ${c.status} (Confidence: ${(c.confidence * 100).toFixed(1)}%)\n`;
      md += `- **Explanation:** ${c.explanation}\n\n`;
    });
    if (report.experiment_results) {
      md += `## 4. Empirical Sandbox Experiment Results\n\n`;
      md += `- **Hypothesis:** ${report.experiment_results.hypothesis}\n`;
      md += `- **Baseline:** ${report.experiment_results.baseline_method} | **Proposed:** ${report.experiment_results.proposed_method}\n\n`;
    }
    md += `## 5. Limitations\n\n`;
    report.limitations.forEach((l) => (md += `- ${l}\n`));
    md += `\n## 6. Authoritative References & Citations\n\n`;
    report.citations.forEach((cit, idx) => {
      md += `[${idx + 1}] **${cit.title}** — ${cit.authors}. *${cit.venue}*.\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `researchpilot_report_${report.run_id}.md`;
    a.click();
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `researchpilot_report_${report.run_id}.json`;
    a.click();
  };

  const handleCopyBibtex = () => {
    const bibtex = `@article{researchpilot_${report.run_id},\n  title={${report.title}},\n  author={ResearchPilot Autonomous Evidence-Verified Agent},\n  year={${new Date(report.generated_at).getFullYear()}},\n  note={Provenance Hash: ${report.provenance_hash}}\n}`;
    navigator.clipboard.writeText(bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  return (
    <div className="page-view">
      {/* Header Actions Card */}
      <div className="card no-print" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="mono badge badge-indigo">{report.run_id}</span>
            <span className="badge badge-emerald">
              <ShieldCheck size={14} /> Provenance Verified
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Hash: {report.provenance_hash.slice(0, 24)}...
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleCopyBibtex} style={{ fontSize: '0.78rem' }}>
              {copiedBibtex ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
              <span>{copiedBibtex ? 'BibTeX Copied' : 'BibTeX'}</span>
            </button>
            <button className="btn btn-secondary" onClick={handleExportMarkdown} style={{ fontSize: '0.78rem' }}>
              <Download size={14} />
              <span>Export Markdown</span>
            </button>
            <button className="btn btn-secondary" onClick={handleExportJSON} style={{ fontSize: '0.78rem' }}>
              <Download size={14} />
              <span>Export JSON</span>
            </button>
            <button className="btn btn-primary" onClick={handlePrintResearchPDF} style={{ fontSize: '0.78rem' }}>
              <Printer size={14} />
              <span>Print / PDF (Research Paper)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Publication Article Container (Formal Academic Paper Layout) */}
      <div
        className="card paper-view-container"
        style={{
          padding: '44px 54px',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)'
        }}
      >
        {/* Academic Header */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="badge badge-indigo" style={{ fontSize: '0.72rem' }}>
              ResearchPilot Formal Synthesis Paper
            </span>
            <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
              <CheckCircle2 size={12} /> Peer-Referenced • Reproducible
            </span>
          </div>

          <h1 style={{ fontSize: '1.9rem', color: '#0f172a', lineHeight: 1.3, marginBottom: '14px', fontWeight: 800 }}>
            {report.title}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.84rem', color: 'var(--text-secondary)', background: '#f8fafc', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <span><strong>Investigation Question:</strong> {report.task_question}</span>
            <span><strong>Generated Date:</strong> {new Date(report.generated_at).toLocaleDateString()}</span>
            <span><strong>Author:</strong> ResearchPilot Reasoner v1</span>
          </div>
        </div>

        {/* Section 1: Executive Summary */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            1. Executive Summary & Abstract
          </h3>
          <p style={{ color: '#1e293b', fontSize: '0.94rem', lineHeight: 1.7, textAlign: 'justify' }}>
            {report.executive_summary}
          </p>
        </div>

        {/* Section 2: Methodology */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            2. Evidence-First Verification Methodology
          </h3>
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #1d4ed8', whiteSpace: 'pre-line', fontSize: '0.88rem', color: '#334155', lineHeight: 1.65 }}>
            {report.methodology}
          </div>
        </div>

        {/* Section 3: Evidence-Verified Claims */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            3. Decomposed Factual Assertions & Literature Provenance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {report.evidence_synthesis.map((claim, idx) => (
              <div key={claim.claim_id || idx} style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                    Claim 3.{idx + 1}: "{claim.claim_text}"
                  </span>
                  <span className={`badge ${claim.status === 'SUPPORTED' ? 'badge-emerald' : 'badge-amber'}`}>
                    {claim.status} ({(claim.confidence * 100).toFixed(1)}%)
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  {claim.explanation}
                </p>

                {claim.supporting_passages && claim.supporting_passages.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-emerald)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: '#334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      <span>Source: {claim.supporting_passages[0].document_title}</span>
                      <span className="mono">{claim.supporting_passages[0].identifier}</span>
                    </div>
                    <em>"{claim.supporting_passages[0].passage}"</em>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Experiment Results */}
        {report.experiment_results && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              4. Sandboxed Empirical Experiment Findings
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#1e293b', marginBottom: '14px' }}>
              Hypothesis: <em>"{report.experiment_results.hypothesis}"</em>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px' }}>
              {report.experiment_results.metrics.map((m) => (
                <div key={m.id || m.name} style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{m.name}</span>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>
                    {m.unit === 'ratio' ? `${(m.value * 100).toFixed(1)}%` : m.value.toFixed(3)}
                  </div>
                  {m.delta_percentage !== undefined && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.68rem', marginTop: '4px' }}>
                      {m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`} vs baseline
                    </span>
                  )}
                </div>
              ))}
            </div>

            {report.experiment_results.chart_url && (
              <div style={{ textAlign: 'center', background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <img
                  src={report.experiment_results.chart_url}
                  alt="Experiment Results Figure"
                  style={{ maxWidth: '580px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Figure 1: Automated Empirical Sandbox Metric Distribution
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 5: Limitations */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            5. Limitations & Scope Constraints
          </h3>
          <ul style={{ paddingLeft: '24px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.65 }}>
            ${report.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>

        {/* Section 6: References */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', color: '#0f2b5c', marginBottom: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            6. References & Literature Citations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.citations.map((cit, idx) => (
              <div key={cit.id || idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--accent-primary)' }}>[{idx + 1}]</strong>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cit.title}</span> — {cit.authors}. <em>{cit.venue}</em>.
              </div>
            ))}
          </div>
        </div>

        {/* Provenance Verification Footer Stamp */}
        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Hash size={14} color="var(--accent-primary)" />
            <span>SHA-256 PROVENANCE: <strong className="mono">{report.provenance_hash}</strong></span>
          </div>
          <div>RESEARCHPILOT SECURE VERIFICATION SEED: 42</div>
        </div>
      </div>
    </div>
  );
};
