# M04B2F-3 — MOH batch classification

Status: **PASS; STOP BEFORE F4**.

- Input rows: **1506**; terminal row decisions: **1506**.
- T0/T1/T2 eligible rows: **0**; unique eligible FMA IDs: **0**; new IDs: **0**.
- Tier counts: `T0=0`, `T1=0`, `T2=0`, `T3=0`, `T4=0`, `T5=0`, `T6=1506`, `TX=0`.
- Dispositions: `IDENTITY_REVIEW=1506`.
- Bulk review packets: **11**; grouped queue dimensions emitted: SCTID, SEP/scope, blockers, family, candidate FMA and relation.

No source row was promoted. F4 was not run because coverage did not increase. The bottleneck is the absence of an authorized pinned FMA/SNOMED endpoint dataset and an admitted exact bridge assertion; the lexical/legacy candidate hints remain T6 review evidence.
