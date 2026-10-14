export const permissions = ["metadata.read", "payload.read", "events.replay", "endpoints.pause", "endpoints.configure", "destinations.configure", "code.read", "code.edit", "code.publish", "code.test", "code.test.effects", "secrets.manage", "secrets.use", "members.manage", "members.admit", "ownership.transfer", "audit.read", "settings.manage", "jobs.read", "jobs.manage", "workspaces.create", "projects.create", "tokens.manage", "notifications.read", "notifications.rules.manage"] as const;

export type Permission = (typeof permissions)[number];
