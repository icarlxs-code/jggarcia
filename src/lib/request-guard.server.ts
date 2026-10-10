/** Blocks scripted requests from other sites before they touch the database. */
export async function guardRequest() {
  const { assertSameSiteRequest } = await import("./auth/isolation.server");
  assertSameSiteRequest();
}
