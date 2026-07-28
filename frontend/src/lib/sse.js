export async function streamGeneration(jobId, model, onEvent) {
  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/jobs/${jobId}/generate/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok || !res.body) throw new Error(`Generation failed (HTTP ${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      if (onEvent(JSON.parse(line.slice(6))) === false) finished = true;
    }
  }
}
