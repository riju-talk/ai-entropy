/** Error carrying the HTTP status so callers can react to 401 (sign in) or 503 (database down). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** fetch + JSON with a readable error. Network failures and non-JSON error pages become friendly messages. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  let res: Response
  try {
    res = await fetch(url, {
      cache: "no-store",
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.")
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`)
  return data as T
}
