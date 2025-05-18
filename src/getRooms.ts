import axios, { AxiosError } from "axios";
import type { Room } from "./types/room";
import { env } from "./env";

/**
 * Get the user's available rooms
 */
export const getRooms = async (token: string) => {
  let rooms: Room[] = [];

  try {
    const availableRooms = await axios.get<Room[]>(`${env.TF_API_URL}/room`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    rooms = availableRooms.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error("TF: Failed to get available rooms!");
      console.error(error.message);
      console.error(error.status, error.response?.data);
      process.exit(1);
    }
  }

  if (rooms.length === 0) {
    console.error("TF: No rooms found for user!");
    process.exit(1);
  }

  return rooms;
};
