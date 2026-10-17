import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAutoCleanupTempDirTracker } from "../../test/helpers/temp-dir.js";
import { acquireGatewayLock, readActiveGatewayLockIdentity } from "../infra/gateway-lock.js";
import { createDeferredCore } from "../shared/deferred.js";
import { GatewayStartupCleanupError } from "./server-shutdown.js";
import { startGatewayServer } from "./server.js";

type GatewayLock = NonNullable<Awaited<ReturnType<typeof acquireGatewayLock>>>;
const runtime = vi.hoisted(() => ({
  close: async () => {},
<<<<<<< HEAD
  start: async () => {},
  startupError: undefined as Error | undefined,
  locks: [] as GatewayLock[],
  ownerLoss: new AbortController(),
}));

vi.mock("../infra/gateway-state-owner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infra/gateway-state-owner.js")>();
  return {
    ...actual,
    captureGatewayStateOwner(databasePath: string) {
      const owner = actual.captureGatewayStateOwner(databasePath);
      return owner ? { ...owner, signal: runtime.ownerLoss.signal } : undefined;
    },
  };
});
=======
  startupError: undefined as Error | undefined,
  locks: [] as GatewayLock[],
}));

>>>>>>> test/all-fixes-2026.9.8
vi.mock("../infra/gateway-lock.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infra/gateway-lock.js")>();
  return {
    ...actual,
    async acquireGatewayLock(options: Parameters<typeof actual.acquireGatewayLock>[0]) {
      const lock = await actual.acquireGatewayLock({
        ...options,
        allowInTests: true,
        timeoutMs: 0,
      });
      if (lock) {
        runtime.locks.push(lock);
      }
      return lock;
    },
  };
});
vi.mock("../process/spawn-broker/context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../process/spawn-broker/context.js")>()),
  startGatewaySpawnBroker: async () => undefined,
}));
vi.mock("../state/openclaw-state-lease-heartbeat.js", () => ({
  startOpenClawStateLeaseHeartbeat: () => ({ ready: Promise.resolve(), stop: async () => {} }),
}));
vi.mock("./server-start.js", () => ({
  startGatewayServerCore: async () => {
<<<<<<< HEAD
    await runtime.start();
=======
>>>>>>> test/all-fixes-2026.9.8
    if (runtime.startupError) {
      throw runtime.startupError;
    }
    return {
      startupSettled: Promise.resolve(),
      getTailscaleIngressEndpoint: () => undefined,
      close: () => runtime.close(),
    };
  },
}));

const tempDirs = useAutoCleanupTempDirTracker(afterEach);
beforeEach(() => {
  const root = tempDirs.make("openclaw-server-owner-");
  vi.stubEnv("OPENCLAW_STATE_DIR", root);
  vi.stubEnv("OPENCLAW_CONFIG_PATH", path.join(root, "openclaw.json"));
  runtime.close = async () => {};
<<<<<<< HEAD
  runtime.start = async () => {};
  runtime.startupError = undefined;
  runtime.ownerLoss = new AbortController();
=======
  runtime.startupError = undefined;
>>>>>>> test/all-fixes-2026.9.8
});
afterEach(async () => {
  for (const lock of runtime.locks.splice(0)) {
    await lock.release();
  }
  vi.unstubAllEnvs();
});

it("refuses a second direct Gateway until the first finishes closing", async () => {
  const first = await startGatewayServer(18701);
  const closed = createDeferredCore();
  const closing = createDeferredCore();
  runtime.close = async () => {
    closing.resolve();
    await closed.promise;
  };
  const stop = first.close();
  await closing.promise;
  try {
    await expect(startGatewayServer(18702)).rejects.toThrow("gateway state ownership");
    expect(await readActiveGatewayLockIdentity()).toMatchObject({ pid: process.pid, port: 18701 });
  } finally {
    closed.resolve();
    await stop;
  }
  runtime.close = async () => {};
  const successor = await startGatewayServer(18702);
  await successor.close();
  expect(await readActiveGatewayLockIdentity()).toBeUndefined();
});

<<<<<<< HEAD
it("joins a lost direct owner's close once before releasing its lock", async () => {
  const closing = createDeferredCore();
  const closed = createDeferredCore();
  runtime.close = vi.fn(async () => {
    closing.resolve();
    await closed.promise;
  });
  const server = await startGatewayServer(18701);
  runtime.ownerLoss.abort(new Error("ownership lost: /state/owner.lock: EIO"));
  await closing.promise;
  const joined = server.close();
  try {
    expect(runtime.close).toHaveBeenCalledOnce();
    expect(await readActiveGatewayLockIdentity()).toMatchObject({ port: 18701 });
  } finally {
    closed.resolve();
    await joined;
  }
  expect(await readActiveGatewayLockIdentity()).toBeUndefined();
});

