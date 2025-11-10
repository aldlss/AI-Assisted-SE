"use client";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

// 客户端组件：使用 MUI AppBar 提供全局导航，避免 RSC 传递函数报错
export default function AppHeader() {
  return (
    <AppBar position="static" color="default" elevation={0} sx={{ mb: 3 }}>
      <Toolbar sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Typography variant="h6" fontWeight={600}>AI 旅行规划师</Typography>
        </Link>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button color="primary" component={Link} href="/trips">我的行程</Button>
          <Button color="primary" component={Link} href="/settings">设置</Button>
          <UserMenu />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
