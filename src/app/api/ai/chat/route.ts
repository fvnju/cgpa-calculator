import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { env } from "~/env";

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, transcript } = (await req.json()) as {
    messages: UIMessage[];
    transcript: string;
  };

  const systemPrompt = `You are GradeGuru, an academic advisor AI assistant embedded in a CGPA calculator app for Nigerian university students using a 5.0 grading scale (A=5, B=4, C=3, D=2, E=1, F=0).

Your role is to help students understand their academic performance, identify areas for improvement, and provide actionable advice.

Here is the student's current academic transcript data:

${transcript}

Guidelines:
- Be concise, warm, and encouraging but honest
- Reference specific courses or semesters from the transcript when relevant
- Give practical, actionable advice
- When calculating GPAs or CGPAs, use the 5.0 scale
- If the transcript is empty, encourage the student to add their courses
- Keep responses focused and digestible — avoid walls of text`;

  const result = streamText({
    model: google("gemini-3-flash-preview"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
