import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";

// 服务器组件：只渲染结构；用户登录状态由客户端组件读取并展示，避免在 RSC 中写 cookies
export default function AppHeader() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <Link href="/" className="text-2xl font-semibold">
        AI 旅行规划师
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link className="text-blue-600 hover:underline" href="/trips">
          我的行程
        </Link>
        <Link className="text-blue-600 hover:underline" href="/settings">
          设置
        </Link>
        <UserMenu />
      </nav>
    </header>
  );
}
