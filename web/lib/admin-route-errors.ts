function extractErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function describeAdminDataError(
  err: unknown,
  opts: {
    entityLabel: string;
    tableName: string;
    migrationFile: string;
    fallbackMessage: string;
  }
) {
  const message = extractErrorMessage(err);
  const lower = message.toLowerCase();
  const tableLower = opts.tableName.toLowerCase();

  if (
    lower.includes(`relation "${tableLower}" does not exist`) ||
    lower.includes(`relation '${tableLower}' does not exist`) ||
    lower.includes(`could not find the table '${tableLower}'`) ||
    lower.includes(`could not find the table "${tableLower}"`)
  ) {
    return `${opts.entityLabel} er ikke sat op i databasen endnu. Kør migrationen ${opts.migrationFile}.`;
  }

  return opts.fallbackMessage;
}
