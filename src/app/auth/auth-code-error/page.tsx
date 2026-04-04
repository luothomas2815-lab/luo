import Link from "next/link";

export const metadata = {
  title: "验证失败",
};

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-lg font-semibold text-zinc-900">登录验证失败</h1>
      <p className="mt-2 text-sm text-zinc-600">
        链接可能已过期或无效，请返回重新登录或重发验证邮件。
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block text-sm text-zinc-900 underline"
      >
        返回登录
      </Link>
    </div>
  );
}
