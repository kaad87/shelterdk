import { handleImageRequest } from "../_shared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleImageRequest(req);
}
