import "server-only";

import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import {
  disputeLifecycleEmail,
  providerVerificationDecisionEmail,
  providerVerificationSubmittedEmail,
  serviceProposalLifecycleEmail,
  type DisputeLifecycleStatus,
  type ProviderVerificationDecision,
  type ServiceProposalLifecycleStatus,
} from "@/lib/email/operational-lifecycle-templates";

export async function sendProviderVerificationSubmittedEmail(input: {
  verificationId: string;
  profileId: string;
  submissionToken: string;
}) {
  const content = providerVerificationSubmittedEmail();

  return sendKlyxDeduplicatedEmail({
    deduplicationKey:
      `provider-verification:${input.verificationId}:submitted:${input.submissionToken}:${input.profileId}`,
    templateKey: "provider_verification_submitted",
    profileId: input.profileId,
    ...content,
  });
}

export async function sendProviderVerificationDecisionEmail(input: {
  verificationId: string;
  reviewId: string;
  profileId: string;
  status: ProviderVerificationDecision;
  note?: string | null;
}) {
  const content = providerVerificationDecisionEmail({
    status: input.status,
    note: input.note,
  });

  return sendKlyxDeduplicatedEmail({
    deduplicationKey:
      `provider-verification:${input.verificationId}:review:${input.reviewId}:${input.profileId}`,
    templateKey: `provider_verification_${input.status}`,
    profileId: input.profileId,
    ...content,
  });
}

export async function sendDisputeLifecycleEmail(input: {
  disputeId: string;
  eventId: string;
  bookingId: string;
  profileId: string;
  status: DisputeLifecycleStatus;
  note?: string | null;
}) {
  const content = disputeLifecycleEmail({
    bookingId: input.bookingId,
    status: input.status,
    note: input.note,
  });

  return sendKlyxDeduplicatedEmail({
    deduplicationKey:
      `dispute:${input.disputeId}:event:${input.eventId}:${input.profileId}`,
    templateKey: `dispute_${input.status}`,
    profileId: input.profileId,
    ...content,
  });
}

export async function sendServiceProposalLifecycleEmail(input: {
  proposalId: string;
  profileId: string;
  proposalName: string;
  status: ServiceProposalLifecycleStatus;
  note?: string | null;
}) {
  const content = serviceProposalLifecycleEmail({
    proposalName: input.proposalName,
    status: input.status,
    note: input.note,
  });

  return sendKlyxDeduplicatedEmail({
    deduplicationKey:
      `service-proposal:${input.proposalId}:${input.status}:${input.profileId}`,
    templateKey: `service_proposal_${input.status}`,
    profileId: input.profileId,
    ...content,
  });
}
