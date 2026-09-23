import { startFakeSupabase } from "../tests/support/fake-supabase";
import { FAKE_SUPABASE_PORT } from "./constants";

export default async function globalSetup() {
  const fake = await startFakeSupabase(FAKE_SUPABASE_PORT);
  return async () => {
    await fake.close();
  };
}
