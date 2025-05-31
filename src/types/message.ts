import z from "zod";

export const zImageMessage = z.object({
  text: z.string(),
  image: z.string(),
});

const zMessageBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ping"),
    message: z.string(),
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("say"),
    message: z.string(),
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("whisper"),
    message: z.string(),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("join"),
    message: z.string(),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("leave"),
    message: z.string(),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("rooms"),
    message: z.string(),
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("image"),
    message: zImageMessage,
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("listen"),
    message: z.string(),
    userId: z.string().optional(),
  }),
]);

// export const zMessageBody = z.object({
//   message: z.string(),
//   action: z.enum(["ping", "say", "whisper", "join", "leave", "rooms"]),
//   userId: z.string().optional(),
// });

export type ImageMessage = z.infer<typeof zImageMessage>;

export type MessageBody = z.infer<typeof zMessageBody>;
