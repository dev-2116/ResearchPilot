import pytest
from app.services.verifier import evidence_verifier

def test_claim_extraction():
    sample_text = "Hybrid retrieval combines BM25 and neural embeddings. Claim verification reduces hallucinations by over 40 percent. Autonomous agents require reproducible manifests."
    claims = evidence_verifier.extract_claims_from_text(sample_text)
    assert len(claims) >= 2

def test_claim_verification_entailment():
    claim = "Retrieval-Augmented Generation models combine parametric and non-parametric memory."
    evidence_passage = "Retrieval-Augmented Generation (RAG) models combine pre-trained parametric memory with non-parametric memory of dense vector indices."
    
    entailment, score, explanation = evidence_verifier.assess_entailment(claim, evidence_passage)
    assert entailment == "ENTAILED"
    assert score >= 0.55
