/** Compose one CI-owned release file, deferring lineage enforcement until data is mapped. */
export function composeReleaseMigration(schema: string, runtime: string) {
	let needsLineageConstraint = false;
	const staged = schema.replace(/(ALTER TABLE "payloadbay"\."workspace" ADD COLUMN "organization_id" uuid) NOT NULL;/g, (_statement, column: string) => {
		needsLineageConstraint = true;

		return column + ";";
	});
	const enforce = needsLineageConstraint ? '\nALTER TABLE "payloadbay"."workspace" ALTER COLUMN "organization_id" SET NOT NULL;\n' : "";

	return staged + "\n--> statement-breakpoint\n" + runtime + enforce;
}
