import { paypalCredentials } from "@/lib/env";
import { handleError, json } from "@/lib/http";

/** The client id is public by design; the secret never leaves the server. */
export async function GET() {
  try {
    return json({ clientId: paypalCredentials().clientId });
  } catch (error) {
    return handleError(error);
  }
}
