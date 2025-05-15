export interface Room {
  name: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  joinCode: string;
  ownerId: string;
}