it("requests hosted recovery only for the current server generation", async () => {
  const lock = await acquireGatewayLock({ port: 18701 });
  const hotReloadRecovery = vi.fn(() => ({ status: "emitted" as const }));
  const opts = { gatewayStateOwner: lock!, hotReloadRecovery };
  const first = await startGatewayServer(18701, opts);
  await first.close();
  const retired = runtime.ownerLoss;
  runtime.ownerLoss = new AbortController();
  const second = await startGatewayServer(18701, opts);
  runtime.close = vi.fn(async () => {});
  retired.abort(new Error("retired ownership lost"));
  expect(hotReloadRecovery).not.toHaveBeenCalled();
  runtime.ownerLoss.abort(new Error("ownership lost: /state/owner.lock: EIO"));
  expect(hotReloadRecovery).toHaveBeenCalledExactlyOnceWith(
    "Error: ownership lost: /state/owner.lock: EIO",
  );
  expect(runtime.close).not.toHaveBeenCalled();
  await second.close();
});

it("closes a server opened during custody loss before rejecting startup", async () => {
  const starting = createDeferredCore();
  const started = createDeferredCore();
  runtime.start = async () => {
    starting.resolve();
    await started.promise;
  };
  runtime.close = vi.fn(async () => {
    expect(await readActiveGatewayLockIdentity()).toMatchObject({ port: 18701 });
  });
  const pending = startGatewayServer(18701);
  await starting.promise;
  const failure = new Error("ownership lost: /state/owner.lock: EIO");
  runtime.ownerLoss.abort(failure);
  const rejected = expect(pending).rejects.toBe(failure);
  started.resolve();
  await rejected;
  expect(runtime.close).toHaveBeenCalledOnce();
=======
it("releases direct ownership after a clean startup failure", async () => {
  runtime.startupError = new Error("startup failed");
  await expect(startGatewayServer(18701)).rejects.toBe(runtime.startupError);
  runtime.startupError = undefined;
  const successor = await startGatewayServer(18702);
  await successor.close();
>>>>>>> test/all-fixes-2026.9.8
  expect(await readActiveGatewayLockIdentity()).toBeUndefined();
});

it("keeps the run loop's owner across server generations and rejects its retired capability", async () => {
  const lock = await acquireGatewayLock({ port: 18701 });
  expect(lock).not.toBeNull();
  const first = await startGatewayServer(18701, { gatewayStateOwner: lock! });
  await first.close();
  await expect(startGatewayServer(18702)).rejects.toThrow("gateway state ownership");
  const restarted = await startGatewayServer(18701, { gatewayStateOwner: lock! });
  await restarted.close();
  await lock!.release();
  await expect(startGatewayServer(18701, { gatewayStateOwner: lock! })).rejects.toThrow(
    "no longer current",
  );
});

<<<<<<< HEAD
it.each(["clean startup", "startup", "shutdown"] as const)(
  "releases ownership only after successful cleanup: %s",
  async (phase) => {
    const failure =
      phase === "clean startup"
        ? new Error("startup failed")
        : new GatewayStartupCleanupError(new Error("startup"), new Error("cleanup"));
    if (phase !== "shutdown") {
=======
it.each(["startup", "shutdown"] as const)(
  "retains direct ownership when %s cleanup has not completed",
  async (phase) => {
    const failure = new GatewayStartupCleanupError(new Error("startup"), new Error("cleanup"));
    if (phase === "startup") {
>>>>>>> test/all-fixes-2026.9.8
      runtime.startupError = failure;
      await expect(startGatewayServer(18701)).rejects.toBe(failure);
      runtime.startupError = undefined;
    } else {
      const first = await startGatewayServer(18701);
      runtime.close = async () => {
        throw failure;
      };
      await expect(first.close()).rejects.toBe(failure);
      runtime.close = async () => {};
    }
<<<<<<< HEAD
    if (phase === "clean startup") {
      const successor = await startGatewayServer(18702);
      await successor.close();
      expect(await readActiveGatewayLockIdentity()).toBeUndefined();
    } else {
      await expect(startGatewayServer(18702)).rejects.toThrow("gateway state ownership");
    }
=======
    await expect(startGatewayServer(18702)).rejects.toThrow("gateway state ownership");
>>>>>>> test/all-fixes-2026.9.8
  },
);
