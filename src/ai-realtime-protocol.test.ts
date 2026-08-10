import { describe, expect, it } from "vitest";
import {
  cancelActiveRealtimeResponse,
  createAudioAppendEvent,
  createRealtimeSessionUpdate,
  createRealtimeProtocolState,
  resamplePcm16Le16To24,
  reduceRealtimeServerEvent,
} from "./ai-realtime-protocol";
import { createPcm16Le16To24Resampler } from "./ai-realtime-audio";

describe("Realtime protocol", () => {
  it("retires a cancelled response while preserving its received partial text", () => {
    const active = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      activeResponseId: "response-1",
      assistantText: "받은 부분",
    };

    const cancelled = cancelActiveRealtimeResponse(active);
    expect(cancelled).toMatchObject({
      phase: "listening",
      responseComplete: false,
      activeResponseId: "response-1",
      assistantText: "받은 부분",
      retiredResponseIds: ["response-1"],
    });
    expect(reduceRealtimeServerEvent(cancelled, {
      type: "response.output_text.delta",
      response_id: "response-1",
      delta: " 늦은 내용",
    }).assistantText).toBe("받은 부분");
  });

  it("tracks response completion as an explicit lifecycle state", () => {
    let state = createRealtimeProtocolState();
    expect(state.responseComplete).toBe(false);
    state = reduceRealtimeServerEvent(state, {
      type: "response.created",
      response: { id: "response-1" },
    });
    expect(state.responseComplete).toBe(false);
    state = reduceRealtimeServerEvent(state, {
      type: "response.done",
      response: { id: "response-1" },
    });
    expect(state.responseComplete).toBe(true);
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-2",
    });
    expect(state.responseComplete).toBe(false);
  });

  it("configures text-only semantic VAD for the glasses microphone", () => {
    const event = createRealtimeSessionUpdate("ko");
    expect(event.type).toBe("session.update");
    expect(event.session.output_modalities).toEqual(["text"]);
    expect(event.session.audio.input.noise_reduction.type).toBe("far_field");
    expect(event.session.audio.input.transcription.model)
      .toBe("gpt-4o-mini-transcribe");
    expect(event.session.audio.input.format.rate).toBe(24_000);
    expect(event.session.audio.input.turn_detection).toMatchObject({
      type: "semantic_vad",
      create_response: true,
      interrupt_response: true,
    });
    expect(event.session.instructions).toContain("Korean");
  });

  it("normalizes app locales to transcription language codes", () => {
    expect(createRealtimeSessionUpdate("zh-Hant").session.audio.input
      .transcription.language).toBe("zh");
    expect(createRealtimeSessionUpdate("fil").session.audio.input
      .transcription.language).toBe("tl");
  });

  it("registers built-in functions and enabled MCP servers with approval", () => {
    const event = createRealtimeSessionUpdate("en", [{
      id: "docs",
      name: "Docs MCP",
      url: "https://mcp.example.com/sse",
      authorization: "local-secret",
      allowedTools: ["search"],
      enabled: true,
    }]);
    expect(event.session.tool_choice).toBe("auto");
    expect(event.session.tools.map((tool) => tool.type)).toEqual([
      "function", "function", "function", "mcp",
    ]);
    expect(event.session.tools.at(-1)).toMatchObject({
      server_label: "mcp_docs",
      authorization: "local-secret",
      require_approval: "always",
      allowed_tools: ["search"],
    });
  });

  it("encodes PCM bytes without changing their contents", () => {
    expect(createAudioAppendEvent(new Uint8Array([0, 1, 254, 255])))
      .toEqual({ type: "input_audio_buffer.append", audio: "AAH+/w==" });
  });

  it("resamples signed 16-bit little-endian PCM from 16 kHz to 24 kHz", () => {
    const input = new Int16Array([0, 1_000, 2_000, 3_000]);
    const output = resamplePcm16Le16To24(
      new Uint8Array(input.buffer),
    );
    expect(output.byteLength).toBe(12);
    expect([...new Int16Array(output.buffer)]).toEqual([
      0,
      667,
      1_333,
      2_000,
      2_667,
      3_000,
    ]);
  });

  it("preserves the waveform when source PCM arrives in uneven stream packets", () => {
    const input = new Int16Array(Array.from({ length: 97 }, (_, index) => (
      Math.round(Math.sin(index / 7) * 12_000)
    )));
    const bytes = new Uint8Array(input.buffer);
    const resampler = createPcm16Le16To24Resampler();
    const pieces = [bytes.slice(0, 35), bytes.slice(35, 112), bytes.slice(112)];
    const output = pieces.map((piece) => resampler.push(piece));
    output.push(resampler.flush());
    const joined = new Uint8Array(output.reduce((total, piece) => total + piece.length, 0));
    let offset = 0;
    for (const piece of output) {
      joined.set(piece, offset);
      offset += piece.length;
    }
    expect([...new Int16Array(joined.buffer)]).toEqual([
      ...new Int16Array(resamplePcm16Le16To24(bytes).buffer),
    ]);
  });

  it("reduces transcription, streaming text, and response usage", () => {
    let state = createRealtimeProtocolState();
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
    });
    expect(state.phase).toBe("listening");
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "오늘 일정 알려줘",
      usage: {
        input_token_details: { audio_tokens: 24 },
        output_token_details: { text_tokens: 7 },
      },
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      delta: "오늘은 ",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      delta: "일정이 없습니다.",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.done",
      response: {
        usage: {
          input_token_details: {
            text_tokens: 20,
            audio_tokens: 40,
            cached_tokens: 8,
            cached_tokens_details: {
              text_tokens: 3,
              audio_tokens: 5,
            },
          },
          output_token_details: { text_tokens: 12 },
        },
      },
    });
    expect(state.userText).toBe("오늘 일정 알려줘");
    expect(state.assistantText).toBe("오늘은 일정이 없습니다.");
    expect(state.phase).toBe("listening");
    expect(state.usage).toMatchObject({
      textInputTokens: 17,
      audioInputTokens: 35,
      cachedTextInputTokens: 3,
      cachedAudioInputTokens: 5,
      textOutputTokens: 12,
      transcriptionAudioInputTokens: 24,
      transcriptionTextOutputTokens: 7,
    });
    expect(state.charge.estimatedNanoUsd).toBeGreaterThan(0);
  });

  it("archives the completed exchange before a fresh semantic-VAD turn", () => {
    let state = reduceRealtimeServerEvent(createRealtimeProtocolState(), {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "First question",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      delta: "First answer",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
    });
    expect(state.turns).toEqual([{
      user: "First question",
      assistant: "First answer",
    }]);
    expect(state.userText).toBe("");
    expect(state.assistantText).toBe("");
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "Second question",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      delta: "Second answer",
    });

    expect(state.userText).toBe("Second question");
    expect(state.assistantText).toBe("Second answer");
  });

  it("keeps late transcription events out of the active turn", () => {
    let state = reduceRealtimeServerEvent(createRealtimeProtocolState(), {
      type: "input_audio_buffer.speech_started",
      item_id: "user-1",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-1",
      transcript: "First question",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.created",
      response: { id: "response-1" },
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      response_id: "response-1",
      delta: "First answer",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-2",
    });

    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "user-1",
      delta: " late",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-1",
      transcript: "First question late",
      usage: {
        input_token_details: { audio_tokens: 11 },
        output_token_details: { text_tokens: 4 },
      },
    });
    expect(state.userText).toBe("");
    expect(state.turns).toEqual([{
      user: "First question late",
      assistant: "First answer",
    }]);
    expect(state.usage).toMatchObject({
      transcriptionAudioInputTokens: 11,
      transcriptionTextOutputTokens: 4,
    });

    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-2",
      transcript: "Second question",
    });
    expect(state.userText).toBe("Second question");
  });

  it("keeps late response events out of the active turn", () => {
    let state = reduceRealtimeServerEvent(createRealtimeProtocolState(), {
      type: "input_audio_buffer.speech_started",
      item_id: "user-1",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-1",
      transcript: "First question",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.created",
      response: { id: "response-1" },
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      response_id: "response-1",
      delta: "First answer",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-2",
    });

    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      response_id: "response-1",
      delta: " late",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.done",
      response: {
        id: "response-1",
        usage: {
          input_token_details: { text_tokens: 9, audio_tokens: 18 },
          output_token_details: { text_tokens: 5 },
        },
      },
    });
    expect(state.assistantText).toBe("");
    expect(state.phase).toBe("listening");
    expect(state.turns[0]?.assistant).toBe("First answer late");
    expect(state.usage).toMatchObject({
      textInputTokens: 9,
      audioInputTokens: 18,
      textOutputTokens: 5,
    });

    state = reduceRealtimeServerEvent(state, {
      type: "response.created",
      response: { id: "response-2" },
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.delta",
      response_id: "response-2",
      delta: "Second answer",
    });
    expect(state.assistantText).toBe("Second answer");
    expect(state.phase).toBe("thinking");
  });

  it("retains a placeholder for a turn whose text arrives entirely late", () => {
    let state = reduceRealtimeServerEvent(createRealtimeProtocolState(), {
      type: "input_audio_buffer.speech_started",
      item_id: "user-1",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.created",
      response: { id: "response-1" },
    });
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-2",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-1",
      transcript: "Entirely late question",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "response.output_text.done",
      response_id: "response-1",
      text: "Entirely late answer",
    });

    expect(state.userText).toBe("");
    expect(state.assistantText).toBe("");
    expect(state.turns).toEqual([{
      user: "Entirely late question",
      assistant: "Entirely late answer",
    }]);
  });

  it("reapplies the transcript limit after a late turn expands", () => {
    let state = createRealtimeProtocolState();
    for (const id of ["user-1", "user-2"] as const) {
      state = reduceRealtimeServerEvent(state, {
        type: "input_audio_buffer.speech_started",
        item_id: id,
      });
      state = reduceRealtimeServerEvent(state, {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: id,
        transcript: id + "x".repeat(2_995),
      });
    }
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-3",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "input_audio_buffer.speech_started",
      item_id: "user-4",
    });
    state = reduceRealtimeServerEvent(state, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-3",
      transcript: "user-3" + "z".repeat(3_993),
    });

    expect(state.turns.reduce(
      (total, turn) => total + turn.user.length + turn.assistant.length,
      0,
    )).toBeLessThanOrEqual(8_000);
    expect(state.turns.at(-1)?.user).toContain("user-3");
  });

  it("bounds archived exchanges by turn count and character count", () => {
    let state = createRealtimeProtocolState();
    for (let index = 0; index < 14; index += 1) {
      state = reduceRealtimeServerEvent(state, {
        type: "conversation.item.input_audio_transcription.completed",
        transcript: `q${index}${"x".repeat(1_000)}`,
      });
      state = reduceRealtimeServerEvent(state, {
        type: "response.output_text.delta",
        delta: `a${index}${"y".repeat(1_000)}`,
      });
      state = reduceRealtimeServerEvent(state, {
        type: "input_audio_buffer.speech_started",
      });
    }

    expect(state.turns.length).toBeLessThanOrEqual(12);
    expect(state.turns.reduce(
      (total, turn) => total + turn.user.length + turn.assistant.length,
      0,
    )).toBeLessThanOrEqual(8_000);
    expect(state.turns.at(-1)?.user).toContain("q13");
  });

  it("turns server errors into a bounded local error", () => {
    const state = reduceRealtimeServerEvent(
      createRealtimeProtocolState(),
      { type: "error", error: { message: "x".repeat(400) } },
    );
    expect(state.phase).toBe("error");
    expect(state.error?.length).toBeLessThanOrEqual(160);
  });
});
