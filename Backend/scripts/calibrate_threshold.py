#!/usr/bin/env python3
"""CLI: calibrate RESEARCHPILOT_MIN_RERANKER_SCORE from human-labelled examples.

Run from Backend/:
    python scripts/calibrate_threshold.py \
        --labels eval/labels/query_relevance_labels.jsonl \
        --output data/calibration/threshold_report.json

Optional:
    --validation PATH      separate labelled validation file (recommended when
                           you have enough labelled examples; otherwise
                           leave-one-query-out CV is used automatically)
    --model NAME           reranker model override (must match production
                           RESEARCHPILOT_RERANKER_MODEL for the threshold to be valid)
    --objective f1|precision|recall|fbeta   threshold selection objective
    --relevance-cutoff N   binary mapping: label >= N counts as relevant (default 2)

The script never fabricates scores: it requires the real cross-encoder model
and reports actual metrics. See Backend/eval/labels/README.md for the label
format and collection instructions.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.calibration import run_calibration, summarize_report  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--labels", required=True, help="Labelled JSONL/CSV file (calibration set)")
    parser.add_argument("--validation", default=None, help="Optional separate labelled validation file")
    parser.add_argument("--output", default=None, help="Where to write the JSON report")
    parser.add_argument("--model", default=None, help="Reranker model override")
    parser.add_argument("--objective", default="f1", choices=["f1", "precision", "recall", "fbeta"])
    parser.add_argument("--relevance-cutoff", type=int, default=2,
                        help="label >= N counts as relevant for the binary mapping (default 2)")
    parser.add_argument("--batch-size", type=int, default=None)
    args = parser.parse_args()

    report = run_calibration(
        labels_path=args.labels,
        validation_path=args.validation,
        output_path=args.output,
        model_name=args.model,
        objective=args.objective,
        relevance_cutoff=args.relevance_cutoff,
        batch_size=args.batch_size,
    )

    print(summarize_report(report))
    if args.output:
        print(f"\nFull report written to: {args.output}")
        print(report["env_instructions"])
    else:
        print("\n(no --output given; JSON report not written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
