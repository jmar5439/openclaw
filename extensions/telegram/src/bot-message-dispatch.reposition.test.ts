// Lane reposition must never delete a bubble carrying the delivered answer.
import { describe, expect, it, vi } from "vitest";
import {
  clearDraftLanesAtTeardown,
  repositionLaneForNewMessage,
  retireAnswerLane,
} from "./bot-message-dispatch-draft.js";
import type { TelegramDispatchTurn as Turn } from "./bot-message-dispatch.types.js";
import type { DraftLaneState } from "./lane-delivery-text-deliverer.js";

function createLane(stream: DraftLaneState["stream"], finalized: boolean): DraftLaneState {
  return {
    stream,
    lastPartialText: "",
    hasStreamedMessage: true,
    finalized,
    retainedPromptContextPages: [],
  };
}

function createTurn(answerLane: DraftLaneState): Turn {
  return {
    answerLane,
    lastAnswerPartialText: "",
    activeAnswerDraftIsToolProgressOnly: false,
    pendingAnswerBlockAssistantMessageIndex: undefined,
    activeAnswerBlockDelivery: undefined,
  } as unknown as Turn;
}

describe("repositionLaneForNewMessage", () => {
  it("rewinds without deleting when the lane carries the delivered answer", () => {
    const stream = {
      rotateToNewMessageDeferringDelete: vi.fn(),
      forceNewMessage: vi.fn(),
    };
    const lane = createLane(stream as never, true);
    const turn = createTurn(lane);
    repositionLaneForNewMessage(turn, lane);
    expect(stream.rotateToNewMessageDeferringDelete).not.toHaveBeenCalled();
    expect(stream.forceNewMessage).toHaveBeenCalledOnce();
    expect(lane.finalized).toBe(false);
  });

  it("repositions with deferred delete for unfinalized previews", () => {
    const stream = {
      rotateToNewMessageDeferringDelete: vi.fn(),
      forceNewMessage: vi.fn(),
    };
    const lane = createLane(stream as never, false);
    const turn = createTurn(lane);
    repositionLaneForNewMessage(turn, lane);
    expect(stream.rotateToNewMessageDeferringDelete).toHaveBeenCalledOnce();
    expect(stream.forceNewMessage).not.toHaveBeenCalled();
  });
});

describe("retireAnswerLane", () => {
  it("does not clear a finalized answer lane on explicit clear", async () => {
    const stream = {
      clear: vi.fn(async () => {}),
      forceNewMessage: vi.fn(),
      stop: vi.fn(async () => {}),
    };
    const lane = createLane(stream as never, true);
    const turn = createTurn(lane);
    await retireAnswerLane(turn, "clear");
    // Finalized lanes rotate (stop + rewind), never clear-delete.
    expect(stream.clear).not.toHaveBeenCalled();
  });
});

describe("clearDraftLanesAtTeardown", () => {
  function createStream() {
    return {
      stop: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };
  }

  function createTurnWithFlag(answerLane: DraftLaneState, toolProgressOnly: boolean): Turn {
    return {
      answerLane,
      lastAnswerPartialText: "",
      activeAnswerDraftIsToolProgressOnly: toolProgressOnly,
      pendingAnswerBlockAssistantMessageIndex: undefined,
      activeAnswerBlockDelivery: undefined,
    } as unknown as Turn;
  }

  it("stops an answer lane carrying streamed answer text before clearing", async () => {
    const stream = createStream();
    const lane = createLane(stream as never, false);
    const turn = createTurnWithFlag(lane, false);
    await clearDraftLanesAtTeardown(turn, [lane]);
    // stop() records final state so the teardown clear retains the answer.
    expect(stream.stop).toHaveBeenCalledOnce();
    expect(stream.clear).toHaveBeenCalledOnce();
  });

  it("keeps progress-only cleanup deleting stale previews", async () => {
    const stream = createStream();
    const lane = createLane(stream as never, false);
    const turn = createTurnWithFlag(lane, true);
    await clearDraftLanesAtTeardown(turn, [lane]);
    expect(stream.stop).not.toHaveBeenCalled();
    expect(stream.clear).toHaveBeenCalledOnce();
  });

  it("skips finalized lanes entirely", async () => {
    const stream = createStream();
    const lane = createLane(stream as never, true);
    const turn = createTurnWithFlag(lane, false);
    await clearDraftLanesAtTeardown(turn, [lane]);
    expect(stream.stop).not.toHaveBeenCalled();
    expect(stream.clear).not.toHaveBeenCalled();
  });

  it("never stops the reasoning lane at teardown", async () => {
    const answerStream = createStream();
    const answerLane = createLane(answerStream as never, false);
    const reasoningStream = createStream();
    const reasoningLane: DraftLaneState = {
      ...createLane(reasoningStream as never, false),
    };
    const turn = createTurnWithFlag(answerLane, false);
    await clearDraftLanesAtTeardown(turn, [answerLane, reasoningLane]);
    expect(reasoningStream.stop).not.toHaveBeenCalled();
    expect(reasoningStream.clear).toHaveBeenCalledOnce();
  });
});
