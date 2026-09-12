# KLYX Trust & Safety + legal delivery foundation

## Decision model

KLYX must answer one operational question:

> Can this account perform this concrete mission, in this category and jurisdiction, under the current policy version?

KLYX must not turn `client`, `provider`, a BCE registration, a social-insurance declaration, a student context, activity frequency or a trust score into an irreversible legal status.

The canonical subject is `public.accounts`. Historical `provider_*` tables remain compatibility data while the product migrates away from role-as-identity.

## Three separate layers

1. **Facts and evidence**
   - account declarations (`trust_work_contexts`)
   - identity and other verifications (`trust_verifications`)
   - qualifications/licences (`trust_credentials`)
   - explainable trust history (`trust_level_assessments`)
   - cases and restrictions (`trust_cases`, `trust_restrictions`)

2. **Operational legal-pathway assessment**
   - `trust_legal_assessments`
   - possible outputs:
     - `undetermined`
     - `occasional_compatible`
     - `employment_structure_required`
     - `independent_compatible`
     - `multiple_possible`
   - this is an operational compatibility assessment, not a declaration of legal status
   - ambiguous assessments default to pending human review

3. **Mission eligibility**
   - deterministic policy engine in `lib/trust-safety/mission-eligibility.ts`
   - category/jurisdiction policy in `trust_category_policies`
   - immutable-style decision snapshot in `trust_eligibility_decisions`
   - human review / appeal in `trust_decision_reviews`

## Eligibility order

The mission gate evaluates, in order:

1. active restrictions relevant to the mission;
2. identity level;
3. required verification kinds;
4. required qualifications/credentials;
5. explainable trust level;
6. operational legal-pathway assessment;
7. category/jurisdiction-specific mandatory review.

Missing evidence produces `requirements_missing`, not a permanent ban.

An adverse trust-level mismatch or unresolved legal pathway produces `human_review_required`.

A policy-engine `ineligible` decision must expose a human-review path.

## Suspension and enforcement rules

A report is evidence to investigate, not proof of wrongdoing.

Every restriction must:

- be linked to a Trust & Safety case;
- have a stable reason code;
- contain a written rationale;
- be scoped (`platform`, `category`, `service`, or `booking`);
- identify the restricted action;
- be reviewable when required.

A restriction imposed by the system cannot be indefinite: it must have an end time and a human-review due time.

Human reviewers should normally create a superseding decision rather than rewriting historical decisions.

## Belgium V1 legal guardrails

These are architecture guardrails, not legal advice. Validate them with Belgian counsel before production activation of each category.

### Relationship classification

Belgian employment law assesses the concrete execution of the relationship. Formal labels such as contract title, social-security registration, BCE registration, VAT registration or tax treatment do not by themselves determine whether a relationship is salaried or independent.

Official source: SPF Emploi — Nature de la relation de travail
https://emploi.belgique.be/fr/themes/contrats-de-travail/nature-de-la-relation-de-travail-travail-salarie-ou-travail-independant

### Platform work

Since 1 January 2023, Belgian law includes specific criteria for activities performed via a digital work platform. Product controls over pricing, ranking, task allocation, acceptance/refusal, schedules, sanctions, presentation/behaviour and ability to build an outside clientele can matter to the analysis.

KLYX product design must therefore treat platform-control features as legal-risk inputs. The legal assessment must not infer independence from registration facts alone.

Official source: SPF Emploi — Nature de la relation de travail: secteurs
https://emploi.belgique.be/fr/themes/contrats-de-travail/nature-de-la-relation-de-travail-travail-salarie-ou-travail-1

### Cleaning

Cleaning is one of the Belgian sectors covered by a rebuttable presumption framework. It must not inherit a generic low-risk "occasional" policy. Belgium cleaning policies should remain in draft / mandatory legal review until the precise operating model has been validated.

### Employment structure

`employment_structure_required` means KLYX has concluded that the mission must pass through a compatible employment arrangement before it may proceed. It does not mean KLYX itself is already a licensed employer, temporary-work agency, service-voucher company or employer-of-record.

Any such operating structure must be separately verified and represented through `trust_verifications(kind = 'employment_structure')` or a future dedicated structure registry.

For service-voucher activities, authorised activity scope is limited and region-specific rules must be checked before activation.

Official source: SPF Emploi — Contrat de travail titres-services: activités autorisées
https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-travail-titres-services-0

### Independent pathway

When a person is subject to the Belgian social status of self-employed workers, affiliation with a social-insurance fund is required. That evidence can be verified, but it still does not replace relationship classification.

Official source: SPF Sécurité sociale — Caisses d'assurances sociales
https://socialsecurity.belgium.be/fr/elaboration-de-la-politique-sociale/independants/liste-des-caisses-dassurances-sociales

### Regulated professions / competencies

Professional-access requirements remain category- and region-dependent, including requirements that still exist in Brussels-Capital and Wallonia. Requirements therefore belong in versioned category/jurisdiction policies, not in a global account role.

Official source: SPF Economie — Conditions d'accès à la profession
https://economie.fgov.be/fr/themes/entreprises/creer-une-entreprise/les-conditions-dacces-la

### Ambiguous relationship

When the employee/independent classification is unclear, Belgian mechanisms exist for a decision or opinion from the Administrative Commission for the Regulation of the Employment Relationship. KLYX should retain a human-review outcome such as `multiple_possible` or `undetermined` rather than forcing a guess.

Official source: SPF Sécurité sociale — Décision/avis relative au statut social
https://socialsecurity.belgium.be/fr/decision-relative-au-statut-social-salarie-ou-independant

## Automated decisions and AI

Trust & Safety decisions can significantly affect access to missions. KLYX should not use an LLM or opaque model as the sole final authority for suspension, fraud attribution, legal pathway classification, or other materially adverse decisions.

The current foundation therefore uses:

- deterministic reason codes;
- explicit policy versions;
- normalized input snapshots;
- a separate human-review/appeal ledger;
- no permanent numeric trust score;
- no direct browser access to sensitive T&S evidence.

GDPR Article 22 protections can apply to solely automated decisions producing legal or similarly significant effects, and require safeguards in relevant cases, including human intervention and contestation rights.

AI systems used for employment, worker management or access to self-employment are also within the AI Act's Annex III sensitive-use taxonomy. Applicability dates and the AI Omnibus transition should be re-checked before launch.

## Data minimisation

Do not copy raw identity documents, full private-message bodies or unnecessary sensitive evidence into decision snapshots or case events.

Store secure evidence through approved evidence systems and reference it with opaque identifiers.

User-facing APIs should expose only the minimum explanation necessary to understand a decision, complete a requirement, or request review.

## Rollout order

1. Apply schema foundation only.
2. Build internal policy registry and human-review queue.
3. Map KLYX service categories to jurisdiction policies.
4. Integrate Sumsub/identity evidence into `trust_verifications`.
5. Add category-specific qualification verification.
6. Add legal-work-context intake without auto-classification.
7. Add case/report APIs and restriction workflow.
8. Gate mission acceptance/assignment through `evaluateMissionEligibility`.
9. Expose user-facing explanations and appeals.
10. Activate one Belgian category at a time only after legal/policy sign-off.
