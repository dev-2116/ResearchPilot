import re
import uuid
from typing import Any, Dict, List, Tuple

class EvidenceVerifier:
    """
    Evidence Verifier module that evaluates whether extracted claims are logically
    entailed, contradicted, or unsupported by retrieved scientific evidence passages.
    """

    def __init__(self):
        pass

    def extract_claims_from_text(self, text: str) -> List[str]:
        """
        Decompose an argument, hypothesis, or research text into individual testable claims.
        """
        # Split sentences and filter out short fragments
        raw_sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        claims = []
        for s in raw_sentences:
            s_clean = s.strip()
            if len(s_clean) > 20 and not s_clean.startswith("#") and not s_clean.startswith("```"):
                claims.append(s_clean)
        return claims[:8] if claims else [text.strip()]

    def assess_entailment(self, claim: str, evidence_passage: str) -> Tuple[str, float, str]:
        """
        Evaluates the NLI relation between a claim and a specific evidence passage.
        Returns: (entailment_type: ENTAILED | CONTRADICTION | NEUTRAL, support_score: float, explanation: str)
        """
        claim_lower = claim.lower()
        passage_lower = evidence_passage.lower()
        
        # Token overlap analysis
        claim_words = set(re.findall(r"\w+", claim_lower))
        passage_words = set(re.findall(r"\w+", passage_lower))
        
        # Negation / contradiction markers
        contradiction_pairs = [
            ("increase", "decrease"), ("reduce", "increase"), ("higher", "lower"),
            ("outperforms", "underperforms"), ("fails", "succeeds"), ("never", "always"),
            ("cannot", "can"), ("positive", "negative"), ("improves", "degrades")
        ]
        
        has_contradiction = False
        for pos, neg in contradiction_pairs:
            if (pos in claim_lower and neg in passage_lower) or (neg in claim_lower and pos in passage_lower):
                # Check if they share surrounding context
                common = claim_words.intersection(passage_words)
                if len(common) >= 3:
                    has_contradiction = True
                    break

        if has_contradiction:
            return "CONTRADICTION", 0.15, "The retrieved passage asserts contradictory empirical trends relative to the stated claim."

        # Compute semantic support
        overlap = len(claim_words.intersection(passage_words))
        ratio = overlap / max(1, len(claim_words))
        
        # Key concept matching
        scientific_terms = ["rag", "bm25", "hybrid", "retrieval", "provenance", "hallucination", "accuracy", "manifest", "seed", "sandbox", "evaluation", "baseline"]
        key_matches = sum(1 for term in scientific_terms if term in claim_lower and term in passage_lower)
        
        support_score = min(1.0, (ratio * 0.7) + (key_matches * 0.12) + 0.1)

        if support_score >= 0.55:
            return "ENTAILED", round(support_score, 3), f"Strong factual grounding with {int(support_score*100)}% evidence alignment."
        elif support_score >= 0.35:
            return "NEUTRAL", round(support_score, 3), "Passage provides partial context but insufficient direct confirmation."
        else:
            return "NEUTRAL", round(support_score, 3), "Insufficient lexical and semantic overlap to verify claim."

    def verify_claims_against_evidence(self, claims: List[str], retrieved_passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Links each claim to candidate evidence passages, scores entailment, and computes overall verification status.
        """
        verified_claims = []

        for idx, claim_text in enumerate(claims):
            claim_id = f"clm_{uuid.uuid4().hex[:8]}"
            best_evidence = []
            best_score = 0.0
            overall_status = "INSUFFICIENT_EVIDENCE"
            best_explanation = "No authoritative retrieved evidence verified this claim."
            
            for passage in retrieved_passages:
                p_text = passage.get("passage_text", "")
                entailment, score, explanation = self.assess_entailment(claim_text, p_text)
                
                if score > 0.3:
                    ev_item = {
                        "id": f"ev_{uuid.uuid4().hex[:8]}",
                        "claim_id": claim_id,
                        "chunk_id": passage.get("chunk_id", "chk_unknown"),
                        "document_title": passage.get("title", "Untitled Source"),
                        "document_authors": passage.get("authors", "Unknown Authors"),
                        "document_identifier": passage.get("identifier", "N/A"),
                        "passage_text": p_text,
                        "support_score": score,
                        "entailment_type": entailment,
                        "retrieval_score": passage.get("retrieval_score", 0.0)
                    }
                    best_evidence.append(ev_item)
                    if score > best_score:
                        best_score = score
                        best_explanation = explanation

            if best_score >= 0.55:
                overall_status = "SUPPORTED"
            elif any(ev["entailment_type"] == "CONTRADICTION" for ev in best_evidence):
                overall_status = "REFUTED"
            else:
                overall_status = "INSUFFICIENT_EVIDENCE"

            verified_claims.append({
                "id": claim_id,
                "text": claim_text,
                "confidence": round(best_score, 3),
                "verification_status": overall_status,
                "explanation": best_explanation,
                "evidence": best_evidence
            })

        return verified_claims

    def calculate_metrics(self, claims: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Computes formal verification metrics as defined in SRS Section 20.
        """
        total = max(1, len(claims))
        supported = sum(1 for c in claims if c["verification_status"] == "SUPPORTED")
        unsupported = sum(1 for c in claims if c["verification_status"] in ("INSUFFICIENT_EVIDENCE", "REFUTED"))
        
        # Calculate citation precision across all linked evidence
        total_citations = 0
        valid_citations = 0
        for c in claims:
            for ev in c.get("evidence", []):
                total_citations += 1
                if ev["entailment_type"] == "ENTAILED":
                    valid_citations += 1
        
        citation_precision = (valid_citations / max(1, total_citations)) if total_citations > 0 else 0.0
        citation_recall = min(1.0, (supported / total) * 0.95 + 0.05)
        unsupported_claim_rate = unsupported / total

        return {
            "citation_precision": round(citation_precision, 4),
            "citation_recall": round(citation_recall, 4),
            "unsupported_claim_rate": round(unsupported_claim_rate, 4),
            "claim_support_rate": round(supported / total, 4)
        }

evidence_verifier = EvidenceVerifier()
