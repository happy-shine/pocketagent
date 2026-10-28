import { describe, expect, it } from "vitest";
import {
  extractEmbedText,
  extractDiscordAttachments,
  extractSnapshotDetails,
} from "../channels/discord/adapter.js";

describe("extractEmbedText", () => {
  it("returns empty string for empty or undefined embeds", () => {
    expect(extractEmbedText()).toBe("");
    expect(extractEmbedText([])).toBe("");
  });

  it("extracts title and description", () => {
    const embeds = [
      { title: "Morgan Stanley Note", description: "32GW power shortage forecast" },
    ];
    expect(extractEmbedText(embeds)).toBe("Morgan Stanley Note\n\n32GW power shortage forecast");
  });

  it("extracts fields", () => {
    const embeds = [
      {
        title: "Market Report",
        fields: [
          { name: "Target", value: "IWM" },
          { name: "Signal", value: "Long" },
        ],
      },
    ];
    expect(extractEmbedText(embeds)).toBe("Market Report\n\nTarget: IWM\n\nSignal: Long");
  });

  it("extracts author, url, footer, and image-only embeds", () => {
    const tweetEmbed = [
      {
        author: { name: "Nick Timiraos (@NickTimiraos)", url: "https://x.com/NickTimiraos" },
        title: "Fed Preview",
        url: "https://x.com/NickTimiraos/status/123",
        description: "Rates expected to hold",
        footer: { text: "Twitter • Today" },
      },
    ];
    expect(extractEmbedText(tweetEmbed)).toBe(
      "Nick Timiraos (@NickTimiraos) (https://x.com/NickTimiraos)\n\nFed Preview (https://x.com/NickTimiraos/status/123)\n\nRates expected to hold\n\nTwitter • Today",
    );

    const imageOnlyEmbed = [{ image: { url: "https://cdn.discordapp.com/attachments/1/chart.png" } }];
    expect(extractEmbedText(imageOnlyEmbed)).toBe("[Embed Image: https://cdn.discordapp.com/attachments/1/chart.png]");
  });
});

describe("extractDiscordAttachments", () => {
  it("handles empty or missing attachments", () => {
    expect(extractDiscordAttachments()).toEqual([]);
    expect(extractDiscordAttachments([])).toEqual([]);
    expect(extractDiscordAttachments(new Map())).toEqual([]);
  });

  it("extracts photo, audio, voice, and document attachments", () => {
    const map = new Map<string, any>([
      [
        "1",
        {
          url: "https://cdn.discordapp.com/attachments/1/img.png",
          name: "img.png",
          contentType: "image/png",
        },
      ],
      [
        "2",
        {
          url: "https://cdn.discordapp.com/attachments/1/audio.mp3",
          name: "audio.mp3",
          contentType: "audio/mpeg",
        },
      ],
      [
        "3",
        {
          url: "https://cdn.discordapp.com/attachments/1/voice.ogg",
          name: "voice.ogg",
          contentType: "audio/ogg",
          waveform: "AQIDBA==",
        },
      ],
      [
        "4",
        {
          url: "https://cdn.discordapp.com/attachments/1/doc.pdf",
          name: "doc.pdf",
          contentType: "application/pdf",
        },
      ],
    ]);

    const result = extractDiscordAttachments(map);
    expect(result).toEqual([
      {
        type: "photo",
        fileId: "https://cdn.discordapp.com/attachments/1/img.png",
        fileName: "img.png",
        mimeType: "image/png",
      },
      {
        type: "audio",
        fileId: "https://cdn.discordapp.com/attachments/1/audio.mp3",
        fileName: "audio.mp3",
        mimeType: "audio/mpeg",
      },
      {
        type: "voice",
        fileId: "https://cdn.discordapp.com/attachments/1/voice.ogg",
        fileName: "voice.ogg",
        mimeType: "audio/ogg",
      },
      {
        type: "document",
        fileId: "https://cdn.discordapp.com/attachments/1/doc.pdf",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
      },
    ]);
  });
});

describe("extractSnapshotDetails", () => {
  it("handles undefined or empty snapshots", () => {
    expect(extractSnapshotDetails()).toEqual({ text: "", attachments: [] });
    expect(extractSnapshotDetails([])).toEqual({ text: "", attachments: [] });
    expect(extractSnapshotDetails(new Map())).toEqual({ text: "", attachments: [] });
  });

  it("extracts text from snapshot content", () => {
    const snapshots = new Map([
      [
        "1557320631899529237",
        {
          id: "1557320631899529237",
          content: "美国数据中心到2028年或面临32GW电力缺口，ASIC、存储和光模块供应链承压",
          embeds: [],
          attachments: new Map(),
        },
      ],
    ]);

    const result = extractSnapshotDetails(snapshots);
    expect(result.text).toBe("美国数据中心到2028年或面临32GW电力缺口，ASIC、存储和光模块供应链承压");
    expect(result.attachments).toEqual([]);
  });

  it("extracts embeds and attachments from snapshot", () => {
    const snapshots = [
      {
        content: "Check this report:",
        embeds: [{ title: "Power Shortage", description: "Details..." }],
        attachments: [
          {
            url: "https://cdn.discordapp.com/attachments/1/chart.png",
            name: "chart.png",
            contentType: "image/png",
          },
        ],
      },
    ];

    const result = extractSnapshotDetails(snapshots);
    expect(result.text).toBe("Check this report:\n\nPower Shortage\n\nDetails...");
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toEqual({
      type: "photo",
      fileId: "https://cdn.discordapp.com/attachments/1/chart.png",
      fileName: "chart.png",
      mimeType: "image/png",
    });
  });

  it("handles snapshots with only attachments and no text", () => {
    const snapshots = [
      {
        content: "",
        embeds: [],
        attachments: [
          {
            url: "https://cdn.discordapp.com/attachments/1/photo.jpg",
            name: "photo.jpg",
            contentType: "image/jpeg",
          },
        ],
      },
    ];

    const result = extractSnapshotDetails(snapshots);
    expect(result.text).toBe("[photo: photo.jpg]");
    expect(result.attachments).toHaveLength(1);
  });

  it("joins multiple snapshots with separator", () => {
    const snapshots = [
      { content: "First forwarded message", embeds: [], attachments: [] },
      { content: "Second forwarded message", embeds: [], attachments: [] },
    ];

    const result = extractSnapshotDetails(snapshots);
    expect(result.text).toBe("First forwarded message\n\n---\n\nSecond forwarded message");
  });

  it("includes author and timestamp header when present on snapshot", () => {
    const ts = new Date(2026, 9, 27, 6, 30).getTime();
    const snapshots = [
      {
        author: { displayName: "Trader Frank", username: "frank" },
        createdTimestamp: ts,
        content: "Watching 6450 support",
        embeds: [],
        attachments: [],
      },
    ];
    const result = extractSnapshotDetails(snapshots);
    expect(result.text).toBe("[Trader Frank | 2026-10-27 06:30]\nWatching 6450 support");
  });
});
