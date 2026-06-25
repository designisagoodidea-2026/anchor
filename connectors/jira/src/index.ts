import { toChangeEvent, type JiraInput } from "./classify";

export interface Env {
  SOURCE: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return json({
        status: "ok",
        source: env.SOURCE,
        version: "0.1",
        mode: "skeleton",
      });
    }

    if (url.pathname === "/classify" && request.method === "POST") {
      const payload = (await request.json()) as JiraInput;
      const event = toChangeEvent(payload);
      return json({ event });
    }

    return new Response(
      "Anchor Jira connector skeleton\nEndpoints: GET /healthz, POST /classify\n",
      { headers: { "content-type": "text/plain" } }
    );
  },
};

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
