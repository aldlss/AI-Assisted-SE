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
      <AppBar
          position="sticky"
          color="default"
          elevation={1}
          sx={{
              mb: 3,
              borderRadius: 2,
              backgroundColor: "var(--neutral-100)",
              color: "var(--neutral-900)",
          }}>
          <Toolbar
              sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: { xs: 2, md: 3 },
              }}>
              <Link
                  href="/"
                  style={{ textDecoration: "none", color: "inherit" }}>
                  <Typography
                      variant="h6"
                      fontWeight={800}
                      className="hero-gradient-text">
                      AI 旅行规划师
                  </Typography>
              </Link>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                      variant="text"
                      color="inherit"
                      component={Link}
                      href="/trips">
                      我的行程
                  </Button>
                  <Button
                      variant="contained"
                      color="primary"
                      component={Link}
                      href="/settings"
                      sx={{ borderRadius: 999 }}>
                      设置
                  </Button>
                  <UserMenu />
              </Box>
          </Toolbar>
      </AppBar>
  );
}
