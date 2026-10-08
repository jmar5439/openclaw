// Lane reposition must never delete a bubble carrying the delivered answer.
import { describe, expect, it, vi } from "vitest";
import { repositionLaneForNewMessage, retireAnswerLane } from "./bot-message-dispatch-draft.js";
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
