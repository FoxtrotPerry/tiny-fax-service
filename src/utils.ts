import type { MessageBody } from "./types/message";

export function send({
  socket,
  payload,
}: {
  socket: WebSocket | null;
  payload: MessageBody;
}) {
  const payloadString = JSON.stringify(payload);
  socket?.send(payloadString);
}
