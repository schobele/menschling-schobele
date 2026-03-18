import { openai } from "../../../lib/openai.ts";

export async function summarizeDoc(
  title: string,
  content: string,
): Promise<{ summary: string; outline: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize the following document in 1-2 sentences. Then provide a brief outline (max 5 bullet points). Return JSON: { summary, outline }",
      },
      { role: "user", content: `# ${title}\n\n${content.slice(0, 4000)}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    return {
      summary: parsed.summary ?? "",
      outline: typeof parsed.outline === "string" ? parsed.outline : JSON.stringify(parsed.outline ?? []),
    };
  } catch {
    return { summary: "", outline: "" };
  }
}
