import { getRedirectPath, logout } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/router";

export function useAuth() {
    const {user, accessToken, isLoading, clearAuth} = useAuthStore();
    const router = useRouter();

    const isAuthenticated = !!accessToken && !!user;

    const handleLogout = async () =>{
        await logout();
        router.push("/login");
    };

    const redirectAfterLogin = (role: string) => {
        router.push(getRedirectPath(role));
    };

    return {
        user, 
        isAuthenticated,
        isLoading,
        handleLogout,
        redirectAfterLogin,
    };
}