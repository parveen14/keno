// Wraps a delete call so a Postgres FK violation (23503) becomes a friendly 400
// instead of a raw 500, for the cases where we don't pre-check references ourselves.
export async function guardedDelete(fn, friendlyMessage) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === '23503') {
      throw Object.assign(new Error(friendlyMessage), { status: 400 });
    }
    throw err;
  }
}
