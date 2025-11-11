"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"login" | "register">("login");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    // 若已登录或登录状态变化，自动跳转到首页，避免停留在登录页
    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                window.location.replace("/");
            }
        });
        const { data: sub } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session) {
                    window.location.replace("/");
                }
            }
        );
        return () => {
            sub.subscription.unsubscribe();
        };
    }, []);
    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const initialError = params.get("error");
        if (initialError && !error) {
            // 使用微任务推迟 setState，避免在 render 期间触发
            queueMicrotask(() => setError(initialError));
        }
    }

    async function submit() {
        setError(null);
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            if (mode === "register") {
                const { error: signUpErr } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: undefined }, // 不做邮箱验证
                });
                if (signUpErr) return setError(signUpErr.message);
                // 注册成功后直接尝试登录，若自动登录失败再手动登录
                const { error: loginErr } =
                    await supabase.auth.signInWithPassword({ email, password });
                if (loginErr) return setError(loginErr.message);
                window.location.replace("/");
            } else {
                const { error: loginErr } =
                    await supabase.auth.signInWithPassword({ email, password });
                if (loginErr) return setError(loginErr.message);
                window.location.replace("/");
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Card variant="outlined">
                <CardHeader title={mode === "login" ? "登录" : "注册"} />
                <CardContent sx={{ display: "grid", gap: 2 }}>
                    <TextField
                        label="邮箱"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="密码"
                        type={showPassword ? "text" : "password"}
                        placeholder="至少 6 位"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={
                                            showPassword
                                                ? "隐藏密码"
                                                : "显示密码"
                                        }
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
                                        edge="end">
                                        {showPassword ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={submit}
                        disabled={!email || !password || loading}
                        fullWidth>
                        {loading
                            ? mode === "login"
                                ? "登录中..."
                                : "注册中..."
                            : mode === "login"
                            ? "登录"
                            : "注册"}
                    </Button>
                    {error && (
                        <Alert severity="error" variant="outlined">
                            {error}
                        </Alert>
                    )}
                    <Button
                        variant="text"
                        onClick={() => {
                            setMode(mode === "login" ? "register" : "login");
                            setError(null);
                        }}
                        sx={{ justifySelf: "start" }}>
                        {mode === "login"
                            ? "没有账号？注册一个"
                            : "已有账号？直接登录"}
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                        {mode === "login"
                            ? "输入已注册邮箱与密码登录。"
                            : "注册后直接登录，无需邮箱验证。"}
                    </Typography>
                </CardContent>
            </Card>
        </Container>
    );
}
