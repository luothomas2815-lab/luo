import { getConversationWithMessages } from "@/lib/coach/storage";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      JSON.stringify({
        error: "请先登录后再查看会话。",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  const conversation = await getConversationWithMessages(user.id, conversationId);
  if (!conversation) {
    return new Response(
      JSON.stringify({
        error: "会话不存在或无访问权限。",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      conversationId: conversation.id,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
        safetyFlag: message.safety_flag,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}
