# Durable execution journal

Snapshot: 2026-08-29. This document describes the durable authorization-claim and journal primitive used by the explicit local-file-only `execute-once` worker path. It does not claim a real transaction or production-ready automatic recovery.

## Security objective

A human-authorized execution bundle is a one-time capability. Process restart, concurrent requests, a later reconciliation error, or a stale UI must never turn one authorization into two distinct transactions.

`@outcome-guard/execution-coordinator` provides the persistence boundary needed before a write:

1. Require an absolute `EXECUTION_STATE_DIR`.
2. Scope state to the configured dedicated Shannon signer.
3. Acquire an exclusive filesystem signer lock. An existing lock fails closed and requires explicit operator reconciliation; the process never guesses that a lock is stale.
4. Independently verify the bundle, recovered human signer, exact raw IOC mandate, deadline, worker identity, receipt chain and arithmetic.
5. Create a one-time claim with exclusive-create semantics and flush it before the first execution journal event.
6. Append canonical JSONL records with strictly increasing sequence numbers, SHA-256 event hashes and `previousEventHash` links.
7. Flush every record before allowing the next state transition.

The journal contains identifiers and evidence hashes, never a private key, raw signed transaction, access token, seed phrase, or full human signature.

## States

Implemented event vocabulary:

```text
JOB_ACCEPTED
-> PREFLIGHT_PASSED
-> SUBMISSION_INTENT_RECORDED
-> TX_BROADCAST
-> TX_MINED_SUCCESS | TX_MINED_REVERT
-> POSITION_RECONCILED
-> RECEIPT_SEALED
```

`TX_ZERO_FILL`, `AMBIGUOUS_SUBMISSION`, and `TERMINAL_FAILURE` preserve honest failure semantics. A mined success followed by a reconciliation failure must not be represented as a revert and must never cause the authorization to be replayed.

## Recovery rules

- A duplicate claim is permanently rejected, including after a new journal instance is created.
- A torn final JSONL record blocks initialization and requires manual chain/nonce reconciliation.
- A changed, reordered, removed, or malformed complete record breaks sequence/hash validation and blocks initialization.
- An existing signer lock blocks another process. Stale-lock removal is an explicit operator action only after confirming the old replica is stopped and reconciling pending chain state.
- The current SDK write path does not expose a pre-signed raw transaction with an explicit nonce. `execute-once` records `SUBMISSION_INTENT_RECORDED` before entering the SDK and permanently retains the claim/lock if the call becomes ambiguous. It never auto-retries; an operator must reconcile the signer nonce and chain state.

## Durability portability

Files and claim records are flushed on all supported systems. Parent-directory `fsync` is also required on Linux, which is the production container target. Windows returns `EPERM` for directory-handle `fsync`; local Windows tests therefore verify file flush, exclusive creation, lock behavior, sequence/hash recovery and corruption failure, but do not claim Linux-equivalent metadata durability.

## Verification

Automated tests cover:

- restart verification of a two-record hash chain;
- exclusive signer locking;
- changed-record and torn-write refusal;
- 25 concurrent appends producing exactly ordered unique sequences;
- refusal of relative state paths.

Implemented wiring: exact mandate reconstruction, fresh shared-policy rerun, required starting premium-risk input, adapter execution, mined result/position reconciliation, linked receipt persistence, and ambiguous-submission lock retention. Funded Shannon execution and a separately authorized winning redemption are complete in `docs/evidence/redemption-campaign-eec6`. Remaining resilience work is crash injection around the SDK submission call, explicit transaction-hash/nonce recovery, and a persistent-volume restart exercise.
