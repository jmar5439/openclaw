<<<<<<< HEAD
/**
 * Select deferred plugin migration warnings that no longer describe current state:
 * the plugin's obligation left the pending ledger, or a later warning for the same
 * plugin superseded it.
 * Matches both shipped warning forms without reading retired migration reports.
 * Messages are ordered oldest first.
 */
export async function readRetiredDeferredPluginMigrationWarnings(
  messages: readonly (string | undefined)[],
): Promise<ReadonlySet<string>> {
  const pluginWarnings = new Map<string, string>();
  const latestByPlugin = new Map<string, string>();
=======
/** Match both shipped warning forms without reading retired migration reports. */
export async function readResolvedDeferredPluginMigrationWarnings(
  messages: readonly (string | undefined)[],
): Promise<ReadonlyMap<string, number>> {
  const pluginWarnings = new Map<string, string>();
>>>>>>> test/all-fixes-2026.9.8
  for (const message of messages) {
    const pluginId =
      message &&
      /^Plugin "([^"]+)" (?:state migration is pending|data\/settings upgrade is unfinished):/u.exec(
        message,
      )?.[1];
    if (message && pluginId) {
      pluginWarnings.set(message, pluginId);
<<<<<<< HEAD
      latestByPlugin.set(pluginId, message);
    }
  }
  if (!pluginWarnings.size) {
    return new Set();
  }
  const { readDeferredPluginMigrationsAsync } = await import("./deferred-plugin-migrations.js");
  const pending = new Set(
    (await readDeferredPluginMigrationsAsync()).map(({ pluginId }) => pluginId),
  );
  return new Set(
    [...pluginWarnings]
      .filter(
        ([message, pluginId]) => !pending.has(pluginId) || latestByPlugin.get(pluginId) !== message,
      )
      .map(([message]) => message),
  );
}

/**
 * Drops warnings a later repair in the same pass settled or superseded, such as
 * post-session plugin migrations finishing after config preflight reported them
 * pending. The ledger is authoritative; an unreadable ledger keeps every warning.
 */
export async function retainCurrentDeferredPluginMigrationWarnings(
  warnings: readonly string[],
): Promise<string[]> {
  const retired = await readRetiredDeferredPluginMigrationWarnings(warnings).catch(
    () => new Set<string>(),
  );
  return warnings.filter((warning) => !retired.has(warning));
=======
    }
  }
  if (!pluginWarnings.size) {
    return new Map();
  }
  const { readDeferredPluginMigrationCompletionsAsync } =
    await import("./deferred-plugin-migrations.js");
  const completions = new Map(
    (await readDeferredPluginMigrationCompletionsAsync()).map(({ pluginId, completedAtMs }) => [
      pluginId,
      completedAtMs,
    ]),
  );
  const resolved = new Map<string, number>();
  for (const [message, pluginId] of pluginWarnings) {
    const completedAtMs = completions.get(pluginId);
    if (completedAtMs !== undefined) {
      resolved.set(message, completedAtMs);
    }
  }
  return resolved;
>>>>>>> test/all-fixes-2026.9.8
}
