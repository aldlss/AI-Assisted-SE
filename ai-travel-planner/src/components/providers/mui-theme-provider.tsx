"use client";
import { PropsWithChildren, useMemo } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export function MUIThemeProvider({ children }: PropsWithChildren) {
    // 主题：现代配色、圆角、细节动效与组件默认值
    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: "light",
                    // 使用十六进制避免 MUI 计算通道时报错；组件内部仍可用 CSS 变量
                    primary: {
                        main: "#3DE0D3", // var(--primary-500)
                        light: "#99F8FB", // var(--primary-300)
                        dark: "#0C836C", // var(--primary-700)
                        contrastText: "#FAFCFC", // var(--neutral-100)
                    },
                    secondary: {
                        main: "#93E81C", // var(--accent-500)
                        light: "#BEFC87", // var(--accent-300)
                        dark: "#5F8702", // var(--accent-700)
                        contrastText: "#FAFCFC",
                    },
                    error: { main: "#EF4444" },
                    warning: { main: "#F59E0B" },
                    info: { main: "#0EA5E9" },
                    success: { main: "#10B981" },
                    background: { default: "#FAFCFC", paper: "#FFFFFF" },
                    text: { primary: "#222625", secondary: "#6F7877" },
                    divider: "#DCE2E3",
                },
                shape: { borderRadius: 14 },
                typography: {
                    fontFamily: `var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`,
                    h1: { fontWeight: 700 },
                    h2: { fontWeight: 700 },
                    h3: { fontWeight: 700 },
                    button: { textTransform: "none", fontWeight: 600 },
                },
                components: {
                    MuiCard: {
                        defaultProps: { elevation: 1 },
                        styleOverrides: {
                            root: ({ theme }) => ({
                                borderRadius:
                                    Number(theme.shape.borderRadius) + 2,
                            }),
                        },
                    },
                    MuiChip: {
                        defaultProps: { variant: "outlined", color: "default" },
                        styleOverrides: {
                            root: {
                                backgroundColor: "var(--primary-100)",
                                color: "var(--neutral-900)",
                                borderColor: "var(--primary-300)",
                                fontWeight: 600,
                            },
                            outlined: { borderColor: "var(--primary-300)" },
                            filled: {
                                backgroundColor: "var(--primary-300)",
                                color: "var(--neutral-900)",
                            },
                        },
                    },
                    MuiAlert: {
                        styleOverrides: {
                            root: { borderRadius: 12 },
                            standardInfo: {
                                backgroundColor: "var(--primary-100)",
                                color: "var(--neutral-900)",
                                border: "1px solid var(--primary-300)",
                            },
                            standardSuccess: {
                                backgroundColor: "var(--accent-100)",
                                color: "var(--neutral-900)",
                                border: "1px solid var(--accent-300)",
                            },
                            standardWarning: {
                                backgroundColor: "#FFF7E6",
                                color: "#8A6116",
                                border: "1px solid #F7D7A1",
                            },
                            standardError: {
                                backgroundColor: "#FFECEC",
                                color: "#A12828",
                                border: "1px solid #FFB3B3",
                            },
                            filledInfo: {
                                backgroundColor: "var(--primary-500)",
                                color: "var(--neutral-900)",
                            },
                            filledSuccess: {
                                backgroundColor: "var(--accent-500)",
                                color: "var(--neutral-900)",
                            },
                            filledWarning: {
                                backgroundColor: "#F59E0B",
                                color: "#fff",
                            },
                            filledError: {
                                backgroundColor: "#EF4444",
                                color: "#fff",
                            },
                        },
                    },
                    MuiBadge: {
                        styleOverrides: {
                            badge: {
                                backgroundColor: "var(--primary-500)",
                                color: "var(--neutral-900)",
                            },
                        },
                    },
                    MuiTooltip: {
                        styleOverrides: {
                            tooltip: {
                                backgroundColor: "var(--neutral-900)",
                                color: "var(--neutral-100)",
                                borderRadius: 10,
                            },
                            arrow: { color: "var(--neutral-900)" },
                        },
                    },
                    MuiToggleButton: {
                        styleOverrides: {
                            root: {
                                borderColor: "var(--neutral-300)",
                                "&.Mui-selected": {
                                    backgroundColor: "var(--primary-100)",
                                    color: "var(--neutral-900)",
                                    borderColor: "var(--primary-300)",
                                },
                            },
                        },
                    },
                    MuiMenu: {
                        styleOverrides: {
                            paper: {
                                borderRadius: 12,
                                border: "1px solid var(--neutral-300)",
                            },
                        },
                    },
                    MuiMenuItem: {
                        styleOverrides: {
                            root: {
                                "&.Mui-selected, &.Mui-selected:hover": {
                                    backgroundColor: "var(--primary-100)",
                                },
                            },
                        },
                    },
                    MuiDivider: {
                        styleOverrides: {
                            root: { borderColor: "var(--neutral-300)" },
                        },
                    },
                    MuiIconButton: {
                        styleOverrides: {
                            root: {
                                color: "var(--neutral-800)",
                                "&:hover": {
                                    backgroundColor: "var(--primary-100)",
                                },
                            },
                        },
                    },
                    MuiPaper: {
                        styleOverrides: {
                            root: () => ({
                                backgroundImage: "none",
                            }),
                        },
                    },
                    MuiAppBar: {
                        styleOverrides: {
                            root: () => ({
                                backgroundImage: "none",
                            }),
                        },
                    },
                },
            }),
        []
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
