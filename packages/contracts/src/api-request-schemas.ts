import { ingressPolicyUpdate } from "./ingress-policy.ts";
import { installationUpdateInput } from "./installation.ts";
import { snoozeNotificationInput } from "./notifications.ts";
import { z } from "zod";
import { resourceInput, tokenCreationInput, grantInput } from "./resources.ts";
import { destinationInput } from "./destinations.ts";
import { sharedVersionInput, sharedCopyInput, middlewareBindingInput, middlewareUpdateInput, middlewareOrderInput } from "./code.ts";
import { notificationChannelInput, notificationChannelUpdate, notificationChannelPreview, emailSettingsInput } from "./notification-channels.ts";
import { notificationRuleInput, notificationRuleUpdateInput, notificationSubscriptionInput } from "./notifications.ts";
import { organizationSecurityInput, organizationPolicyInput } from "./organization-policy.ts";
import { savedScriptTestInput, scriptTestInput } from "./script-test.ts";
import { bootstrapInput, emailPreviewInput, draftInput, publicationInput, activationInput, eventReplayInput, bulkReplayInput, invitationInput, onboardingInput, endpointInput, secretInput, secretImportInput, helperImportInput, invitationAcceptInput, tokenRevokeInput, emptyCommandInput } from "./http-inputs.ts";

/** The same validators used by HTTP handlers; no copied documentation shapes. */
export const apiRequestSchemas: Record<string, z.ZodType> = {
	"post /api/v1/bootstrap": bootstrapInput,
	"put /api/v1/endpoints/{endpointId}/protection": ingressPolicyUpdate,
	"put /api/v1/installation/settings": installationUpdateInput,
	"post /api/v1/notifications/{incidentId}/snooze": snoozeNotificationInput,
	"post /api/v1/email-settings/preview": emailPreviewInput,
	"put /api/v1/email-settings": emailSettingsInput,
	"patch /api/v1/endpoints/{endpointId}/drafts/{stage}": draftInput,
	"post /api/v1/endpoints/{endpointId}/publications": publicationInput,
	"patch /api/v1/endpoints/{endpointId}/publications": activationInput,
	"post /api/v1/endpoints/{endpointId}/pause": emptyCommandInput,
	"post /api/v1/endpoints/{endpointId}/resume": emptyCommandInput,
	"post /api/v1/endpoints/{endpointId}/test": scriptTestInput,
	"post /api/v1/endpoints/{endpointId}/tests": savedScriptTestInput,
	"put /api/v1/endpoints/{endpointId}/tests/{testId}": savedScriptTestInput,
	"post /api/v1/events/{eventId}/replay": eventReplayInput,
	"post /api/v1/events/replay": bulkReplayInput,
	"post /api/v1/invitations": invitationInput,
	"post /api/v1/invitations/accept": invitationAcceptInput,
	"put /api/v1/members": grantInput,
	"post /api/v1/middleware": middlewareBindingInput,
	"patch /api/v1/middleware/{bindingId}": middlewareUpdateInput,
	"post /api/v1/middleware/reorder": middlewareOrderInput,
	"post /api/v1/notification-channels": notificationChannelInput,
	"patch /api/v1/notification-channels/{channelId}": notificationChannelUpdate,
	"post /api/v1/notification-channels/preview": notificationChannelPreview,
	"patch /api/v1/notification-rules/{ruleId}": notificationRuleUpdateInput,
	"put /api/v1/notification-rules/{ruleId}/subscription": notificationSubscriptionInput,
	"post /api/v1/onboarding": onboardingInput,
	"post /api/v1/organizations": resourceInput,
	"put /api/v1/organizations/{organizationId}/security": organizationSecurityInput,
	"put /api/v1/organizations/{organizationId}/policy": organizationPolicyInput.omit({ organizationId: true }),
	"put /api/v1/destinations/{destinationId}": destinationInput,
	"post /api/v1/projects/{projectId}/destinations": destinationInput,
	"post /api/v1/projects/{projectId}/endpoints": endpointInput,
	"post /api/v1/projects/{projectId}/notification-rules": notificationRuleInput,
	"post /api/v1/projects": resourceInput,
	"post /api/v1/secrets": secretInput,
	"post /api/v1/secrets/import": secretImportInput,
	"post /api/v1/shared-code": sharedVersionInput,
	"post /api/v1/shared-code/{revisionId}/copy": sharedCopyInput,
	"post /api/v1/shared-code/{revisionId}/import": helperImportInput,
	"post /api/v1/tokens": tokenCreationInput,
	"delete /api/v1/tokens": tokenRevokeInput,
	"post /api/v1/workspaces": resourceInput,
	"post /api/v1/workspaces/{workspaceId}/notification-rules": notificationRuleInput,
};

export const versionedOperations = new Set(["delete /api/v1/endpoints/{endpointId}", "delete /api/v1/destinations/{destinationId}", "put /api/v1/destinations/{destinationId}", "patch /api/v1/endpoints/{endpointId}/drafts/{stage}", "post /api/v1/endpoints/{endpointId}/pause", "post /api/v1/endpoints/{endpointId}/resume", "patch /api/v1/middleware/{bindingId}", "patch /api/v1/notification-rules/{ruleId}"]);
